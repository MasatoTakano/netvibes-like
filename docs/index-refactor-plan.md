# index.vue 責務分割 設計書（P4-5）

**対象**: `pages/index.vue`（947行）→ composables への分割
**作成日**: 2026-06-21
**前提**: 機能変更なし、純粋なリファクタリング（動作・見た目完全不変）

---

## 1. 現状分析

### 1.1 index.vue の構造（947行）

| 行範囲 | ブロック | 行数 |
|---|---|---|
| 1–173 | `<template>` | 173 |
| 175–206 | imports + useAuth + useI18n | 32 |
| 209–250 | State 変数群（panesData, modal, globalSettings 等） | 42 |
| 252–280 | Watchers（globalSettings→CSS変数, isLoading→resize許可） | 29 |
| 282–306 | Computed（globalStyles）+ debounce ユーティリティ | 25 |
| 308–370 | onMounted（設定ロード + レイアウトロード + 正規化） | 63 |
| 372–415 | 保存処理（saveLayoutDebounced, saveGlobalSettingsDebounced） | 44 |
| 417–791 | Methods（リサイズ、CRUD、モーダル、D&D、折りたたみ） | 375 |
| 793–797 | useHead | 5 |
| 799–947 | `<style scoped>` | 149 |

### 1.2 責務の分類

現状1ファイルに混在している責務を分類:

| 責務カテゴリ | 関連する変数・関数 | 行数 |
|---|---|---|
| **A. レイアウトCRUD** | `panesData`, `isLoading`, `isSaving`, `saveError`, `splitpanesKey`, `onMounted`(ロード部分), `saveLayoutDebounced`, `loadLayout`, ウィジェットCRUD(add/remove/update), `handleDragChange` | ~200行 |
| **B. ペインリサイズ** | `isSplitpanesReady`, `allowPaneResizeHandling`, `handlePaneReady`, `handlePaneResize` | ~40行 |
| **C. モーダル管理** | `activeModal`, `editingWidgetData`, `editingPaneId`, `widgetToDelete`, `openSettingsModal`, `closeModal`, `handleConfirmDelete`, `confirmRemoveWidget`, `handleSave*Settings` | ~180行 |
| **D. グローバル設定** | `globalSettings`(reactive), `saveGlobalSettingsDebounced`, `openGlobalSettingsModal`, `handleSaveGlobalSettings`, CSS変数watcher | ~60行 |
| **E. ウィジェット追加** | `handleAddWidget`, `addMemoWidgetInternal`, `addRssWidgetInternal`, `addCalendarWidgetInternal`, `openAddWidgetMenuForFirstPane` | ~80行 |

---

## 2. 分割方針

### 2.1 論点と決定

#### 論点1: `panesData` の所有権

| 案 | 内容 | メリット | デメリット |
|---|---|---|---|
| A | `useLayout` が所有、他 composable は引数で受け取る | 単一責任、データ源泉が明確 | composable 間の引数渡しが増える |
| B | `index.vue` が所有、全 composable に渡す | index.vue が制御しやすい | index.vue がファサード化し、行数削減効果が薄い |

**決定: 案A** — `useLayout` が `panesData` を所有し、返り値として公開。他 composable は `panesData` と `saveLayoutDebounced` を受け取って使用。

#### 論点2: debounce ユーティリティの扱い

**決定**: `composables/useDebounce.ts` として共通ユーティリティに切り出し。複数 composable で再利用。

#### 論点3: globalSettings の扱い

**決定**: `composables/useGlobalSettings.ts` として独立させる。CSS変数の watchEffect もここに移動。index.vue からは `globalStyles` computed と `globalSettings` reactive を受け取る。

#### 論点4: composable 間の依存関係

```
useLayout (panesData の所有者)
  ├── usePaneResize      → panesData + saveLayoutDebounced を使用
  ├── useWidgetActions    → panesData + saveLayoutDebounced を使用
  └── useGlobalSettings   → 独立（globalSettings のみ）
```

`useWidgetModal` と `useWidgetActions` を分けるか迷ったが、モーダルの save ハンドラがウィジェット更新を直接行うため、**`useWidgetModal` に統合**する（モーダル開閉 + save時のウィジェット更新を一括管理）。

