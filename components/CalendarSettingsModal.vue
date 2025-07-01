<!-- components/CalendarSettingsModal.vue -->
<template>
  <BaseModal :show="show" @close="close" title-id="calendar-settings-title">
    <template #title>{{ $t('calendarSettings.title') }}</template>

    <template #default>
      <div v-if="widgetData" class="settings-form">
        <div class="form-group">
          <label :for="'calendar-iframe-' + widgetData.id">{{ $t('calendarSettings.iframeTag') }}</label>
          <textarea
            :id="'calendar-iframe-' + widgetData.id"
            v-model="editableSettings.iframeTag"
            rows="8"
            :placeholder="t('calendarSettings.iframePlaceholder')"
          ></textarea>
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
import BaseModal from './BaseModal.vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

// --- Props ---
const props = defineProps({
  show: { type: Boolean, required: true },
  widgetData: { type: Object as PropType<CalendarWidget | null>, default: null },
});

// --- Emits ---
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'save', settings: { widgetId: string; paneId: string; settings: { iframeTag: string } }): void;
}>();

// --- State ---
const editableSettings = reactive({
  iframeTag: '',
});
const error = ref<string | null>(null);

// --- Watcher ---
watch(() => props.widgetData, (newData) => {
  if (newData) {
    editableSettings.iframeTag = newData.iframeTag || '';
    error.value = null;
  }
}, { immediate: true });

// --- Methods ---
const validateSettings = (): boolean => {
  error.value = null;
  if (!editableSettings.iframeTag.includes('<iframe')) {
    error.value = t('calendarSettings.invalidIframe');
    return false;
  }
  return true;
};

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

const close = () => {
  emit('close');
};

// --- Type Definition ---
interface CalendarWidget {
  id: string;
  paneId: string;
  type: 'calendar';
  iframeTag: string;
}
</script>

<style scoped>
.settings-form { }
.form-group { margin-bottom: 15px; }
.form-group label { display: block; margin-bottom: 5px; font-weight: bold; }
.form-group textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-sizing: border-box;
  resize: vertical;
}
.error-message { color: #dc3545; margin-top: 10px; font-size: 0.9em; }
.loading-message { color: #666; text-align: center; }
</style>
