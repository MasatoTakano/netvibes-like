---pages/index.vue---
<template>
  <!-- ClientOnly でラップ -->
  <ClientOnly placeholder="Loading interface...">
    <div
      id="app-container"
      :style="globalStyles"
    >
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
              @click="openAddWidgetMenuForFirstPane"
              class="button button-primary header-button">
              {{ $t('addWidget.button') }}
            </button>
            <button
              @click="openGlobalSettingsModal"
              class="button button-secondary header-button"
              title="$t('globalSettings.title')">
              ⚙️ {{ $t('globalSettings.title') }}
            </button>
            <!-- ログアウト -->
            <button
              @click="logout"
              class="button button-secondary header-button">{{ $t('logout.button') }}
            </button>
          </template>
        </div>
      </header>
      <ClientOnly placeholder="Loading splitpanes...">
        <splitpanes
          class="default-theme app-splitpanes"
          :key="splitpanesKey"
          ref="splitpanesRef"
          v-if="!isLoading && panesData.length > 0"
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
              @change="handleDragChange($event, pane.id)"
            >
              <!-- #header -->
              <template #header>
              </template>

              <!-- 各ウィジェットの表示 (WidgetCardコンポーネントを使用) -->
              <template #item="{ element: widget }">
                <WidgetCard
                  :widget="widget"
                  :pane-id="pane.id"
                  @toggle-collapse="toggleCollapse"
                  @open-settings="openSettingsModal"
                  @confirm-remove="confirmRemoveWidget"
                  @update:note-content="updateNoteContent"
                  @update:rss-title="updateRssWidgetTitle"
                  class="draggable-widget"
                />
              </template>

              <!-- 空ペインのメッセージ -->
              <template #footer>
                <div v-if="!pane.widgets || pane.widgets.length === 0" class="empty-pane-message">
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
        :widget-data="activeModal === 'rss' ? { ...editingWidgetData, paneId: editingPaneId } : null"
        :available-fonts="availableFonts"
        @close="closeModal"
        @save="handleSaveRssSettings"
      />
      <!-- メモ設定モーダル -->
      <MemoSettingsModal
        :show="activeModal === 'memo'"
        :widget-data="activeModal === 'memo' ? { ...editingWidgetData, paneId: editingPaneId } : null"
        :available-fonts="availableFonts"
        @close="closeModal"
        @save="handleSaveMemoSettings"
      />
      <!-- カレンダー設定モーダル -->
      <CalendarSettingsModal
        :show="activeModal === 'calendar'"
        :widget-data="activeModal === 'calendar' ? { ...editingWidgetData, paneId: editingPaneId } : null"
        @close="closeModal"
        @save="handleSaveCalendarSettings"
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
        <template #description v-if="widgetToDelete">
          <p>{{ $t('confirmDelete.message') }}</p>
          <p class="item-description-highlight">"{{ widgetToDelete.description }}"</p>
        </template>
      </ConfirmDeleteModal>
    </div>
    <template #fallback>
      <!-- Loading表示 -->
      <div style="padding: 20px; text-align: center;">{{ $t('common.loading') }}</div>
    </template>
  </ClientOnly>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, reactive, computed, watchEffect } from 'vue';
import { Splitpanes, Pane } from 'splitpanes';
import draggable from 'vuedraggable';
import type { PaneData, NoteWidget, RssWidget, CalendarWidget, GlobalSettings, RssSettingsPayload, MemoSettingsPayload, CalendarSettingsPayload } from '~/types';
import { DEFAULT_GLOBAL_SETTINGS, AVAILABLE_FONTS,
  DEFAULT_NOTE_FONT_FAMILY, DEFAULT_NOTE_FONT_SIZE,
  DEFAULT_RSS_FONT_FAMILY, DEFAULT_RSS_FONT_SIZE,DEFAULT_RSS_ITEM_COUNT, DEFAULT_RSS_UPDATE_INTERVAL_MINUTES } from '~/constants';
