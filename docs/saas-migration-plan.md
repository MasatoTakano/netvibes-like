# memo-app SaaS化 計画書

> 作成日: 2026-06-23  
> 改訂日: 2026-06-23  
> 現状: Nuxt 3 + Prisma/PostgreSQL + Better Auth + Docker Compose/Traefik  
> 前提: Phase 1（Redisによる分散レートリミットを除く）は完了済み

---

## 1. 現状アーキテクチャの整理

| レイヤー | 現状 | 今後の論点 |
|----------|------|------------|
| DB | PostgreSQL 16 + Prisma | バックアップ、マネージドDB移行、接続プール |
| 認証 | Better Auth + email/password + Argon2id | メール確認、パスワードリセット、OAuth、セッション管理UI |
| レートリミット | Better Auth 組み込み `rateLimit` | 単一インスタンスでは十分。水平スケール/serverless化時にRedis化を再検討 |
| セッション | Better Auth `Session` テーブル | 他端末セッション管理、全端末ログアウト |
| データ永続化 | `Layout` / `Setting` をユーザー単位で保存 | エクスポート、削除、将来的な共有/チーム化 |
| ファイル | なし | 画像添付・エクスポート・インポート時にR2/S3検討 |
| メール | 未導入 | パスワードリセット、メール確認、通知に必須 |
| 課金 | 未導入 | StripeはPhase 2から分離。プラン設計後に導入 |
| 管理画面 | 未導入 | ユーザー管理、利用状況、課金状態、監査ログ |
| 監視 | 未導入 | Sentry、アップタイム監視、分析 |

---

## 2. フェーズ再定義

今回の方針では、**Phase 2 は「課金」ではなく「アカウント運用基盤」に集中**する。Stripe課金は、プラン・利用制限設計を固めた後の独立フェーズにする。

### Phase 1: 技術基盤更新 — 完了

目的: SaaS化しなくても必要な基盤更新を完了する。

完了済み:

- SQLite → PostgreSQL
- Lucia Auth → Better Auth
- 既存データ移行
- Better Auth catch-all handler 導入
- 旧Lucia API/ユーティリティ削除
- Docker Compose に PostgreSQL 追加
- `memo-app-pgdata` external volume 化
- `.env` / `.env.docker` 整理
- README更新
- lint / typecheck / 認証フロー確認

保留:

- Redisによる分散レートリミット
  - 理由: 現状は単一Nuxtインスタンス運用であり、Better Auth組み込みレートリミットで十分
  - 再検討条件: 複数Nuxtコンテナ、serverless移行、認証攻撃の実観測、API利用制限の厳密共有が必要になった場合

### Phase 2: アカウント運用基盤

目的: 複数ユーザー運用に必要なアカウント周辺機能を完成させる。

このフェーズには **Stripe課金を含めない**。

優先順:

1. メール送信基盤 — ✅ 完了 (2026-06-24)
2. パスワードリセット — ✅ 完了 (2026-06-24)
3. メールアドレス確認 — ✅ 完了 (2026-06-24)
4. アカウント設定ページ — ✅ 完了 (2026-06-24)
5. セッション管理 — 後送り（Phase 4前に再検討）
6. Google OAuth — ✅ 完了 (2026-06-24)

### Phase 3: プラン・利用制限設計

目的: Stripeを入れる前に、何に課金価値を置くか、Free/Proで何を制限するかを固める。

このフェーズでは **Stripe連携を実装しない**。DB上の手動プラン切替で、利用制限とUXを検証する。

### Phase 4: Stripe課金

目的: Phase 3で固めたプラン仕様をStripeに接続し、支払い・解約・失敗時処理を実装する。

### Phase 5: 運用・管理・監視

目的: 公開サービスとして安定運用するための監視、管理、分析を整える。

### Phase 6: 法務・コンプライアンス

目的: 公開サービスとして必要な規約、プライバシー、データ削除/エクスポートを整える。

---

## 3. Phase 2: アカウント運用基盤 実装計画

### 2-1. メール送信基盤

**目的:** パスワードリセット、メール確認、通知メールの共通基盤を作る。

**推奨サービス:** Resend

**新規パッケージ:**

```bash
npm install resend
```

**環境変数:**

`.env.example` / `.env.docker.example` に追加:

```bash
RESEND_API_KEY=""
EMAIL_FROM="noreply@example.com"
```

**新規ファイル:**

| ファイル | 目的 |
|----------|------|
| `server/utils/email.ts` | Resend クライアント初期化、送信ヘルパー |
| `server/utils/email-templates.ts` | メール確認・パスワードリセット等のテンプレート |