### 2.2 分割後の構成

```
composables/
├── useDebounce.ts         (新規) debounce ユーティリティ
├── useLayout.ts           (新規) レイアウトCRUD + ウィジェット操作
├── usePaneResize.ts       (新規) ペインリサイズ管理
├── useWidgetModal.ts      (新規) モーダル管理 + 設定保存
├── useGlobalSettings.ts   (新規) グローバル設定 + CSS変数
└── useAuth.ts             (既存) 変更なし
```

---

## 3. 各 composable の詳細設計

### 3.1 `composables/useDebounce.ts`

```ts
export function useDebounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void
```

- index.vue の `debounce` 関数（289–306行）をそのまま切り出し
- 純粋関数、状態なし

### 3.2 `composables/useLayout.ts`

**所有状態**:
- `panesData: Ref<PaneData[]>`
- `isLoading: Ref<boolean>`
- `isSaving: Ref<boolean>`
- `saveError: Ref<string | null>`
- `splitpanesKey: Ref<number>`

**公開メソッド**:
- `loadLayout(): Promise<void>` — onMounted 内のレイアウトロード・正規化ロジック（308–370行）
- `saveLayoutDebounced(): void` — debounce 保存（372–402行）
- `addWidget(paneId: string, widget: NoteWidget | RssWidget | CalendarWidget): void`
- `removeWidget(widgetId: string, paneId: string): void`
- `updateNoteContent(widgetId: string, content: string): void`
- `updateRssWidgetTitle(widgetId: string, paneId: string, title: string): void`
- `toggleCollapse(widgetId: string, paneId: string): void`
- `handleDragChange(): void`
- `findWidget(widgetId: string, paneId?: string): { pane, widget, widgetIndex } | null`

**引数**: なし（自立型）
**依存**: `useDebounce`, `$fetch`, 型定義, 定数(DEFAULT_NOTE_FONT_FAMILY等)

### 3.3 `composables/usePaneResize.ts`

**所有状態**:
- `isSplitpanesReady: Ref<boolean>`
- `allowPaneResizeHandling: Ref<boolean>`

**公開メソッド**:
- `handlePaneReady(): void`
- `handlePaneResize(eventPayload): void`

**引数**:
```ts
usePaneResize(options: {
  panesData: Ref<PaneData[]>;
  isLoading: Ref<boolean>;
  saveLayoutDebounced: () => void;
})
```

**依存**: 型定義のみ（ロジックは417–456行）

### 3.4 `composables/useWidgetModal.ts`

**所有状態**:
- `activeModal: Ref<ModalType>`
- `editingWidgetData: Ref<NoteWidget | RssWidget | CalendarWidget | null>`
- `editingPaneId: Ref<string | null>`
- `widgetToDelete: Ref<{...} | null>`

**公開メソッド**:
- `openAddWidgetMenu(): void` — Add Widget モーダルを開く
- `openSettingsModal(widgetId, paneId, widgetType): void`
- `confirmRemoveWidget(widgetId, paneId): void` — 削除確認モーダル
- `closeModal(): void`
- `handleAddWidget(payload): void` — ウィジェット追加実行
- `handleConfirmDelete(): void`
- `handleSaveRssSettings(payload): void`
- `handleSaveMemoSettings(payload): void`
- `handleSaveCalendarSettings(payload): void`

**引数**:
```ts
useWidgetModal(options: {
  panesData: Ref<PaneData[]>;
  saveLayoutDebounced: () => void;
  t: (key: string) => string;  // i18n
})
```

**依存**: 型定義、定数(DEFAULT_*)

### 3.5 `composables/useGlobalSettings.ts`

**所有状態**:
- `globalSettings: Reactive<GlobalSettings>`

**公開メソッド**:
- `loadGlobalSettings(): Promise<void>` — onMounted 内のロード（313–323行）
- `saveGlobalSettingsDebounced(): void`
- `openGlobalSettingsModal()` → これは useWidgetModal 側で activeModal を制御
- `handleSaveGlobalSettings(payload): void`
- `globalStyles: ComputedRef<Record<string, string>>` — CSS変数バインディング

**副作用**: `watchEffect` で `document.documentElement.style` に CSS変数を設定

