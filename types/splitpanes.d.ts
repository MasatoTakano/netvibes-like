// types/splitpanes.d.ts
// splitpanes パッケージは型定義(.d.ts)を同梱しておらず、@types/splitpanes も存在しないため、
// コンポーネントを Vue の DefineComponent として最小限宣言する。
declare module 'splitpanes' {
  import type { DefineComponent } from 'vue';
  export const Splitpanes: DefineComponent<Record<string, unknown>>;
  export const Pane: DefineComponent<Record<string, unknown>>;
}
