# Netvibes-like (memo-app)

Nuxt 3 + TypeScript で構築された、カスタマイズ可能なダッシュボードWebアプリケーションです。ユーザーはペインを分割し、各種ウィジェット（メモ、RSSリーダー、Googleカレンダー、ブックマーク）をドラッグ&ドロップで配置できます。

## Features

- **ウィジェットダッシュボード**: splitpanes による3ペイン分割、vuedraggable によるドラッグ&ドロップ配置
- **ユーザー認証**: Better Auth によるセッションベース認証（Argon2id パスワードハッシュ）
- **レイアウト永続化**: ユーザーごとのウィジェット配置・設定を Prisma + PostgreSQL に保存
- **マルチウィジェット**: メモ/ノート、RSSリーダー、Googleカレンダーiframe、ブックマーク
- **国際化**: `@nuxtjs/i18n` による日本語/英語対応
- **テーマ切替**: ライト/ダークモード

## Tech Stack

| レイヤー | 技術 |
|---|---|
| Frontend | Nuxt 3 (Vue 3), TypeScript, splitpanes, vuedraggable, DOMPurify |
| Backend | Nuxt server routes (Nitro), Zod（入力バリデーション） |
| Database | Prisma ORM + PostgreSQL |
| Auth | Better Auth + @node-rs/argon2 |
| Infra | Docker Compose, PostgreSQL 16, Traefik v3（HTTPSリバースプロキシ） |

## Prerequisites

- **Node.js** >= 18（ローカル開発時）
- **Docker** & **Docker Compose**（Docker構成で起動する場合）
- **htpasswd**（Traefik ダッシュボード BasicAuth 用。Debian/Ubuntuでは `apache2-utils`）

## Environment Variables

このプロジェクトでは、用途別に2つの環境変数ファイルを使います。

| ファイル | 用途 |
|---|---|
| `.env` | ホスト側のローカル開発、Prisma CLI、Docker Compose の `${...}` 変数展開 |
| `.env.docker` | `nuxt-app` コンテナへ注入する実行時環境変数 |

> **重要**: `docker-compose.yml` の `labels` 内にある `${TRAEFIK_DASHBOARD_AUTH_USERS}` は `.env.docker` ではなく `.env` から展開されます。`docker compose down` でもComposeファイルの補間が走るため、`.env` にこの値がないと停止すら失敗します。

### Better Auth Secret の生成

```bash
openssl rand -hex 32
```

生成した値を `.env` と `.env.docker` の `BETTER_AUTH_SECRET` に設定してください。

### Traefik ダッシュボード BasicAuth の生成

```bash
# パスワードハッシュを生成
htpasswd -nbB admin 'your-password'
# 出力例: admin:$2y$05$abcdef...

# Docker Compose が変数展開するため、$ を $$ にエスケープして .env に設定:
# TRAEFIK_DASHBOARD_AUTH_USERS="admin:$$2y$$05$$abcdef..."
```

## Quick Start

このプロジェクトは2つの起動パターンをサポートします。

### A. ローカル開発（Docker Compose）

ローカル開発では自己署名証明書を使い、`memo-app.local` ドメインでアクセスします。

```bash
# 1. リポジトリをクローン
git clone https://github.com/MasatoTakano/netvibes-like.git memo-app
cd memo-app

# 2. 環境変数ファイルを準備
cp .env.example .env
cp .env.docker.example .env.docker

# 3. .env / .env.docker を編集
#    - BETTER_AUTH_SECRET を設定
#    - .env の TRAEFIK_DASHBOARD_AUTH_USERS を設定
#    - .env.docker の BETTER_AUTH_URL を実際のURLに合わせる

# 4. 自己署名証明書を生成
mkdir -p certs
openssl req -x509 -nodes -days 365 \
  -newkey rsa:2048 \
  -keyout certs/memo-app.local-key.pem \
  -out certs/memo-app.local.pem \
  -subj "/CN=memo-app.local"

# 5. hosts にドメインを追加
#    /etc/hosts に以下を追記:
#    127.0.0.1 memo-app.local traefik.memo-app.local

# 6. PostgreSQL データボリュームを作成
#    docker-compose.yml は移行済みデータ保持のため external volume を参照する設定です。
docker volume create memo-app-pgdata

# 7. PostgreSQL を起動
docker compose up -d postgres

# 8. データベースマイグレーションを適用
npx prisma migrate deploy

# 9. アプリをビルド & 起動
docker compose up -d --build

# 10. アクセス
#    アプリ:         https://memo-app.local
#    ダッシュボード: https://traefik.memo-app.local/dashboard/
```

