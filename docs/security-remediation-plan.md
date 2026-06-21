# セキュリティ監査 対応計画書

**対象**: netvibes-like (memo-app)
**監査日**: 2026-06-21
**作成日**: 2026-06-21
**Git復旧**: 2026-06-21 (clone from `MasatoTakano/netvibes-like`, commit `22a47b4`)

---

## 0. 技術検証結果（対応計画の前提）

対応策立案前に実施した追加検証の結論。

### 0.1 better-sqlite3 側は完全デッドコード

| ファイル | 参照元 | 状態 |
|---|---|---|
| `server/utils/db.ts` | `layout.put.ts` のみ | デッドコード |
| `server/api/layout.put.ts` | フロント(`index.vue`)から未使用 | デッドコード |
| `better-sqlite3` パッケージ | `db.ts` のみ | デッド依存 |

フロントは Prisma 側（`POST /api/layout`）のみ使用。`layout.put.ts` は **認証なしで叩ける** ため、セキュリティリスクだけが生きている。→ Phase 1 で削除。

### 0.2 監査レポート H-2 の訂正：Lucia v3 は secret-less 設計

Lucia v3 のコンストラクタ型定義を確認:

```ts
constructor(adapter: Adapter, options?: {
    sessionExpiresIn?: TimeSpan;
    sessionCookie?: SessionCookieOptions;
    getSessionAttributes?: ...;
    getUserAttributes?: ...;
});
```

`secret` オプションは存在しない。Lucia v3 は**セッションID自体を十分なエントロピーのランダム値として保護を担保する設計**。「Lucia に secret が渡されていない」（H-2）は**誤判定**。

ただし `AUTH_SECRET` が `.env` / `.env.docker` に定義されているのに**コードから一切参照されていない**（未使用の謎シークレット）という問題は別途存在する。Lucia では不要なため削除対象。

### 0.3 GitHub リポジトリに `prisma/migrations/` が存在

初期コミットに3つのマイグレーション + `migration_lock.toml` が含まれている:

```
prisma/migrations/
├── migration_lock.toml
├── 20250425104624_init/migration.sql
├── 20250425111813_init_string_data/migration.sql
└── 20250425112444_add_lucia_relations/migration.sql
```

git clone 後はこれらが復元済み。監査時（`.git` 紛失状態）は見えなかった構成。マイグレーション未管理問題（1.3）は解決済み。

### 0.4 GitHub リポジトリの問題点（別途対応候補）

clone して判明した正リポジトリ側の問題:

| 問題 | 影響 |
|---|---|
| `null` という空ファイルが混入 | Windows 環境で `> null` をリダイレクト先とした誤作成と推定 |
| `.env docker.example`（スペース入りファイル名） | `.env.docker.example` の Typo。README の `cp .env.example.docker` 手順と不一致 |

---

## 1. フェーズ分けと工数感

| フェーズ | 内容 | 工数感 | 前提 |
|---|---|---|---|
| **Phase 1** | 緊急対応（CRITICAL + デッドコード削除） | 0.5〜1日 | インターネット公開前に必須 |
| **Phase 2** | セキュリティ強化（HIGH） | 2〜3日 | Phase 1 完了後 |
| **Phase 3** | 構造改善 + MEDIUM | 3〜5日 | 認証基盤移行を除く |
| **Phase 4** | 品質改善（LOW） | 1〜2日 | 任何时候 |

---

## 2. Phase 1: 緊急対応

### P1-1: layout.put.ts 削除（C-1 対応 + デッドコード除去）

**問題**: 認証なしで `layout.sqlite` を上書き可能なエンドポイントが露出

**対応**: 以下を削除
- `server/api/layout.put.ts`
- `server/utils/db.ts`
- `package.json` から `better-sqlite3` / `@types/better-sqlite3` を削除

**規模**: ファイル3箇所変更
**影響**: なし（フロントは Prisma 側のみ使用）
**リスク**: 極低（デッドコードのため）

### P1-2: RSS プロキシのSSRF対策 + 認証追加（C-2 対応）

**問題**: 未認証 + プライベートIP/メタデータサービスへのアクセス可能

