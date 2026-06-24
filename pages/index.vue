---pages/index.vue---
<template>
  <!-- ClientOnly でラップ -->
  <ClientOnly placeholder="Loading interface...">
    <div id="app-container" :style="globalStyles">
      <!-- ヘッダー領域 -->
      <header class="app-header">
        <h1>{{ $t('appTitle') }}</h1>
        <!-- 右側にボタンを集約するためのコンテナ -->
        <div class="header-actions">
          <!-- ログインしている場合 -->
          <template v-if="isLoggedIn">
            <!-- ライト・ダークモード選択-->
            <ThemeSwitcher />
            <!-- 言語選択 -->
            <LanguageSwitcher />
            <!-- ユーザ情報 -->
            <span class="user-info">[ {{ user?.email || user?.name }} ]</span>
            <!-- Add Widget ボタン -->
            <button
              class="button button-primary header-button"
              @click="openAddWidgetMenuForFirstPane"
            >
              {{ $t('addWidget.button') }}
            </button>
            <button
              class="button button-secondary header-button"
              title="$t('globalSettings.title')"
              @click="openGlobalSettingsModal"
            >
              ⚙️ {{ $t('globalSettings.title') }}
            </button>
            <!-- ログアウト -->
            <button
              class="button button-secondary header-button"
              @click="logout"
            >
              {{ $t('logout.button') }}
            </button>
          </template>
        </div>
      </header>
      <ClientOnly placeholder="Loading splitpanes...">
        <splitpanes
          v-if="!isLoading && panesData.length > 0"
          :key="splitpanesKey"
          ref="splitpanesRef"
          class="default-theme app-splitpanes"
          :watch-resized="true"
          @resized="handlePaneResize"
          @ready="handlePaneReady"
        >
          <pane
            v-for="pane in panesData"
            :key="pane.id"
            :size="pane.size"
            class="app-pane"
          >
            <draggable
              v-model="pane.widgets"
              item-key="id"
              group="widgets-group"
              tag="div"
              class="drag-area"
              ghost-class="ghost"
              chosen-class="chosen"
              drag-class="drag"
              handle=".widget-menu-bar"
              @change="handleDragChange"
            >
              <!-- #header -->
              <template #header> </template>

              <!-- 各ウィジェットの表示 (WidgetCardコンポーネントを使用) -->
              <template #item="{ element: widget }">
                <WidgetCard
                  :widget="widget"
                  :pane-id="pane.id"
                  class="draggable-widget"
                  @toggle-collapse="toggleCollapse"
                  @open-settings="openSettingsModal"
                  @confirm-remove="confirmRemoveWidget"
                  @update:note-content="updateNoteContent"
                  @update:rss-title="updateRssWidgetTitle"
                  @update:bookmarks="updateBookmarks"
                />
              </template>

              <!-- 空ペインのメッセージ -->
              <template #footer>
                <div
                  v-if="!pane.widgets || pane.widgets.length === 0"
                  class="empty-pane-message"
                >
                  {{ $t('widget.empty') }}
                </div>
              </template>
            </draggable>
          </pane>
        </splitpanes>
      </ClientOnly>

      <!-- RSS設定モーダル -->
      <RssSettingsModal
        :show="activeModal === 'rss'"
        :widget-data="rssWidgetData"
        :available-fonts="availableFonts"
        @close="closeModal"
        @save="handleSaveRssSettings"
      />
      <!-- メモ設定モーダル -->
      <MemoSettingsModal
        :show="activeModal === 'memo'"
        :widget-data="memoWidgetData"
        :available-fonts="availableFonts"
        @close="closeModal"
        @save="handleSaveMemoSettings"
      />
      <!-- カレンダー設定モーダル -->
      <CalendarSettingsModal
        :show="activeModal === 'calendar'"
        :widget-data="calendarWidgetData"
        @close="closeModal"
        @save="handleSaveCalendarSettings"
      />
      <!-- ブックマーク設定モーダル -->
      <BookmarkSettingsModal
        :show="activeModal === 'bookmark'"
        :widget-data="bookmarkWidgetData"
        :available-fonts="availableFonts"
        @close="closeModal"
        @save="handleSaveBookmarkSettings"
      />
      <!-- 全体設定モーダル -->
      <GlobalSettingsModal
        :show="activeModal === 'global'"
        :initial-settings="globalSettings"
        :available-fonts="availableFonts"
        @close="closeModal"
        @save="handleSaveGlobalSettings"
      />
      <!-- ウィジェット追加モーダル -->
      <AddWidgetModal
        :show="activeModal === 'add'"
        @close="closeModal"
        @add="handleAddWidget"
      />
      <!-- 削除確認モーダル -->
      <ConfirmDeleteModal
        :show="activeModal === 'delete'"
        :item-description="widgetToDelete?.description"
        @close="closeModal"
        @confirm="handleConfirmDelete"
      >
        <template v-if="widgetToDelete" #description>
          <p>{{ $t('confirmDelete.message') }}</p>
          <p class="item-description-highlight">
            "{{ widgetToDelete.description }}"
          </p>
        </template>
      </ConfirmDeleteModal>
    </div>
    <template #fallback>
      <!-- Loading表示 -->
      <div style="padding: 20px; text-align: center">
        {{ $t('common.loading') }}
      </div>
    </template>
  </ClientOnly>
