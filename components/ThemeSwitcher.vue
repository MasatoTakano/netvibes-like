<template>
    <button @click="toggleTheme" class="theme-switcher-button" :title="buttonTitle">
      <!-- 現在のテーマに応じてアイコンを切り替え -->
      <span v-if="theme === 'light'">☀️</span>
      <span v-else>🌙</span>
    </button>
  </template>
  
  <script setup lang="ts">
  import { computed } from 'vue'
  import { useTheme } from '~/composables/useTheme' // 作成した Composable をインポート
  import { useI18n } from 'vue-i18n' // i18n を使用
  
  const { theme, toggleTheme } = useTheme()
  const { t } = useI18n()
  
  // ボタンのツールチップテキストを動的に設定
  const buttonTitle = computed(() => {
    return theme.value === 'light'
      ? t('themeSwitcher.switchToDark') // 例: locales/xx.json に定義
      : t('themeSwitcher.switchToLight') // 例: locales/xx.json に定義
  })
  </script>
  
  <style scoped>
  .theme-switcher-button {
    background: none;
    border: none;
    padding: 5px 8px; /* クリックしやすいようにパディング */
    margin: 0; /* デフォルトのマージンをリセット */
    cursor: pointer;
    font-size: 1.3em; /* アイコンのサイズ調整 */
    line-height: 1; /* ボタン内の縦中央揃え */
    border-radius: 4px;
    transition: background-color 0.2s ease;
    color: inherit; /* 親要素(ヘッダー)の文字色を継承 */
    display: inline-flex; /* アイコンの中央揃えのため */
    align-items: center;
    justify-content: center;
    /* 必要に応じてヘッダー内の他の要素との垂直位置を調整 */
    vertical-align: middle;
  }
  
  /* ホバー時の背景色 (ライト/ダーク共通の薄い色) */
  .theme-switcher-button:hover {
    background-color: var(--theme-switcher-hover-bg, rgba(128, 128, 128, 0.1)); /* CSS変数かデフォルト値 */
  }
  
  /* アイコンのラッパー (絵文字の微妙な位置ずれ対策) */
  .theme-switcher-button span {
    display: inline-block;
    line-height: 1; /* 高さをフォントサイズに合わせる */
  }
  </style>