import RssSettingsModal from '~/components/RssSettingsModal.vue';
import MemoSettingsModal from '~/components/MemoSettingsModal.vue';
import CalendarSettingsModal from '~/components/CalendarSettingsModal.vue';
import GlobalSettingsModal from '~/components/GlobalSettingsModal.vue';
import AddWidgetModal from '~/components/AddWidgetModal.vue';
import ConfirmDeleteModal from '~/components/ConfirmDeleteModal.vue';
import LanguageSwitcher from '~/components/LanguageSwitcher.vue';
import ThemeSwitcher from '~/components/ThemeSwitcher.vue'
import WidgetCard from '~/components/WidgetCard.vue'

const { user, isLoggedIn, logout } = useAuth();

const { t } = useI18n();

// --- デフォルトの初期データ ---
const defaultPanesData: PaneData[] = [
  { id: 'pane-1', size: 33.3, widgets: [] },
  { id: 'pane-2', size: 33.4, widgets: [] },
  { id: 'pane-3', size: 33.3, widgets: [] },
];

// 初期値は空配列にしておき、マウント後にAPIからロードする
const panesData = ref<PaneData[]>([]);
const isLoading = ref(true); // ローディング状態を追加
const isSplitpanesReady = ref(false); // splitpanesの@readyが発火したか
const allowPaneResizeHandling = ref(false); // resizedイベントの処理を許可するか
const splitpanesKey = ref(0); // splitpanesのキー (強制的に再レンダリングするために使用)
const isSaving = ref(false); // 保存中の状態を示すフラグ
const saveError = ref<string | null>(null); // 保存エラーメッセージ


// --- State ---
const activeModal = ref<'rss' | 'memo' | 'global' | 'add' | 'delete' | 'calendar' | null>(null);
const editingWidgetData = ref<NoteWidget | RssWidget | CalendarWidget | null>(null);
const editingPaneId = ref<string | null>(null);
const widgetToDelete = ref<{ widgetId: string; paneId: string; description: string; } | null>(null);

// 全体設定用の状態
const globalSettings = reactive({
  fontFamily: DEFAULT_GLOBAL_SETTINGS.fontFamily,
  fontSize: DEFAULT_GLOBAL_SETTINGS.fontSize,
});

// フォントリスト
const availableFonts = ref<Readonly<string[]>>(AVAILABLE_FONTS);

// --- Watcher for Global Settings ---
// globalSettings の変更を監視し、:root の CSS 変数を直接更新する
watchEffect(() => {
  if (process.client) {
    // ルートエレメントのスタイルを取得
    const rootStyle = document.documentElement.style;

    // ウィジェットコンテンツ用の変数を更新
    rootStyle.setProperty('--widget-content-font-family', globalSettings.fontFamily);
    rootStyle.setProperty('--widget-content-font-size', `${globalSettings.fontSize}px`);
  }
});


watch([isLoading, isSplitpanesReady], ([loading, ready]) => {
  if (!loading && ready) {
    // DBロード完了 かつ splitpanes準備完了
    // 少し遅延させてから resized イベントの処理を許可する
    // これにより、初期化直後の自動発火をやり過ごす
    setTimeout(() => {
      allowPaneResizeHandling.value = true;
    }, 500); // 500msの遅延
  }
});

// --- Computed ---
// 全体スタイルを適用するための computed プロパティ
const globalStyles = computed(() => ({
  '--global-font-family': globalSettings.fontFamily,
  '--global-font-size': `${globalSettings.fontSize}px`,
}));


// --- Debounce 関数 ---
// (waitミリ秒待ってから関数を実行。待機中に再度呼び出されるとタイマーリセット)
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return function(this: ThisParameterType<T>, ...args: Parameters<T>) {
    const context = this;
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func.apply(context, args);
      timeoutId = null;
    }, wait);
  };
}

