// composables/useLayout.ts
// レイアウトデータのCRUD、ウィジェット操作、ロード/保存を管理

import { ref } from 'vue';
import type { PaneData, NoteWidget, RssWidget, CalendarWidget, BookmarkWidget, BookmarkItem } from '~/types';
import {
  DEFAULT_NOTE_FONT_FAMILY,
  DEFAULT_NOTE_FONT_SIZE,
  DEFAULT_RSS_FONT_FAMILY,
  DEFAULT_RSS_FONT_SIZE,
  DEFAULT_RSS_ITEM_COUNT,
  DEFAULT_RSS_UPDATE_INTERVAL_MINUTES,
  DEFAULT_BOOKMARK_FONT_FAMILY,
  DEFAULT_BOOKMARK_FONT_SIZE,
  DEFAULT_BOOKMARK_COLUMNS,
} from '~/constants';
import { useDebounce } from './useDebounce';

// デフォルトの初期データ
const defaultPanesData: PaneData[] = [
  { id: 'pane-1', size: 33.3, widgets: [] },
  { id: 'pane-2', size: 33.4, widgets: [] },
  { id: 'pane-3', size: 33.3, widgets: [] },
];

export function useLayout() {
  // --- State ---
  const panesData = ref<PaneData[]>([]);
  const isLoading = ref(true);
  const isSaving = ref(false);
  const saveError = ref<string | null>(null);
  const splitpanesKey = ref(0);

  // --- レイアウト保存 (Debounce 1500ms) ---
  const saveLayoutDebounced = useDebounce(async () => {
    if (isLoading.value || panesData.value.length === 0) {
      return;
    }

    // 保存前にサイズ合計が100%に近いか確認・調整
    const totalSize = panesData.value.reduce((sum, pane) => sum + pane.size, 0);
    if (Math.abs(totalSize - 100) > 0.1) {
      const factor = 100 / totalSize;
      panesData.value.forEach((pane) => {
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
      saveError.value =
        err.data?.message || err.message || 'Failed to save layout.';
    } finally {
      isSaving.value = false;
    }
  }, 1500);

  // --- APIからレイアウトデータをロード ---
  async function loadLayout() {
    isLoading.value = true;

    try {
      const loadedPanesRaw = await $fetch<PaneData[]>('/api/layout');

      let panesToApply: PaneData[];

      if (
        loadedPanesRaw &&
        Array.isArray(loadedPanesRaw) &&
        loadedPanesRaw.length > 0
      ) {
        const isValidStructure = loadedPanesRaw.every(
          (p) =>
            p &&
            typeof p.id === 'string' &&
            typeof p.size === 'number' &&
            Array.isArray(p.widgets),
        );
        if (isValidStructure) {
          panesToApply = JSON.parse(JSON.stringify(loadedPanesRaw));

          // 正規化処理
          const totalSize = panesToApply.reduce(
            (sum, pane) => sum + (pane.size || 0),
            0,
          );
          if (totalSize > 0 && Math.abs(totalSize - 100) > 0.1) {
            const factor = 100 / totalSize;
            panesToApply.forEach((pane) => {
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
      splitpanesKey.value++;
    } catch {
      panesData.value = JSON.parse(JSON.stringify(defaultPanesData));
    } finally {
      isLoading.value = false;
    }
  }

  // --- ウィジェットCRUD ---

  function addNoteWidget(paneId: string) {
    const targetPane = panesData.value.find((p) => p.id === paneId);
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
  }

  function addRssWidget(paneId: string, feedUrl: string, itemCount: number) {
    const targetPane = panesData.value.find((p) => p.id === paneId);
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
      console.warn(
        `>>> [ERROR] [Client] Could not find pane with id ${paneId} to add RSS widget.`,
      );
    }
  }

  function addCalendarWidget(paneId: string) {
    const targetPane = panesData.value.find((p) => p.id === paneId);
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
      console.warn(
        `>>> [ERROR] [Client] Could not find pane with id ${paneId} to add Calendar widget.`,
      );
    }
  }

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
        columns: DEFAULT_BOOKMARK_COLUMNS,
        isCollapsed: false,
      };
      targetPane.widgets.push(newWidget);
      saveLayoutDebounced();
    } else {
      console.warn(
        `>>> [ERROR] [Client] Could not find pane with id ${paneId} to add Bookmark widget.`,
      );
    }
  }

  function removeWidget(widgetId: string, paneId: string) {
    const targetPane = panesData.value.find((p) => p.id === paneId);
    if (targetPane) {
      const initialLength = targetPane.widgets.length;
      targetPane.widgets = targetPane.widgets.filter(
        (widget) => widget.id !== widgetId,
      );
      if (targetPane.widgets.length < initialLength) {
        saveLayoutDebounced();
      }
    }
  }

  function updateNoteContent(widgetId: string, newContent: string) {
    if (isLoading.value) {
      return;
    }

    let found = false;
    for (const pane of panesData.value) {
      const widgetIndex = pane.widgets.findIndex(
        (widget) => widget.id === widgetId && widget.type === 'note',
      );
      if (widgetIndex !== -1) {
        (pane.widgets[widgetIndex] as NoteWidget).content = newContent;
        found = true;
        break;
      }
    }
    if (found) {
      saveLayoutDebounced();
    } else {
      console.warn(
        `>>> 「ERROR] [Client] Attempted to update note with unknown id: ${widgetId}`,
      );
    }
  }

  function updateRssWidgetTitle(
    widgetId: string,
    paneId: string,
    newTitle: string,
  ) {
    if (isLoading.value) {
      return;
    }

    const pane = panesData.value.find((p) => p.id === paneId);
    const widget = pane?.widgets.find(
      (w) => w.id === widgetId && w.type === 'rss',
    ) as RssWidget | undefined;
    if (widget && widget.feedTitle !== newTitle) {
      widget.feedTitle = newTitle;
      saveLayoutDebounced();
    }
  }

  function updateBookmarks(widgetId: string, newBookmarks: BookmarkItem[]) {
    if (isLoading.value) {
      return;
    }

    let found = false;
    for (const pane of panesData.value) {
      const widgetIndex = pane.widgets.findIndex(
        (widget) => widget.id === widgetId && widget.type === 'bookmark',
      );
      if (widgetIndex !== -1) {
        (pane.widgets[widgetIndex] as BookmarkWidget).bookmarks = newBookmarks;
        found = true;
        break;
      }
    }
    if (found) {
      saveLayoutDebounced();
    } else {
      console.warn(
        `>>> [ERROR] [Client] Attempted to update bookmarks for unknown widget id: ${widgetId}`,
      );
    }
  }

  function toggleCollapse(widgetId: string, paneId: string) {
    if (isLoading.value) {
      return;
    }

    const pane = panesData.value.find((p) => p.id === paneId);
    const widget = pane?.widgets.find((w) => w.id === widgetId);
    if (widget) {
      widget.isCollapsed = !(widget.isCollapsed ?? false);
      saveLayoutDebounced();
    }
  }

  function handleDragChange() {
    saveLayoutDebounced();
  }

  return {
    panesData,
    isLoading,
    isSaving,
    saveError,
    splitpanesKey,
    loadLayout,
    saveLayoutDebounced,
    addNoteWidget,
    addRssWidget,
    addCalendarWidget,
    addBookmarkWidget,
    removeWidget,
    updateNoteContent,
    updateRssWidgetTitle,
    updateBookmarks,
    toggleCollapse,
    handleDragChange,
  };
}
