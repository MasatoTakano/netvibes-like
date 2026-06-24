# コードレビュー報告書: 責務分離 & セキュリティ

**日付:** 2026-06-24
**対象:** memo-app 全体（サーバー / クライアント / インフラ）
**レビュー範囲:** 責務分離の適切性、セキュリティ実装の問題点

---

## 1. 全体評価

**HIGH: 0件 / MEDIUM: 1件 / LOW: 6件 / INFO: 2件**

責務分離・セキュリティともに高い水準で実装されている。Composable 3層分割、サーバーサイドの SSRF/CSRF/バリデーション対策は特に優秀。即座に修正すべきクリティカルな問題はない。

一方で、本報告書作成後の妥当性レビューにより、初版の一部表現（「全POST」「全API」「Docker socket read-only」「最小権限」など）は実装範囲に対してやや過剰または包括的すぎることが分かったため、本版では限定表現に修正している。

---

## 2. 責務分離 — 確認結果

### 2.1 Composable 層（✅ 適切）

| Composable | 責務 | 評価 |
|---|---|---|
| `useLayout` | レイアウト state 管理 + load/save | ✅ 単一責務 |
| `useWidgetMutations` | ウィジェット CRUD 操作 | ✅ panesData ref への操作のみ |
| `useWidgetModal` | モーダル開閉状態管理 | ✅ mutation は useWidgetMutations に委譲 |
| `useGlobalSettings` | グローバルフォント設定 + CSS変数反映 | ✅ |
| `usePaneResize` | splitpanes 連動 | ✅ |
| `useAuth` | 認証状態 + Better Auth クライアント呼び出し | ✅ |

- index.vue が各 Composable を組み合わせるオーケストレーション役として機能している
- 依存注入パターン（`useWidgetMutations({ panesData, saveLayoutDebounced })`）が一方向でクリーン

### 2.2 サーバーユーティリティ層（✅ 適切）

| ファイル | 責務 | 評価 |
|---|---|---|
| `auth.ts` | Better Auth 設定 + `requireSession` ヘルパー | ✅ |
| `rss.ts` | RSS 取得・パース・正規化・エラー分類（サービス層） | ✅ トランスポート層から分離済み |
| `ssrf.ts` | SSRF 対策付き安全な URL fetch | ✅ |
| `calendar.ts` | iframeTag サーバー側検証（多層防御） | ✅ |
| `rateLimit.ts` | インメモリ・スライディングウィンドウレートリミッター | ✅ |
| `feedCache.ts` | RSS フィード短期 TTL キャッシュ | ✅ |
| `clientIp.ts` | 信頼できるクライアント IP 抽出 | ✅ |
| `envValidation.ts` | 環境変数 fail-fast 検証 | ✅ |
| `prisma.ts` | PrismaClient シングルトン | ✅ |

- API ハンドラ（`server/api/*.ts`）は薄く、ビジネスロジックは utils に委譲されている
- `utils/calendarHosts.ts` がクライアント・サーバー間の単一ソースとして機能している

### 2.3 責務分離の改善推奨事項

#### RESP-1［LOW］`updateWidgetSettings` の `Object.assign` に型ガードがない

**対象:** `composables/useWidgetMutations.ts` L175-193

```ts
function updateWidgetSettings(
  widgetId: string,
  paneId: string | undefined,
  widgetType: 'note' | 'rss' | 'calendar' | 'bookmark',
  settings: Record<string, unknown>,   // ← 任意キーを許容
) {
  // ...
  Object.assign(widget, settings);     // ← id/type も上書き可能
}
```

**問題:** `settings` が `Record<string, unknown>` であり、`Object.assign` で widget の任意フィールド（`id`, `type` を含む）を上書きできる。現在の呼び出し元は型安全だが、構造的な防御がない。

**対策案:** 各ウィジェットタイプごとに許可フィールドの allowlist を定義し、それ以外のキーは無視する。

#### RESP-2［LOW］セッション検証ロジックの軽微な重複

**対象:** 以下 3 箇所で `auth.api.getSession` を直接呼んでいる

