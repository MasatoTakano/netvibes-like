import { mount } from '@vue/test-utils';
import { describe, it, expect, vi } from 'vitest';
import ThemeSwitcher from '../ThemeSwitcher.vue';
import { ref } from 'vue';

// useTheme composable のモック
const mockToggleTheme = vi.fn();
vi.mock('~/composables/useTheme', () => ({
  useTheme: () => ({
    theme: ref('light'), // refでリアクティブな値にする
    toggleTheme: mockToggleTheme,
  }),
}));

// useI18n のモック
const mockT = vi.fn((key) => key);
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: mockT,
  }),
}));

describe('ThemeSwitcher.vue', () => {
  it('renders the sun icon when the theme is light', () => {
    const wrapper = mount(ThemeSwitcher);
    expect(wrapper.text()).toContain('☀️');
  });

  it('calls toggleTheme when the button is clicked', async () => {
    const wrapper = mount(ThemeSwitcher);
    await wrapper.find('button').trigger('click');
    expect(mockToggleTheme).toHaveBeenCalled(); // モック関数を直接検証
  });
});
