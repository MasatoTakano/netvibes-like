// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },
  css: [
    'splitpanes/dist/splitpanes.css',
    '~/assets/css/main.css',
  ],
  modules: [
    '@nuxtjs/i18n',
  ],
  runtimeConfig: {
  },

  i18n: {
    locales: [
      {
        code: 'en', // 言語コード (URLパスや識別子として使われる)
        iso: 'en-US', // ISO言語コード (SEOなどに利用)
        name: 'English', // 表示名（言語スイッチャーなどで使う）
        file: 'en-US.json' // 翻訳ファイル名 (後で作成)
      },
      {
        code: 'ja',
        iso: 'ja-JP',
        name: '日本語',
        file: 'ja-JP.json'
      }
    ],
    lazy: true, // 翻訳ファイルを遅延読み込みする (推奨)
    langDir: 'locales', // 翻訳ファイルを置くディレクトリ (後で作成)
    defaultLocale: 'ja', // デフォルトの言語
    strategy: 'prefix_except_default', // URL戦略: デフォルト言語はプレフィックスなし ('/'), 他は '/en', '/fr' など
    detectBrowserLanguage: { // ブラウザの言語設定を検出してリダイレクトするか
      useCookie: true,          // 選択した言語をクッキーに保存するか
      cookieKey: 'i18n_redirected', // クッキー名
      redirectOn: 'root',      // ルートパス ('/') にアクセスした時だけリダイレクト
      alwaysRedirect: false,    // 常にリダイレクトするかどうか
    },
  }
})
