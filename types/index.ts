// types/index.ts

// --- 基本ウィジェット型 ---
export interface WidgetBase {
    id: string;
    type: 'note' | 'rss';
  }
  
  // --- メモウィジェット型 ---
  export interface NoteWidget extends WidgetBase {
    type: 'note';
    title?: string;       // タイトル
    content: string;      // メモ内容
    fontFamily?: string | null;  // フォントファミリー (null許容)
    fontSize?: number | null;    // フォントサイズ (null許容)
    isCollapsed?: boolean;
  }
  
  // --- RSSウィジェット型 ---
  export interface RssWidget extends WidgetBase {
    type: 'rss';
    feedUrl: string;     // RSSフィードのURL
    itemCount: number;  // 表示するアイテム数
    feedTitle?: string;   // RSSフィード自体のタイトル
    fontFamily?: string | null;  // フォントファミリー (null許容)
    fontSize?: number | null;    // フォントサイズ (null許容)
    updateIntervalMinutes?: number | null; // 更新間隔 (null許容)
    isCollapsed?: boolean;
  }
  
  // --- ペインデータ型 ---
  export interface PaneData {
    id: string;
    widgets: (NoteWidget | RssWidget)[];
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
  export interface RssSettingsPayload {
    widgetId: string;
    paneId: string;
    settings: Pick<RssWidget, 'feedUrl' | 'itemCount' | 'fontFamily' | 'fontSize' | 'updateIntervalMinutes'>;
  }
  export interface MemoSettingsPayload {
    widgetId: string;
    paneId: string;
    settings: Pick<NoteWidget, 'title' | 'fontFamily' | 'fontSize'>;
  }