**対応**: `server/api/rss.get.ts` に以下を実装
1. **認証チェック追加**: `lucia.validateSession()` でセッション検証
2. **プライベートIPブロック**: URLの解決先が以下に該当する場合は拒否
   - ループバック: `127.0.0.0/8`, `::1`
   - プライベート: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`
   - リンクローカル: `169.254.0.0/16`（AWS metadata含む）
   - その他: `0.0.0.0/8`, `FC00::/7` (IPv6 ULA), `FE80::/10`
3. **タイムアウト設定**: `rss-parser` に `{ timeout: 10000 }` を設定
4. **レスポンスサイズ制限**: アイテム数上限（例: 50件）

**実装方式の選択肢**:

| 方式 | メリット | デメリット | 推奨 |
|---|---|---|---|
| A: URLのホスト名をDNS解決してIP判定 | 確実 | 非同期処理が必要 | ⭐ |
| B: URL文字列の正規表現ブラックリスト | 簡単 | DNSリバインディングに無力 | — |

推奨は **A**。`node:dns.promises` の `lookup()` で解決し、`ipaddr.js` で範囲判定。

**規模**: 1ファイル、新規ロジック約40行
**影響**: RSSウィジェット機能（既存動作は維持、セキュリティチェック追加のみ）
**依存追加**: `ipaddr.js`（軽量、セキュリティ用途で実績あり）

### P1-3: Traefik ダッシュボード保護（C-3 対応）

**問題**: `--api.insecure=true` でダッシュボードが認証なし公開

**対応**: `docker-compose.yml` の Traefik 設定を変更

**実装方式の選択肢**:

| 方式 | メリット | デメリット | 推奨 |
|---|---|---|---|
| A: `--api.insecure=false` + BasicAuth ミドルウェア + ダッシュボードルータ定義 | 標準的 | Traefikラベル定義が増える | ⭐ |
| B: ダッシュボードを無効化（`--api.dashboard=false`） | 最も安全 | 運用時の可視性低下 | — |
| C: `:8080` ポートを `127.0.0.1:8080:8080` にバインド | 簡単 | リモート運用時に不便 | — |

推奨は **A**（本番運用を見据えた標準構成）。

**規模**: `docker-compose.yml` のみ（約15行追加）
**影響**: Traefik ダッシュボードにBasicAuthがかかる
**注意**: BasicAuthのパスワードは `htpasswd` で生成（bcrypt）、`.env.docker` に記載

---

## 3. Phase 2: セキュリティ強化（HIGH）

### P2-1: 未使用シークレットの整理（H-1 対応）

**問題**: `AUTH_SECRET` が定義されているが未使用（技術検証 0.2 参照）

**対応**:
1. `.env` / `.env.docker` / `.env.local` から `AUTH_SECRET` 行を削除
2. `.env.example` / `.env docker.example` からも削除
3. Git履歴の確認: リポジトリに実シークレットがコミットされていないか `git log --all -p -- .env*` で確認

**規模**: env ファイル4箇所
**影響**: なし（未使用のため）

### P2-2: Cookie secure 属性の本番有効化（H-3 対応）

**問題**: `NUXT_LUCIA_COOKIE_SECURE` がデフォルト `false`

**対応**:
- 本番環境の `.env.docker` で `NUXT_LUCIA_COOKIE_SECURE=true` を設定
- `.env.example` のコメントを改善: デフォルト `false`、本番では `true` を明記

**規模**: env ファイル修正のみ
**影響**: なし

### P2-3: `.env.docker` 行末欠陥の修正（H-4 対応）

**問題**: `NUXT_LUCIA_COOKIE_SECURE=falseDATABASE_URL=...` と変数が連結

**対応**: 適切な改行で分割

**規模**: 1ファイル1行修正
**影響**: なし

### P2-4: MemoNote のサニタイズ統一（H-5 対応）

**問題**: `v-html` 使用だが DOMPurify 未使用（手製 `escapeHtml` のみ）

**対応**: `components/MemoNote.vue` の `linkifyUrls` を DOMPurify ベースに変更
- `package.json` に `dompurify` は既に依存あり（CalendarWidget で使用済み）
- URLリンク化 → DOMPurify sanitize 後にリンク化、または sanitize オプションで許可タグ制御

**実装方式**:
```ts
// 現状: escapeHtml → 正規表現でURLを<a>に置換
// 改善: 全体を文字列として組み立て → DOMPurify.sanitize(html, { ALLOWED_TAGS: ['a'], ALLOWED_ATTR: ['href', 'target', 'rel'] })
```

**規模**: 1ファイル、約20行変更
**影響**: メモ表示機能（見た目は変わらない、セキュリティ強化のみ）

### P2-5: CalendarWidget の iframe src 制限（H-6 対応）

**問題**: 任意ドメインの iframe 埋め込み可能

**対応**: `components/CalendarWidget.vue` の DOMPurify 設定にフックを追加
- DOMPurify の `HOOKS.afterSanitizeAttributes` で `iframe[src]` を検査
- `src` が以下のホワイトリストに一致しない場合は削除:
  - `calendar.google.com`
  - `www.google.com/calendar`

**規模**: 1ファイル、約15行追加
**影響**: Google Calendar 以外の iframe が弾かれる（仕様上は問題ない想定）
**注意**: ユーザーが他のカレンダーサービスを使う場合はホワイトリスト拡張が必要

### P2-6: PII デバッグログの除去（H-7 対応）

**問題**: email/name が全リクエストで stdout に出力

**対応**: 以下から `console.log` を削除または `debug` レベルに変更
- `server/utils/auth.ts:30, 36`（getUserAttributes のログ）
- `server/api/login.post.ts:32, 43, 80`
- `server/api/signup.post.ts:94`

**規模**: 3ファイル、約10行削除
**影響**: なし

### P2-7: Dockerfile の .env COPY 削除（H-8 対応）

**問題**: ビルド時に `.env` をイメージレイヤに焼き込み

**対応**: `Dockerfile:41` の `COPY .env .env` を削除
- `docker-compose.yml` の `env_file: .env.docker` で実行時に注入しているため不要

**規模**: 1行削除
**影響**: なし

### P2-8: コンテナの非root実行化（H-9 対応）

**問題**: `USER node` がコメントアウトされ root 実行

**対応**: `Dockerfile` のコメントアウトを解除
- `RUN chown -R node:node ...` のコメントを外す
- `USER node` のコメントを外す
- ファイル権限の調整（`.output`, `node_modules`, `.data` 等）

**規模**: Dockerfile のコメント解除 + 権限調整
**影響**: コンテナ起動時のファイル権限エラーが出ないか要検証
**注意**: `.data/dev.db` の書き込み権限が critical（DB更新不可になる）

---

## 4. Phase 3: 構造改善 + MEDIUM

### P3-1: 認証チェックの共通化（複数APIの重複解消）

**現状**: `layout.get.ts`, `layout.post.ts`, `settings.get.ts`, `settings.post.ts` で同じ認証ボイラープレート（約30行）が重複

**対応**: `server/utils/auth.ts` に `requireSession(event)` ヘルパーを追加
```ts
export async function requireSession(event: H3Event): Promise<{ userId: string; session: Session }> {
  // セッション検証 + Cookie更新 + 失敗時 createError(401) を共通化
}
```
各APIは `const { userId } = await requireSession(event);` の1行に集約。

**規模**: `auth.ts` +20行、各API -30行×4ファイル
**影響**: APIの認証ロジックが統一され、認証漏れ（C-1/RSS のような）を構造的に防止

### P3-2: PrismaClient シングルトン化（1.2 対応）

**現状**: 7ファイルで `new PrismaClient()` を呼び出し

**対応**: `server/utils/prisma.ts` を作成し、Nuxt プラグインとして登録
```ts
// server/utils/prisma.ts
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
export { prisma };
```
各APIの `const prisma = new PrismaClient();` を `import { prisma } from '~/server/utils/prisma';` に置換。

**規模**: 新規1ファイル + 7ファイルのインポート置換
**影響**: なし（接続プール効率化のみ）

### P3-3: レートリミット導入（M-4 対応）※要意思決定

**問題**: ログイン試行のレートリミットなし

**実装方式の選択肢**:

| 方式 | メリット | デメリット | 推奨 |
|---|---|---|---|
| A: Traefik ミドルウェア (`rateLimit`) | アプリ改修不要 | 細かい制御が困難（IP単位のみ） | — |
| B: Nitro server middleware + メモリ/Redis | エンドポイント単位で制御可能 | 実装コスト、SQLite運用では永続化が課題 | ⭐ |
| C: サードパーティ（`rate-limiter-flexible` 等） | 実装が楽 | 依存追加 | — |

推奨は **B**（ログインAPIのみ `5回/15分/IP` 等で制限）。メモリベースで十分（単一インスタンス運用前提）。

**規模**: server middleware 1ファイル新規、約40行
**影響**: ブルートフォース対策

### P3-4: セキュリティヘッダの設定（M-5 対応）※要意思決定

**問題**: CSP / X-Frame-Options / X-Content-Type-Options / HSTS 未設定

**実装方式の選択肢**:

| 方式 | メリット | デメリット | 推奨 |
|---|---|---|---|
| A: Nitro `routeRules` で `headers` 設定 | Nuxtネイティブ、ビルド時に固定 | — | ⭐ |
| B: Traefik ミドルウェア (`headers`) | アプリ外で設定可能 | Traefik設定が肥大化 | — |

推奨は **A**。`nuxt.config.ts` に追加:
```ts
routeRules: {
  '/**': {
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      // CSP は段階導入（Report-Only → 本適用）
    }
  }
}
```

**規模**: `nuxt.config.ts` 約10行追加
**影響**: CSP 導入時は CalendarWidget（iframe）や MemoNote（v-html）との整合性確認が必要
**注意**: CSP は `Content-Security-Policy-Report-Only` から始めて違反を観察後、本適用へ

### P3-5: devtools 無効化（M-7 対応）

**対応**: `nuxt.config.ts` を環境判定で切り替え
```ts
devtools: { enabled: process.env.NODE_ENV !== 'production' }
```

**規模**: 1行変更
**影響**: なし

### P3-6: 入力バリデーション強化（M-1, M-2, M-3 対応）

**問題**: layout POST の緩い検証、name 長さ上限なし、email 正規化なし

**対応**: Zod 導入を検討
- `package.json` に `zod` を追加
- 各APIの入力検証を Zod スキーマで定義
- signup: `email.normalize().toLowerCase()` で正規化

**実装方式の選択肢**:

| 方式 | メリット | デメリット | 推奨 |
|---|---|---|---|
| A: Zod 導入 | 型安全、スキーマ再利用 | 依存追加 | ⭐ |
| B: 手製バリデーション強化 | 依存なし | 誤りが入りやすい | — |

推奨は **A**（Prismaスキーマとの整合性も取りやすい）。

**規模**: 各API + スキーマ定義ファイル、約50行
**影響**: なし

### P3-7: Docker socket マウント見直し（M-6 対応）

**問題**: `/var/run/docker.sock` をマウント

**対応**: Traefik が Docker socket を読む必要があるため完全削除は不可。以下で軽減:
- `:ro`（読み取り専用）は既に設定済み
- Traefik を専用ネットワークに分離し、他コンテナとのネットワーク分離を強化

**規模**: `docker-compose.yml` の networks 定義追加
**影響**: コンテナ間通信の分離

### P3-8: 認証基盤の移行検討（1.5 対応）※要意思決定

**問題**: Lucia v3 は2024年末でアーカイブ済み

**選択肢**:

| 選択肢 | 移行コスト | 今後の保守性 | 推奨 |
|---|---|---|---|
| A: Lucia 継続（freeze） | ゼロ | 脆弱性時の対応不可 | 短期 |
| B: `oslo` + 自前セッション管理 | 中 | 制御可能だが自前負担 | — |
| C: Auth.js (NextAuth) 移行 | 大 | 実績豊富、社区サポート | — |
| D:better-auth 移行 | 中 | Lucia後継の有力候補 | ⭐ 中期 |

**推奨**: 短期は **A**（Lucia継続でセキュリティ問題のみ対処）、中期（Phase 3 完了後）に **D**（`better-auth`）への移行を別タスクとして計画。

**規模**: D の場合、認証関連ファイル全面書き換え（`auth.ts`, `login.post.ts`, `signup.post.ts`, `logout.post.ts`, `plugins/auth.ts`, `composables/useAuth.ts`, `middleware/auth.global.ts`）+ スキーママイグレーション

---

## 5. Phase 4: 品質改善（LOW）

### P4-1: コンソールログ整理（L-1 対応）

Phase 2 の P2-6 と合わせて実施。`debug` パッケージ等の導入を検討。

### P4-2: 自己署名証明書の取扱い（L-2 対応）

**現状**: `certs/` に秘密鍵が平文（`.gitignore` 対象外）

**対応**:
- `.gitignore` に `certs/*.pem` を追加
- 既存の自己署名証明書はローカル開発用として維持

**規模**: `.gitignore` 1行追加

### P4-3: コメント整理（L-3, L-4 対応）

- `nuxt.config.ts:28` の i18n コメント修正
- `useAuth.ts:2-3` のデバッグコメント削除

### P4-4: RSS エラー詳細のマスク（L-6 対応）

`server/api/rss.get.ts:89` の `message: error.message` を汎用メッセージに変更（詳細はサーバーログのみ）。

### P4-5: index.vue の責務分割（M-9 対応）

947行の単一ファイルを以下に分割検討:
- `composables/useLayout.ts`（レイアウトCRUD）
- `composables/useWidgetModal.ts`（モーダル管理）
- `composables/usePaneResize.ts`（ペインリサイズ）

**規模**: 大（リファクタリング）
**影響**: 機能変更なし、可読性・保守性向上

---

## 6. GitHub リポジトリ側の問題（別途対応）

| 問題 | 対応 | 優先 |
|---|---|---|
| `null` 空ファイル | 削除 | 低 |
| `.env docker.example`（スペース入り） | `.env.docker.example` にリネーム | 低 |
| README の `.env.example.docker` 参照 | `.env.docker.example` に修正 | 低 |

これらはコミット時に整理可能。

---

## 7. 要意思決定ポイント

以下は対応実装前に判断が必要な項目。

### 7.1 認証基盤の移行タイミング（P3-8）

→ **短期: Lucia継続 / 中期: better-auth移行** を推奨。Phase 1〜3 は Lucia 上で実施し、移行は独立タスクとする。

### 7.2 レートリミット実装方式（P3-3）

→ **Nitro server middleware（メモリベース）** を推奨。

### 7.3 セキュリティヘッダ実装方式（P3-4）

→ **Nitro routeRules** を推奨。CSP は Report-Only から段階導入。

### 7.4 入力バリデーション（P3-6）

→ **Zod 導入** を推奨。

### 7.5 CalendarWidget ホワイトリスト範囲（P2-5）

→ Google Calendar（`calendar.google.com`, `www.google.com/calendar`）のみで始め、必要に応じて拡張。

---

## 8. 実施順序サマリー

```
Phase 1（緊急）─────────────────────────────────────
  P1-1 layout.put.ts + db.ts 削除
  P1-2 RSS SSRF対策 + 認証追加
  P1-3 Traefik ダッシュボード保護

Phase 2（セキュリティ強化）─────────────────────────
  P2-1 AUTH_SECRET 削除 + git履歴確認
  P2-2 Cookie secure 本番有効化
  P2-3 .env.docker 行末修正
  P2-4 MemoNote DOMPurify統一
  P2-5 CalendarWidget iframe制限
  P2-6 PIIログ除去
  P2-7 Dockerfile .env COPY削除
  P2-8 コンテナ非root化

Phase 3（構造改善）─────────────────────────────────
  P3-1 認証ヘルパー共通化
  P3-2 PrismaClient シングルトン化
  P3-3 レートリミント導入
  P3-4 セキュリティヘッダ設定
  P3-5 devtools無効化
  P3-6 Zod バリデーション導入
  P3-7 Docker network分離

Phase 4（品質改善）─────────────────────────────────
  P4-1〜P4-5 ログ整理・コメント修正・リファクタリング

独立タスク（中期）─────────────────────────────────
  認証基盤 better-auth 移行
```

---

## 9. 実施記録（2026-06-21）

全フェーズ（Phase 1〜4）の対応が完了。

### Phase 1: 緊急対応 — ✅ 完了

| タスク | 状態 | 備考 |
|---|---|---|
| P1-1 layout.put.ts + db.ts 削除 | ✅ | `server/api/layout.put.ts`, `server/utils/db.ts` 削除、`better-sqlite3` 依存除去 |
| P1-2 RSS SSRF対策 + 認証追加 | ✅ | `server/utils/ssrf.ts` 新規、`requireSession` 適用、`ipaddr.js` 導入 |
| P1-3 Traefik ダッシュボード保護 | ✅ | `--api.insecure=true` 削除、BasicAuth ミドルウェア追加 |

### Phase 2: セキュリティ強化（HIGH） — ✅ 完了

| タスク | 状態 | 備考 |
|---|---|---|
| P1-1 AUTH_SECRET 削除 | ✅ | env ファイルから除去、git履歴確認（コミットなし） |
| P2-2 Cookie secure 本番有効化 | ✅ | `auth.ts` で NODE_ENV/環境変数による判定実装 |
| P2-3 .env.docker 行末修正 | ✅ | 適切な改行で分割 |
| P2-4 MemoNote DOMPurify統一 | ✅ | `escapeHtml` から DOMPurify に移行 |
| P2-5 CalendarWidget iframe制限 | ✅ | DOMPurify HOOKS で Google Calendar 以外をブロック |
| P2-6 PIIログ除去 | ✅ | auth.ts, login, signup の console.log 削除 |
| P2-7 Dockerfile .env COPY削除 | ✅ | Dockerfile:41 の `COPY .env .env` 削除 |
| P2-8 コンテナ非root化 | ✅ | `USER node` 有効化、chown 調整 |

### Phase 3: 構造改善 — ✅ 完了

| タスク | 状態 | 備考 |
|---|---|---|
| P3-1 認証ヘルパー共通化 | ✅ | `requireSession()` を8ファイルで使用 |
| P3-2 PrismaClient シングルトン化 | ✅ | `server/utils/prisma.ts`（globalForPrisma パターン） |
| P3-3 レートリミント導入 | ✅ | `server/middleware/rateLimit.ts`（IP単位・15分/10回・メモリベース） |
| P3-4 セキュリティヘッダ設定 | ✅ | routeRules に nosniff/X-Frame-Options/HSTS/Referrer-Policy/Permissions-Policy 設定。CSP は Report-Only で段階導入開始 |
| P3-5 devtools 無効化 | ✅ | `devtools: { enabled: process.env.NODE_ENV !== 'production' }` |
| P3-6 Zod バリデーション導入 | ✅ | login, signup, settings, layout の全APIにZod適用。email正規化（`.toLowerCase().trim()`）も実装 |
| P3-7 Docker network 分離 | ✅ | `internal` bridge ネットワーク定義 |
| P3-8 認証基盤移行検討 | — | 中期タスク（better-auth 移行）として継続保留 |

### Phase 4: 品質改善（LOW） — ✅ 完了

| タスク | 状態 | 備考 |
|---|---|---|
| P4-1 コンソールログ整理 | ✅ | `plugins/auth.ts` のコメントアウト済み console.log 5箇所削除 |
| P4-2 自己署名証明書 .gitignore | ✅ | `.gitignore` に `certs/` 既存（対応済み） |
| P4-3 コメント整理 | ✅ | `useAuth.ts`/`plugins/auth.ts` の ★ デバッグコメント削除、`nuxt.config.ts` i18nコメント修正 |
| P4-4 RSS エラー詳細マスク | ✅ | P1-2 実装時に汎用メッセージ化済み |
| P4-5 index.vue 責務分割 | ✅ | 947行→475行（script ~620行→~65行）。5つのcomposableに分割（詳細は [index-refactor-plan.md](index-refactor-plan.md)） |

### CSP（Content-Security-Policy）の導入状態

P3-4 で `Content-Security-Policy-Report-Only` を設定済み。本適用（`Content-Security-Policy` への切り替え）は、本番環境での十分な観察期間を経た後に実施すること。

現在のポリシー:
```
default-src 'self';
script-src 'self' 'unsafe-inline';
style-src 'self' 'unsafe-inline';
img-src 'self' data: https:;
font-src 'self' data:;
connect-src 'self';
frame-src https://calendar.google.com https://www.google.com/calendar;
object-src 'none';
base-uri 'self';
form-action 'self';
```

### Docker 再ビルド時の注意

サーバー側コード・nuxt.config.ts を変更した場合は、Docker イメージの再ビルドが必要:
```bash
docker compose up -d --build
```
