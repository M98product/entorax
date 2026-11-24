// Chat function for Vercel, powered by Groq.
// Needs the GROQ_API_KEY environment variable (Vercel > Settings > Environment Variables).
// Optional: GROQ_MODEL to change the model without touching the code.

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const MAX_TURNS = 16;
const MAX_CHARS = 4000;

const ROLES = {
  team: "the Entorax Team coordinator. You speak for four specialists (Strategist, Designer, CFO, Legal). For a new idea, give a quick verdict, then one line per specialist on what they would do first, labelled with their name.",
  strategist: "the Strategist. You handle market sizing, target customers, competitors, positioning and pricing.",
  designer: "the Designer. You handle naming, brand identity, tone of voice and landing page structure.",
  cfo: "the CFO. You handle cost structure, revenue model, simple forecasts, break-even and funding options, including community raising with an on-chain project wallet.",
  legal: "Legal. You explain company types, setup steps, required documents and common pitfalls, in general terms, noting that rules depend on the country.",
};

const systemPrompt = (agent) => `You are ${ROLES[agent]} You work at Entorax, an AI co-founder platform that helps people turn an idea into a real business, with project wallets on Robinhood Chain.
Rules:
- Reply in the same language as the user's last message.
- Be concrete and practical. Keep answers under 180 words.
- Use short lines and "- " bullet lists. You may bold key words with **double asterisks**. No headings, no tables.
- Label any number you estimate as an estimate. Never invent facts about the user.
- For legal or financial matters, give general guidance and recommend checking with a qualified professional.
- Never promote a token, promise returns or give investment advice.
- End with one short follow-up question that moves the project forward.`;

// Keep only valid turns, merge consecutive same-role turns, start and end on a user turn.
function cleanMessages(raw) {
  if (!Array.isArray(raw)) return null;
  const out = [];
  for (const m of raw.slice(-MAX_TURNS)) {
    if (!m || (m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string") continue;
    const content = m.content.slice(0, MAX_CHARS).trim();
    if (!content) continue;
    const last = out[out.length - 1];
    if (last && last.role === m.role) last.content += "\n\n" + content;
    else out.push({ role: m.role, content });
  }
  while (out.length && out[0].role !== "user") out.shift();
  if (!out.length || out[out.length - 1].role !== "user") return null;
  return out;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Use POST." });
  }
  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: "GROQ_API_KEY is missing on the server." });
  }

  const { agent, messages } = req.body || {};
  const cleaned = cleanMessages(messages);
  if (!ROLES[agent] || !cleaned) {
    return res.status(400).json({ error: "Send an agent name and a conversation ending with a user message." });
  }

  const ctl = new AbortController();
  req.on("close", () => ctl.abort());

  let upstream;
  try {
    upstream = await fetch(GROQ_URL, {
      method: "POST",
      signal: ctl.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        stream: true,
        max_tokens: 1200,
        temperature: 0.6,
        messages: [{ role: "system", content: systemPrompt(agent) }, ...cleaned],
      }),
    });
  } catch (err) {
    if (ctl.signal.aborted) return res.end();
    console.error("groq fetch failed", err);
    return res.status(502).json({ error: "Could not reach Groq." });
  }

  if (!upstream.ok || !upstream.body) {
    const raw = await upstream.text().catch(() => "");
    console.error("groq error", upstream.status, raw);
    let detail = "";
    try { detail = JSON.parse(raw).error?.message || ""; } catch {}
    return res.status(upstream.status === 429 ? 429 : 502).json({ error: `Groq ${upstream.status}: ${detail || "no details"}`.slice(0, 300) });
  }

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");

  // Groq streams Server-Sent Events: lines "data: {json}", ending with "data: [DONE]".
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for await (const chunk of upstream.body) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();
      for (const line of lines) {
        const data = line.trim();
        if (!data.startsWith("data:")) continue;
        const payload = data.slice(5).trim();
        if (payload === "[DONE]") continue;
        try {
          const text = JSON.parse(payload).choices?.[0]?.delta?.content;
          if (text) res.write(text);
        } catch {
          // ignore a malformed line
        }
      }
    }
  } catch (err) {
    if (!ctl.signal.aborted) console.error("groq stream error", err);
  }
  res.end();
}
