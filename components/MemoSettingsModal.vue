<!-- components/RssSettingsModal.vue -->
<template>
  <BaseModal :show="show" @close="close" title-id="memo-settings-title">
    <template #title>{{ $t('memoSettings.title') }}</template>

    <template #default>
      <div v-if="widgetData" class="settings-form">
        <div class="form-group">
          <label :for="'memo-title-' + widgetData.id">{{ $t('memoSettings.widgetTitle') }}</label>
          <input
            type="text"
            :id="'memo-title-' + widgetData.id"
            v-model="editableSettings.title"
            :placeholder="$t('memoSettings.widgetTitlePlaceholder')"
          />
        </div>
        <div class="form-group">
          <label :for="'memo-font-family-' + widgetData.id">{{ $t('common.font') }}</label>
          <select
            :id="'memo-font-family-' + widgetData.id"
            v-model="editableSettings.fontFamily"
          >
            <option v-for="font in availableFonts" :key="font" :value="font">{{ font }}</option>
          </select>
        </div>
        <div class="form-group">
          <label :for="'memo-font-size-' + widgetData.id">{{ $t('common.fontSize') }}</label>
          <input
            type="number"
            :id="'memo-font-size-' + widgetData.id"
            v-model.number="editableSettings.fontSize"
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
      <button @click="save" class="button button-primary" :disabled="!widgetData">{{ $t('common.save') }}</button>
      <button @click="close" class="button button-secondary">{{ $t('common.cancel') }}</button>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue';
import BaseModal from './BaseModal.vue'; // BaseModal をインポート
import { DEFAULT_NOTE_FONT_FAMILY, DEFAULT_NOTE_FONT_SIZE } from '~/constants';

const { t } = useI18n();

// 親から渡される Props
const props = defineProps({
  show: { type: Boolean, required: true },
  widgetData: { type: Object as () => NoteWidget | null, default: null }, // 編集対象ウィジェットデータ
  availableFonts: { type: Array as () => string[], default: () => [] }, // フォントリスト
});

// 親へ通知する Emits
const emit = defineEmits(['close', 'save']);

// モーダル内部の状態
const editableSettings = reactive({
  title: '',
  fontFamily: DEFAULT_NOTE_FONT_FAMILY,
  fontSize: DEFAULT_NOTE_FONT_SIZE,
});
const error = ref<string | null>(null);

// Props の widgetData が変更されたら、editableSettings を更新
watch(() => props.widgetData, (newData) => {
  if (newData) {
    editableSettings.title = newData.title || '';
    editableSettings.fontFamily = newData.fontFamily || DEFAULT_NOTE_FONT_FAMILY;
    editableSettings.fontSize = newData.fontSize || DEFAULT_NOTE_FONT_SIZE;
    error.value = null; // エラーリセット
  }
}, { immediate: true }); // 初期表示時も実行

// バリデーション関数 (例)
const validateSettings = (): boolean => {
  error.value = null;
  const fontSize = editableSettings.fontSize;
  if (typeof fontSize !== 'number' || !Number.isInteger(fontSize) || fontSize < 8 || fontSize > 72) {
      error.value = t('common.errorFontSize'); return false;
  }
  // Font family validation (optional)
  return true;
};

// 保存処理
const save = () => {
  if (!props.widgetData || !validateSettings()) {
    return;
  }
  // 変更後の設定データを emit で親に渡す
  emit('save', {
    widgetId: props.widgetData.id,
    paneId: props.widgetData.paneId, // paneId も渡す必要あり (propsに追加)
    settings: { ...editableSettings } // editableSettings のコピーを渡す
  });
  // emit('close'); // 保存成功後、親が閉じるか、ここで閉じるか
};

// キャンセル処理 (閉じるだけ)
const close = () => {
  emit('close');
};

// RssWidget 型定義 (インポートするか、ここで定義)
interface NoteWidget {
  id: string;
  paneId?: string; // 親から渡す際に付与する必要あり
  type: 'note';
  title?: string;       // タイトル
  content: string;      // メモ内容
  fontFamily?: string;  // フォントファミリー
  fontSize?: number;    // フォントサイズ(px単位で保存)
}
</script>

<style scoped>
/* モーダル内のフォームスタイル */
.settings-form {
  /* display: grid; grid-template-columns: auto 1fr; gap: 10px 15px; align-items: center; */
}
.form-group {
  margin-bottom: 15px;
}
.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
}
.form-group input[type="url"],
.form-group input[type="number"],
.form-group select {
  width: 100%;
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-sizing: border-box;
}
.error-message {
  color: #dc3545;
  margin-top: 10px;
  font-size: 0.9em;
}
.loading-message { color: #666; text-align: center; }
</style>