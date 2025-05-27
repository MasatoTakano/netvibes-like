<!-- components/RssSettingsModal.vue -->
<template>
  <BaseModal :show="show" @close="close" title-id="rss-settings-title">
    <template #title>{{ $t('rssSettings.title') }}</template>

    <template #default>
      <div v-if="widgetData" class="settings-form">
        <div class="form-group">
          <label :for="'rss-url-' + widgetData.id">{{ $t('rssSettings.feedUrl') }}</label>
          <input
            type="url"
            :id="'rss-url-' + widgetData.id"
            v-model="editableSettings.feedUrl"
            placeholder="https://example.com/rss.xml"
          />
        </div>
        <div class="form-group">
          <label :for="'rss-count-' + widgetData.id">{{ $t('rssSettings.itemCount') }}</label>
          <input
            type="number"
            :id="'rss-count-' + widgetData.id"
            v-model.number="editableSettings.itemCount"
            min="1"
            max="50"
          />
        </div>
        <div class="form-group">
          <label :for="'rss-font-family-' + widgetData.id">{{ $t('common.font') }}</label>
          <select
            :id="'rss-font-family-' + widgetData.id"
            v-model="editableSettings.fontFamily"
          >
            <option
              v-for="font in availableFonts"
              :key="font"
              :value="font"
            >
              {{ font }}
            </option>
          </select>
        </div>
        <div class="form-group">
          <label :for="'rss-font-size-' + widgetData.id">{{ $t('common.fontSize') }}</label>
          <input type="number" :id="'rss-font-size-' + widgetData.id" v-model.number="editableSettings.fontSize" min="8" max="72" step="1"/>
        </div>
        <div class="form-group">
          <label :for="'rss-interval-' + widgetData.id">{{ $t('rssSettings.updateInterval') }}</label>
          <select :id="'rss-interval-' + widgetData.id" v-model.number="editableSettings.updateIntervalMinutes">
            <option :value="5">5</option>
            <option :value="10">10</option>
            <option :value="15">15</option>
            <option :value="30">30</option>
            <option :value="60">60</option>
            <option :value="null">{{ $t('rssSettings.manualOnly') }}</option> <!-- 更新しないオプション -->
          </select>
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
import { DEFAULT_RSS_FONT_FAMILY, DEFAULT_RSS_FONT_SIZE, DEFAULT_RSS_ITEM_COUNT, DEFAULT_RSS_UPDATE_INTERVAL_MINUTES } from '~/constants';

const { t } = useI18n();

// 親から渡される Props
const props = defineProps({
  show: { type: Boolean, required: true },
  widgetData: { type: Object as () => RssWidget | null, default: null }, // 編集対象ウィジェットデータ
  availableFonts: { type: Array as () => string[], default: () => [] }, // フォントリスト
});

// 親へ通知する Emits
const emit = defineEmits(['close', 'save']);

// モーダル内部の状態
const editableSettings = reactive({
  feedUrl: '',
  itemCount: DEFAULT_RSS_ITEM_COUNT,
  fontFamily: DEFAULT_RSS_FONT_FAMILY,
  fontSize: DEFAULT_RSS_FONT_SIZE,
  updateIntervalMinutes: DEFAULT_RSS_UPDATE_INTERVAL_MINUTES,
});
const error = ref<string | null>(null);

// Props の widgetData が変更されたら、editableSettings を更新
watch(() => props.widgetData, (newData) => {
  if (newData) {
    editableSettings.feedUrl = newData.feedUrl;
    editableSettings.itemCount = newData.itemCount || DEFAULT_RSS_ITEM_COUNT,
    editableSettings.fontFamily = newData.fontFamily || DEFAULT_RSS_FONT_FAMILY;
    editableSettings.fontSize = newData.fontSize || DEFAULT_RSS_FONT_SIZE;
    editableSettings.updateIntervalMinutes = newData.updateIntervalMinutes || DEFAULT_RSS_UPDATE_INTERVAL_MINUTES;
    error.value = null; // エラーリセット
  }
}, { immediate: true }); // 初期表示時も実行

// バリデーション関数 (例)
const validateSettings = (): boolean => {
  error.value = null;
  if (!editableSettings.feedUrl || (!editableSettings.feedUrl.startsWith('http://') && !editableSettings.feedUrl.startsWith('https://'))) {
    error.value = 'Please enter a valid URL.'; return false;
  }
  if (typeof editableSettings.itemCount !== 'number' || editableSettings.itemCount < 1) {
    error.value = t('rssSettings.invalidItemCount'); return false;
  }
  const fontSize = editableSettings.fontSize;
  if (typeof fontSize !== 'number' || !Number.isInteger(fontSize) || fontSize < 8 || fontSize > 72) {
      error.value = t('common.errorFontSize'); return false;
  }
  const interval = editableSettings.updateIntervalMinutes;
  if (interval !== null && (typeof interval !== 'number' || interval < 5)) {
      error.value = 'Invalid update interval selected.'; return false;
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
interface RssWidget {
  id: string;
  paneId?: string; // 親から渡す際に付与する必要あり
  type: 'rss';
  feedUrl: string;
  itemCount: number;
  feedTitle?: string;
  fontFamily?: string;
  fontSize?: number;
  updateIntervalMinutes?: number;
}
</script>
  
<style scoped>
.settings-form { } /* 必要なら */
.form-group { margin-bottom: 15px; }
.form-group label { display: block; margin-bottom: 5px; font-weight: bold; }
.form-group input[type="url"],
.form-group input[type="number"],
.form-group select {
  width: 100%; padding: 10px; border: 1px solid #ccc;
  border-radius: 4px; box-sizing: border-box;
}
.error-message { color: #dc3545; margin-top: 10px; font-size: 0.9em; }
.loading-message { color: #666; text-align: center; }
</style>