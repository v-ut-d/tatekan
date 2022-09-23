FROM node:16-alpine AS builder

WORKDIR /app
RUN npm i -g pnpm

COPY ./*.* ./

RUN sed '/prepare/d' -i package.json
RUN pnpm i --frozen-lockfile

COPY ./src ./src
RUN pnpm build


FROM node:16-alpine AS runner

WORKDIR /app

COPY --from=builder /app/dist/main.cjs main.js

CMD ["node", "main.js"]
