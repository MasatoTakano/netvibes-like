// composables/usePaneResize.ts
// ペインリサイズ管理（splitpanes連動）

import { ref, watch, type Ref } from 'vue';
import type { PaneData } from '~/types';

export function usePaneResize(options: {
  panesData: Ref<PaneData[]>;
  isLoading: Ref<boolean>;
  saveLayoutDebounced: () => void;
}) {
  const { panesData, isLoading, saveLayoutDebounced } = options;

  const isSplitpanesReady = ref(false);
  const allowPaneResizeHandling = ref(false);

  // --- Watcher: ロード完了 + splitpanes準備完了後にresize処理を許可 ---
  watch([isLoading, isSplitpanesReady], ([loading, ready]) => {
    if (!loading && ready) {
      // 少し遅延させてから resized イベントの処理を許可する
      // これにより、初期化直後の自動発火をやり過ごす
      setTimeout(() => {
        allowPaneResizeHandling.value = true;
      }, 500);
    }
  });

  // --- Splitpanesの準備完了イベントハンドラ ---
  function handlePaneReady() {
    isSplitpanesReady.value = true;
  }

  // --- Splitpanesのリサイズイベントハンドラ ---
  function handlePaneResize(eventPayload: {
    panes: Array<{ min: number; max: number; size: number }>;
    [key: string]: any;
  }) {
    const resizedPanes = eventPayload.panes;

    if (!allowPaneResizeHandling.value) {
      return;
    }

    if (isLoading.value) {
      return;
    }

    if (
      resizedPanes &&
      Array.isArray(resizedPanes) &&
      resizedPanes.length === panesData.value.length
    ) {
      let sizesChanged = false;
      panesData.value.forEach((pane, index) => {
        const newSize = resizedPanes[index]?.size;
        if (newSize !== undefined && Math.abs(pane.size - newSize) > 0.01) {
          pane.size = newSize;
          sizesChanged = true;
        }
      });

      if (sizesChanged) {
        saveLayoutDebounced();
      }
    }
  }

  return {
    isSplitpanesReady,
    allowPaneResizeHandling,
    handlePaneReady,
    handlePaneResize,
  };
}
