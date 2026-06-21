# Netvibes-like (memo-app)

Nuxt 3 + TypeScript で構築された、カスタマイズ可能なダッシュボードWebアプリケーション。ユーザーはペインを分割し、各種ウィジェット（メモ、RSSリーダー、Googleカレンダー）をドラッグ&ドロップで配置できます。

## Features

- **ウィジェットダッシュボード**: splitpanes による3ペイン分割、vuedraggable によるドラッグ&ドロップ配置
- **ユーザー認証**: Lucia Auth v3 によるセッションベース認証（Argon2ハッシュ）
- **レイアウト永続化**: ユーザーごとのウィジェット配置・設定を Prisma + SQLite に保存
- **マルチウィジェット**: メモ/ノート、RSSリーダー、Googleカレンダーiframe
- **国際化**: `@nuxtjs/i18n` による日本語/英語対応
- **テーマ切替**: ライト/ダークモード

## Tech Stack

| レイヤー | 技術 |
|---|---|
| Frontend | Nuxt 3 (Vue 3), TypeScript, splitpanes, vuedraggable, DOMPurify |
| Backend | Nuxt server routes (Nitro), Zod（入力バリデーション） |
| Database | Prisma ORM + SQLite |
| Auth | Lucia Auth v3 + @node-rs/argon2 |
| Infra | Docker Compose, Traefik v3（HTTPSリバースプロキシ） |

## Prerequisites

- **Node.js** >= 18（ローカル開発時）
- **Docker** & **Docker Compose**（Docker構成で起動する場合）

## Quick Start

このプロジェクトは2つの起動パターンをサポートします：

### A. ローカル開発（Docker Compose）

ローカル開発では自己署名証明書を使い、`memo-app.local` ドメインでアクセスします。

```bash
# 1. リポジトリをクローン
git clone https://github.com/MasatoTakano/netvibes-like.git memo-app
cd memo-app

# 2. 環境変数ファイルを準備
cp .env.docker.example .env.docker
cp .env.example .env   # ビルド時に DATABASE_URL が参照されるため必要

# 3. .env.docker を編集
#    TRAEFIK_DASHBOARD_AUTH_USERS を設定（後述）

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

# 6. ビルド & 起動
docker compose up -d --build

# 7. データベースの初期化（初回のみ）
docker compose exec nuxt-app npx prisma db push

# 8. アクセス
#    アプリ:       https://memo-app.local
#    ダッシュボード: https://traefik.memo-app.local/dashboard/
```

> **注意**: 自己署名証明書はブラウザで警告が出ます。これはローカル開発専用です。

#### Traefik ダッシュボード BasicAuth の生成

```bash
# パスワードハッシュを生成（htpasswd が必要、または apache2-utils パッケージ）
htpasswd -nbB admin 'your-password'
# 出力例: admin:$2y$05$abcdef...

# .env.docker の TRAEFIK_DASHBOARD_AUTH_USERS に設定
# ※ Docker Compose が変数展開するため $ を $$ にエスケープ:
#    TRAEFIK_DASHBOARD_AUTH_USERS="admin:$$2y$$05$$abcdef..."
```

### B. ローカル開発サーバー（Dockerなし）

```bash
git clone https://github.com/MasatoTakano/netvibes-like.git memo-app
cd memo-app

cp .env.example .env
npm install
npx prisma db push
npm run dev   # → http://localhost:3000
```

### C. 本番デプロイ

本番では **Traefik のACME（Let's Encrypt）** で正規のTLS証明書を自動発行・更新することを推奨します。自己署名証明書は使わないでください。

#### 必要な変更

1. **ドメインを用意**: `memo-app.example.com` 等、パブリックに解決可能なドメイン（DNS AレコードをサーバーのIPに向ける）

2. **`docker-compose.yml` の Traefik command に ACME 設定を追加**:

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

3. **各ルータのラベルに `certresolver` を指定**:

```yaml
labels:
  - 'traefik.http.routers.nuxt-app.rule=Host(`memo-app.example.com`)'
  - 'traefik.http.routers.nuxt-app.entrypoints=websecure'
  - 'traefik.http.routers.nuxt-app.tls=true'
  - 'traefik.http.routers.nuxt-app.tls.certresolver=le'   # ← 追加
```

4. **`.env.docker` の本番設定**:

```
DATABASE_URL="file:/app/.data/dev.db"
NUXT_LUCIA_COOKIE_SECURE=true
TRAEFIK_DASHBOARD_AUTH_USERS="admin:$$2y$$05$$..."   # 強力なパスワードで
```

5. **`traefik_dynamic.yml`** は本番では不要です（ACMEが証明書を管理するため）。ボリュームマウントから外してください。

6. **ビルド & 起動**:

```bash
docker compose up -d --build
docker compose exec nuxt-app npx prisma db push
```

## Project Structure

```
memo-app/
├── components/          # Vueコンポーネント（WidgetCard, 各種SettingsModal等）
├── composables/         # ロジック分離（useLayout, useWidgetModal, useGlobalSettings等）
├── constants/           # デフォルト値・フォントリスト等の定数
├── pages/
│   ├── index.vue        # メインダッシュボード（3ペイン + ウィジェット）
│   ├── login.vue        # ログインページ
│   └── signup.vue       # サインアップページ
├── plugins/
│   └── auth.ts          # SSR時のセッション復元プラグイン
├── server/
│   ├── api/             # APIエンドポイント（layout, settings, rss, auth系）
│   ├── middleware/
│   │   └── rateLimit.ts # ログイン試行レートリミット（IP単位）
│   ├── utils/
│   │   ├── auth.ts      # Lucia インスタンス + requireSession ヘルパー
│   │   ├── prisma.ts    # PrismaClient シングルトン
│   │   └── ssrf.ts      # SSRF対策（プライベートIPブロック）
│   └── tsconfig.json
├── prisma/
│   ├── schema.prisma    # User, Session, Key, Layout, Setting モデル
│   └── migrations/      # Prismaマイグレーション
├── types/               # TypeScript型定義（Widget, PaneData等）
├── certs/               # 自己署名証明書（.gitignore対象、各自生成）
├── .data/               # SQLite DB（.gitignore対象、実行時に生成）
├── docker-compose.yml   # Traefik + Nuxt 構成
├── Dockerfile           # マルチステージビルド（builder + runtime）
├── traefik_dynamic.yml  # Traefik 動的設定（TLS証明書）
└── nuxt.config.ts       # セキュリティヘッダ、CSP、i18n、devtools設定
```

## Security Features

本アプリケーションには以下のセキュリティ対策が実装されています:

| 対策 | 実装箇所 |
|---|---|
| 認証必須化（全API） | `server/utils/auth.ts` の `requireSession()` |
| SSRF対策（RSSプロキシ） | `server/utils/ssrf.ts`（プライベートIPブロック、タイムアウト、サイズ制限） |
| 入力バリデーション | Zod スキーマ（login, signup, layout, settings） |
| レートリミット | `server/middleware/rateLimit.ts`（ログイン: 10回/15分/IP） |
| セキュリティヘッダ | `nuxt.config.ts` routeRules（HSTS, X-Frame-Options, CSP等） |
| CSP（Report-Only） | `nuxt.config.ts`（`unsafe-inline` 許可、frame-src はGoogle Calendar限定） |
| XSS対策 | DOMPurify（MemoNote, CalendarWidget） |
| Cookie secure 属性 | 本番環境で `NUXT_LUCIA_COOKIE_SECURE=true` |
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
| `npm run test` | Vitest テスト実行 |
| `npx prisma db push` | スキーマをDBに反映 |
| `npx prisma studio` | Prisma Studio（DB GUI） |
| `npx nuxi typecheck` | TypeScript型チェック |

## Documentation

- [セキュリティ監査 対応計画書](docs/security-remediation-plan.md) — フェーズ別の対応内容と進捗
- [index.vue リファクタリング設計書](docs/index-refactor-plan.md) — composables 分割の設計

## License

MIT