// --- APIからデータをロード ---
onMounted(async () => {
  isLoading.value = true; // データロード開始
  allowPaneResizeHandling.value = false; // 初期はリサイズ処理を許可しない

  // 1. グローバル設定のロード
  try {
    const savedSettings = await $fetch<GlobalSettings>('/api/settings');
    if (savedSettings) Object.assign(globalSettings, savedSettings);
    console.log('>>> [onMounted] Global settings loaded.');
  } catch (err) {
    console.error('>>> [ERROR] [onMounted] Failed to load global settings:', err);
  }

  // 2. レイアウトデータのロード
  try {
    const loadedPanesRaw = await $fetch<PaneData[]>('/api/layout');

    let panesToApply: PaneData[];

    if (loadedPanesRaw && Array.isArray(loadedPanesRaw) && loadedPanesRaw.length > 0) {
      const isValidStructure = loadedPanesRaw.every(p => p && typeof p.id === 'string' && typeof p.size === 'number' && Array.isArray(p.widgets));
      if (isValidStructure) {
        panesToApply = JSON.parse(JSON.stringify(loadedPanesRaw)); // コピーを作成

        // 正規化処理
        const totalSize = panesToApply.reduce((sum, pane) => sum + (pane.size || 0), 0);
        if (totalSize > 0 && Math.abs(totalSize - 100) > 0.1) {
          const factor = 100 / totalSize;
          panesToApply.forEach(pane => {
            if (typeof pane.size === 'number') pane.size = pane.size * factor;
          });
        }
      } else {
        panesToApply = JSON.parse(JSON.stringify(defaultPanesData));
      }
    } else {
      panesToApply = JSON.parse(JSON.stringify(defaultPanesData));
    }
    panesData.value = panesToApply;
    splitpanesKey.value++; // splitpanesの再レンダリングを強制するためにキーを更新
  } catch (error) {
    panesData.value = JSON.parse(JSON.stringify(defaultPanesData)); // エラー時もデフォルト
  } finally {
    isLoading.value = false; // データロード完了 (成功・失敗問わず)
  }
});

// レイアウト保存処理 (Debounce化)
const saveLayoutDebounced = debounce(async () => {
  if (isLoading.value || panesData.value.length === 0) {
    return;
  }

  // 保存前にサイズ合計が100%に近いか確認・調整（念のため残しておく）
  const totalSize = panesData.value.reduce((sum, pane) => sum + pane.size, 0);
  if (Math.abs(totalSize - 100) > 0.1) {
    const factor = 100 / totalSize;
    panesData.value.forEach(pane => {
      pane.size = pane.size * factor;
    });
  }

  isSaving.value = true;
  saveError.value = null;

  try {
    await $fetch('/api/layout', {
      method: 'POST',
      body: panesData.value,
    });
  } catch (err: any) {
    console.error('>>> [ERROR] [Client] Failed to save layout via API:', err);
    saveError.value = err.data?.message || err.message || 'Failed to save layout.';
  } finally {
    isSaving.value = false;
  }
}, 1500);

// 全体設定保存処理 (Debounce化)
const saveGlobalSettingsDebounced = debounce(async () => {
     try {
         await $fetch('/api/settings', { method: 'POST', body: globalSettings });
     } catch (err: any) {
         // エラー処理
         console.error('>>> [ERROR] [Client] Failed to save global settings via API:', err);
     }
 }, 500);

// --- Methods ---
// Splitpanesの準備完了イベントハンドラ
const handlePaneReady = () => {
  isSplitpanesReady.value = true;
};

// Splitpanesのリサイズイベントハンドラ
const handlePaneResize = (eventPayload: { panes: Array<{ min: number, max: number, size: number }>, [key: string]: any }) => {
  const resizedPanes = eventPayload.panes;

  if (!allowPaneResizeHandling.value) {
    return;
  }  

  if (isLoading.value) {
    return;
  }

  if (resizedPanes && Array.isArray(resizedPanes) && resizedPanes.length === panesData.value.length) {
    let sizesChanged = false;
    panesData.value.forEach((pane, index) => {
      const newSize = resizedPanes[index]?.size;
      if (newSize !== undefined && Math.abs(pane.size - newSize) > 0.01) {
        pane.size = newSize;
        sizesChanged = true;
      }
    });

    if (sizesChanged) {
      saveLayoutDebounced();
    }
  }
};


