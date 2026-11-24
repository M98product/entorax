# Entorax

Site Entorax : page d'accueil 3D, onglets (How it works, AI Space, $ENTORAX, Docs) et chat avec 4 agents IA propulsé par Groq.

## Contenu

| Fichier | Rôle |
|---|---|
| `index.html` | Le site complet (design, 3D, chat) |
| `api/chat.js` | Fonction serveur Vercel qui parle à Groq. La clé API reste ici, jamais dans le navigateur |
| `package.json` | Configuration Node (aucune dépendance) |
| `vercel.json` | Laisse jusqu'à 60 s à une réponse du chat |

## Mettre en ligne

1. Crée une clé API gratuite sur https://console.groq.com (API Keys → Create API Key).
2. Mets ce dossier sur GitHub (nouveau dépôt, puis « Add file » → « Upload files »).
3. Sur https://vercel.com : « Add New » → « Project » → importe le dépôt. Laisse les réglages par défaut.
4. Avant de cliquer sur Deploy, ouvre « Environment Variables » et ajoute :
   - Name : `GROQ_API_KEY`
   - Value : ta clé Groq (commence par `gsk_`)
5. Clique sur Deploy. Le chat marche sur l'adresse que Vercel te donne.

Si tu ajoutes la clé après le premier déploiement, relance un déploiement (Deployments → ⋯ → Redeploy).

## Réglages utiles

- **Adresse du contrat** : dans `index.html`, cherche `CONTRACT_ADDRESS = ""` et colle l'adresse entre les guillemets le jour du lancement.
- **Modèle** : par défaut `llama-3.3-70b-versatile`. Si Groq l'a retiré, choisis un modèle dans https://console.groq.com/docs/models et ajoute sur Vercel la variable `GROQ_MODEL` avec son nom (puis Redeploy). Le quota gratuit de Groq est limité : au-delà, le chat répond « Too many messages ».
- **Instructions des agents** : la liste `ROLES` et la fonction `systemPrompt` dans `api/chat.js`.

## Tester en local

```bash
npx vercel dev
```

Mets ta clé dans un fichier `.env.local` (`GROQ_API_KEY=gsk_...`). Ce fichier est ignoré par Git.
