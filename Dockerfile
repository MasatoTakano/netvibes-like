# ビルドステージ
FROM node:23-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl openssl-dev

# docker-compose.yml から渡されるビルド引数を宣言
ARG DATABASE_URL_BUILD

COPY package*.json ./
COPY prisma ./prisma

# ビルド引数を使って、prisma generate 用の一時的な .env を作成
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

# ディレクトリ作成
RUN mkdir -p /app/.data && chown node:node /app/.data

COPY --from=builder /app/package*.json ./
RUN npm install --production
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/prisma/schema.prisma ./prisma/schema.prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# ホストの .env ファイルをコンテナの /app/.env にコピー
COPY .env .env

# node ユーザーに変更する場合
# コピーした .env ファイルにも権限を与える必要があるかもしれません
# RUN chown -R node:node /app/.output /app/node_modules /app/prisma /app/.env /app/.data
# USER node

ENV NUXT_HOST=0.0.0.0
ENV NUXT_PORT=3000

EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]