| ファイル | 用途 |
|---|---|
| `server/utils/auth.ts` (`requireSession`) | 認証必須エンドポイント用（未認証 → 401 throw） |
| `server/api/user.get.ts` | 未認証なら null を返す（throw しない） |
| `plugins/auth.ts` | SSR 時のユーザー状態初期化 |

**問題:** `user.get.ts` と `plugins/auth.ts` は「未認証 → null」という意図的な違いがあるため必須の修正ではないが、共通ヘルパー（例: `getOptionalSession`）化できればよりクリーン。

---

## 3. セキュリティ — 確認結果

### 3.1 既存のセキュリティ対策（✅ 優秀）

| カテゴリ | 対策内容 | 実装箇所 |
|---|---|---|
| **パスワードハッシュ** | Argon2id（memoryCost:19456, timeCost:2, parallelism:1） | `server/utils/auth.ts` |
| **入力バリデーション** | 独自の状態変更API（layout/settings）で Zod schema 検証。layout.post.ts ではサイズ/数/URLスキーム/font allowlist を定義。settings.post.ts は現状 fontFamily の長さ制限のみで、allowlist 化が改善候補 | `server/api/layout.post.ts`, `settings.post.ts` |
| **URL スキーム制限** | `javascript:`, `file:` 等を拒否。http/https のみ許可 | `layout.post.ts` (`httpUrlSchema`), `rss.ts` (`toSafeHttpUrl`) |
| **CSRF 対策** | 独自の状態変更APIに対して Origin/Referer 検証 + Content-Type 強制（application/json）。`/api/auth/*` は Better Auth 側の検証に委譲 | `server/middleware/originCheck.ts` |
| **SSRF 対策** | DNS pinning, リダイレクト手動追跡（各ホップ再検証）, public/unicast アドレスのみ許可, IPv4-mapped IPv6 の再判定, ポート制限(80/443), 認証情報付きURL拒否, レスポンスサイズ上限(1MiB), タイムアウト(10s) | `server/utils/ssrf.ts` |
| **XSS 対策（MemoNote）** | DOMPurify サニタイズ + 手動 HTML エスケープ（二重防御）, `ALLOWED_TAGS: ['a']` に限定 | `components/MemoNote.vue` |
| **XSS 対策（Calendar）** | DOMPurify + 許可ホスト検証の多層防御。クライアントとサーバーで二重チェック | `components/CalendarWidget.vue`, `server/utils/calendar.ts` |
| **カレンダー iframe 制限** | クライアント側では許可ホスト(HTTPS): `calendar.google.com`, `www.google.com/calendar/*` のみ表示し、`sandbox` 属性を付与。サーバー側では保存時に iframe src の許可ホストを検証 | `utils/calendarHosts.ts`, `CalendarWidget.vue`, `server/utils/calendar.ts` |
| **レートリミット** | RSS API: 30 req / 5 min / user+IP。認証 API: 30 req / 15 min（Better Auth 内蔵） | `server/api/rss.get.ts`, `server/utils/auth.ts` |
| **信頼できる IP 抽出** | X-Forwarded-For の末尾エントリを採用（先頭は偽装可能なため不信） | `server/utils/clientIp.ts` |
| **セキュリティヘッダー** | HSTS, X-Frame-Options:DENY, X-Content-Type-Options:nosniff, Referrer-Policy, Permissions-Policy, CSP (Report-Only) | `nuxt.config.ts` |
| **環境変数 fail-fast** | production で BETTER_AUTH_SECRET/URL 不備時にプロセス停止 | `server/plugins/envCheck.ts`, `server/utils/envValidation.ts` |
| **Docker セキュリティ** | マルチステージビルド, non-root 実行(USER node), Traefik dashboard BasicAuth 認証。Docker socket は read-only マウントだが権限が強いため、本番では docker-socket-proxy 等の権限制限も検討 | `Dockerfile`, `docker-compose.yml` |
| **アプリ専用DBユーザー** | PostgreSQL ユーザー（memoapp）を使用。ただし公式イメージの初期ユーザーは強い権限を持ち得るため、本番では非superuser/最小権限ユーザーを別途作成することを推奨 | `docker-compose.yml`, `prisma/schema.prisma` |
| **DB データ分離** | 永続化データを扱う layout/settings API では `requireSession` により userId を取得し、`where: { userId }` でユーザーデータをスコープ | `layout.get/post.ts`, `settings.get/post.ts` |

