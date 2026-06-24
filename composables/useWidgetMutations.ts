// composables/useWidgetMutations.ts
// ウィジェットの追加・削除・更新・折りたたみ操作を担当する。
// レイアウトデータの state 自体は useLayout が保持し、
// この composable は panesData ref に対する操作のみを行う。

import { type Ref } from 'vue';
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

export function useWidgetMutations(options: {
  panesData: Ref<PaneData[]>;
  saveLayoutDebounced: () => void;
}) {
  const { panesData, saveLayoutDebounced } = options;

  // --- ウィジェット追加 ---

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

  // --- ウィジェット削除 ---

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

  // --- ウィジェット更新 ---

  function updateNoteContent(widgetId: string, newContent: string) {
    const result = findWidget(widgetId, 'note');
    if (result) {
      (result.widget as NoteWidget).content = newContent;
      saveLayoutDebounced();
    }
  }

  function updateRssWidgetTitle(
    widgetId: string,
    paneId: string,
    newTitle: string,
  ) {
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
    const result = findWidget(widgetId, 'bookmark');
    if (result) {
      (result.widget as BookmarkWidget).bookmarks = newBookmarks;
      saveLayoutDebounced();
    }
  }

  // --- 折りたたみ ---

  function toggleCollapse(widgetId: string, paneId: string) {
    const pane = panesData.value.find((p) => p.id === paneId);
    const widget = pane?.widgets.find((w) => w.id === widgetId);
    if (widget) {
      widget.isCollapsed = !(widget.isCollapsed ?? false);
      saveLayoutDebounced();
    }
  }

  // --- ドラッグ ---

  function handleDragChange() {
    saveLayoutDebounced();
  }

  // --- モーダル設定保存用のジェネリック更新 ---

  function updateWidgetSettings(
    widgetId: string,
    paneId: string | undefined,
    widgetType: 'note' | 'rss' | 'calendar' | 'bookmark',
    settings: Record<string, unknown>,
  ) {
    if (!paneId) return false;

    const pane = panesData.value.find((p) => p.id === paneId);
    const widget = pane?.widgets.find(
      (w) => w.id === widgetId && w.type === widgetType,
    );

    if (widget) {
      Object.assign(widget, settings);
      saveLayoutDebounced();
      return true;
    }
    return false;
  }

  // --- 全体フォント設定の一括適用 ---

  function applyGlobalFonts(fontFamily: string, fontSize: number) {
    panesData.value.forEach((pane) => {
      pane.widgets.forEach((widget) => {
        if (widget.type === 'note' || widget.type === 'rss' || widget.type === 'bookmark') {
          widget.fontFamily = fontFamily;
          widget.fontSize = fontSize;
        }
      });
    });
    saveLayoutDebounced();
  }

  // --- 内部ヘルパー ---

  function findWidget(
    widgetId: string,
    widgetType?: string,
  ): { widget: NoteWidget | RssWidget | CalendarWidget | BookmarkWidget } | null {
    for (const pane of panesData.value) {
      const widget = pane.widgets.find(
        (w) => w.id === widgetId && (!widgetType || w.type === widgetType),
      );
      if (widget) return { widget };
    }
    return null;
  }

  return {
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
    updateWidgetSettings,
    applyGlobalFonts,
  };
}
