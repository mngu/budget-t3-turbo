# Le bundle nitro (`.output`, preset node-server) est autonome : ses dépendances
# sont soit tracées dans `.output/server/node_modules`, soit inlinées dans les
# chunks (`pg` et le SDK Anthropic le sont), et aucune n'a de binaire natif.
# L'image n'a donc besoin ni de pnpm, ni du monorepo, ni d'une étape de build :
# `pnpm build` à la racine produit le contexte, `deploy.sh` le pousse ici.
FROM node:22-alpine

WORKDIR /app
COPY .output ./

# DATA_DIR : hors du monorepo, la remontée relative de data-dir.ts ne désigne
# plus la racine (voir packages/api/src/lib/data-dir.ts). Volume côté compose.
ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/data

EXPOSE 3000
CMD ["node", "server/index.mjs"]
