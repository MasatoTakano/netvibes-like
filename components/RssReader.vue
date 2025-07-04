<!-- components/RssReader.vue -->
<template>
  <div class="rss-reader-content" :style="rssStyle">
    <div v-if="pending && !feedData" class="loading-message">
      {{ $t('rssReader.loading') }}
    </div>
    <div v-else-if="error" class="error-message">
      <p>{{ $t('rssReader.error') }}</p>
      <!-- エラー詳細を表示 -->
      <p class="error-details">
        {{ error.data?.message || error.message || 'Unknown error' }}
      </p>
      <p>URL: {{ props.feedUrl }}</p>
    </div>
    <div
      v-else-if="!feedData || !feedData.items || feedData.items.length === 0"
      class="empty-message"
    >
      {{ $t('rssReader.noItems') }}
    </div>
    <ul v-else class="feed-items">
      <!-- itemCount に基づいて表示件数を制限 -->
      <li
        v-for="(item, index) in displayedItems"
        :key="item.guid || item.link || index"
        class="feed-item"
      >
        <span v-if="item.pubDate" class="item-time">{{
          formatTime(item.pubDate)
        }}</span>
        <a
          :href="item.link"
          target="_blank"
          rel="noopener noreferrer"
          class="item-title"
          :title="item.title || ''"
        >
          {{ getTruncatedTitle(item.title) }}
        </a>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
  import { ref, watch, computed, onMounted, onUnmounted } from 'vue';
  import {
    DEFAULT_RSS_FONT_FAMILY,
    DEFAULT_RSS_FONT_SIZE,
    DEFAULT_RSS_ITEM_COUNT,
    DEFAULT_RSS_UPDATE_INTERVAL_MINUTES,
  } from '~/constants';
  import { useFetch } from '#app';

  // --- Props ---
  const props = defineProps({
    id: { type: String, required: true },
    feedUrl: { type: String, required: true },
    itemCount: { type: Number, default: DEFAULT_RSS_ITEM_COUNT },
    fontFamily: { type: String, default: DEFAULT_RSS_FONT_FAMILY }, // フォントファミリ
    fontSize: { type: Number, default: DEFAULT_RSS_FONT_SIZE }, // フォントサイズ
    updateIntervalMinutes: {
      type: Number as () => number | null,
      default: DEFAULT_RSS_UPDATE_INTERVAL_MINUTES,
    },
    titleMaxLength: { type: Number, default: 100 }, // タイトルを省略するまでの最大文字数
  });

  // --- Emits (title更新用イベントを追加) ---
  const emit = defineEmits(['update:title']);

  // --- 型定義 (APIレスポンスとrss-parserの型を参考に) ---
  interface RssItem {
    title?: string;
    link?: string;
    pubDate?: string;
    contentSnippet?: string; // 概要など
    guid?: string;
    // 他にも isoDate など、必要に応じて追加
  }
  interface FeedData {
    title?: string;
    link?: string;
    items: RssItem[];
  }

  // --- State ---
  // useFetch の結果を保持するための ref
  const feedData = ref<FeedData | null>(null);
  const pending = ref(false);
  const error = ref<Error | null>(null); // H3Error を含む可能性
  const intervalId = ref<ReturnType<typeof setInterval> | null>(null);

  // --- Computed ---
  const updateIntervalMs = computed(() => {
    const minutes = props.updateIntervalMinutes;
    if (minutes && minutes > 0) {
      return minutes * 60 * 1000;
    }
    return null; // 更新しない場合は null
  });

  const rssStyle = computed(() => {
    const style: Record<string, string> = {};
    if (props.fontFamily) {
      // 値があれば設定
      style.fontFamily = props.fontFamily;
    }
    if (props.fontSize) {
      // 値があれば設定
      style.fontSize = `${props.fontSize}px`;
    }
    return style;
  });

  // --- API Fetch ---
  const fetchFeed = async (url: string) => {
    if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
      error.value = new Error('Invalid feed URL format.'); // 無効なURLの場合はカスタムエラー
      feedData.value = null;
      pending.value = false;
      return;
    }

    // 既存のエラーとデータをリセット
    error.value = null;
    pending.value = true; // useFetch の pending とは別にローディング状態を管理

    // APIエンドポイントのURLを構築 (URLをエンコードする)
    const apiUrl = `/api/rss?url=${encodeURIComponent(url)}`;

    try {
      // useFetch を使ってAPIを呼び出す
      const {
        data: fetchedData,
        error: fetchError,
        pending: fetchPending,
      } = await useFetch<FeedData>(apiUrl, {
        key: `rss-${props.id}-${url}`, // コンポーネントIDとURLでユニークなキー
      });

      if (fetchError.value) {
        error.value = fetchError.value; // useFetch が返すエラーオブジェクト
        feedData.value = null;
        emit('update:title', 'RSS Feed (Error)');
      } else if (fetchedData.value) {
        feedData.value = fetchedData.value;
        emit('update:title', fetchedData.value.title || 'RSS Feed');
      } else {
        // データが null で返ってきた場合 (通常はエラーになるはずだが念のため)
        feedData.value = null;
        emit('update:title', 'RSS Feed (No Data)');
      }
    } catch (catchedError: any) {
      // useFetch 自体のセットアップ等で予期せぬエラーが発生した場合
      console.error(
        '[ERROR] [RssReader] Unexpected error during fetchFeed execution:',
        catchedError,
      );
      error.value = catchedError;
      feedData.value = null;
      emit('update:title', 'RSS Feed (Error)');
    } finally {
      pending.value = false; // ローディング完了
    }
  };

  // --- Computed ---
  // 表示するアイテムリスト (itemCount に基づいて件数を絞る)
  const displayedItems = computed(() => {
    if (!feedData.value || !feedData.value.items) {
      return [];
    }
    // slice で指定件数分だけ取得
    return feedData.value.items.slice(0, props.itemCount);
  });

  // --- Methods ---
  // 日付をフォーマットする関数
  const formatTime = (dateString?: string): string => {
    if (!dateString) return '--:--'; // 日付がない場合はプレースホルダー
    try {
      const date = new Date(dateString);
      // getHours() と getMinutes() を使う
      const hours = date.getHours().toString().padStart(2, '0'); // 2桁表示、0埋め
      const minutes = date.getMinutes().toString().padStart(2, '0'); // 2桁表示、0埋め
      return `${hours}:${minutes}`;
    } catch (e) {
      console.error('Error formatting time:', e);
      return '--:--'; // パース失敗時
    }
  };

  // タイトルを指定文字数で省略する
  const getTruncatedTitle = (title?: string): string => {
    const text = title || 'No Title'; // タイトルがない場合のデフォルト値
    const maxLength = props.titleMaxLength;

    // maxLength が 0 以下、または title が maxLength より短い場合はそのまま返す
    if (maxLength <= 0 || text.length <= maxLength) {
      return text;
    }

    // 指定文字数で切り取り、末尾に "..." を追加
    return text.slice(0, maxLength) + '...';
  };

  // --- ライフサイクル & タイマー管理 ---
  const stopTimer = () => {
    if (intervalId.value) {
      clearInterval(intervalId.value);
      intervalId.value = null;
    }
  };

  const startTimer = () => {
    stopTimer(); // 既存のタイマーがあれば停止
    const intervalMs = updateIntervalMs.value; // 計算された更新間隔(ms)を取得
    if (intervalMs) {
      intervalId.value = setInterval(() => {
        fetchFeed(props.feedUrl);
      }, intervalMs);
    }
  };

  // --- Mounted / Unmounted ---
  onMounted(() => {
    // マウント時にタイマーを開始 (初回フェッチは watch で行われる)
    startTimer();
  });

  onUnmounted(() => {
    // アンマウント時にタイマーを停止
    stopTimer();
  });

  // --- Watcher ---
  // feedUrl prop が変更されたら、再度フィードを取得する
  watch(
    [() => props.feedUrl, () => props.updateIntervalMinutes],
    ([newUrl], [oldUrl]) => {
      if (
        newUrl &&
        (newUrl.startsWith('http://') || newUrl.startsWith('https://'))
      ) {
        // URLが変わった場合のみ即時フェッチ
        if (newUrl !== oldUrl) {
          fetchFeed(newUrl);
        }
        startTimer(); // タイマーを再開 (または停止)
      } else {
        // URLが無効になった場合
        feedData.value = null;
        error.value = null;
        pending.value = false;
        stopTimer(); // タイマー停止
      }
    },
    { immediate: true },
  );
