# Phase 2-6: Google OAuth 実装計画書

> 作成日: 2026-06-24
> ステータス: 計画（実装承認待ち）

---

## 1. 目的

Googleアカウントによる登録・ログインを提供し、サインアップの摩擦を下げる。

---

## 2. Better Auth の OAuth 仕様（確認済み）

### サーバー側

- `socialProviders.google` に `clientId` / `clientSecret` を渡す
- Better Auth が内部で Google OAuth フロー（リダイレクト → コールバック → ユーザー情報取得 → セッション作成）を完結
- APIエンドポイントは全て catch-all handler (`/api/auth/[...all]`) に自動追加:
  - `GET /api/auth/sign-in/social?provider=google&callbackURL=...` → Google へリダイレクト
  - `GET /api/auth/callback/google` → コールバック処理 → アプリへリダイレクト

### クライアント側

- `authClient.signIn.social({ provider: 'google', callbackURL: '/' })` でフロー開始
- 型安全なメソッド名は `client.signIn.social`（`signInSocial` ではない）

### アカウントリンク（accountLinking）の挙動

Better Auth のデフォルト挙動:

| 状況 | 動作 |
|------|------|
| 新規メール + Google | 新規User + Account(providerId: "google") を作成、`emailVerified = true`（Google確認済みのため） |
| 既存メール/password ユーザー + Google | **自動リンク**（Google = trusted provider）。既存UserにAccount行を追加。`emailVerified` を true に更新 |
| 既存Googleユーザー + email/password | そのままGoogleログイン |

**注意:** `requireLocalEmailVerified`（デフォルト `true`）により、既存ユーザーの `emailVerified` が `false` の場合は自動リンクされず `"account not linked"` エラーになる。

### 新規Googleユーザーの Layout / Setting 作成

Better Auth は新規ユーザー作成時に Layout / Setting を自動作成しない。既存の email/password サインアップフローでも明示的な作成は行われておず、フロントエンド（useLayout.ts）の `loadLayout()` が空配列を返した場合に初期レイアウトが作成される仕組み。Google OAuth ユーザーも同じパスを通るため、追加対応は不要。

---

## 3. 実装計画

### 3-1. Google Cloud Console 設定（手作業・ユーザー実施）

1. https://console.cloud.google.com/ でプロジェクト作成（または既存を選択）
2. 「APIとサービス」→「認証情報」→「認証情報を作成」→「OAuth クライアント ID」
3. アプリケーションの種類: **ウェブ アプリケーション**
4. 承認済みリダイレクト URI:
   - 開発: `http://localhost:3000/api/auth/callback/google`
   - 本番: `https://{本番ドメイン}/api/auth/callback/google`
5. 発行された Client ID / Client Secret を `.env` に設定

### 3-2. 環境変数

```bash
# .env / .env.docker に追加
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
```

`.env.example` / `.env.docker.example` にも追加。

### 3-3. サーバー側: auth.ts 設定変更

```ts
socialProviders: {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  },
},
```

### 3-4. クライアント側: composable 拡張

`useAuth.ts` に `loginWithGoogle()` / `signupWithGoogle()` を追加:

```ts
const loginWithGoogle = async () => {
  await authClient.signIn.social({
    provider: 'google',
    callbackURL: '/',
  });
};
```

Google ログイン/サインアップは同一メソッド（Better Auth が新規・既存を自動判定）。

### 3-5. UI 変更

#### login.vue / signup.vue

各ページに「Googleでログイン」「Googleで登録」ボタンを追加。

デザイン方針:
- Google公式ブランディングガイドラインに沿った白背景 + Googleロゴ + "Googleで続ける"テキスト
- 区切り線（`--- または ---`）で email/password フォームと分離
- `signIn.social()` はページ遷移を伴うためボタンクリック即実行

### 3-6. i18n 追加

```
"login": {
  "googleButton": "Googleでログイン"
},
"signup": {
  "googleButton": "Googleで登録"
},
"common": {
  "or": "または"
}
```

