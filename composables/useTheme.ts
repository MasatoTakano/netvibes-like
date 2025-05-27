// composables/useTheme.ts
import { useColorMode, type UseColorModeOptions } from '@vueuse/core'
import { computed } from 'vue' // computed をインポート

export const useTheme = () => {
  // useColorMode の設定
  const options: UseColorModeOptions = {
    selector: 'html',        // html タグを対象にする
    attribute: 'data-theme', // 'data-theme' 属性を付与 (例: <html data-theme="dark">)
    initialValue: 'light',   // デフォルトはライトモード
    modes: {                 // 利用可能なモード名 (値は何でも良いが、属性値と合わせるのが一般的)
      light: 'light',
      dark: 'dark',
    },
    storageKey: 'app-theme', // localStorage に保存するキー名
    storage: process.client ? localStorage : undefined, // クライアントサイドでのみ localStorage を使用
    // OSのテーマ設定を初期値にしたい場合は initialValue: 'auto' を使う
    // initialValue: 'auto'
  }

  // useColorMode を初期化
  const colorMode = useColorMode(options)

  // テーマを切り替える関数
  const toggleTheme = () => {
    // 現在のモードが 'dark' なら 'light' に、そうでなければ 'dark' に切り替え
    colorMode.value = colorMode.value === 'dark' ? 'light' : 'dark'
  }

  // 現在のテーマがダークモードかどうかを示す computed プロパティ (任意)
  const isDarkMode = computed(() => colorMode.value === 'dark')

  // useColorMode が状態 (colorMode.value) と DOM 操作、永続化を管理してくれる

  return {
    theme: colorMode, // 現在のテーマ ('light' または 'dark') を保持する ref
    toggleTheme,      // テーマを切り替える関数
    isDarkMode,       // ダークモードかどうか (boolean)
  }
}