> **注意**: 自己署名証明書はブラウザで警告が出ます。これはローカル開発専用です。

#### 停止

```bash
docker compose down
```

`pgdata` は external volume (`memo-app-pgdata`) として管理しているため、`docker compose down` ではDBデータは削除されません。

### B. ローカル開発サーバー（Dockerなし）

DockerなしでNuxt開発サーバーを起動する場合も、PostgreSQLは必要です。

```bash
git clone https://github.com/MasatoTakano/netvibes-like.git memo-app
cd memo-app

cp .env.example .env
# .env の DATABASE_URL は localhost の PostgreSQL を参照する
# BETTER_AUTH_SECRET と TRAEFIK_DASHBOARD_AUTH_USERS も設定する

npm install

docker volume create memo-app-pgdata
docker compose up -d postgres

npx prisma migrate deploy
npm run dev   # → http://localhost:3000
```

### C. 本番デプロイ

本番では **Traefik のACME（Let's Encrypt）** で正規のTLS証明書を自動発行・更新することを推奨します。自己署名証明書は使わないでください。

#### 必要な変更

1. **ドメインを用意**: `memo-app.example.com` 等、パブリックに解決可能なドメイン（DNS AレコードをサーバーのIPに向ける）

2. **`.env` / `.env.docker` の本番設定**:

`.env`:

```bash
DATABASE_URL="postgresql://memoapp:strong-password@localhost:5432/memoapp"
BETTER_AUTH_SECRET="<openssl rand -hex 32 の値>"
BETTER_AUTH_URL="https://memo-app.example.com"
TRAEFIK_DASHBOARD_AUTH_USERS="admin:$$2y$$05$$..."  # 強力なパスワードで生成
```

`.env.docker`:

```bash
DATABASE_URL="postgresql://memoapp:strong-password@postgres:5432/memoapp"
BETTER_AUTH_SECRET="<.env と同じ値>"
BETTER_AUTH_URL="https://memo-app.example.com"
```

3. **`docker-compose.yml` の Traefik command に ACME 設定を追加**:

```yaml
command:
  # ...既存の設定...
  # ACME (Let's Encrypt) 証明書自動発行
  - '--certificatesresolvers.le.acme.tlschallenge=true'
  - '--certificatesresolvers.le.acme.email=your-email@example.com'
  - '--certificatesresolvers.le.acme.storage=/letsencrypt/acme.json'
volumes:
  # ...既存の設定...
  - letsencrypt:/letsencrypt   # 証明書の永続化

# volumes セクションを末尾に追加
volumes:
  letsencrypt:
```

4. **各ルータのラベルに `certresolver` を指定**:

```yaml
labels:
  - 'traefik.http.routers.nuxt-app.rule=Host(`memo-app.example.com`)'
  - 'traefik.http.routers.nuxt-app.entrypoints=websecure'
  - 'traefik.http.routers.nuxt-app.tls=true'
  - 'traefik.http.routers.nuxt-app.tls.certresolver=le'
```

5. **`traefik_dynamic.yml`** は本番では不要です（ACMEが証明書を管理するため）。ボリュームマウントから外してください。

6. **ビルド & 起動**:

```bash
docker volume create memo-app-pgdata
docker compose up -d postgres
npx prisma migrate deploy
docker compose up -d --build
```

## Project Structure

