<!-- components/AddWidgetModal.vue -->
<template>
  <BaseModal :show="show" title-id="add-widget-title" @close="close">
    <template #title>{{ $t('addWidget.modalTitle') }}</template>

    <template #default>
      <div class="add-widget-options">
        <p>{{ $t('addWidget.selectPrompt') }}<</p>
        <div class="widget-type-selection">
          <button class="button widget-type-button" @click="selectType('note')">
            <span class="icon">📝</span> {{ $t('addWidget.memo') }}
          </button>
          <button class="button widget-type-button" @click="selectType('rss')">
            <span class="icon">📰</span> {{ $t('addWidget.rss') }}
          </button>
          <button
            class="button widget-type-button"
            @click="selectType('calendar')"
          >
            <span class="icon">📅</span> {{ $t('addWidget.googleCalendar') }}
          </button>
          <button
            class="button widget-type-button"
            @click="selectType('bookmark')"
          >
            <span class="icon">🔗</span> {{ $t('addWidget.bookmark') }}
          </button>
        </div>

        <!-- RSS選択時にURL入力欄を表示 -->
        <div v-if="selectedType === 'rss'" class="rss-url-input form-group">
          <label for="add-rss-url">{{ $t('addWidget.rssUrlPrompt') }}</label>
          <input
            id="add-rss-url"
            ref="rssUrlInputRef"
            v-model="rssFeedUrl"
            type="url"
            placeholder="https://example.com/rss.xml"
          />
          <p v-if="rssUrlError" class="error-message">{{ rssUrlError }}</p>
        </div>
      </div>
    </template>

    <template #footer>
      <!-- RSS選択時はURL入力後にAddボタンを有効化 -->
      <button
        class="button button-primary"
        :disabled="!selectedType || (selectedType === 'rss' && !isRssUrlValid)"
        @click="add"
      >
        {{ $t('addWidget.addButton') }}
      </button>
      <button class="button button-secondary" @click="close">
        {{ $t('common.cancel') }}
      </button>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
  import { ref, computed, nextTick, watch } from 'vue';
  import BaseModal from './BaseModal.vue';

  const { t } = useI18n();

  // Props
  const props = defineProps({
    show: { type: Boolean, required: true },
    // paneId: { type: String, required: true } // どのペインに追加するか (今回は不要)
  });

  // Emits
  const emit = defineEmits(['close', 'add']);

  // 内部状態
  const selectedType = ref<'note' | 'rss' | 'calendar' | 'bookmark' | null>(null);
  const rssFeedUrl = ref('');
  const rssUrlError = ref<string | null>(null);
  const rssUrlInputRef = ref<HTMLInputElement | null>(null); // URL入力欄フォーカス用

  // ウィジェットタイプ選択
  const selectType = (type: 'note' | 'rss' | 'calendar' | 'bookmark') => {
    selectedType.value = type;
    rssUrlError.value = null; // エラーリセット
    // RSS選択時にURL入力欄にフォーカス (nextTick後)
    if (type === 'rss') {
      nextTick(() => {
        rssUrlInputRef.value?.focus();
      });
    }
  };

  // RSS URLの簡易バリデーション
  const isRssUrlValid = computed(() => {
    const url = rssFeedUrl.value.trim();
    return url.startsWith('http://') || url.startsWith('https://');
  });

  // Addボタンクリック
  const add = () => {
    rssUrlError.value = null; // エラーリセット
    if (!selectedType.value) return;

    if (selectedType.value === 'rss') {
      if (!isRssUrlValid.value) {
        rssUrlError.value = t('addWidget.errorInvalidUrl');
        return;
      }
      // RSSウィジェット追加イベントを発行
      emit('add', { type: 'rss', feedUrl: rssFeedUrl.value.trim() });
    } else if (selectedType.value === 'calendar') {
      emit('add', { type: 'calendar' });
    } else if (selectedType.value === 'bookmark') {
      emit('add', { type: 'bookmark' });
    } else {
      // メモウィジェット追加イベントを発行
      emit('add', { type: 'note' });
    }
    // 追加後、内部状態をリセットして閉じる
    resetAndClose();
  };

  // キャンセル
  const close = () => {
    resetAndClose();
  };

  // 状態リセットとクローズ
  const resetAndClose = () => {
    selectedType.value = null;
    rssFeedUrl.value = '';
    rssUrlError.value = null;
    emit('close');
  };

  // モーダル表示時に状態をリセット (任意)
  watch(
    () => props.show,
    (newShow) => {
      if (!newShow) {
        resetAndClose();
      }
    },
  );
</script>

<style scoped>
  .add-widget-options p {
    margin-top: 0;
    margin-bottom: 15px;
    text-align: center;
  }
  .widget-type-selection {
    display: flex;
    justify-content: center;
    gap: 15px;
    margin-bottom: 20px;
  }
  .widget-type-button {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 15px 20px;
    border: 1px solid #ccc;
    background-color: #f8f9fa;
    cursor: pointer;
    border-radius: 4px;
    width: 120px; /* 固定幅 */
    transition:
      background-color 0.2s ease,
      border-color 0.2s ease;
  }
  .widget-type-button:hover {
    background-color: #e9ecef;
    border-color: #adb5bd;
  }
  .widget-type-button .icon {
    font-size: 1.8em;
    margin-bottom: 8px;
  }

  .rss-url-input {
    margin-top: 20px;
  }
  /* フォーム要素共通スタイル */
  .form-group {
    margin-bottom: 15px;
  }
  .form-group label {
    display: block;
    margin-bottom: 5px;
    font-weight: bold;
  }
  .form-group input[type='url'] {
    width: 100%;
    padding: 10px;
    border: 1px solid #ccc;
    border-radius: 4px;
    box-sizing: border-box;
  }
  .error-message {
    color: #dc3545;
    margin-top: 5px;
    font-size: 0.9em;
  }

  /* BaseModalからボタンクラスを流用 */
  .button {
    /* ... 必要なら BaseModal 側のスタイルを参照 ... */
  }
  .button-primary {
    /* ... */
  }
  .button-secondary {
    /* ... */
  }
</style>
