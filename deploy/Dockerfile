# deploy.sh uploads the self-contained Nitro build, including traced dependencies.
FROM node:22-alpine

WORKDIR /app
COPY .output ./

# Bundled code cannot resolve the monorepo data path; Compose mounts persistent storage here.
ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/data

EXPOSE 3000
CMD ["node", "server/index.mjs"]