```
memo-app/
├── components/          # Vueコンポーネント（WidgetCard, 各種SettingsModal等）
├── composables/         # ロジック分離（useLayout, useWidgetModal, useAuth等）
├── constants/           # デフォルト値・フォントリスト等の定数
├── lib/
│   └── auth-client.ts   # Better Auth Vue クライアント
├── pages/
│   ├── index.vue        # メインダッシュボード（3ペイン + ウィジェット）
│   ├── login.vue        # ログインページ
│   └── signup.vue       # サインアップページ
├── plugins/
│   └── auth.ts          # SSR時のセッション復元プラグイン
├── server/
│   ├── api/             # APIエンドポイント（layout, settings, rss, auth系）
│   │   └── auth/[...all].ts # Better Auth の catch-all ハンドラー
│   ├── utils/
│   │   ├── auth.ts      # Better Auth 設定 + requireSession ヘルパー
│   │   ├── prisma.ts    # PrismaClient シングルトン
│   │   └── ssrf.ts      # SSRF対策（プライベートIPブロック）
│   └── tsconfig.json
├── prisma/
│   ├── schema.prisma    # Better Auth + App モデル
│   └── migrations/      # Prismaマイグレーション
├── types/               # TypeScript型定義（Widget, PaneData等）
├── certs/               # 自己署名証明書（.gitignore対象、各自生成）
├── docker-compose.yml   # PostgreSQL + Traefik + Nuxt 構成
├── Dockerfile           # マルチステージビルド（builder + runtime）
├── traefik_dynamic.yml  # ローカル開発用Traefik動的設定（TLS証明書）
└── nuxt.config.ts       # セキュリティヘッダ、CSP、i18n、devtools設定
```

## Database Schema

主なPrismaモデル:

| モデル | 用途 |
|---|---|
| `User` | Better Auth ユーザー |
| `Session` | Better Auth セッション |
| `Account` | Better Auth 認証アカウント（email/password、将来のOAuth） |
| `Verification` | Better Auth 検証トークン |
| `Layout` | ユーザーごとのダッシュボードレイアウト |
| `Setting` | ユーザーごとのグローバル設定 |

## Security Features

本アプリケーションには以下のセキュリティ対策が実装されています:

| 対策 | 実装箇所 |
|---|---|
| 認証必須化（全API） | `server/utils/auth.ts` の `requireSession()` |
| セッション管理 | Better Auth (`server/api/auth/[...all].ts`) |
| パスワードハッシュ | Argon2id (`@node-rs/argon2`) |
| レートリミット | Better Auth の組み込み `rateLimit` |
| SSRF対策（RSSプロキシ） | `server/utils/ssrf.ts`（プライベートIPブロック、タイムアウト、サイズ制限） |
| 入力バリデーション | Zod スキーマ（layout, settings等） |
| セキュリティヘッダ | `nuxt.config.ts` routeRules（HSTS, X-Frame-Options, CSP等） |
| CSP（Report-Only） | `nuxt.config.ts`（`unsafe-inline` 許可、frame-src はGoogle Calendar限定） |
| XSS対策 | DOMPurify（MemoNote, CalendarWidget） |
| CSRF対策 | Better Auth のOriginチェック |
| コンテナ非root実行 | Dockerfile の `USER node` |
| Traefik ダッシュボード保護 | BasicAuth ミドルウェア |

## Available Scripts

| コマンド | 説明 |
|---|---|
| `npm run dev` | 開発サーバー起動（HMR有効） |
| `npm run build` | 本番ビルド |
| `npm run preview` | ビルド成果物のプレビュー |
| `npm run lint` | ESLint 実行 |
| `npm run lint:fix` | ESLint 自動修正 |
| `npm run format` | Prettier フォーマット |
| `npm run format:check` | Prettier フォーマット確認 |
| `npm run test` | Vitest テスト実行 |
| `npx prisma migrate deploy` | マイグレーションをDBに適用（本番/Compose向け） |
| `npx prisma migrate dev` | 開発用マイグレーション作成・適用 |
| `npx prisma studio` | Prisma Studio（DB GUI） |
| `npx nuxi typecheck` | TypeScript型チェック |

## Operational Notes

### Compose変数展開エラーが出る場合

以下のようなエラーが出る場合:

```txt
error while interpolating services.traefik.labels.[]: required variable TRAEFIK_DASHBOARD_AUTH_USERS is missing a value
```

`.env` に `TRAEFIK_DASHBOARD_AUTH_USERS` が設定されているか確認してください。`.env.docker` ではありません。

### PostgreSQLデータボリューム

`docker-compose.yml` は以下のexternal volumeを参照します。

```yaml
volumes:
  pgdata:
    name: memo-app-pgdata
    external: true
```

初回起動前に作成してください。

```bash
docker volume create memo-app-pgdata
```

## Documentation

- [SaaS化 計画書](docs/saas-migration-plan.md) — PostgreSQL/Better Auth移行を含むSaaS化ロードマップ
- [セキュリティ監査 対応計画書](docs/security-remediation-plan.md) — フェーズ別の対応内容と進捗
- [index.vue リファクタリング設計書](docs/index-refactor-plan.md) — composables 分割の設計

## License

MIT
