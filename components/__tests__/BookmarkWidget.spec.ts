import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import BookmarkWidget from '../BookmarkWidget.vue';
import type { BookmarkItem } from '~/types';

const draggableStub = {
  props: ['modelValue'],
  template: `
    <div class="bookmark-list-stub">
      <div v-for="element in modelValue" :key="element.id">
        <slot name="item" :element="element" />
      </div>
    </div>
  `,
};

const bookmarkItemModalStub = {
  props: ['show'],
  template: '<div v-if="show" class="bookmark-item-modal-stub" />',
};

const sampleBookmarks: BookmarkItem[] = [
  { id: 'bm-1', title: 'GitHub', url: 'https://github.com' },
  { id: 'bm-2', title: 'Google', url: 'https://google.com' },
];

const mountWidget = (overrides: Record<string, unknown> = {}) =>
  mount(BookmarkWidget, {
    props: {
      id: 'bookmark-widget-1',
      bookmarks: [],
      fontFamily: null,
      fontSize: null,
      ...overrides,
    },
    global: {
      mocks: {
        $t: (key: string) => key,
      },
      stubs: {
        draggable: draggableStub,
        BookmarkItemModal: bookmarkItemModalStub,
      },
    },
  });

describe('BookmarkWidget.vue', () => {
  it('opens the bookmark item modal from the add button', async () => {
    const wrapper = mountWidget();

    expect(wrapper.find('.bookmark-item-modal-stub').exists()).toBe(false);
    await wrapper.find('.bookmark-add-btn').trigger('click');

    expect(wrapper.find('.bookmark-item-modal-stub').exists()).toBe(true);
  });

  it('does not render external URL D&D registration UI', () => {
    const wrapper = mountWidget();

    expect(wrapper.find('.dnd-zone').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('D&D debug');
  });

  // --- 削除確認 ---
  it('shows confirmation overlay when delete button is clicked', async () => {
    const wrapper = mountWidget({ bookmarks: sampleBookmarks });

    // 確認オーバーレイは最初は表示されない
    expect(wrapper.find('.bookmark-delete-confirm').exists()).toBe(false);

    // × ボタンをクリック
    await wrapper.find('.bookmark-delete-btn').trigger('click');

    // 確認UIが表示される
    expect(wrapper.find('.bookmark-delete-confirm').exists()).toBe(true);
    expect(wrapper.text()).toContain('bookmarkWidget.confirmDelete');
  });

  it('cancels delete when no button is clicked', async () => {
    const wrapper = mountWidget({ bookmarks: sampleBookmarks });

    await wrapper.find('.bookmark-delete-btn').trigger('click');
    expect(wrapper.find('.bookmark-delete-confirm').exists()).toBe(true);

    await wrapper.find('.bookmark-confirm-no').trigger('click');
    expect(wrapper.find('.bookmark-delete-confirm').exists()).toBe(false);
    // ブックマークは削除されない
    expect(wrapper.findAll('.bookmark-item')).toHaveLength(2);
  });

  it('deletes bookmark when yes button is clicked', async () => {
    const wrapper = mountWidget({ bookmarks: sampleBookmarks });

    await wrapper.find('.bookmark-delete-btn').trigger('click');
    await wrapper.find('.bookmark-confirm-yes').trigger('click');

    // ブックマークが1件削除される
    expect(wrapper.findAll('.bookmark-item')).toHaveLength(1);
  });

  // --- 追加ボタンの下部配置 ---
  it('places the add button after the bookmark list', () => {
    const wrapper = mountWidget({ bookmarks: sampleBookmarks });

    const items = wrapper.findAll('.bookmark-item');
    const addBtn = wrapper.find('.bookmark-add-btn');

    // DOM順序で追加ボタンがリストより後にある
    expect(addBtn.element.compareDocumentPosition(items[0].element)).toBe(
      Node.DOCUMENT_POSITION_PRECEDING,
    );
  });
});
