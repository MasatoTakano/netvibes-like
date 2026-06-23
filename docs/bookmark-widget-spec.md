# ブックマークウィジェット 仕様書

## 1. 概要

よく使うURLをリスト形式で管理・表示するブックマークウィジェットを追加する。  
既存のメモ/RSS/カレンダーウィジェットと同一のアーキテクチャパターンに従い、ドラッグ&ドロップ配置、レイアウト永続化、設定モーダルに統合する。

## 2. 機能要件

### 2.1 ブックマークリスト表示

- ブックマークアイテム（タイトル + URL）をリスト形式で表示
- 各アイテムの先頭に favicon を表示（Google Favicon API: `https://www.google.com/s2/favicons?domain={domain}&sz=32`）
- アイテムクリックで新規タブで開く（`target="_blank" rel="noopener noreferrer"`）
- アイテムはドラッグ&ドロップで並び替え可能（vuedraggable、ウィジェット内ローカル）

### 2.2 ブックマーク追加

- ウィジェット内の追加ボタンから、ブックマーク追加モーダルを開く
- 追加モーダルでタイトル・説明・URLを入力してブックマークリストに追加
  - 入力URLから自動的にドメインを抽出し favicon を表示
  - タイトルは未入力の場合 URL のドメイン名をデフォルトとする
- URL バリデーション: `http://` または `https://` のみ許可
- 外部URLのドラッグ&ドロップ登録は対応しない
  - ブラウザURL欄・タブ由来のD&DはWebページへイベント配送されないケースがあり、挙動が安定しないため廃止する
  - ウィジェット内のブックマーク並び替えD&Dは引き続き対応する

### 2.3 ブックマーク削除

- 各アイテムにホバー表示の削除ボタン（×）を配置
- 削除確認モーダルなし（アイテム単位の軽微な操作のため）

### 2.4 設定モーダル

- ウィジェットタイトル編集
- フォントファミリー選択（既存のフォントリスト流用）
- フォントサイズ指定（8〜72px）
- ※ブックマークアイテム自体の編集・追加・削除はウィジェット本体で行う（設定モーダルでは行わない）

### 2.5 共通ウィジェット機能（既存パターン踏襲）

- 折りたたみ（collapse）
- ドラッグ&ドロップ配置（ペイン間移動）
- レイアウト永続化（debounce save）
- 全体設定からのフォント反映

## 3. データモデル

### 3.1 型定義（`types/index.ts`）

```typescript
// 個別ブックマークアイテム
export interface BookmarkItem {
  id: string;
  title: string;
  url: string;
}

// ブックマークウィジェット
export interface BookmarkWidget extends WidgetBase {
  type: 'bookmark';
  title?: string;           // ウィジェットタイトル
  bookmarks: BookmarkItem[]; // ブックマークのリスト
  fontFamily?: string | null;
  fontSize?: number | null;
  isCollapsed?: boolean;
}

// 設定モーダル用（paneId付き）
export type BookmarkWidgetWithPane = BookmarkWidget & { paneId?: string };

// 設定ペイロード
export interface BookmarkSettingsPayload {
  widgetId: string;
  paneId?: string;
  settings: Pick<BookmarkWidget, 'title' | 'fontFamily' | 'fontSize'>;
}
```

### 3.2 WidgetBase の type 拡張

```typescript
// 変更前
type: 'note' | 'rss' | 'calendar';
// 変更後
type: 'note' | 'rss' | 'calendar' | 'bookmark';
```

### 3.3 PaneData の widgets 配列型拡張

```typescript
widgets: (NoteWidget | RssWidget | CalendarWidget | BookmarkWidget)[];
```

### 3.4 DBスキーマ変更

**不要**。レイアウトデータは JSON 文字列として `Layout.data` カラムに保存されるため、スキーマ変更・マイグレーションなしで新しいウィジェット型を追加できる。

## 4. ファイル変更一覧