### 3-7. originCheck ミドルウェア

`server/middleware/originCheck.ts` は `/api/auth/*` を除外済みのため、Google OAuth のコールバック（Google → アプリへのPOSTリダイレクト）は問題なく通過する。**変更不要。**

---

## 4. 議論すべき論点

### 論点A: emailVerified が false の既存ユーザーと Google の衝突

Better Auth のデフォルト `requireLocalEmailVerified: true` により、メール未確認の既存ユーザーが Google ログインを試みると `"account not linked"` エラーになる。

**選択肢:**

| 選択肢 | 内容 | リスク |
|--------|------|--------|
| (a) デフォルト維持 | 未確認ユーザーはGoogle連携できない。確認してからリンク | 既存ユーザーが混乱する可能性 |
| (b) `requireLocalEmailVerified: false` | 未確認でもGoogleログインで自動リンク | メール所有確認前のリンクは弱いが、Googleが確認済みなので実害は低い |

**推奨: (a)** — セキュリティ保守的。Phase 2-3でメール確認を実装済みであり、未確認ユーザーは少数。確認メールの再送UIも提供済み。

### 論点B: コールバックURLの環境差分

- 開発: `http://localhost:3000`
- Docker Compose: `https://memo-app.local`
- 本番: `https://{本番ドメイン}`

Better Auth は `baseURL`（`BETTER_AUTH_URL`）からコールバックURLを自動生成するため、各環境の `.env` / `.env.docker` で正しい `BETTER_AUTH_URL` を設定すれば良い。**コード側の環境分岐は不要。**

ただし、Google Cloud Console の「承認済みリダイレクトURI」は開発・本番両方を事前登録が必要。

### 論点C: エラー処理

OAuth フローでエラーが起きた場合のハンドリング:

| エラー | ユーザー体験 | 対応 |
|--------|-------------|------|
| Google認証失敗 | Google側のエラー画面 | Better Auth が `callbackURL?error=...` でリダイレクト |
| アカウント未リンク | リダイレクト先でエラー表示 | login/signup ページで `route.query.error` をチェック |
| ユーザーがキャンセル | Google側で「キャンセル」→リダイレクト | `callbackURL` に戻る |

**実装:** login/signup ページの `onMounted` で `route.query.error` をチェックし、エラーバナーを表示。

### 論点D: 開発環境でのテスト方法

`http://localhost:3000` で開発サーバーを起動し、Google Cloud Console に `http://localhost:3000/api/auth/callback/google` を承認済みリダイレクトURIとして登録すれば、ローカルでOAuthフロー全体をテスト可能。

---

## 5. 変更ファイル一覧

| ファイル | 変更内容 |
|----------|----------|
| `server/utils/auth.ts` | `socialProviders.google` 追加 |
| `lib/auth-client.ts` | `signIn.social` のエクスポートは不要（signIn自体を既にエクスポート済み） |
| `composables/useAuth.ts` | `loginWithGoogle()` 追加 |
| `pages/login.vue` | Googleログインボタン + 区切り線 + エラー処理 |
| `pages/signup.vue` | Google登録ボタン + 区切り線 + エラー処理 |
| `i18n/locales/ja-JP.json` | `login.googleButton`, `signup.googleButton`, `common.or` 追加 |
| `i18n/locales/en-US.json` | 同上 |
| `.env.example` / `.env.docker.example` | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` 追加 |

**新規Prismaマイグレーション: 不要**（Account テーブルは既に OAuth providerId を想定した構造）

---

## 6. 検証項目

1. 新規Googleログインで User + Account が作成される
2. Googleログイン後、ダッシュボード（/）に遷移し、初期レイアウトが表示される
3. 既存email/passwordユーザー（emailVerified=true）がGoogleログイン → アカウントがリンクされる
4. ログアウト後、再ログインできる
5. `route.query.error` でOAuthエラーが表示される
6. lint / typecheck / test 全通過