</template>

<script setup lang="ts">
  import { onMounted, computed } from 'vue';
  import { Splitpanes, Pane } from 'splitpanes';
  import draggable from 'vuedraggable';
  import { AVAILABLE_FONTS } from '~/constants';
  import type {
    NoteWidgetWithPane,
    RssWidgetWithPane,
    CalendarWidgetWithPane,
    BookmarkWidgetWithPane,
  } from '~/types';
  import RssSettingsModal from '~/components/RssSettingsModal.vue';
  import MemoSettingsModal from '~/components/MemoSettingsModal.vue';
  import CalendarSettingsModal from '~/components/CalendarSettingsModal.vue';
  import BookmarkSettingsModal from '~/components/BookmarkSettingsModal.vue';
  import GlobalSettingsModal from '~/components/GlobalSettingsModal.vue';
  import AddWidgetModal from '~/components/AddWidgetModal.vue';
  import ConfirmDeleteModal from '~/components/ConfirmDeleteModal.vue';
  import LanguageSwitcher from '~/components/LanguageSwitcher.vue';
  import ThemeSwitcher from '~/components/ThemeSwitcher.vue';
  import WidgetCard from '~/components/WidgetCard.vue';

  const { t } = useI18n();
  const { user, isLoggedIn, logout } = useAuth();

  // --- Layout: state + load/save のみ ---
  const {
    panesData,
    isLoading,
    splitpanesKey,
    loadLayout,
    saveLayoutDebounced,
  } = useLayout();

  // --- Widget Mutations: ウィジェットCRUD操作 ---
  const mutations = useWidgetMutations({
    panesData,
    saveLayoutDebounced,
  });
  const {
    updateNoteContent,
    updateRssWidgetTitle,
    updateBookmarks,
    toggleCollapse,
    handleDragChange,
  } = mutations;

  // --- Global Settings: フォント設定 + CSS変数 ---
  const { globalSettings, globalStyles, loadGlobalSettings, saveGlobalSettingsDebounced } =
    useGlobalSettings();

  // --- Pane Resize: splitpanes連動 ---
  const { handlePaneReady, handlePaneResize } = usePaneResize({
    panesData,
    isLoading,
    saveLayoutDebounced,
  });

  // --- Widget Modal: モーダル開閉状態のみ管理 ---
  const {
    activeModal,
    editingWidgetData,
    editingPaneId,
    widgetToDelete,
    openAddWidgetMenu: openAddWidgetMenuForFirstPane,
    openSettingsModal,
    openGlobalSettingsModal,
    closeModal,
    handleAddWidget,
    confirmRemoveWidget,
    handleConfirmDelete,
    handleSaveRssSettings,
    handleSaveMemoSettings,
    handleSaveCalendarSettings,
    handleSaveBookmarkSettings,
    handleSaveGlobalSettings,
  } = useWidgetModal({
    panesData,
    mutations,
    globalSettings,
    saveGlobalSettingsDebounced,
    t,
  });

  const availableFonts = AVAILABLE_FONTS;

  // --- モーダルへ渡す型安全なウィジェットデータ (activeModal と型を連動させる) ---
  // editingWidgetData は全ウィジェット型の union だが、activeModal と実行時には連動している。
  // ここで型ガードを通して各モーダル専用の型に絞り込む。
  const rssWidgetData = computed<RssWidgetWithPane | null>(() => {
    const w = activeModal.value === 'rss' ? editingWidgetData.value : null;
    return w && w.type === 'rss' ? { ...w, paneId: editingPaneId.value } : null;
  });
  const memoWidgetData = computed<NoteWidgetWithPane | null>(() => {
    const w = activeModal.value === 'memo' ? editingWidgetData.value : null;
    return w && w.type === 'note'
      ? { ...w, paneId: editingPaneId.value }
      : null;
  });
  const calendarWidgetData = computed<CalendarWidgetWithPane | null>(() => {
    const w =
      activeModal.value === 'calendar' ? editingWidgetData.value : null;
    return w && w.type === 'calendar'
      ? { ...w, paneId: editingPaneId.value }
      : null;
  });
  const bookmarkWidgetData = computed<BookmarkWidgetWithPane | null>(() => {
    const w =
      activeModal.value === 'bookmark' ? editingWidgetData.value : null;
    return w && w.type === 'bookmark'
      ? { ...w, paneId: editingPaneId.value }
      : null;
  });

  // --- onMounted: データロード ---
  onMounted(async () => {
    await loadGlobalSettings();
    await loadLayout();
  });

  // --- ページメタ情報 ---
  useHead({ title: t('appTitle') });
