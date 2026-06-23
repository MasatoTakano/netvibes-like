<!-- components/BookmarkWidget.vue -->
<template>
  <div class="bookmark-widget-content" :style="widgetStyle">
    <!-- ブックマークリスト -->
    <div v-if="localBookmarks.length > 0" class="bookmark-list-wrapper">
      <draggable
        v-model="localBookmarks"
        item-key="id"
        tag="div"
        class="bookmark-list"
        :style="{ '--bookmark-columns': effectiveColumns }"
        handle=".bookmark-drag-handle"
        @change="emitUpdate"
      >
        <template #item="{ element }">
          <div
            class="bookmark-item"
            @mouseenter="showBalloon($event, element)"
            @mouseleave="hideBalloon"
          >
            <span class="bookmark-drag-handle" title="Drag to reorder">⠿</span>
            <img
              :src="getFaviconUrl(element.url)"
              alt=""
              class="bookmark-favicon"
              loading="lazy"
              @error="handleFaviconError"
            />
            <div class="bookmark-text">
              <a
                :href="element.url"
                target="_blank"
                rel="noopener noreferrer"
                class="bookmark-link"
                :title="element.url"
              >
                {{ element.title || element.url }}
              </a>
              <p v-if="element.description" class="bookmark-description">
                {{ element.description }}
              </p>
            </div>
            <!-- 削除確認インライン -->
            <div
              v-if="pendingDeleteId === element.id"
              class="bookmark-delete-confirm"
            >
              <button
                class="bookmark-confirm-btn bookmark-confirm-yes"
                @click.stop="confirmDelete"
              >
                {{ $t('bookmarkWidget.confirmDeleteYes') }}
              </button>
              <button
                class="bookmark-confirm-btn bookmark-confirm-no"
                @click.stop="cancelDelete"
              >
                {{ $t('bookmarkWidget.confirmDeleteNo') }}
              </button>
            </div>
            <template v-else>
              <span
                class="bookmark-action-btn bookmark-edit-btn"
                :title="$t('widget.settings')"
                @click.stop="openEditModal(element)"
              >
                ✏️
              </span>
              <span
                class="bookmark-action-btn bookmark-delete-btn"
                :title="$t('widget.remove')"
                @click.stop="requestDelete(element.id)"
              >
                ×
              </span>
            </template>
          </div>
        </template>
      </draggable>
    </div>
    <div v-else class="bookmark-empty">
      {{ $t('bookmarkWidget.empty') }}
    </div>

    <!-- 追加ボタン（下部固定） -->
    <div class="bookmark-toolbar">
      <button class="bookmark-add-btn" @click="openAddModal">
        ＋ {{ $t('bookmarkWidget.addButton') }}
      </button>
    </div>

    <!-- ホバーバルーン（Teleport で overflow クリップを回避） -->
    <Teleport to="body">
      <div
        v-if="balloon.visible && balloon.item"
        class="bookmark-balloon"
        :style="balloonStyle"
      >
        <strong>{{ balloon.item.title || balloon.item.url }}</strong>
        <p v-if="balloon.item.description">{{ balloon.item.description }}</p>
        <span class="bookmark-balloon-url">{{ balloon.item.url }}</span>
      </div>
    </Teleport>

    <!-- 追加・編集モーダル -->
    <BookmarkItemModal
      :show="showItemModal"
      :mode="modalMode"
      :edit-item="editingItem"
      :prefill-url="prefillUrl"
      :prefill-title="prefillTitle"
      @close="closeItemModal"
      @add="handleModalAdd"
      @update="handleModalUpdate"
    />
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive, computed, watch } from 'vue';
  import draggable from 'vuedraggable';
  import BookmarkItemModal from './BookmarkItemModal.vue';
  import { DEFAULT_BOOKMARK_COLUMNS, MAX_BOOKMARK_COLUMNS } from '~/constants';
  import type { BookmarkItem } from '~/types';

  // --- Props ---
  const props = withDefaults(
    defineProps<{
      id: string;
      bookmarks: BookmarkItem[];
      fontFamily?: string | null;
      fontSize?: number | null;
      columns?: number | null;
    }>(),
    {
      fontFamily: null,
      fontSize: null,
      columns: null,
    },
  );

  // --- Emits ---
  const emit = defineEmits<{
    (e: 'update:bookmarks', bookmarks: BookmarkItem[]): void;
  }>();

  // --- State ---
  const localBookmarks = ref<BookmarkItem[]>([...(props.bookmarks || [])]);

  watch(
    () => props.bookmarks,
    (newBookmarks) => {
      const currentJson = JSON.stringify(localBookmarks.value);
      const newJson = JSON.stringify(newBookmarks || []);
      if (currentJson !== newJson) {
        localBookmarks.value = [...(newBookmarks || [])];
      }
    },
  );

  // モーダル状態
  const showItemModal = ref(false);
  const modalMode = ref<'add' | 'edit'>('add');
  const editingItem = ref<BookmarkItem | null>(null);
  const prefillUrl = ref('');
  const prefillTitle = ref('');

  // 削除確認状態
  const pendingDeleteId = ref<string | null>(null);

  // --- バルーン状態 ---
  const balloon = reactive({
    visible: false,
    item: null as BookmarkItem | null,
    top: 0,
    left: 0,
  });

  const showBalloon = (event: MouseEvent, item: BookmarkItem) => {
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    balloon.item = item;
    balloon.top = rect.top;
    balloon.left = rect.left;
    balloon.visible = true;
  };

  const hideBalloon = () => {
    balloon.visible = false;
    balloon.item = null;
  };

  const balloonStyle = computed(() => ({
    top: `${balloon.top}px`,
    left: `${balloon.left}px`,
    transform: 'translateY(-100%) translateY(-8px)',
  }));

  // --- Computed ---
  const effectiveColumns = computed(() => {
    const c = props.columns;
    if (c && c >= 1 && c <= MAX_BOOKMARK_COLUMNS) {
      return c;
    }
    return DEFAULT_BOOKMARK_COLUMNS;
  });

  const widgetStyle = computed(() => {
    const style: Record<string, string> = {};
    if (props.fontFamily) {
      style.fontFamily = props.fontFamily;
    }
    if (props.fontSize) {
      style.fontSize = `${props.fontSize}px`;
    }
    return style;
  });

  // --- Methods ---

  const getFaviconUrl = (url: string): string => {
    try {
      const urlObj = new URL(url);
      return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`;
    } catch {
      return '';
    }
  };

  const handleFaviconError = (event: Event) => {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
  };

  // --- モーダル操作 ---

  const openAddModal = () => {
    modalMode.value = 'add';
    editingItem.value = null;
    prefillUrl.value = '';
    prefillTitle.value = '';
    showItemModal.value = true;
  };

  const openEditModal = (item: BookmarkItem) => {
    modalMode.value = 'edit';
    editingItem.value = { ...item };
    showItemModal.value = true;
  };

  const closeItemModal = () => {
    showItemModal.value = false;
    editingItem.value = null;
    prefillUrl.value = '';
    prefillTitle.value = '';
  };

  const handleModalAdd = (newItem: Omit<BookmarkItem, 'id'>) => {
    localBookmarks.value.push({
      id: crypto.randomUUID(),
      ...newItem,
    });
    emitUpdate();
    closeItemModal();
  };

  const handleModalUpdate = (updatedItem: BookmarkItem) => {
    const index = localBookmarks.value.findIndex(
      (item) => item.id === updatedItem.id,
    );
    if (index !== -1) {
      localBookmarks.value[index] = updatedItem;
      emitUpdate();
    }
    closeItemModal();
  };

  // --- 削除（インライン確認付き） ---

  const requestDelete = (itemId: string) => {
    pendingDeleteId.value = itemId;
  };

  const cancelDelete = () => {
    pendingDeleteId.value = null;
  };

  const confirmDelete = () => {
    if (pendingDeleteId.value) {
      localBookmarks.value = localBookmarks.value.filter(
        (item) => item.id !== pendingDeleteId.value,
      );
      pendingDeleteId.value = null;
      emitUpdate();
    }
  };

  // --- 親へ更新通知 ---
  const emitUpdate = () => {
    emit('update:bookmarks', [...localBookmarks.value]);
  };
</script>

<style scoped>
  .bookmark-widget-content {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 4px 4px;
    box-sizing: border-box;
  }

  /* --- ブックマークリスト --- */
  .bookmark-list-wrapper {
    flex-grow: 1;
    overflow-y: auto;
    min-height: 20px;
  }

  .bookmark-list {
    display: grid;
    grid-template-columns: repeat(var(--bookmark-columns, 1), 1fr);
    gap: 0;
  }

  .bookmark-item {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    padding: 1px 4px;
    border-radius: 3px;
    transition: background-color 0.15s ease;
    background-color: transparent;
    position: relative;
  }

  .bookmark-item:hover {
    background-color: var(--theme-switcher-hover-bg, rgba(128, 128, 128, 0.1));
  }

  /* --- ドラッグハンドル --- */
  .bookmark-drag-handle {
    cursor: grab;
    color: var(--empty-pane-text-color, #999);
    font-size: 1.1em;
    flex-shrink: 0;
    user-select: none;
    line-height: 1.6;
    padding-top: 1px;
  }

  .bookmark-drag-handle:active {
    cursor: grabbing;
  }

  .bookmark-favicon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    border-radius: 2px;
    margin-top: 2px;
  }

  .bookmark-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .bookmark-link {
    color: var(--widget-text-color, #333);
    text-decoration: none;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    line-height: 1.4;
  }

  .bookmark-link:hover {
    color: var(--link-color, #007bff);
    text-decoration: underline;
  }

  .bookmark-description {
    margin: 0;
    font-size: 0.85em;
    color: var(--empty-pane-text-color, #888);
    line-height: 1.3;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  /* --- アクションボタン --- */
  .bookmark-action-btn {
    cursor: pointer;
    font-size: 1em;
    line-height: 1;
    padding: 2px 3px;
    flex-shrink: 0;
    opacity: 0;
    transition: opacity 0.15s ease;
    margin-top: 1px;
  }

  .bookmark-item:hover .bookmark-action-btn {
    opacity: 1;
  }

  .bookmark-delete-btn {
    color: var(--empty-pane-text-color, #999);
    font-size: 1.2em;
  }

  .bookmark-delete-btn:hover {
    color: #dc3545;
  }

  /* --- 削除確認インライン --- */
  .bookmark-delete-confirm {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  .bookmark-confirm-btn {
    padding: 2px 8px;
    font-size: 0.85em;
    white-space: nowrap;
    border-radius: 3px;
    cursor: pointer;
    border: 1px solid transparent;
    font-family: inherit;
  }

  .bookmark-confirm-yes {
    background-color: #dc3545;
    color: #fff;
    border-color: #dc3545;
  }

  .bookmark-confirm-yes:hover {
    background-color: #c82333;
  }

  .bookmark-confirm-no {
    background-color: #6c757d;
    color: #fff;
    border-color: #6c757d;
  }

  .bookmark-confirm-no:hover {
    background-color: #5a6268;
  }

  /* --- ツールバー（下部） --- */
  .bookmark-toolbar {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    margin-top: 6px;
    padding-top: 4px;
    border-top: 1px solid var(--theme-switcher-border, rgba(128, 128, 128, 0.15));
    flex-shrink: 0;
  }

  .bookmark-add-btn {
    padding: 4px 16px;
    font-size: inherit;
    font-family: inherit;
    white-space: nowrap;
    flex-shrink: 0;
    background-color: var(--button-primary-bg, #007bff);
    color: var(--button-primary-text, #fff);
    border: 1px solid var(--button-primary-border, #007bff);
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.2s ease;
  }

  .bookmark-add-btn:hover {
    background-color: var(--button-primary-hover-bg, #0056b3);
  }

  /* --- 空状態 --- */
  .bookmark-empty {
    flex-grow: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    color: var(--empty-pane-text-color, #999);
    padding: 20px 8px;
    font-size: 0.9em;
    font-style: italic;
  }
</style>

<!-- バルーンは Teleport to body なので scoped 外に記述 -->
<style>
  .bookmark-balloon {
    position: fixed;
    background-color: #333;
    color: #fff;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 0.85em;
    line-height: 1.4;
    z-index: 10000;
    pointer-events: none;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    max-width: 280px;
    white-space: normal;
  }

  .bookmark-balloon strong {
    display: block;
    margin-bottom: 2px;
  }

  .bookmark-balloon p {
    margin: 0 0 4px;
    font-size: 0.95em;
    opacity: 0.85;
  }

  .bookmark-balloon .bookmark-balloon-url {
    display: block;
    font-size: 0.9em;
    color: #8ab4f8;
    word-break: break-all;
  }
</style>
