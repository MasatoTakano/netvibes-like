// composables/useGlobalSettings.ts
// グローバル設定（フォント）の管理とCSS変数への反映

import { reactive, computed, watchEffect } from 'vue';
import type { GlobalSettings } from '~/types';
import { DEFAULT_GLOBAL_SETTINGS } from '~/constants';
import { useDebounce } from './useDebounce';

export function useGlobalSettings() {
  const globalSettings = reactive<GlobalSettings>({
    fontFamily: DEFAULT_GLOBAL_SETTINGS.fontFamily,
    fontSize: DEFAULT_GLOBAL_SETTINGS.fontSize,
  });

  // --- Computed: CSS変数バインディング用 ---
  const globalStyles = computed(() => ({
    '--global-font-family': globalSettings.fontFamily,
    '--global-font-size': `${globalSettings.fontSize}px`,
  }));

  // --- Watcher: globalSettings の変更を :root の CSS 変数に直接反映 ---
  watchEffect(() => {
    if (process.client) {
      const rootStyle = document.documentElement.style;
      rootStyle.setProperty(
        '--widget-content-font-family',
        globalSettings.fontFamily,
      );
      rootStyle.setProperty(
        '--widget-content-font-size',
        `${globalSettings.fontSize}px`,
      );
    }
  });

  // --- APIからグローバル設定をロード ---
  async function loadGlobalSettings() {
    try {
      const savedSettings = await $fetch<GlobalSettings>('/api/settings');
      if (savedSettings) Object.assign(globalSettings, savedSettings);
      console.log('>>> [onMounted] Global settings loaded.');
    } catch (err) {
      console.error(
        '>>> [ERROR] [onMounted] Failed to load global settings:',
        err,
      );
    }
  }

  // --- 全体設定保存 (Debounce 500ms) ---
  const saveGlobalSettingsDebounced = useDebounce(async () => {
    try {
      await $fetch('/api/settings', {
        method: 'POST',
        body: globalSettings,
      });
    } catch (err: any) {
      console.error(
        '>>> [ERROR] [Client] Failed to save global settings via API:',
        err,
      );
    }
  }, 500);

  return {
    globalSettings,
    globalStyles,
    loadGlobalSettings,
    saveGlobalSettingsDebounced,
  };
}
