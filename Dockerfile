# ビルドステージ
FROM node:23-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl openssl-dev

# docker-compose.yml から渡されるビルド引数を宣言
ARG DATABASE_URL_BUILD

COPY package*.json ./
COPY prisma ./prisma

# prisma generate 用の一時的な .env を作成
RUN echo "DATABASE_URL=${DATABASE_URL_BUILD}" > .env.build-tmp

RUN npm install
# Prismaクライアントを生成 (上記で作成した一時 .env を参照)
RUN npx prisma generate

# 一時的な .env は不要なので削除
RUN rm .env.build-tmp

COPY . .

RUN npm run build

# --- 実行ステージ ---
FROM node:23-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache openssl

# 永続化ディレクトリを作成し、node ユーザーで書き込めるようにする
RUN mkdir -p /app/.data && chown node:node /app/.data

COPY --from=builder --chown=node:node /app/package*.json ./
RUN npm install --production
COPY --from=builder --chown=node:node /app/.output ./.output
COPY --from=builder --chown=node:node /app/prisma/schema.prisma ./prisma/schema.prisma
COPY --from=builder --chown=node:node /app/node_modules/.prisma ./node_modules/.prisma

# .env はイメージに焼き込まない。実行時に docker-compose.yml の env_file で注入する。
RUN chown -R node:node /app/.output /app/node_modules /app/prisma /app/.data
USER node

ENV NUXT_HOST=0.0.0.0
ENV NUXT_PORT=3000

EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
