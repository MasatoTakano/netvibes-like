<!-- components/ConfirmDeleteModal.vue -->
<template>
  <BaseModal :show="show" title-id="confirm-delete-title" @close="cancel">
    <template #title>
      {{ $t('confirmDelete.title') }}
    </template>

    <template #default>
      <p>
        {{ $t('confirmDelete.message', { itemDescription: itemDescription }) }}
      </p>
      <p>{{ $t('confirmDelete.cannotUndo') }}</p>
    </template>

    <template #footer>
      <!-- 削除ボタン -->
      <button class="button button-danger" @click="confirm">
        {{ $t('confirmDelete.delete') }}
      </button>
      <button class="button button-secondary" @click="cancel">
        {{ $t('common.cancel') }}
      </button>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
  import BaseModal from './BaseModal.vue';

  // Props
  const props = defineProps({
    show: { type: Boolean, required: true },
    itemDescription: { type: String, default: 'widget' }, // 削除対象の説明
  });

  // Emits
  const emit = defineEmits(['close', 'confirm']);

  // 確認
  const confirm = () => {
    emit('confirm');
  };

  // キャンセル
  const cancel = () => {
    emit('close');
  };
</script>

<style scoped>
  p {
    margin-top: 0;
    margin-bottom: 10px;
  }
</style>
