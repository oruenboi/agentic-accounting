FROM node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 AS build

WORKDIR /workspace

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json

RUN npm ci

COPY apps/web ./apps/web

ARG VITE_DEFAULT_API_BASE_URL=https://api.nexiuslabs.com
ENV VITE_DEFAULT_API_BASE_URL=$VITE_DEFAULT_API_BASE_URL

RUN npm run build:web

FROM nginx:1.29-alpine@sha256:5616878291a2eed594aee8db4dade5878cf7edcb475e59193904b198d9b830de AS runtime

ARG BUILD_REVISION=unknown

LABEL org.opencontainers.image.source="https://github.com/oruenboi/agentic-accounting" \
      org.opencontainers.image.revision=$BUILD_REVISION

COPY apps/web/infra/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/apps/web/dist /usr/share/nginx/html
