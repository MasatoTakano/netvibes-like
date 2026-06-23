// composables/useWidgetModal.ts
// モーダル管理（開閉・設定保存・ウィジェット追加・削除確認）

import { ref, type Ref } from 'vue';
import type {
  PaneData,
  NoteWidget,
  RssWidget,
  CalendarWidget,
  BookmarkWidget,
  GlobalSettings,
  RssSettingsPayload,
  MemoSettingsPayload,
  CalendarSettingsPayload,
  BookmarkSettingsPayload,
} from '~/types';
import { DEFAULT_RSS_ITEM_COUNT } from '~/constants';

type ModalType = 'rss' | 'memo' | 'global' | 'add' | 'delete' | 'calendar' | 'bookmark' | null;

export function useWidgetModal(options: {
  panesData: Ref<PaneData[]>;
  saveLayoutDebounced: () => void;
  addNoteWidget: (paneId: string) => void;
  addRssWidget: (paneId: string, feedUrl: string, itemCount: number) => void;
  addCalendarWidget: (paneId: string) => void;
  addBookmarkWidget: (paneId: string) => void;
  removeWidget: (widgetId: string, paneId: string) => void;
  globalSettings: GlobalSettings;
  saveGlobalSettingsDebounced: () => void;
  t: (key: string) => string;
}) {
  const {
    panesData,
    saveLayoutDebounced,
    addNoteWidget,
    addRssWidget,
    addCalendarWidget,
    addBookmarkWidget,
    removeWidget,
    globalSettings,
    saveGlobalSettingsDebounced,
    t,
  } = options;

  // --- State ---
  const activeModal = ref<ModalType>(null);
  const editingWidgetData = ref<
    NoteWidget | RssWidget | CalendarWidget | BookmarkWidget | null
  >(null);
  const editingPaneId = ref<string | undefined>(undefined);
  const widgetToDelete = ref<{
    widgetId: string;
    paneId: string;
    description: string;
  } | null>(null);

  // --- モーダル開閉 ---

  function openAddWidgetMenu() {
    activeModal.value = 'add';
  }

  function openSettingsModal(
    widgetId: string,
    paneId: string,
    widgetType: 'note' | 'rss' | 'calendar' | 'bookmark',
  ) {
    const pane = panesData.value.find((p) => p.id === paneId);
    const widget = pane?.widgets.find((w) => w.id === widgetId);
    if (widget) {
      editingWidgetData.value = { ...widget };
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
        case 'bookmark':
          activeModal.value = 'bookmark';
          break;
        default:
          break;
      }
    }
  }

  function openGlobalSettingsModal() {
    activeModal.value = 'global';
  }

  function closeModal() {
    activeModal.value = null;
    editingWidgetData.value = null;
    editingPaneId.value = undefined;
    widgetToDelete.value = null;
  }

  // --- ウィジェット追加 ---

  function handleAddWidget(payload: {
    type: 'note' | 'rss' | 'calendar' | 'bookmark';
    feedUrl?: string;
  }) {
    if (panesData.value.length > 0) {
      const firstPaneId = panesData.value[0].id;

      if (payload.type === 'note') {
        addNoteWidget(firstPaneId);
      } else if (payload.type === 'rss' && payload.feedUrl) {
        addRssWidget(firstPaneId, payload.feedUrl, DEFAULT_RSS_ITEM_COUNT);
      } else if (payload.type === 'calendar') {
        addCalendarWidget(firstPaneId);
      } else if (payload.type === 'bookmark') {
        addBookmarkWidget(firstPaneId);
      }
    } else {
      console.error(
        '>>> [ERROR] [Client] Cannot add widget, no panes available.',
      );
    }

    closeModal();
  }

  // --- ウィジェット削除 ---

  function confirmRemoveWidget(widgetId: string, paneId: string) {
    const pane = panesData.value.find((p) => p.id === paneId);
    const widget = pane?.widgets.find((w) => w.id === widgetId);
    if (widget) {
      const description =
        (widget.type === 'note'
          ? widget.title
          : widget.type === 'rss'
            ? (widget as RssWidget).feedTitle
            : widget.type === 'bookmark'
              ? widget.title
              : undefined) ||
        `${widget.type} ${t('widget.name')}`;
      widgetToDelete.value = { widgetId, paneId, description };
      activeModal.value = 'delete';
    } else {
      console.warn('[ERROR] Widget to delete not found.');
    }
  }

  function handleConfirmDelete() {
    if (widgetToDelete.value) {
      removeWidget(widgetToDelete.value.widgetId, widgetToDelete.value.paneId);
    }
    closeModal();
  }

  // --- 設定モーダル save ハンドラ ---

  function handleSaveRssSettings(payload: RssSettingsPayload) {
    const { widgetId, paneId, settings } = payload;
    const targetPane = panesData.value.find((p) => p.id === paneId);
    const widgetIndex = targetPane?.widgets.findIndex(
      (w) => w.id === widgetId && w.type === 'rss',
    );

    if (targetPane && widgetIndex !== undefined && widgetIndex > -1) {
      const widgetToUpdate = targetPane.widgets[widgetIndex] as RssWidget;
      Object.assign(widgetToUpdate, settings);
      saveLayoutDebounced();
    } else {
      console.error(
        `>>> [ERROR] [Client] Could not find RSS widget ${widgetId} to save settings from modal.`,
      );
    }
    closeModal();
  }

  function handleSaveMemoSettings(payload: MemoSettingsPayload) {
    const { widgetId, paneId, settings } = payload;
    const targetPane = panesData.value.find((p) => p.id === paneId);
    const widgetIndex = targetPane?.widgets.findIndex(
      (w) => w.id === widgetId && w.type === 'note',
    );

    if (targetPane && widgetIndex !== undefined && widgetIndex > -1) {
      const widgetToUpdate = targetPane.widgets[widgetIndex] as NoteWidget;
      Object.assign(widgetToUpdate, settings);
      saveLayoutDebounced();
    } else {
      console.error(
        `>>> [ERROR] [Client] Could not find Memo widget ${widgetId} to save settings from modal.`,
      );
    }
    closeModal();
  }

  function handleSaveCalendarSettings(payload: CalendarSettingsPayload) {
    const { widgetId, paneId, settings } = payload;
    const targetPane = panesData.value.find((p) => p.id === paneId);
    const widgetIndex = targetPane?.widgets.findIndex(
      (w) => w.id === widgetId && w.type === 'calendar',
    );

    if (targetPane && widgetIndex !== undefined && widgetIndex > -1) {
      const widgetToUpdate = targetPane.widgets[widgetIndex] as CalendarWidget;
      Object.assign(widgetToUpdate, settings);
      saveLayoutDebounced();
    } else {
      console.error(
        `>>> [ERROR] [Client] Could not find Calendar widget ${widgetId} to save settings from modal.`,
      );
    }
    closeModal();
  }

  function handleSaveBookmarkSettings(payload: BookmarkSettingsPayload) {
    const { widgetId, paneId, settings } = payload;
    const targetPane = panesData.value.find((p) => p.id === paneId);
    const widgetIndex = targetPane?.widgets.findIndex(
      (w) => w.id === widgetId && w.type === 'bookmark',
    );

    if (targetPane && widgetIndex !== undefined && widgetIndex > -1) {
      const widgetToUpdate = targetPane.widgets[widgetIndex] as BookmarkWidget;
      Object.assign(widgetToUpdate, settings);
      saveLayoutDebounced();
    } else {
      console.error(
        `>>> [ERROR] [Client] Could not find Bookmark widget ${widgetId} to save settings from modal.`,
      );
    }
    closeModal();
  }

  function handleSaveGlobalSettings(payload: GlobalSettings) {
    Object.assign(globalSettings, payload);

    panesData.value.forEach((pane) => {
      pane.widgets.forEach((widget) => {
        if (widget.type === 'note' || widget.type === 'rss' || widget.type === 'bookmark') {
          widget.fontFamily = payload.fontFamily;
          widget.fontSize = payload.fontSize;
        }
      });
    });

    saveGlobalSettingsDebounced();
    saveLayoutDebounced();
    closeModal();
  }

  return {
    activeModal,
    editingWidgetData,
    editingPaneId,
    widgetToDelete,
    openAddWidgetMenu,
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
  };
}
