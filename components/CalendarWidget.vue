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
  import { useTheme } from '~/composables/useTheme';
  import { isAllowedCalendarSrc } from '~/utils/calendarHosts';

  // --- Theme ---
  const { isDarkMode } = useTheme();

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
    const sanitized = DOMPurify.sanitize(props.iframeTag, {
      ADD_TAGS: ['iframe'],
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
      ],
    });

    const template = document.createElement('template');
    template.innerHTML = sanitized;

    const allowedIframes: string[] = [];
    for (const iframe of Array.from(template.content.querySelectorAll('iframe'))) {
      const src = iframe.getAttribute('src') || '';
      if (!isAllowedCalendarSrc(src)) {
        continue;
      }

      iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups');
      iframe.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
      allowedIframes.push(iframe.outerHTML);
    }

    // カレンダー設定は iframe タグ専用。iframe 以外のサニタイズ済みHTMLも表示しない。
    return allowedIframes.join('');
  });
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
