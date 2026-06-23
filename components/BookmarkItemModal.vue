<!-- components/BookmarkItemModal.vue -->
<!-- ブックマークアイテムの追加・編集モーダル -->
<template>
  <BaseModal :show="show" title-id="bookmark-item-modal-title" @close="close">
    <template #title>
      {{ mode === 'add' ? $t('bookmarkItemModal.addTitle') : $t('bookmarkItemModal.editTitle') }}
    </template>

    <template #default>
      <div class="settings-form">
        <div class="form-group">
          <label for="bookmark-item-title">{{
            $t('bookmarkItemModal.titleLabel')
          }}</label>
          <input
            id="bookmark-item-title"
            ref="titleInputRef"
            v-model="formData.title"
            type="text"
            :placeholder="$t('bookmarkItemModal.titlePlaceholder')"
            @keydown.enter="save"
          />
        </div>

        <div class="form-group">
          <label for="bookmark-item-description">{{
            $t('bookmarkItemModal.descriptionLabel')
          }}</label>
          <textarea
            id="bookmark-item-description"
            v-model="formData.description"
            rows="2"
            :placeholder="$t('bookmarkItemModal.descriptionPlaceholder')"
          />
        </div>

        <div class="form-group">
          <label for="bookmark-item-url">{{
            $t('bookmarkItemModal.urlLabel')
          }}</label>
          <input
            id="bookmark-item-url"
            v-model="formData.url"
            type="url"
            :placeholder="$t('bookmarkItemModal.urlPlaceholder')"
            @keydown.enter="save"
          />
        </div>
        <p v-if="error" class="error-message">{{ error }}</p>
      </div>
    </template>

    <template #footer>
      <button class="button button-primary" :disabled="!isFormValid" @click="save">
        {{ mode === 'add' ? $t('bookmarkItemModal.addButton') : $t('bookmarkItemModal.saveButton') }}
      </button>
      <button class="button button-secondary" @click="close">
        {{ $t('common.cancel') }}
      </button>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
  import { ref, reactive, computed, watch, nextTick } from 'vue';
  import BaseModal from './BaseModal.vue';
  import type { BookmarkItem } from '~/types';

  const { t } = useI18n();

  // --- Props ---
  const props = withDefaults(
    defineProps<{
      show: boolean;
      mode?: 'add' | 'edit';
      /** 編集時に渡される既存アイテム */
      editItem?: BookmarkItem | null;
      /** 外部連携等で事前入力されるURL */
      prefillUrl?: string;
      /** 外部連携等で事前入力されるタイトル */
      prefillTitle?: string;
    }>(),
    {
      mode: 'add',
      editItem: null,
      prefillUrl: '',
      prefillTitle: '',
    },
  );

  // --- Emits ---
  const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'add', item: Omit<BookmarkItem, 'id'>): void;
    (e: 'update', item: BookmarkItem): void;
  }>();

  // --- 内部状態 ---
  const titleInputRef = ref<HTMLInputElement | null>(null);
  const error = ref<string | null>(null);

  const formData = reactive({
    title: '',
    description: '',
    url: '',
  });

  // --- Computed ---
  const isFormValid = computed(() => {
    return formData.url.trim().startsWith('http://') || formData.url.trim().startsWith('https://');
  });

  // --- Watch: モーダル表示時に初期値セット ---
  watch(
    () => props.show,
    (visible) => {
      if (visible) {
        error.value = null;
        if (props.mode === 'edit' && props.editItem) {
          formData.title = props.editItem.title;
          formData.description = props.editItem.description || '';
          formData.url = props.editItem.url;
        } else {
          // add モード
          formData.title = props.prefillTitle || '';
          formData.description = '';
          formData.url = props.prefillUrl || '';
        }
        // URL入力欄以外にフォーカス
        nextTick(() => {
          if (!formData.url) {
            titleInputRef.value?.focus();
          }
        });
      }
    },
  );

  // --- Methods ---
  const save = () => {
    const trimmedUrl = formData.url.trim();
    if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
      error.value = t('bookmarkWidget.errorInvalidUrl');
      return;
    }

    // タイトルが未入力ならドメイン名をデフォルト
    let title = formData.title.trim();
    if (!title) {
      try {
        title = new URL(trimmedUrl).hostname;
      } catch {
        title = trimmedUrl;
      }
    }

    if (props.mode === 'edit' && props.editItem) {
      emit('update', {
        id: props.editItem.id,
        title,
        description: formData.description.trim(),
        url: trimmedUrl,
      });
    } else {
      emit('add', {
        title,
        description: formData.description.trim(),
        url: trimmedUrl,
      });
    }
  };

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
  .form-group input[type='url'],
  .form-group textarea {
    width: 100%;
    padding: 10px;
    border: 1px solid #ccc;
    border-radius: 4px;
    box-sizing: border-box;
    font-family: inherit;
    font-size: inherit;
  }
  .form-group textarea {
    resize: vertical;
  }
  .error-message {
    color: #dc3545;
    margin-top: 10px;
    font-size: 0.9em;
  }
</style>