### 3.2 セキュリティ改善推奨事項

#### SEC-1［LOW / 対応推奨］`settings.post.ts` の fontFamily バリデーション不整合

**対象:** `server/api/settings.post.ts` L9-12

**現状:**

```ts
// settings.post.ts — 自由文字列（allowlist ではない）
const fontSettingsSchema = z.object({
  fontFamily: z.string().min(1).max(100),
  fontSize: z.number().int().min(6).max(72),
});
```

**対比（layout.post.ts は allowlist 適用済み）:**

```ts
// layout.post.ts — allowlist で検証
const fontSchema = z
  .enum(AVAILABLE_FONTS as [string, ...string[]])
  .nullable()
  .optional();
```

**影響:**
- `globalSettings.fontFamily` は `document.documentElement.style.setProperty()` で CSS 変数に直接書き込まれる（`useGlobalSettings.ts` L25-28）
- 即時 XSS につながる可能性は高くないが、`layout.post.ts` との検証方針が不一致
- 表示崩れ・保存データ品質低下・多層防御不足の観点から allowlist 化を推奨

**修正案:**

```ts
import { AVAILABLE_FONTS } from '~/constants';

const fontSettingsSchema = z.object({
  fontFamily: z.enum(AVAILABLE_FONTS as [string, ...string[]]),
  fontSize: z.number().int().min(6).max(72),
});
```

#### SEC-2［MEDIUM / 本番流用時］PostgreSQL ポートがホストに公開

**対象:** `docker-compose.yml` L11

```yaml
postgres:
    ports:
      - '5432:5432'   # ← 本番では削除すべき
```

**影響:** 開発用途（ホスト側 `npm run dev` からの接続）としては許容範囲。ただし Traefik/TLS 構成を含む Compose であり、本番に流用した場合は MEDIUM 相当のリスクになる。さらに `POSTGRES_PASSWORD: memoapp_dev` の固定値も開発用前提である。

**対策案:**
- 本番では `ports` を削除し、`internal` ネットワーク内通信に限定する
- 開発でも必要に応じて `127.0.0.1:5432:5432` に限定する
- 本番用 compose と開発用 override/profile を分離する
- 本番DBユーザーは非superuser/最小権限で作成する

#### SEC-3［LOW］レートリミッターのバケット未クリーンアップ

**対象:** `server/utils/rateLimit.ts` L22

**現状:** `buckets` Map のエントリは、そのキーが再度アクセスされた時しか破棄されない（L48 の filter はアクセス時のみ発動）。

**影響:** 大量の一意キー（異なる IP / UserID の組み合わせ）を生成されると、メモリが単調増加する。小規模運用では実害は低いが、長期運用時や攻撃時に問題になり得る。

**対策案:**

```ts
// 定期的なスイープ（5分毎）
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of buckets) {
    entry.timestamps = entry.timestamps.filter((t) => t > now - MAX_WINDOW_MS);
    if (entry.timestamps.length === 0) {
      buckets.delete(key);
    }
  }
}, 5 * 60 * 1000);
```

または、バケットエントリ数の上限（例: 10,000）を設け、超過時に最古のエントリを削除する。

#### SEC-4［LOW］`settings.get.ts` の保存済み設定再検証がない

**対象:** `server/api/settings.get.ts`

**現状:** DB の JSON を parse した後、`fontFamily` / `fontSize` を型アサーション相当で扱っている。

```ts
const parsedSetting: GlobalSettings = JSON.parse(settingRecord.data);
```

**影響:** `settings.post.ts` を allowlist 化しても、既存DB値・手動投入値・過去バージョンで保存された値には効かない。

**対策案:** read 時にも Zod `safeParse` を行い、不正値は `DEFAULT_GLOBAL_SETTINGS` に fallback する。

#### SEC-5［LOW］`layout.get.ts` の保存済み layout 再検証がない

**対象:** `server/api/layout.get.ts`

