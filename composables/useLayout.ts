// composables/useLayout.ts
// レイアウトデータの state 管理、ロード/保存を担当する。
// ウィジェットのCRUD操作は useWidgetMutations に分離済み。

import { ref } from 'vue';
import type { PaneData } from '~/types';
import { useDebounce } from './useDebounce';

// デフォルトの初期データ
const defaultPanesData: PaneData[] = [
  { id: 'pane-1', size: 33.3, widgets: [] },
  { id: 'pane-2', size: 33.4, widgets: [] },
  { id: 'pane-3', size: 33.3, widgets: [] },
];

export function useLayout() {
  // --- State ---
  const panesData = ref<PaneData[]>([]);
  const isLoading = ref(true);
  const isSaving = ref(false);
  const saveError = ref<string | null>(null);
  const splitpanesKey = ref(0);

  // --- レイアウト保存 (Debounce 1500ms) ---
  const saveLayoutDebounced = useDebounce(async () => {
    if (isLoading.value || panesData.value.length === 0) {
      return;
    }

    // 保存前にサイズ合計が100%に近いか確認・調整
    const totalSize = panesData.value.reduce((sum, pane) => sum + pane.size, 0);
    if (Math.abs(totalSize - 100) > 0.1) {
      const factor = 100 / totalSize;
      panesData.value.forEach((pane) => {
        pane.size = pane.size * factor;
      });
    }

    isSaving.value = true;
    saveError.value = null;

    try {
      await $fetch('/api/layout', {
        method: 'POST',
        body: panesData.value,
      });
    } catch (err: any) {
      console.error('>>> [ERROR] [Client] Failed to save layout via API:', err);
      saveError.value =
        err.data?.message || err.message || 'Failed to save layout.';
    } finally {
      isSaving.value = false;
    }
  }, 1500);

  // --- APIからレイアウトデータをロード ---
  async function loadLayout() {
    isLoading.value = true;

    try {
      const loadedPanesRaw = await $fetch<PaneData[]>('/api/layout');

      let panesToApply: PaneData[];

      if (
        loadedPanesRaw &&
        Array.isArray(loadedPanesRaw) &&
        loadedPanesRaw.length > 0
      ) {
        const isValidStructure = loadedPanesRaw.every(
          (p) =>
            p &&
            typeof p.id === 'string' &&
            typeof p.size === 'number' &&
            Array.isArray(p.widgets),
        );
        if (isValidStructure) {
          panesToApply = JSON.parse(JSON.stringify(loadedPanesRaw));

          // 正規化処理
          const totalSize = panesToApply.reduce(
            (sum, pane) => sum + (pane.size || 0),
            0,
          );
          if (totalSize > 0 && Math.abs(totalSize - 100) > 0.1) {
            const factor = 100 / totalSize;
            panesToApply.forEach((pane) => {
              if (typeof pane.size === 'number') pane.size = pane.size * factor;
            });
          }
        } else {
          panesToApply = JSON.parse(JSON.stringify(defaultPanesData));
        }
      } else {
        panesToApply = JSON.parse(JSON.stringify(defaultPanesData));
      }
      panesData.value = panesToApply;
      splitpanesKey.value++;
    } catch {
      panesData.value = JSON.parse(JSON.stringify(defaultPanesData));
    } finally {
      isLoading.value = false;
    }
  }

  return {
    panesData,
    isLoading,
    isSaving,
    saveError,
    splitpanesKey,
    loadLayout,
    saveLayoutDebounced,
  };
}