**引数**: なし（panesData は handleSaveGlobalSettings 内で全ウィジェットのフォント更新に必要）
```ts
useGlobalSettings(options: {
  panesData: Ref<PaneData[]>;
  saveLayoutDebounced: () => void;
})
```

---

## 4. index.vue リファクタ後の構造（目標）

```vue
<template>
  <!-- テンプレート部分は変更なし（173行） -->
</template>

<script setup lang="ts">
  // imports
  import { Splitpanes, Pane } from 'splitpanes';
  import draggable from 'vuedraggable';
  // ...

  // composables 初期化
  const { t } = useI18n();
  const { user, isLoggedIn, logout } = useAuth();

  const {
    panesData, isLoading, isSaving, splitpanesKey,
    loadLayout, saveLayoutDebounced,
    updateNoteContent, updateRssWidgetTitle, toggleCollapse,
    handleDragChange,
  } = useLayout();

  const {
    globalSettings, globalStyles,
    loadGlobalSettings, handleSaveGlobalSettings,
    saveGlobalSettingsDebounced,
  } = useGlobalSettings({ panesData, saveLayoutDebounced });

  const {
    isSplitpanesReady, allowPaneResizeHandling,
    handlePaneReady, handlePaneResize,
  } = usePaneResize({ panesData, isLoading, saveLayoutDebounced });

  const {
    activeModal, editingWidgetData, editingPaneId, widgetToDelete,
    openAddWidgetMenu, openSettingsModal, openGlobalSettingsModal,
    closeModal, handleAddWidget, confirmRemoveWidget, handleConfirmDelete,
    handleSaveRssSettings, handleSaveMemoSettings, handleSaveCalendarSettings,
  } = useWidgetModal({ panesData, saveLayoutDebounced, t });

  const availableFonts = AVAILABLE_FONTS;

  // onMounted: データロード
  onMounted(async () => {
    await loadGlobalSettings();
    await loadLayout();
  });

  // useHead
  useHead({ title: t('appTitle') });
</script>

<style scoped>
  <!-- スタイル部分は変更なし（149行） -->
</style>
```

**目標行数**: ~60行（script部分）+ 173行（template）+ 149行（style）= **~380行**

---

## 5. 実装ステップ

### Step 1: `useDebounce.ts` 作成
- `debounce` 関数を切り出し
- index.vue はまだ変更しない

### Step 2: `useLayout.ts` 作成
- State（panesData等）+ ロード/保存 + ウィジェットCRUD を移動
- 内部で `useDebounce` を使用

### Step 3: `useGlobalSettings.ts` 作成
- globalSettings + CSS変数watcher + 保存処理を移動

### Step 4: `usePaneResize.ts` 作成
- リサイズ関連ロジックを移動

### Step 5: `useWidgetModal.ts` 作成
- モーダル管理 + save ハンドラを移動

### Step 6: `index.vue` 書き換え
- composables を呼び出す形に書き換え
- テンプレートは変更なし

### Step 7: 検証
- `npx eslint` で全ファイル確認
- `npx nuxi typecheck` で型確認
- ブラウザで動作確認（Docker再ビルド）

---

## 6. リスクと対策

| リスク | 影響 | 対策 |
|---|---|---|
| composable 間の参照が循環する | コンパイルエラー | 依存方向を一方向に保つ（useLayout ← 他） |
| reactive 参照が壊れてリアクティビティが失われる | UIが更新されない | `Ref` をそのまま渡す（`.value` で展開しない） |
| Nuxt auto-import と明示 import の競合 | 二重定義エラー | composables 内では明示 import のみ使用 |
| watchEffect の実行タイミング変化 | CSS変数が反映されない | onMounted 前に watchEffect を登録する（composable 呼び出し時に自動登録されることを確認） |

---

## 7. 検証基準

- [ ] ESLint エラーゼロ（全新規ファイル + index.vue）
- [ ] TypeScript 型エラーゼロ（今回変更分）
- [ ] ブラウザで以下が全て動作すること:
  - レイアウトロード・保存（debounce）
  - ウィジェット追加・削除・編集
  - ペインリサイズ
  - モーダル開閉（全6種）
  - グローバル設定のフォント反映
  - ドラッグ&ドロップ
  - 折りたたみ
