import { defineNuxtConfig } from 'nuxt/config';

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: process.env.NODE_ENV !== 'production' },
  css: ['splitpanes/dist/splitpanes.css', '~/assets/css/main.css'],
  modules: ['@nuxtjs/i18n'],
  runtimeConfig: {},

  routeRules: {
    '/**': {
      headers: {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
        // CSP: Report-Only で段階導入。違反はブラウザコンソールに報告されるがブロックされない。
        // 十分な観察期間を経た後、Content-Security-Policy に切り替えて本適用する。
        // ※ script-src/style-src の 'unsafe-inline' は Nuxt の hydration/スタイル注入に必要。
        // ※ frame-src は CalendarWidget (Google Calendar iframe) のために許可。
        'Content-Security-Policy-Report-Only':
          "default-src 'self'; " +
          "script-src 'self' 'unsafe-inline'; " +
          "style-src 'self' 'unsafe-inline'; " +
          "img-src 'self' data: https:; " +
          "font-src 'self' data:; " +
          "connect-src 'self'; " +
          "frame-src https://calendar.google.com https://www.google.com/calendar; " +
          "object-src 'none'; " +
          "base-uri 'self'; " +
          "form-action 'self';",
      },
    },
  },

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
    strategy: 'no_prefix', // 全言語でURLプレフィックスなし
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_redirected',
      redirectOn: 'root',
      alwaysRedirect: false,
    },
  },
});
