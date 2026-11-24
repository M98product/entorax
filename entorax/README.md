# Entorax

Site Entorax : page d'accueil 3D, onglets (How it works, AI Space, $ENTORAX, Docs) et chat avec 4 agents IA propulsé par Claude.

## Contenu

| Fichier | Rôle |
|---|---|
| `index.html` | Le site complet (design, 3D, chat) |
| `api/chat.js` | Fonction serveur Vercel qui parle à Claude. La clé API reste ici, jamais dans le navigateur |
| `package.json` | Dépendance : SDK Anthropic |
| `vercel.json` | Laisse jusqu'à 60 s à une réponse du chat |

## Mettre en ligne

1. Crée une clé API sur https://platform.claude.com (section API Keys) et ajoute du crédit.
2. Mets ce dossier sur GitHub (nouveau dépôt, puis « Add file » → « Upload files »). N'envoie pas `node_modules`.
3. Sur https://vercel.com : « Add New » → « Project » → importe le dépôt. Laisse les réglages par défaut.
4. Avant de cliquer sur Deploy, ouvre « Environment Variables » et ajoute :
   - Name : `ANTHROPIC_API_KEY`
   - Value : ta clé (commence par `sk-ant-`)
5. Clique sur Deploy. Le chat marche sur l'adresse que Vercel te donne.

Si tu ajoutes la clé après le premier déploiement, relance un déploiement (Deployments → ⋯ → Redeploy).

## Réglages utiles

- **Adresse du contrat** : dans `index.html`, cherche `CONTRACT_ADDRESS = ""` et colle l'adresse entre les guillemets le jour du lancement.
- **Modèle et coût** : dans `api/chat.js`, `MODEL` vaut `claude-opus-5-5` avec `effort: "low"` pour des réponses rapides. Chaque message est facturé sur ton compte Anthropic.
- **Instructions des agents** : la liste `ROLES` et la fonction `systemPrompt` dans `api/chat.js`.

## Tester en local

```bash
npm install
npx vercel dev
```

Mets ta clé dans un fichier `.env.local` (`ANTHROPIC_API_KEY=sk-ant-...`). Ce fichier est ignoré par Git.
