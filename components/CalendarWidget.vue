<!-- components/CalendarWidget.vue -->
<template>
  <div class="calendar-widget-content">
    <div v-if="!iframeTag" class="no-iframe-message">
      {{ $t('calendarWidget.noIframe') }}
    </div>
    <div
      v-else
      class="iframe-container"
      :class="{ 'dark-mode-iframe': isDarkMode }"
      v-html="sanitizedIframeTag"
    ></div>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import DOMPurify from 'dompurify';
  import { useTheme } from '~/composables/useTheme'; // useTheme をインポート

  // --- Theme ---
  const { isDarkMode } = useTheme(); // 現在のテーマを取得

  // --- Props ---
  const props = defineProps({
    id: {
      type: String,
      required: true,
    },
    iframeTag: {
      type: String,
      required: true,
    },
  });

  // --- Computed ---
  const sanitizedIframeTag = computed(() => {
    // DOMPurify を使って iframe タグをサニタイズ
    return DOMPurify.sanitize(props.iframeTag, {
      ADD_TAGS: ['iframe'], // iframe タグを許可
      ADD_ATTR: [
        'src',
        'style',
        'frameborder',
        'scrolling',
        'allowfullscreen',
        'loading',
        'referrerpolicy',
        'width',
        'height',
      ], // 許可する属性を追加
    });
  });

  watch(
    () => props.iframeTag,
    (newTag) => {
      console.log('Original iframeTag:', newTag);
      console.log('Sanitized iframeTag:', sanitizedIframeTag.value);
    },
    { immediate: true },
  );
</script>

<style scoped>
  .calendar-widget-content {
    /* height: 100% を削除し、コンテンツの高さに依存するように変更 */
    display: flex;
    flex-direction: column;
    background-color: var(--widget-bg-color);
    color: var(--widget-text-color);
  }

  .no-iframe-message {
    color: #666;
    padding: 20px;
    text-align: center;
    flex-grow: 1;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .iframe-container {
    /* flex-grow: 1 を削除 */
    /* display: flex; は、iframeが単一要素なので不要 */
  }

  .iframe-container.dark-mode-iframe ::v-deep(iframe) {
    filter: invert(1) hue-rotate(180deg);
    background-color: #f0f0f0; /* 背景色を調整して、反転後の見栄えを改善 */
  }

  .iframe-container ::v-deep(iframe) {
    width: 100%;
    /* height: 100% を削除し、iframeタグのheight属性を尊重させる */
    border: none;
    /* iframeはインライン要素なので、予期せぬ余白を防ぐためにblockに変更 */
    display: block;
  }
</style>