**実装方針:**

- `sendEmail({ to, subject, html, text })` の薄い共通関数を作る
- 本番では `RESEND_API_KEY` 必須
- 開発環境でAPIキー未設定の場合は、送信せずコンソールにURLを出す fallback を許容する
- メールドメインのSPF/DKIM/DMARC設定手順をREADMEまたは `docs/email-setup.md` に記載する

**検証:**

```bash
npm run lint
npx nuxi typecheck
```

必要に応じてテスト用APIまたは一時スクリプトで送信確認する。

---

### 2-2. パスワードリセット

**目的:** ユーザーがパスワードを忘れた場合に自力復旧できるようにする。

**新規ページ:**

| ファイル | 目的 |
|----------|------|
| `pages/forgot-password.vue` | メールアドレス入力、リセットメール送信 |
| `pages/reset-password.vue` | トークン付きURLから新パスワード設定 |

**変更ファイル:**

| ファイル | 変更内容 |
|----------|----------|
| `server/utils/auth.ts` | Better Auth の forgot/reset password 設定を追加 |
| `pages/login.vue` | 「パスワードを忘れた場合」リンク追加 |
| `i18n/locales/ja-JP.json` | 文言追加 |
| `i18n/locales/en-US.json` | 文言追加 |

**実装方針:**

- Better Auth のパスワードリセット機能を使う
- リセットメール送信成功時は、メール存在有無を推測できない文言にする
- トークン期限切れ/無効時のUIを用意する
- 成功後はログインページへ誘導する

**検証:**

- 存在するメールアドレスでリセットメールが生成/送信される
- 存在しないメールアドレスでも同じ成功表示になる
- 有効トークンでパスワード変更できる
- 変更後、旧パスワードではログイン不可、新パスワードでログイン可

---

### 2-3. メールアドレス確認

**目的:** 登録メールアドレスの所有確認を行い、将来的な利用制限・通知信頼性の土台を作る。

**変更ファイル:**

| ファイル | 変更内容 |
|----------|----------|
| `server/utils/auth.ts` | Better Auth の email verification 設定を追加 |
| `plugins/auth.ts` / `composables/useAuth.ts` | `emailVerified` をクライアント状態に含める |
| `pages/index.vue` または共通ヘッダー | 未確認メールの警告表示 |
| `pages/settings.vue` | 確認メール再送ボタン |
| `i18n/locales/*.json` | 文言追加 |

**実装方針:**

- 初期段階では、メール未確認でも全機能を即ブロックしない
- 未確認ユーザーには画面上部または設定画面で警告を表示
- 確認メール再送を提供
- 将来的に制限できるよう、`emailVerified` 判定ヘルパーを用意する

**検証:**

- サインアップ時に確認メールが送られる
- 確認URLアクセス後に `emailVerified=true` になる
- 未確認状態で警告が表示される
- 再送ボタンが機能する

---

### 2-4. アカウント設定ページ

**目的:** ユーザーが自分のアカウント情報と基本操作を管理できるようにする。

**新規ページ:**

| ファイル | 目的 |
|----------|------|
| `pages/settings.vue` | アカウント設定画面 |

**最低限の機能:**

- メールアドレス表示
- 名前変更
- パスワード変更
- メール確認状態表示
- 確認メール再送
- ログアウト
- アカウント削除

**新規/変更API候補:**

| エンドポイント | 機能 |
|----------------|------|
| `PATCH /api/account/profile` | 名前変更 |
| `POST /api/account/change-password` | パスワード変更 |
| `DELETE /api/account` | アカウント削除 |

Better Auth 側の機能で代替できるものは、独自APIを増やさず Better Auth API を優先する。

**アカウント削除方針:**

- `User` 削除で `Layout` / `Setting` / `Session` / `Account` が cascade delete されることを確認
- 削除前に確認UIを出す
- 削除後はログアウト状態で `/signup` または `/login` へ遷移

---

### 2-5. セッション管理

**目的:** ユーザーがログイン中セッションを把握し、不要な端末を無効化できるようにする。

**機能:**

- 現在のセッション表示
- 他端末セッション一覧
- 個別セッション無効化
- 全端末ログアウト

**実装方針:**

- Better Auth のセッションモデル/ API で実現可能な範囲を優先
- `ipAddress` / `userAgent` を表示する場合、ユーザーに過度な精度を約束しない
- MVPでは後回し可。Phase 2後半のタスクとする

---

### 2-6. Google OAuth