</script>

<style scoped>
  /* --- index.vue 固有のレイアウトスタイル --- */
  /* ヘッダー領域 */
  .app-header {
    display: flex;
    align-items: center;
    padding: 8px 20px; /* 少し上下のpaddingを狭く調整 */
    flex-shrink: 0; /* ヘッダーは縮まない */
    background-color: #282c2d;
    transition:
      background-color 0.2s ease-out,
      border-color 0.2s ease-out;
    color: #fff; /* ヘッダーの文字色 */
  }

  h1 {
    margin: 0 15px 0 0; /* 右側に少しマージン */
    font-size: 1.4em; /* タイトルサイズ調整 */
    flex-grow: 1; /* 残りのスペースをタイトルが使う */
    text-align: left;
    white-space: nowrap;
    color: #fff; /* ヘッダーの文字色 */
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 12px; /* ボタン間のスペース調整 */
    flex-shrink: 0; /* アクション部分は縮まない */
  }

  .header-button {
    /* font-family, font-size は assets/css/main.css の .button で定義 */
    padding: 6px 12px; /* ヘッダー内のボタンは少し小さく */
  }

  .user-info {
    margin-right: 10px; /* Add Widget ボタンとの間隔 */
    color: var(--app-text-color);
    font-size: 0.85em; /* 少し小さく */
    white-space: nowrap;
    color: #fff; /* ヘッダーの文字色 */
  }

  /* アプリ全体のコンテナ */
  #app-container {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    /* 背景色は body に適用されているので不要 */
    /* border: 1px solid #ccc; */ /* 必要であれば境界線 */
  }

  /* Splitpanes コンテナ */
  .app-splitpanes {
    flex-grow: 1; /* 残りの高さをすべて使う */
    display: flex; /* Splitpanes内部で必要 */
    /* ヘッダーの高さを動的に計算するか、固定値で見積もる */
    /* 例: calc(100vh - {ヘッダーの実測高さ}px) */
    height: calc(100vh - 53px); /* ヘッダー高さを53pxと仮定 (要調整) */
    /* border-top: 1px solid #eee; */ /* ヘッダーとの境界線 */
  }

  /* 各ペイン */
  .app-pane {
    padding: 15px; /* ペインの内側に余白 */
    box-sizing: border-box;
    overflow-y: auto; /* ペイン内でウィジェットが溢れた場合にスクロール */
    background-color: #3e5f6f !important; /* splitpanesの背景色を強制上書き */
  }

  /* ドラッグ可能なウィジェットが配置されるエリア */
  .drag-area {
    display: flex;
    flex-direction: column;
    gap: 15px; /* ウィジェット間の垂直方向の間隔 */
    min-height: 100px; /* 空の場合でもドラッグ＆ドロップ先として認識しやすいように */
    height: 100%; /* Paneの高さを使う */
  }

  /* 空のペインに表示されるメッセージ */
  .empty-pane-message {
    text-align: center;
    color: #888; /* 少し濃いグレー */
    padding: 30px 15px;
    border: 2px dashed #ccc;
    border-radius: 4px;
    min-height: 100px; /* メッセージ表示領域の最低高さ */
    display: flex;
    justify-content: center;
    align-items: center;
    font-style: italic;
    flex-grow: 1; /* Pane内で可能な限りのスペースを占める */
    margin-top: 5px; /* 上部に少しマージン */
  }

  /* --- vuedraggable 関連のスタイル --- */
  /* :deep() を使用して、scoped スタイル内で vuedraggable によって */
  /* 子コンポーネント (WidgetCard) に付与されるクラスにスタイルを適用する */

  /* ドラッグ中のプレースホルダー (ゴースト) のスタイル */
  :deep(.ghost) {
    /* WidgetCardコンポーネントのルート(.widget-wrapper)に適用される想定 */
    opacity: 0.6;
    background: #d6eaff !important; /* 背景色を明るい青に */
    border: 2px dashed #007bff !important; /* 青い破線に */
    box-shadow: none !important; /* 元の影を消す */
    border-radius: 4px; /* 角丸を維持 */
  }
  /* ゴースト内のメニューバーなどの見た目も調整する場合 */
  :deep(.ghost .widget-menu-bar) {
    background-color: #b3d7ff !important;
    border-bottom-color: #80bfff !important;
  }
  :deep(.ghost .widget-content) {
    /* display: none; */ /* ゴースト中はコンテンツ不要なら非表示 */
    visibility: hidden; /* コンテンツエリアは維持しつつ非表示 */
  }

  /* ドラッグ対象として選択されている要素のスタイル (任意) */
  :deep(.chosen) {
    /* 例: 少し影を濃くするなど */
    /* box-shadow: 0 4px 8px rgba(0,0,0,0.15) !important; */
  }

  /* ドラッグ操作中にマウスカーソルと共に移動する要素のスタイル (任意) */
  :deep(.drag) {
    /* 通常はデフォルトで問題ないことが多い */
  }

  /* --- モーダル関連のスタイル --- */
  /* 例: 削除確認モーダル内の強調表示 */
  .item-description-highlight {
    font-weight: bold;
    color: #dc3545; /* 削除対象なので赤文字に */
    background-color: #f8d7da; /* 薄い赤背景 */
    padding: 8px 12px;
    border-radius: 4px;
    margin: 10px 0;
    display: inline-block; /* ブロック要素にならないように */
  }

  :root {
    --button-primary-rgb: 0, 123, 255;
  }
  html[data-theme='dark'] {
    --button-primary-rgb: 35, 134, 54;
  }
</style>
