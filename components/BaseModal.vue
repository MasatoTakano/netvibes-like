<!-- components/BaseModal.vue -->
<template>
  <!-- モーダルを body 直下にレンダリング -->
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="show" class="modal-overlay">
        <div
          class="modal-content"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
        >
          <!-- ヘッダー -->
          <header class="modal-header">
            <h2 :id="titleId" class="modal-title">
              <!-- タイトル用スロット -->
              <slot name="title">Default Title</slot>
            </h2>
            <button
              class="modal-close-button"
              aria-label="Close modal"
              @click="$emit('close')"
            >
              ×
            </button>
          </header>
          <section class="modal-body">
            <!-- メインコンテンツ用スロット -->
            <slot>Default body content</slot>
          </section>
          <!-- フッター -->
          <footer class="modal-footer">
            <slot name="footer">
              <!-- フッター用スロット -->
            </slot>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
  import { watch, onUnmounted } from 'vue';

  const props = defineProps({
    show: {
      type: Boolean,
      required: true,
    },
    // アクセシビリティのためのタイトルID (任意)
    titleId: {
      type: String,
      default: 'modal-title',
    },
  });

  const emit = defineEmits(['close']);

  // モーダル表示時にEscキーで閉じるイベントリスナーを追加
  const handleEscape = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && props.show) {
      emit('close');
    }
  };

  watch(
    () => props.show,
    (newShow) => {
      if (typeof document !== 'undefined') {
        if (newShow) {
          document.body.style.overflow = 'hidden'; // 背景スクロール禁止
          document.addEventListener('keydown', handleEscape);
        } else {
          document.body.style.overflow = ''; // 背景スクロール許可
          document.removeEventListener('keydown', handleEscape);
        }
      }
    },
  );

  // コンポーネント破棄時にもリスナー解除
  onUnmounted(() => {
    if (typeof document !== 'undefined') {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleEscape);
    }
  });
</script>

<style scoped>
  /* --- BaseModal の基本スタイル --- */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.6);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  }

  .modal-content {
    background-color: white;
    padding: 0;
    border-radius: 8px;
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
    min-width: 450px;
    max-width: 90%;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px 20px;
    border-bottom: 1px solid #eee;
  }

  .modal-title {
    margin: 0;
    font-size: 1.4em;
  }

  .modal-close-button {
    background: none;
    border: none;
    font-size: 1.8em;
    line-height: 1;
    cursor: pointer;
    color: #aaa;
    padding: 0 5px;
  }
  .modal-close-button:hover {
    color: #333;
  }

  .modal-body {
    padding: 20px 25px;
    overflow-y: auto;
    flex-grow: 1;
  }

  .modal-footer {
    padding: 15px 20px;
    border-top: 1px solid #eee;
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }

  /* --- Animation --- */
  .modal-fade-enter-active,
  .modal-fade-leave-active {
    transition: opacity 0.3s ease;
  }
  .modal-fade-enter-from,
  .modal-fade-leave-to {
    opacity: 0;
  }
  .modal-fade-enter-active .modal-content,
  .modal-fade-leave-active .modal-content {
    transition: transform 0.3s ease;
  }
  .modal-fade-enter-from .modal-content,
  .modal-fade-leave-to .modal-content {
    transform: scale(0.95);
  }
</style>