</script>

<style scoped>
  .rss-reader-content {
    height: 100%; /* 親の高さを使う */
    display: flex;
    flex-direction: column;
    background-color: var(--widget-bg-color);
    color: var(--widget-text-color);
  }

  .widget-title {
    margin-top: 0;
    margin-bottom: 10px;
    font-size: 1.1em;
    border-bottom: 1px solid #eee;
    padding-bottom: 8px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
    background-color: var(--widget-bg-color);
    color: var(--widget-text-color);
  }
  .widget-title a {
    color: #333;
    text-decoration: none;
    flex-grow: 1; /* タイトルが長くなることを考慮 */
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .widget-title a:hover {
    color: #007bff;
  }

  .loading-indicator,
  .error-indicator {
    font-size: 0.8em;
    color: #999;
    margin-left: 5px;
    white-space: nowrap;
  }
  .error-indicator {
    color: #dc3545;
    font-weight: bold;
  }

  .loading-message,
  .error-message,
  .empty-message {
    color: #666;
    padding: 20px;
    text-align: center;
    flex-grow: 1; /* 残りのスペースを埋める */
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  .error-message {
    color: #721c24;
    background-color: #f8d7da;
    border: 1px solid #f5c6cb;
    border-radius: 4px;
    padding: 10px 15px;
    text-align: left;
  }
  .error-details {
    font-size: 0.9em;
    color: #721c24;
    opacity: 0.8;
    margin-top: 5px;
    word-break: break-all; /* 長いエラーメッセージを折り返す */
  }

  .feed-items {
    list-style: none;
    padding: 0;
    margin: 0;
    overflow-y: auto; /* はみ出したらスクロール */
    flex-grow: 1; /* 残りの高さを埋める */
  }

  .feed-item {
    display: flex;
    align-items: baseline; /* テキストのベースラインを揃える */
    gap: 6px;
    margin-bottom: 1px;
    padding-bottom: 1px;
    /* 枠線 */
    /* border-bottom: 1px solid #f0f0f0; */
  }

  .feed-item:last-child {
    border-bottom: none;
    margin-bottom: 0;
    padding-bottom: 0;
  }

  .item-title {
    font-weight: normal; /* 好みに合わせて調整 */
    color: var(--widget-text-color);
    text-decoration: none;
    margin-bottom: 0;
    font-weight: bold;
    font-size: 1em;
    white-space: nowrap; /* 折り返さない */
    overflow: hidden; /* はみ出した部分を隠す */
    text-overflow: ellipsis; /* 省略記号を表示 */
  }
  .item-title:hover {
    text-decoration: underline;
  }

  .item-time {
    font-size: 0.85em; /* 少し小さめ */
    color: #888;
    white-space: nowrap; /* 改行させない */
    flex-shrink: 0; /* 縮まないように */
  }
</style>