| ファイル | 変更内容 |
|---|---|
| `types/index.ts` | `BookmarkItem`, `BookmarkWidget`, `BookmarkWidgetWithPane`, `BookmarkSettingsPayload` 追加。`WidgetBase.type` に `'bookmark'` 追加。`PaneData.widgets` のユニオン型に `BookmarkWidget` 追加 |
| `constants/index.ts` | `DEFAULT_BOOKMARK_FONT_FAMILY`, `DEFAULT_BOOKMARK_FONT_SIZE` 追加 |
| `components/BookmarkWidget.vue` | **新規作成**。ブックマークリスト表示・追加・削除・並び替えUI |
| `components/BookmarkSettingsModal.vue` | **新規作成**。タイトル・フォント設定モーダル |
| `components/WidgetCard.vue` | `bookmark` タイプのレンダリング分岐追加。`getWidgetTitle` に bookmark 処理追加。`open-settings` emit の型に `'bookmark'` 追加 |
| `components/AddWidgetModal.vue` | ブックマーク選択ボタン追加。`selectedType` に `'bookmark'` 追加 |
| `composables/useLayout.ts` | `addBookmarkWidget()` 追加 |
| `composables/useWidgetModal.ts` | `ModalType` に `'bookmark'` 追加。`openSettingsModal`, `handleAddWidget`, `handleSaveBookmarkSettings`, `confirmRemoveWidget` に bookmark 処理追加 |
| `pages/index.vue` | `BookmarkSettingsModal` インポート・配置。`bookmarkWidgetData` computed 追加。`useLayout`, `useWidgetModal` の戻り値追加分を接続 |
| `i18n/locales/ja-JP.json` | ブックマーク関連の日本語翻訳追加 |
| `i18n/locales/en-US.json` | ブックマーク関連の英語翻訳追加 |

## 5. 各ファイルの変更詳細

### 5.1 `components/BookmarkWidget.vue`（新規）

**Props**: `id`, `bookmarks`, `fontFamily`, `fontSize`  
**Emits**: `update:bookmarks`（リスト追加・削除・並び替え時に発行）

**UI構成**:
```
┌─────────────────────────────┐
│ [＋ 追加]                    │
├─────────────────────────────┤
│ ≡ [📡] GitHub        [✏️][×] │  ← ドラッグハンドル + favicon + タイトル + 編集/削除
│ ≡ [📰] Hacker News   [✏️][×] │
│ ≡ [🔵] Twitter       [✏️][×] │
│                             │
│ ※ アイテムなし時はプレースホルダ │
└─────────────────────────────┘
```

- 追加ボタンでブックマーク追加モーダルを開く
- モーダル保存で `BookmarkItem` を生成し emit
- 各アイテムの ✏️ ボタンで編集モーダルを開く
- 各アイテムの × ボタンで削除 emit
- vuedraggable でアイテム並び替え、`onChange` で emit
- favicon URL は `https://www.google.com/s2/favicons?domain=${domain}&sz=32` を使用
- タイトル未入力時は URL からドメイン名を抽出してデフォルトタイトルとする

### 5.2 `components/BookmarkSettingsModal.vue`（新規）

MemoSettingsModal.vue と同一構造（タイトル + フォントファミリー + フォントサイズ）。  
差分のみ:
- i18n キー: `bookmarkSettings.*`
- 型: `BookmarkWidgetWithPane`, `BookmarkSettingsPayload`
- デフォルトフォント: `DEFAULT_BOOKMARK_FONT_*`

### 5.3 `components/WidgetCard.vue`

```typescript
// template に追加
<BookmarkWidget
  v-else-if="widget.type === 'bookmark'"
  :id="widget.id"
  :bookmarks="widget.bookmarks"
  :font-family="widget.fontFamily"
  :font-size="widget.fontSize"
  class="draggable-widget-content"
  @update:bookmarks="emitUpdateBookmarks"
/>

// script に追加
// getWidgetTitle に:
if (widget.type === 'bookmark') {
  return widget.title || t('widget.types.bookmark');
}

// open-settings emit の型に 'bookmark' を追加
// emitUpdateBookmarks メソッド追加
```

メニューバーの背景色クラス: `widget-menu-bar--bookmark`（薄い緑 `#e8f5e9` を想定）

### 5.4 `components/AddWidgetModal.vue`

```html
<button class="button widget-type-button" @click="selectType('bookmark')">
  <span class="icon">🔗</span> {{ $t('addWidget.bookmark') }}
</button>
```

`selectedType` の型: `'note' | 'rss' | 'calendar' | 'bookmark' | null`  
`add()` に: `else if (selectedType.value === 'bookmark') { emit('add', { type: 'bookmark' }); }`