**現状:** DB の JSON を parse してそのまま返している。

```ts
return JSON.parse(layoutRecord.data);
```

**影響:** 通常経路では `layout.post.ts` の強い Zod 検証が効くが、旧データ・DB直接投入・将来のスキーマ変更後の互換性崩れには弱い。特に Bookmark の `href` などは保存時の URL 検証に依存しているため、read 時再検証があると多層防御になる。

**対策案:** `layout.post.ts` の schema を共有可能な utility に切り出し、`layout.get.ts` でも `safeParse` して、不正データは `defaultLayoutData` へ fallback する。

#### SEC-6［INFO］CSP が Report-Only モード

**対象:** `nuxt.config.ts` L23

**現状:** コメントで段階導入と明記されており、意図的な設計。

```
'Content-Security-Policy-Report-Only': "default-src 'self'; ..."
```

**推奨:** 本番運用開始後、十分な観察期間（1〜2週間）を経て `Content-Security-Policy` に切り替える。違反レポートの収集方法（Report-To ヘッダーの設定等）も併せて検討する。

#### SEC-7［INFO］Docker socket マウントのリスク注記

**対象:** `docker-compose.yml` L49

```yaml
- '/var/run/docker.sock:/var/run/docker.sock:ro'
```

**現状:** Traefik Docker provider 用に Docker socket を read-only マウントしている。

**補足:** `:ro` はファイルシステム上のマウントを read-only にするだけで、Docker API 操作を安全に読み取り専用化するものではない。Traefik コンテナ侵害時には Docker socket 経由で強い影響が出る可能性がある。

**推奨:** 本番では `docker-socket-proxy` などにより Traefik が必要とする API のみに権限を絞ることを検討する。

---

## 4. 推奨対応優先度

| 優先度 | ID | 内容 | 工数目安 |
|---|---|---|---|
| 対応推奨 | SEC-1 | settings.post.ts fontFamily allowlist 化 | 〜15分 |
| 本番前対応 | SEC-2 | docker-compose.yml PostgreSQL ポート削除 / 開発用 override 分離 | 〜15分 |
| **対応推奨** | SEC-3 | レートリミッターバケットの定期クリーンアップ | 〜30分 |
| 対応推奨 | SEC-4 | settings.get.ts の read時再検証 | 〜20分 |
| 対応推奨 | SEC-5 | layout.get.ts の read時再検証 / schema共有化 | 〜45分 |
| 対応推奨 | RESP-1 | updateWidgetSettings の allowlist 型ガード | 〜30分 |
| 任意 | RESP-2 | セッション検証の共通ヘルパー化 | 〜20分 |
| 本番前対応 | SEC-6 | CSP を Report-Only → 本適用に切り替え | 〜10分 |
| 本番前対応 | SEC-7 | Docker socket proxy 等による権限制限 | 〜30分 |

---

## 5. レビュー対象ファイル一覧

### サーバー側
- `server/utils/auth.ts`, `prisma.ts`, `rss.ts`, `ssrf.ts`, `calendar.ts`, `rateLimit.ts`, `feedCache.ts`, `clientIp.ts`, `envValidation.ts`
- `server/api/layout.get.ts`, `layout.post.ts`, `settings.get.ts`, `settings.post.ts`, `rss.get.ts`, `user.get.ts`, `auth/[...all].ts`
- `server/middleware/originCheck.ts`
- `server/plugins/envCheck.ts`

### クライアント側
- `composables/useLayout.ts`, `useWidgetMutations.ts`, `useWidgetModal.ts`, `useAuth.ts`, `useGlobalSettings.ts`
- `plugins/auth.ts`
- `lib/auth-client.ts`
- `components/MemoNote.vue`, `CalendarWidget.vue`, `BookmarkWidget.vue`
- `pages/index.vue`, `login.vue`, `signup.vue`
- `middleware/auth.global.ts`

### インフラ・設定
- `nuxt.config.ts`, `docker-compose.yml`, `Dockerfile`
- `prisma/schema.prisma`
- `utils/calendarHosts.ts`, `constants/index.ts`, `types/index.ts`
- `.env.example`
