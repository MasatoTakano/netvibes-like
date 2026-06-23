// types/index.ts

// --- 基本ウィジェット型 ---
export interface WidgetBase {
  id: string;
  type: 'note' | 'rss' | 'calendar' | 'bookmark';
}

// --- メモウィジェット型 ---
export interface NoteWidget extends WidgetBase {
  type: 'note';
  title?: string; // タイトル
  content: string; // メモ内容
  fontFamily?: string | null; // フォントファミリー (null許容)
  fontSize?: number | null; // フォントサイズ (null許容)
  isCollapsed?: boolean;
}

// --- RSSウィジェット型 ---
export interface RssWidget extends WidgetBase {
  type: 'rss';
  feedUrl: string; // RSSフィードのURL
  itemCount: number; // 表示するアイテム数
  feedTitle?: string; // RSSフィード自体のタイトル
  fontFamily?: string | null; // フォントファミリー (null許容)
  fontSize?: number | null; // フォントサイズ (null許容)
  updateIntervalMinutes?: number | null; // 更新間隔 (null許容)
  isCollapsed?: boolean;
}

// --- Calendarウィジェット型 ---
export interface CalendarWidget extends WidgetBase {
  type: 'calendar';
  iframeTag: string; // Google Calendarのiframeタグ
  isCollapsed?: boolean;
}

// --- ブックマークアイテム型 ---
export interface BookmarkItem {
  id: string;
  title: string; // 表示文（タイトル）
  description?: string; // 説明（任意）
  url: string;
}

// --- ブックマークウィジェット型 ---
export interface BookmarkWidget extends WidgetBase {
  type: 'bookmark';
  title?: string; // ウィジェットタイトル
  bookmarks: BookmarkItem[]; // ブックマークのリスト
  fontFamily?: string | null; // フォントファミリー (null許容)
  fontSize?: number | null; // フォントサイズ (null許容)
  columns?: number | null; // 表示列数 (1〜4, null許容)
  isCollapsed?: boolean;
}

// --- 設定モーダル用のウィジェット型 (ウィジェット + paneId) ---
// モーダルには親 (index.vue) から { ...widget, paneId } の形で渡されるため、
// paneId を併せ持つ型をここで一元管理する（各モーダルでのローカル定義重複を防ぐ）。
export type NoteWidgetWithPane = NoteWidget & { paneId?: string };
export type RssWidgetWithPane = RssWidget & { paneId?: string };
export type CalendarWidgetWithPane = CalendarWidget & { paneId?: string };
export type BookmarkWidgetWithPane = BookmarkWidget & { paneId?: string };

// --- ペインデータ型 ---
export interface PaneData {
  id: string;
  widgets: (NoteWidget | RssWidget | CalendarWidget | BookmarkWidget)[];
  size: number; // 初期表示用
}

// --- 全体設定型 ---
export interface GlobalSettings {
  fontFamily: string;
  fontSize: number;
}

export type FontSettings = Omit<GlobalSettings, 'backgroundColor'>;

// --- RSSフィードデータ型 (RssReader.vue や API で使用) ---
export interface RssItem {
  title?: string;
  link?: string;
  pubDate?: string;
  isoDate?: string;
  contentSnippet?: string;
  guid?: string;
}

export interface FeedData {
  title?: string;
  link?: string;
  items: RssItem[];
}

// --- 設定画面ペイロード型 (イベントの型付け用型定義) ---
// paneId は親(index.vue)の編集中ペインが未確定の可能性を考慮し optional とする
// (WidgetWithPane 系の型と整合させる)。
export interface RssSettingsPayload {
  widgetId: string;
  paneId?: string;
  settings: Pick<
    RssWidget,
    | 'feedUrl'
    | 'itemCount'
    | 'fontFamily'
    | 'fontSize'
    | 'updateIntervalMinutes'
  >;
}
export interface MemoSettingsPayload {
  widgetId: string;
  paneId?: string;
  settings: Pick<NoteWidget, 'title' | 'fontFamily' | 'fontSize'>;
}

export interface CalendarSettingsPayload {
  widgetId: string;
  paneId?: string;
  settings: Pick<CalendarWidget, 'iframeTag'>;
}

export interface BookmarkSettingsPayload {
  widgetId: string;
  paneId?: string;
  settings: Pick<BookmarkWidget, 'title' | 'fontFamily' | 'fontSize' | 'columns'>;
}
