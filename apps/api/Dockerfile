FROM node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 AS build

WORKDIR /workspace

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json

RUN npm ci

COPY apps/api ./apps/api

RUN npm run build:api

FROM node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 AS runtime

WORKDIR /workspace

ARG BUILD_REVISION=unknown

ENV NODE_ENV=production
ENV PORT=3000

LABEL org.opencontainers.image.source="https://github.com/oruenboi/agentic-accounting" \
      org.opencontainers.image.revision=$BUILD_REVISION

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json

RUN npm ci --omit=dev --workspace @agentic-accounting/api --include-workspace-root \
    && npm cache clean --force

COPY --from=build /workspace/apps/api/dist ./apps/api/dist

EXPOSE 3000

CMD ["node", "apps/api/dist/main.js"]
