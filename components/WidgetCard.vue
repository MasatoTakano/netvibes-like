<template>
    <div class="widget-wrapper">
      <div
        class="widget-menu-bar"
        :class="{
          'widget-menu-bar--note': widget.type === 'note',
          'widget-menu-bar--rss': widget.type === 'rss'
        }"
      >
        <span
          class="widget-collapse-toggle"
          @click.stop="emitToggleCollapse"
        >
          {{ widget.isCollapsed ? '▷' : '▽' }}
        </span>
        <span class="widget-title">{{ getWidgetTitle(widget) }}</span>
        <div class="widget-actions">
          <span
            v-if="widget.type === 'note' || widget.type === 'rss' || widget.type === 'calendar'"
            class="widget-action-icon settings-icon"
            @click.stop="emitOpenSettings"
            :title="t('widget.settings')"
          >
            ⚙️
          </span>
          <span
            class="widget-action-icon remove-icon"
            @click.stop="emitConfirmRemove"
            :title="t('widget.remove')"
          >
            ×
          </span>
        </div>
      </div>
      <!-- isCollapsed の制御は v-show でも良いが、トランジションのために CSS 制御が望ましい -->
      <div class="widget-content" v-show="!widget.isCollapsed">
        <MemoNote
          v-if="widget.type === 'note'"
          :id="widget.id"
          :content="widget.content"
          :title="widget.title"
          :font-family="widget.fontFamily"
          :font-size="widget.fontSize"
          @update:content="emitUpdateNoteContent"
          class="draggable-widget-content"
        />
        <RssReader
          v-else-if="widget.type === 'rss'"
          :id="widget.id"
          :feed-url="widget.feedUrl"
          :item-count="widget.itemCount"
          :font-family="widget.fontFamily"
          :font-size="widget.fontSize"
          :updateIntervalMinutes="widget.updateIntervalMinutes"
          @update:title="emitUpdateRssTitle"
          class="draggable-widget-content"
        />
        <CalendarWidgetComponent
          v-else-if="widget.type === 'calendar'"
          :id="widget.id"
          :iframe-tag="widget.iframeTag"
          class="draggable-widget-content"
        />
      </div>
    </div>
  </template>
  
  <script setup lang="ts">
  import type { PropType } from 'vue';
  import type { NoteWidget, RssWidget, CalendarWidget } from '~/types';
  import MemoNote from '~/components/MemoNote.vue'; // Passenden Pfad sicherstellen
  import RssReader from '~/components/RssReader.vue'; // Passenden Pfad sicherstellen
  import CalendarWidgetComponent from '~/components/CalendarWidget.vue';
  
  const { t } = useI18n(); // i18n を利用
  
  // --- Props ---
  const props = defineProps({
    widget: {
      type: Object as PropType<NoteWidget | RssWidget | CalendarWidget>,
      required: true,
    },
    paneId: {
      type: String,
      required: true,
    }
  });
  
  // --- Emits ---
  const emit = defineEmits<{
    (e: 'toggle-collapse', widgetId: string, paneId: string): void
    (e: 'open-settings', widgetId: string, paneId: string, widgetType: 'note' | 'rss' | 'calendar'): void
    (e: 'confirm-remove', widgetId: string, paneId: string): void
    (e: 'update:noteContent', widgetId: string, content: string): void // メモ内容更新イベント
    (e: 'update:rssTitle', widgetId: string, paneId: string, title: string): void // RSSタイトル更新イベント
  }>();
  
  // --- Methods ---
  const getWidgetTitle = (widget: NoteWidget | RssWidget | CalendarWidget): string => {
    if (widget.type === 'note') {
      return widget.title || t('widget.types.note'); // i18n を使う
    } else if (widget.type === 'rss') {
      // feedTitle があればそれ、なければデフォルト
      return widget.feedTitle || t('widget.types.rss'); // i18n を使う
    } else if (widget.type === 'calendar') {
      return t('widget.types.googleCalendar');
    }
    return t('widget.name'); // i18n を使う
  };
  
  const emitToggleCollapse = () => {
    emit('toggle-collapse', props.widget.id, props.paneId);
  };
  
  const emitOpenSettings = () => {
    if (props.widget.type === 'note' || props.widget.type === 'rss' || props.widget.type === 'calendar') {
      emit('open-settings', props.widget.id, props.paneId, props.widget.type);
    }
  };
  
  const emitConfirmRemove = () => {
    emit('confirm-remove', props.widget.id, props.paneId);
  };
  
  const emitUpdateNoteContent = (newContent: string) => {
    // NoteWidget の場合のみ emit
    if (props.widget.type === 'note') {
      emit('update:noteContent', props.widget.id, newContent);
    }
  };
  
  const emitUpdateRssTitle = (newTitle: string) => {
    // RssWidget の場合のみ emit
    if (props.widget.type === 'rss') {
      emit('update:rssTitle', props.widget.id, props.paneId, newTitle);
    }
  };
  
  </script>
  
  <style scoped>
  /* WidgetCard コンポーネント固有のスタイル */
  .widget-wrapper {
    background-color: #fff;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.08);
    display: flex;
    flex-direction: column;
    overflow: hidden; /* コンテンツのはみ出し防止と角丸のため */
    box-sizing: border-box;
  }
  
  /* --- Widget Menu Bar --- */
  .widget-menu-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background-color: #f8f9fa; /* デフォルトの背景色 */
    border-bottom: 1px solid #e0e0e0;
    cursor: grab; /* メニューバー全体をハンドルに */
    flex-shrink: 0;
    width: 100%;
    box-sizing: border-box;
    padding: 2px 5px; /* 少し狭く調整 */
    user-select: none; /* ドラッグ操作の邪魔にならないように */
  }
  .widget-menu-bar:active {
      cursor: grabbing;
  }
  
  /* タイプごとのメニューバー背景色 */
  .widget-menu-bar--note {
    background-color: #fffacd; /* 薄い黄色 */
    border-bottom-color: #ffe58f;
  }
  .widget-menu-bar--note:hover {
    background-color: #fff5b4;
  }
  .widget-menu-bar--rss {
    background-color: #e9ecef; /* 薄いグレー */
    border-bottom-color: #ced4da;
  }
  .widget-menu-bar--rss:hover {
    background-color: #dee2e6;
  }
  
  .widget-collapse-toggle {
    cursor: pointer;
    padding: 4px 6px; /* クリック領域調整 */
    font-size: 0.9em;
    color: #6c757d;
    margin-right: 6px; /* アイコンとタイトルの間 */
    transition: color 0.2s ease;
    line-height: 1;
  }
  .widget-collapse-toggle:hover {
    color: #343a40;
  }
  
  .widget-title {
    font-weight: bold;
    font-size: 0.9em; /* 少し小さく */
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-right: 10px;
    flex-grow: 1; /* スペースを埋める */
    color: #343a40;
  }
  
  .widget-actions {
    display: flex;
    align-items: center;
    gap: 6px; /* アイコン間のスペースを少し狭く */
    flex-shrink: 0; /* アクションボタンが縮まないように */
  }
  
  .widget-action-icon {
    color: #6c757d;
    cursor: pointer;
    font-size: 1em; /* アイコンサイズ調整 */
    padding: 3px; /* クリック領域確保 */
    border-radius: 3px;
    transition: background-color 0.2s ease, color 0.2s ease;
    line-height: 1; /* 縦中央揃えのため */
  }
  .widget-action-icon:hover {
    background-color: #e9ecef;
    color: #343a40;
  }
  .settings-icon:hover {
    color: #007bff;
  }
  .remove-icon:hover {
    color: #dc3545;
  }
  
  /* --- Widget Content --- */
  .widget-content {
    /* padding は内側のコンポーネント (MemoNote, RssReader) に任せる */
    padding: 0;
    flex-grow: 1; /* 残りの高さを埋める */
    width: 100%;
    box-sizing: border-box;
    /* グローバルCSSで定義されたカスタムプロパティを使用 */
    font-family: var(--widget-content-font-family);
    font-size: var(--widget-content-font-size);
    overflow-y: auto; /* コンテンツが多い場合にスクロール */
    /* max-height は設定せず、flex-grow で高さを確保 */
    /* トランジション用のスタイル */
    transition: padding 0.3s ease-out, max-height 0.3s ease-out, opacity 0.2s ease-out;
    opacity: 1;
    max-height: 1000px; /* アニメーション用。必要なら調整 */
  }
  
  /* 子コンポーネントへのスタイル適用 (必要であれば :deep を使う) */
  .draggable-widget-content {
    /* WidgetCard の .widget-content 内で */
    /* 高さを100%使うようにしたいが、.widget-contentがflex-growするので */
    /* 子要素でheight:100%は効きにくい場合がある */
    /* 必要であれば、MemoNote/RssReader 側で調整 */
    width: 100%;
  }
  
  /* 折りたたみ時のスタイル（v-showと連携） */
  .widget-wrapper:has(.widget-content[style*="display: none"]) .widget-content {
    max-height: 0;
    padding-top: 0;
    padding-bottom: 0;
    opacity: 0;
    overflow: hidden; /* transition中にコンテンツが見えないように */
    /* border-top: none; メニューバーとの間に隙間ができる場合は調整 */
  }
  /* display: none; が style 属性につくため、CSS Transition は期待通り動かない可能性がある */
  /* v-if を使うか、クラスバインディングで制御する方がトランジションは確実 */
  /* 例：
  <div class="widget-content" :class="{ 'is-collapsed': widget.isCollapsed }">
  .widget-content.is-collapsed { max-height: 0; ... }
  */
  /* v-show のままでも、見た目の切り替えは機能する */
  
  </style>