// RSSウィジェット更新処理
const updateRssWidgetTitle = (widgetId: string, paneId: string, newTitle: string) => {
  if (isLoading.value) {
    return;
  }

  const pane = panesData.value.find(p => p.id === paneId);
  const widget = pane?.widgets.find(w => w.id === widgetId && w.type === 'rss') as RssWidget | undefined;
  if (widget && widget.feedTitle !== newTitle) {
    widget.feedTitle = newTitle;
    saveLayoutDebounced();
  }
};

// メモウィジェット更新処理
const updateNoteContent = (widgetId: string, newContent: string): void => {
  if (isLoading.value) {
    return;
  }

  let found = false;
  for (const pane of panesData.value) {
    const widgetIndex = pane.widgets.findIndex(widget => widget.id === widgetId && widget.type === 'note');
    if (widgetIndex !== -1) {
      (pane.widgets[widgetIndex] as NoteWidget).content = newContent;
      found = true;
      break;
    }
  }
  if (found) {
    // メモ内容変更後も保存
    saveLayoutDebounced();
  } else {
    console.warn(`>>> 「ERROR] [Client] Attempted to update note with unknown id: ${widgetId}`);
  }
};


// 「+ Add Widget」ボタンクリック時の処理
const openAddWidgetMenuForFirstPane = () => {
  activeModal.value = 'add';
};

// ウィジェット追加処理
const handleAddWidget = (payload: { type: 'note' | 'rss' | 'calendar'; feedUrl?: string }) => {
  if (panesData.value.length > 0) {
    // 最初のペインIDを取得
    const firstPaneId = panesData.value[0].id;

    if (payload.type === 'note') {
      addMemoWidgetInternal(firstPaneId);
    } else if (payload.type === 'rss' && payload.feedUrl) {
      addRssWidgetInternal(firstPaneId, payload.feedUrl, DEFAULT_RSS_ITEM_COUNT);
    } else if (payload.type === 'calendar') {
      addCalendarWidgetInternal(firstPaneId);
    }
  } else {
     console.error(">>> [ERROR] [Client] Cannot add widget, no panes available.");
  }

  // モーダルを閉じる (AddWidgetModal側で閉じても良い)
  closeModal();
};

// メモウィジェットを追加する内部関数
const addMemoWidgetInternal = (paneId: string) => {
  const targetPane = panesData.value.find(p => p.id === paneId);
  if (targetPane) {
    const newWidget: NoteWidget = {
      id: crypto.randomUUID(),
      type: 'note',
      title: 'New Memo',
      content: '',
      fontFamily: DEFAULT_NOTE_FONT_FAMILY,
      fontSize: DEFAULT_NOTE_FONT_SIZE,
      isCollapsed: false,
    };
    targetPane.widgets.push(newWidget);
    saveLayoutDebounced();
  }
};

// RSSウィジェットを追加する内部関数
const addRssWidgetInternal = (paneId: string, feedUrl: string, itemCount: number) => {
  const targetPane = panesData.value.find(p => p.id === paneId);
  if (targetPane) {
    const newWidget: RssWidget = {
      id: crypto.randomUUID(),
      type: 'rss',
      feedUrl: feedUrl,
      itemCount: itemCount || DEFAULT_RSS_ITEM_COUNT,
      feedTitle: 'RSS Feed',
      fontFamily: DEFAULT_RSS_FONT_FAMILY,
      fontSize: DEFAULT_RSS_FONT_SIZE,
      updateIntervalMinutes: DEFAULT_RSS_UPDATE_INTERVAL_MINUTES,
      isCollapsed: false,
    };
    targetPane.widgets.push(newWidget);
    saveLayoutDebounced();
  } else {
    console.warn(`>>> [ERROR] [Client] Could not find pane with id ${paneId} to add RSS widget.`);
  }
};