**目的:** Googleアカウントによる登録・ログインを提供し、サインアップの摩擦を下げる。

**優先度:** Phase 2後半。メール/パスワード運用が安定してから実装する。

**環境変数:**

```bash
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
```

**変更ファイル:**

| ファイル | 変更内容 |
|----------|----------|
| `server/utils/auth.ts` | `socialProviders.google` 追加 |
| `pages/login.vue` | Googleログインボタン追加 |
| `pages/signup.vue` | Googleサインアップボタン追加 |
| `composables/useAuth.ts` | OAuth開始関数追加 |
| `i18n/locales/*.json` | 文言追加 |

**重要論点:**

- 既存 email/password ユーザーとGoogle OAuthユーザーの紐付け
- 同一メールで重複ユーザーを作らない
- OAuth作成ユーザーにも `Layout` / `Setting` を必ず作成する
- Google側で確認済みメールなら `emailVerified` をどう扱うか
- ローカル/本番 callback URL の設定差分

**検証:**

- 新規Googleログインでユーザー・アカウント・初期Layout/Settingが作成される
- 既存メールアドレスとの衝突時の挙動が安全
- ログアウト後に再ログインできる

---

## 4. Phase 3: プラン・利用制限設計

### 目的

Stripe導入前に、Free/Proなどのプラン仕様と利用制限を固める。ここではStripe連携は行わず、DB上の手動プラン切替でプロダクト仕様を検証する。

### 決めるべき論点

| 論点 | 検討例 |
|------|--------|
| Free制限 | ウィジェット数、RSSフィード数、ブックマーク数、ダッシュボード数 |
| Pro価値 | 無制限、テーマ、エクスポート、共有、添付ファイル |
| 制限超過時 | 既存データは消さず、新規追加/編集だけ止める |
| 解約後挙動 | Proデータは閲覧可、追加/編集不可 |
| 既存ユーザー | Free制限超過済みデータをどう扱うか |
| 将来のチーム化 | 個人課金か、ワークスペース課金か |

### 実装候補

**Prismaモデル候補:**

```prisma
enum Plan {
  FREE
  PRO
}

model UserPlan {
  id        String   @id @default(cuid())
  userId    String   @unique
  plan      Plan     @default(FREE)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

**新規ファイル候補:**

| ファイル | 目的 |
|----------|------|
| `server/utils/plan.ts` | ユーザーの現在プラン解決 |
| `server/utils/usage.ts` | Widget/RSS等の利用量計測 |
| `server/utils/limits.ts` | プラン別制限判定 |
| `components/LimitNotice.vue` | UI上の制限表示 |

**実装方針:**

- Stripeなしで `FREE` / `PRO` をDB上で手動切替できるようにする
- 制限は「既存データ削除」ではなく「新規追加/更新の制限」を基本にする
- UI上で、なぜ追加できないのかを明確に表示する
- Phase 4でStripeのSubscription状態を `UserPlan` または後続モデルへ同期する

---

## 5. Phase 4: Stripe課金

### 目的

Phase 3で固めたプラン仕様をStripeに接続し、支払い・解約・支払い失敗時処理を実装する。

### 新規パッケージ

```bash
npm install stripe @stripe/stripe-js
```

### Prismaモデル候補

```prisma
model Subscription {
  id                   String   @id @default(cuid())
  userId               String   @unique
  user                 User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  stripeCustomerId     String   @unique
  stripeSubscriptionId String?  @unique
  stripePriceId        String?
  status               SubscriptionStatus
  currentPeriodEnd     DateTime?
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt
}

enum SubscriptionStatus {
  ACTIVE
  TRIALING
  PAST_DUE
  CANCELED
  UNPAID
}
```

### 新規ファイル候補

| ファイル | 目的 |
|----------|------|
| `server/utils/stripe.ts` | Stripeクライアント初期化 |
| `server/api/stripe/checkout.post.ts` | Checkout Session作成 |
| `server/api/stripe/portal.post.ts` | Customer Portal Session作成 |
| `server/api/stripe/webhook.post.ts` | Webhook受信 |
| `server/utils/subscription.ts` | Stripe状態とアプリ内Plan同期 |
| `pages/pricing.vue` | 料金ページ |
| `pages/billing.vue` | 課金管理ページ |
| `components/PricingCards.vue` | 料金カード |

### Webhookで扱うイベント候補

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`
- `invoice.payment_succeeded`

### 重要論点

- Webhook冪等性
- Stripe Customer と User の1:1対応
- 支払い失敗時の猶予期間
- 解約後のFree降格タイミング
- Free制限超過データの扱い
- 管理画面から課金状態を確認できること