### 5.5 `composables/useLayout.ts`

```typescript
function addBookmarkWidget(paneId: string) {
  const targetPane = panesData.value.find((p) => p.id === paneId);
  if (targetPane) {
    const newWidget: BookmarkWidget = {
      id: crypto.randomUUID(),
      type: 'bookmark',
      title: '',
      bookmarks: [],
      fontFamily: DEFAULT_BOOKMARK_FONT_FAMILY,
      fontSize: DEFAULT_BOOKMARK_FONT_SIZE,
      isCollapsed: false,
    };
    targetPane.widgets.push(newWidget);
    saveLayoutDebounced();
  }
}
```

`updateBookmarks(widgetId, bookmarks)` も追加（MemoContent更新と同等のパターン）。

### 5.6 `composables/useWidgetModal.ts`

- `ModalType` に `'bookmark'` 追加
- `openSettingsModal` に bookmark case 追加
- `handleAddWidget` に `{ type: 'bookmark' }` case 追加
- `handleSaveBookmarkSettings(payload: BookmarkSettingsPayload)` 追加
- `handleSaveGlobalSettings` のループ条件に `widget.type === 'bookmark'` 追加

### 5.7 `pages/index.vue`

- `BookmarkSettingsModal` のインポート・テンプレート配置
- `bookmarkWidgetData` computed 追加
- `useLayout` から `addBookmarkWidget`, `updateBookmarks` を取得
- `useWidgetModal` に `addBookmarkWidget` を渡し、`handleSaveBookmarkSettings` を取得

## 6. i18n キー

### ja-JP.json（追加箇所）

```json
"widget.types.bookmark": "ブックマーク",
"addWidget.bookmark": "ブックマーク",
"bookmarkSettings": {
  "title": "ブックマークウィジェット設定",
  "widgetTitle": "タイトル:",
  "widgetTitlePlaceholder": "ブックマークのタイトル（任意）"
},
"bookmarkWidget": {
  "urlPlaceholder": "URLを入力してください...",
  "addButton": "追加",
  "empty": "ブックマークがありません。URLを入力して追加してください。",
  "errorInvalidUrl": "有効なURLを入力してください (http:// または https://)。"
}
```

### en-US.json（追加箇所）

```json
"widget.types.bookmark": "Bookmarks",
"addWidget.bookmark": "Bookmarks",
"bookmarkSettings": {
  "title": "Bookmark Widget Settings",
  "widgetTitle": "Title:",
  "widgetTitlePlaceholder": "Bookmark title (optional)"
},
"bookmarkWidget": {
  "urlPlaceholder": "Enter URL...",
  "addButton": "Add",
  "empty": "No bookmarks. Enter a URL to add one.",
  "errorInvalidUrl": "Please enter a valid URL (http:// or https://)."
}
```

## 7. セキュリティ考慮事項

| 項目 | 対策 |
|---|---|
| favicon 取得 | Google Favicon API のみ使用（ユーザー入力URLからドメイン抽出してAPIに渡す）。外部サイトへの直接リクエストなし |
| リンククリック | `target="_blank" rel="noopener noreferrer"` |
| URL バリデーション | `http://` `https://` のみ許可（`javascript:` 等のスキームを排除） |
| XSS | ブックマークのタイトル・URL はテキストバインディング（`{{ }}`）で表示。`v-html` 不使用 |

## 8. 今回対応外（スコープ外）

- ブックマークのフォルダ分け・階層構造
- ブックマークのインポート/エクスポート
- favicon 取得の失敗時フォールバック画像（CSSデフォルトアイコンで対応）
- OGPメタデータ取得によるリッチプレビュー

## 9. 検証項目

- [ ] 追加ボタンからブックマーク追加モーダルを開ける
- [ ] URL入力でブックマークアイテムが追加され、favicon が表示される
- [ ] ブックマークアイテムのドラッグ&ドロップで並び替えができる
- [ ] 削除ボタンでアイテムが削除される
- [ ] 設定モーダルでタイトル・フォントが変更できる
- [ ] 折りたたみが機能する
- [ ] ページリロード後にレイアウトが復元される
- [ ] lint / typecheck が通過する