// カレンダーウィジェットを追加する内部関数
const addCalendarWidgetInternal = (paneId: string) => {
  const targetPane = panesData.value.find(p => p.id === paneId);
  if (targetPane) {
    const newWidget: CalendarWidget = {
      id: crypto.randomUUID(),
      type: 'calendar',
      iframeTag: '',
      isCollapsed: false,
    };
    targetPane.widgets.push(newWidget);
    saveLayoutDebounced();
  } else {
    console.warn(`>>> [ERROR] [Client] Could not find pane with id ${paneId} to add Calendar widget.`);
  }
};

// 削除ボタンクリック時の処理 (確認モーダルを開く)
const confirmRemoveWidget = (widgetId: string, paneId: string) => {
  const pane = panesData.value.find(p => p.id === paneId);
  const widget = pane?.widgets.find(w => w.id === widgetId);
  if (widget) {
      const description = (widget.type === 'note' ? widget.title : (widget as RssWidget).feedTitle) || `${widget.type} ${t('widget.name')}`;
      widgetToDelete.value = { widgetId, paneId, description };
      activeModal.value = 'delete'; // 削除確認モーダルを開く
  } else {
     console.warn("[ERROR] Widget to delete not found.");
  }
};

// ウィジェット削除確認
const handleConfirmDelete = () => {
  if (widgetToDelete.value) {
    removeWidgetInternal(widgetToDelete.value.widgetId, widgetToDelete.value.paneId);
  }
  closeModal();
};

// ウィジェット削除の内部処理
const removeWidgetInternal = (widgetId: string, paneId: string) => {
  const targetPane = panesData.value.find(p => p.id === paneId);
  if (targetPane) {
    const initialLength = targetPane.widgets.length;
    targetPane.widgets = targetPane.widgets.filter(widget => widget.id !== widgetId);
    if (targetPane.widgets.length < initialLength) {
      saveLayoutDebounced();
    }
  }
};

// ウィジェットのD&D処理
const handleDragChange = (evt: any, paneId: string) => {
  saveLayoutDebounced(); // ドラッグ完了後も保存
};


// メモ・RSSウィジェットの設定画面関係
const openSettingsModal = (widgetId: string, paneId: string, widgetType: 'note' | 'rss' | 'calendar') => {
  const pane = panesData.value.find(p => p.id === paneId);
  const widget = pane?.widgets.find(w => w.id === widgetId);
  if (widget) {
    // ウィジェットデータのコピーを渡す
    editingWidgetData.value = { ...widget};
    editingPaneId.value = paneId;
    switch (widgetType) {
      case 'note':
        activeModal.value = 'memo';
        break;
    
      case 'rss':
        activeModal.value = 'rss';
        break;

      case 'calendar':
        activeModal.value = 'calendar';
        break;
      default:
        break;
    }
  }
};

// 全体設定の設定画面表示
const openGlobalSettingsModal = () => {
    // globalSettings は reactive なのでそのまま渡せる (コピーでも良い)
    activeModal.value = 'global';
};

// モーダルを閉じる関数
const closeModal = () => {
    activeModal.value = null;
    editingWidgetData.value = null;
    editingPaneId.value = null;
    widgetToDelete.value = null;
};


// RSS設定モーダルの保存イベントハンドラ
const handleSaveRssSettings = (payload: RssSettingsPayload) => {
  const { widgetId, paneId, settings } = payload;
  const targetPane = panesData.value.find(p => p.id === paneId);
  const widgetIndex = targetPane?.widgets.findIndex(w => w.id === widgetId && w.type === 'rss');

  if (targetPane && widgetIndex !== undefined && widgetIndex > -1) {
    const widgetToUpdate = targetPane.widgets[widgetIndex] as RssWidget;
    // settings の内容で上書き
    Object.assign(widgetToUpdate, settings);
    saveLayoutDebounced();
  } else {
    console.error(`>>> [ERROR] [Client] Could not find RSS widget ${widgetId} to save settings from modal.`);
  }
  closeModal();
};

