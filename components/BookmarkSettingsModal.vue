<!-- components/BookmarkSettingsModal.vue -->
<template>
  <BaseModal :show="show" title-id="bookmark-settings-title" @close="close">
    <template #title>{{ $t('bookmarkSettings.title') }}</template>

    <template #default>
      <div v-if="widgetData" class="settings-form">
        <div class="form-group">
          <label :for="'bookmark-title-' + widgetData.id">{{
            $t('bookmarkSettings.widgetTitle')
          }}</label>
          <input
            :id="'bookmark-title-' + widgetData.id"
            v-model="editableSettings.title"
            type="text"
            :placeholder="$t('bookmarkSettings.widgetTitlePlaceholder')"
          />
        </div>
        <div class="form-group">
          <label :for="'bookmark-columns-' + widgetData.id">{{
            $t('bookmarkSettings.columns')
          }}</label>
          <input
            :id="'bookmark-columns-' + widgetData.id"
            v-model.number="editableSettings.columns"
            type="number"
            min="1"
            :max="maxColumns"
            step="1"
          />
          <small class="form-hint">{{ $t('bookmarkSettings.columnsHint') }}</small>
        </div>
        <div class="form-group">
          <label :for="'bookmark-font-family-' + widgetData.id">{{
            $t('common.font')
          }}</label>
          <select
            :id="'bookmark-font-family-' + widgetData.id"
            v-model="editableSettings.fontFamily"
          >
            <option v-for="font in availableFonts" :key="font" :value="font">
              {{ font }}
            </option>
          </select>
        </div>
        <div class="form-group">
          <label :for="'bookmark-font-size-' + widgetData.id">{{
            $t('common.fontSize')
          }}</label>
          <input
            :id="'bookmark-font-size-' + widgetData.id"
            v-model.number="editableSettings.fontSize"
            type="number"
            min="8"
            max="72"
            step="1"
          />
        </div>
        <p v-if="error" class="error-message">{{ error }}</p>
      </div>
      <div v-else class="loading-message">{{ $t('common.loading') }}</div>
    </template>

    <template #footer>
      <button
        class="button button-primary"
        :disabled="!widgetData"
        @click="save"
      >
        {{ $t('common.save') }}
      </button>
      <button class="button button-secondary" @click="close">
        {{ $t('common.cancel') }}
      </button>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
  import { ref, reactive, watch } from 'vue';
  import BaseModal from './BaseModal.vue';
  import {
    DEFAULT_BOOKMARK_FONT_FAMILY,
    DEFAULT_BOOKMARK_FONT_SIZE,
    DEFAULT_BOOKMARK_COLUMNS,
    MAX_BOOKMARK_COLUMNS,
  } from '~/constants';
  import type { BookmarkWidgetWithPane } from '~/types';

  const { t } = useI18n();

  // --- Props ---
  const props = defineProps({
    show: { type: Boolean, required: true },
    widgetData: {
      type: Object as () => BookmarkWidgetWithPane | null,
      default: null,
    },
    availableFonts: {
      type: Array as () => readonly string[],
      default: () => [],
    },
  });

  // --- Emits ---
  const emit = defineEmits(['close', 'save']);

  // --- 内部状態 ---
  const editableSettings = reactive({
    title: '',
    fontFamily: DEFAULT_BOOKMARK_FONT_FAMILY,
    fontSize: DEFAULT_BOOKMARK_FONT_SIZE,
    columns: DEFAULT_BOOKMARK_COLUMNS,
  });
  const error = ref<string | null>(null);
  const maxColumns = MAX_BOOKMARK_COLUMNS;

  // --- watch: Props 変更時に editableSettings を同期 ---
  watch(
    () => props.widgetData,
    (newData) => {
      if (newData) {
        editableSettings.title = newData.title || '';
        editableSettings.fontFamily =
          newData.fontFamily || DEFAULT_BOOKMARK_FONT_FAMILY;
        editableSettings.fontSize =
          newData.fontSize || DEFAULT_BOOKMARK_FONT_SIZE;
        editableSettings.columns =
          newData.columns || DEFAULT_BOOKMARK_COLUMNS;
        error.value = null;
      }
    },
    { immediate: true },
  );

  // --- バリデーション ---
  const validateSettings = (): boolean => {
    error.value = null;
    const fontSize = editableSettings.fontSize;
    if (
      typeof fontSize !== 'number' ||
      !Number.isInteger(fontSize) ||
      fontSize < 8 ||
      fontSize > 72
    ) {
      error.value = t('common.errorFontSize');
      return false;
    }
    const columns = editableSettings.columns;
    if (
      typeof columns !== 'number' ||
      !Number.isInteger(columns) ||
      columns < 1 ||
      columns > MAX_BOOKMARK_COLUMNS
    ) {
      error.value = t('bookmarkSettings.errorColumns');
      return false;
    }
    return true;
  };

  // --- 保存 ---
  const save = () => {
    if (!props.widgetData || !validateSettings()) {
      return;
    }
    emit('save', {
      widgetId: props.widgetData.id,
      paneId: props.widgetData.paneId,
      settings: { ...editableSettings },
    });
  };

  // --- キャンセル ---
  const close = () => {
    emit('close');
  };
</script>

<style scoped>
  .form-group {
    margin-bottom: 15px;
  }
  .form-group label {
    display: block;
    margin-bottom: 5px;
    font-weight: bold;
  }
  .form-group input[type='text'],
  .form-group input[type='number'],
  .form-group select {
    width: 100%;
    padding: 10px;
    border: 1px solid #ccc;
    border-radius: 4px;
    box-sizing: border-box;
  }
  .form-hint {
    display: block;
    margin-top: 4px;
    color: #888;
    font-size: 0.85em;
  }
  .error-message {
    color: #dc3545;
    margin-top: 10px;
    font-size: 0.9em;
  }
  .loading-message {
    color: #666;
    text-align: center;
  }
</style>
