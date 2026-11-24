import Anthropic from "@anthropic-ai/sdk";

// Reads ANTHROPIC_API_KEY from the Vercel environment variables.
const client = new Anthropic();

const MODEL = "claude-opus-5-5";
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

  const { agent, messages } = req.body || {};
  const cleaned = cleanMessages(messages);
  if (!ROLES[agent] || !cleaned) {
    return res.status(400).json({ error: "Send an agent name and a conversation ending with a user message." });
  }

  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 4000,
    system: systemPrompt(agent),
    output_config: { effort: "low" },
    // If the model declines, the API retries the request on a fallback model automatically.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    messages: cleaned,
  });
  req.on("close", () => stream.abort());

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");

  try {
    for await (const event of stream) {
      if (event.type === "content_block_start" && event.content_block.type === "fallback") {
        res.write("\n\n");
      } else if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        res.write(event.delta.text);
      }
    }
    const final = await stream.finalMessage();
    if (final.stop_reason === "refusal") {
      res.write("\n\nThe agent can't help with that request. Try asking another way.");
    }
    res.end();
  } catch (err) {
    if (err instanceof Anthropic.APIUserAbortError) return res.end();
    console.error("chat error", err);
    // Headers go out with the first chunk: before that we can still answer with a proper error status.
    const status = err instanceof Anthropic.RateLimitError ? 429 : 502;
    if (!res.headersSent) return res.status(status).json({ error: "The agent couldn't answer." });
    res.end();
  }
}
