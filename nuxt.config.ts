import { defineNuxtConfig } from 'nuxt/config';

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },
  css: ['splitpanes/dist/splitpanes.css', '~/assets/css/main.css'],
  modules: ['@nuxtjs/i18n'],
  runtimeConfig: {},

  i18n: {
    locales: [
      {
        code: 'en-US',
        iso: 'en-US',
        name: 'English',
        file: 'en-US.json',
      },
      {
        code: 'ja-JP',
        iso: 'ja-JP',
        name: '日本語',
        file: 'ja-JP.json',
      },
    ],
    lazy: true,
    defaultLocale: 'ja-JP',
    strategy: 'no_prefix', // URL戦略: デフォルト言語はプレフィックスなし ('/'), 他は '/en', '/fr' など
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_redirected',
      redirectOn: 'root',
      alwaysRedirect: false,
    },
  },
});
