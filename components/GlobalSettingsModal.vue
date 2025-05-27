<!-- components/GlobalSettingsModal.vue -->
<template>
  <BaseModal :show="show" @close="close" title-id="global-settings-title">
    <template #title>{{ $t('globalSettings.title') }}</template>

    <template #default>
      <div class="settings-form">
        <div class="form-group">
          <label for="global-font-family">{{ $t('common.font') }}</label>
          <select id="global-font-family" v-model="editableSettings.fontFamily">
            <option v-for="font in availableFonts" :key="font" :value="font">{{ font }}</option>
          </select>
        </div>
        <div class="form-group">
          <label for="global-font-size">{{ $t('common.fontSize') }}</label>
          <input type="number" id="global-font-size" v-model.number="editableSettings.fontSize" min="8" max="72" step="1"/>
        </div>
        <p v-if="error" class="error-message">{{ error }}</p>
      </div>
    </template>

    <template #footer>
      <button @click="save" class="button button-primary">{{ $t('common.apply') }}</button>
      <button @click="close" class="button button-secondary">{{ $t('common.cancel') }}</button>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue';
import BaseModal from './BaseModal.vue';
import { DEFAULT_GLOBAL_SETTINGS } from '~/constants';

const { t } = useI18n();

// 親から渡される Props
const props = defineProps({
  show: { type: Boolean, required: true },
  initialSettings: { type: Object as () => GlobalSettings, required: true }, // 現在の全体設定
  availableFonts: { type: Array as () => string[], default: () => [] }, // フォントリスト
});

// 親へ通知する Emits
const emit = defineEmits(['close', 'save']);

// モーダル内部の状態
const editableSettings = reactive<GlobalSettings>({
  fontFamily: DEFAULT_GLOBAL_SETTINGS.fontFamily,
  fontSize: DEFAULT_GLOBAL_SETTINGS.fontSize,
});
const error = ref<string | null>(null);

// Props の initialSettings が変更されたら、editableSettings を更新
watch(() => props.initialSettings, (newSettings) => {
  if (newSettings) {
    // editableSettings に現在の設定値をコピー
    Object.assign(editableSettings, newSettings);
    error.value = null; // エラーリセット
  }
}, { immediate: true, deep: true }); // deep: true でオブジェクト内部の変更も検知 (通常は不要かも)

// バリデーション関数
const validateSettings = (): boolean => {
  error.value = null;
  const fontSize = editableSettings.fontSize;
  if (typeof fontSize !== 'number' || !Number.isInteger(fontSize) || fontSize < 8 || fontSize > 72) {
     error.value = t('common.errorFontSize'); return false;
  }
  return true;
};

// 保存処理
const save = () => {
  if (!validateSettings()) {
    return;
  }
  emit('save', { ...editableSettings });
};

// キャンセル処理
const close = () => {
  emit('close');
};

// GlobalSettings 型定義 (インポートするか、ここで定義)
interface GlobalSettings {
  fontFamily: string;
  fontSize: number;
}
</script>

<style scoped>
/* 他の設定モーダルと同様のスタイルを適用 */
.settings-form { }
.form-group { margin-bottom: 15px; }
.form-group label { display: block; margin-bottom: 5px; font-weight: bold; }
html[data-theme='dark'] .form-group label {
    opacity: 0.8;
}
.form-group input[type="number"],
.form-group input[type="color"],
.form-group select {
  width: 100%;
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-sizing: border-box;
}
/* type="color" の高さを調整 */
.form-group input[type="color"] {
  height: 40px; /* input type="number" などと高さを合わせる */
  padding: 5px; /* パディングを調整 */
  background-color: var(--input-bg-color);
  color: var(--input-text-color);
  border: 1px solid var(--input-border-color);
}
.error-message { color: #dc3545; margin-top: 10px; font-size: 0.9em; }

html[data-theme='dark'] .error-message {
    color: #f8d7da; /* Lighter red for dark mode */
}
</style>