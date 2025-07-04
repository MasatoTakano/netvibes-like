// constants/index.ts
import type { FontSettings } from '~/types';

// --- デフォルト全体設定 ---
export const DEFAULT_GLOBAL_SETTINGS: Readonly<FontSettings> = Object.freeze({
  fontFamily: 'Meiryo', // デフォルトフォント
  fontSize: 12, // デフォルトフォントサイズ
});

// --- 利用可能なフォントリスト ---
// Readonly<string[]> で配列の内容が変更されないようにマーク
export const AVAILABLE_FONTS: Readonly<string[]> = Object.freeze([
  'Arial',
  'Verdana',
  'Tahoma',
  'Trebuchet MS',
  'Times New Roman',
  'Georgia',
  'Garamond',
  'Courier New',
  'Brush Script MT', // 'Helvetica Neue', // 環境依存強い
  'Roboto',
  'Lato',
  'Montserrat',
  'Open Sans', // Google Fonts例 (実際に使うなら読み込みが必要)
  'sans-serif',
  'serif',
  '"Hiragino Kaku Gothic ProN"',
  '"Hiragino Sans"',
  '"Yu Gothic"',
  '"YuGothic"',
  'Meiryo',
  '"Hiragino Mincho ProN"',
  '"Yu Mincho"',
  '"YuMincho"',
]);

// --- デフォルトウィジェット設定 ---
export const DEFAULT_NOTE_FONT_FAMILY = DEFAULT_GLOBAL_SETTINGS.fontFamily;
export const DEFAULT_NOTE_FONT_SIZE = DEFAULT_GLOBAL_SETTINGS.fontSize;
export const DEFAULT_RSS_FONT_FAMILY = DEFAULT_GLOBAL_SETTINGS.fontFamily;
export const DEFAULT_RSS_FONT_SIZE = DEFAULT_GLOBAL_SETTINGS.fontSize;
export const DEFAULT_RSS_ITEM_COUNT = 5; // 表示するアイテム数
export const DEFAULT_RSS_UPDATE_INTERVAL_MINUTES = 15; // 更新間隔(分単位)

// --- デフォルトレイアウト設定 ---
export const defaultLayoutData = [
  {
    id: 'pane-1',
    size: 33.3,
    widgets: [
      {
        id: 'note-default',
        type: 'note',
        title: 'Welcome!',
        content: 'Start typing your notes here.',
        fontFamily: DEFAULT_GLOBAL_SETTINGS.fontFamily,
        fontSize: DEFAULT_GLOBAL_SETTINGS.fontSize,
      },
    ],
  },
  {
    id: 'pane-2',
    size: 33.3,
    widgets: [],
  },
  {
    id: 'pane-3',
    size: 33.3,
    widgets: [],
  },
];