// メモ設定モーダルの保存イベントハンドラ
const handleSaveMemoSettings = (payload: MemoSettingsPayload) => {
   const { widgetId, paneId, settings } = payload;
   const targetPane = panesData.value.find(p => p.id === paneId);
   const widgetIndex = targetPane?.widgets.findIndex(w => w.id === widgetId && w.type === 'note');

   if (targetPane && widgetIndex !== undefined && widgetIndex > -1) {
      const widgetToUpdate = targetPane.widgets[widgetIndex] as NoteWidget;
      Object.assign(widgetToUpdate, settings);
      saveLayoutDebounced();
   } else {
      console.error(`>>> [ERROR] [Client] Could not find Memo widget ${widgetId} to save settings from modal.`);
   }

   closeModal();
};

// カレンダー設定モーダルの保存イベントハンドラ
const handleSaveCalendarSettings = (payload: CalendarSettingsPayload) => {
  const { widgetId, paneId, settings } = payload;
  const targetPane = panesData.value.find(p => p.id === paneId);
  const widgetIndex = targetPane?.widgets.findIndex(w => w.id === widgetId && w.type === 'calendar');

  if (targetPane && widgetIndex !== undefined && widgetIndex > -1) {
    const widgetToUpdate = targetPane.widgets[widgetIndex] as CalendarWidget;
    Object.assign(widgetToUpdate, settings);
    saveLayoutDebounced();
  } else {
    console.error(`>>> [ERROR] [Client] Could not find Calendar widget ${widgetId} to save settings from modal.`);
  }
  closeModal();
};

// 全体設定モーダルの保存イベントハンドラ
const handleSaveGlobalSettings = (payload: GlobalSettings) => {
  Object.assign(globalSettings, payload); // globalSettings を更新

  panesData.value.forEach(pane => {
      pane.widgets.forEach(widget => {
          if (widget.type === 'note' || widget.type === 'rss') {
              widget.fontFamily = payload.fontFamily;
              widget.fontSize = payload.fontSize;
          }
      });
  });

  // 全体設定DB保存
  saveGlobalSettingsDebounced();
  // レイアウトDB保存
  saveLayoutDebounced();
  closeModal();
};

// ウィジェット折りたたみ・展開処理
const toggleCollapse = (widgetId: string, paneId: string) => {
  if (isLoading.value) {
    return;
  }

  const pane = panesData.value.find(p => p.id === paneId);
  const widget = pane?.widgets.find(w => w.id === widgetId);
  if (widget) {
    // isCollapsed プロパティを反転 (undefined の場合は false として扱う)
    widget.isCollapsed = !(widget.isCollapsed ?? false);
    saveLayoutDebounced(); // 状態が変わったのでレイアウトを保存
  }
};

  // --- ページメタ情報 ---
  useHead({
    title: t('appTitle'),
  });
</script>

<style scoped>
/* --- index.vue 固有のレイアウトスタイル --- */
/* ヘッダー領域 */
.app-header {
  display: flex;
  align-items: center;
  padding: 8px 20px; /* 少し上下のpaddingを狭く調整 */
  flex-shrink: 0; /* ヘッダーは縮まない */
  background-color: #282C2D;
  transition: background-color 0.2s ease-out, border-color 0.2s ease-out;
  color: #fff; /* ヘッダーの文字色 */
}

h1 {
  margin: 0 15px 0 0; /* 右側に少しマージン */
  font-size: 1.4em; /* タイトルサイズ調整 */
  flex-grow: 1; /* 残りのスペースをタイトルが使う */
  text-align: left;
  white-space: nowrap;
  color:#fff; /* ヘッダーの文字色 */
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
  color:#fff; /* ヘッダーの文字色 */
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
  background-color: #3E5F6F !important; /* splitpanesの背景色を強制上書き */
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
  /* display: none; */ /* ゴースト中はコンテンツ不要なら非表示に */
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

:root { --button-primary-rgb: 0, 123, 255; }
html[data-theme='dark'] { --button-primary-rgb: 35, 134, 54; }
</style>