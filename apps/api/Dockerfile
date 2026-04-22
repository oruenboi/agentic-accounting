FROM node:22-alpine AS build

WORKDIR /app

COPY package.json ./
COPY tsconfig.json ./
COPY nest-cli.json ./

RUN npm install

COPY src ./src

RUN npm run build

FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package.json ./

RUN npm install --omit=dev

COPY --from=build /app/dist ./dist

EXPOSE 3000

CMD ["npm", "run", "start"]
