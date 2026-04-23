FROM node:22-alpine AS build

WORKDIR /app

COPY package.json ./
COPY tsconfig.json ./
COPY tsconfig.node.json ./
COPY vite.config.ts ./
COPY tailwind.config.ts ./
COPY postcss.config.cjs ./
COPY index.html ./
COPY src ./src

RUN npm install

ARG VITE_DEFAULT_API_BASE_URL=https://api.nexiuslabs.com
ENV VITE_DEFAULT_API_BASE_URL=$VITE_DEFAULT_API_BASE_URL

RUN npm run build

FROM nginx:1.29-alpine AS runtime

COPY infra/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