---

## 6. Phase 5: 運用・管理・監視

### 5-1. 管理画面

| ファイル | 目的 |
|----------|------|
| `pages/admin/index.vue` | ユーザー数・利用状況・MRR等の概要 |
| `pages/admin/users.vue` | ユーザー一覧・検索・停止 |
| `pages/admin/subscriptions.vue` | 課金状況一覧（Phase 4後） |
| `server/api/admin/stats.get.ts` | 統計データ取得 |
| `server/api/admin/users.get.ts` | ユーザー一覧取得 |
| `server/middleware/adminAuth.ts` | 管理者認証チェック |

### 5-2. 監視・エラー追跡

候補:

- Sentry: フロント/サーバーのエラー追跡
- UptimeRobot / BetterUptime: アップタイム監視
- PostHog / GA4: ユーザー行動分析

### 5-3. ファイルストレージ

将来的な画像添付・データエクスポート・インポート向け。

候補:

- Cloudflare R2
- Amazon S3

新規ファイル候補:

| ファイル | 目的 |
|----------|------|
| `server/utils/storage.ts` | R2/S3クライアント初期化 |
| `server/api/upload.post.ts` | ファイルアップロードAPI |

---

## 7. Phase 6: 法務・コンプライアンス

### 法的ページ

| ファイル | 目的 |
|----------|------|
| `pages/terms.vue` | 利用規約 |
| `pages/privacy.vue` | プライバシーポリシー |
| `pages/legal.vue` | 特定商取引法に基づく表記（日本向けに販売する場合） |

### データ保護

| 機能 | 候補エンドポイント |
|------|--------------------|
| データエクスポート | `GET /api/export` |
| アカウント削除 | `DELETE /api/account` |
| Cookie同意 | `components/CookieBanner.vue` |

アカウント削除はPhase 2のアカウント設定ページでも最低限実装し、Phase 6では規約・データ保護観点で仕上げる。

---

## 8. デプロイ方式の選択肢

### 選択肢A: 既存VPS/Docker Compose + PostgreSQL

| 利点 | 欠点 |
|------|------|
| 現状構成を活かせる | 水平スケールは手動対応 |
| コスト最小 | 障害復旧・バックアップ設計が必要 |
| Dockerfile/docker-compose がそのまま使える | 監視・アラート構築が必要 |

### 選択肢B: Fly.io + マネージドPostgreSQL

| 利点 | 欠点 |
|------|------|
| Dockerベースで移行しやすい | 設定の手間がやや多い |
| スケール設定が柔軟 | リージョン・DB接続を考慮する必要あり |

### 選択肢C: Vercel + Neon + Upstash

| 利点 | 欠点 |
|------|------|
| デプロイが速い | serverless/edgeでPrismaやセッション挙動の検証が必要 |
| マネージド運用が容易 | コストとベンダーロックイン |
| 分散レートリミットはUpstashに寄せやすい | 既存Docker運用とは異なる |

**推奨:** Phase 2〜3 は既存VPS/Docker Compose構成で進め、Phase 4〜5でユーザー数・運用負荷を見てFly.io/Vercel等を再検討する。

---

## 9. 推奨実装順序

```txt
Phase 1: 技術基盤更新 — 完了
    ↓
Phase 2-1: メール送信基盤
    ↓
Phase 2-2: パスワードリセット
    ↓
Phase 2-3: メール確認
    ↓
Phase 2-4: アカウント設定ページ
    ↓
Phase 2-5: セッション管理
    ↓
Phase 2-6: Google OAuth
    ↓
Phase 3: プラン・利用制限設計（Stripeなし）
    ↓
Phase 4: Stripe課金
    ↓
Phase 5: 運用・管理・監視
    ↓
Phase 6: 法務・コンプライアンス
```

次に着手すべきは **Phase 2-1: メール送信基盤**。これはパスワードリセット、メール確認、将来の課金通知の前提になる。

---

## 10. Phase 2 実装時の品質ゲート

各サブフェーズ完了時に以下を確認する。

```bash
npm run lint
npx nuxi typecheck
npm run test
```

追加で、認証/メール関連では以下を手動確認する。

- 未ログイン時のアクセス制御
- ログイン済み時のリダイレクト
- CSRF/Originチェックで想定外のPOSTが通らないこと
- メール存在有無を推測できる応答差がないこと
- トークン期限切れ・不正トークン時の表示
- アカウント削除後に関連データが残らないこと
