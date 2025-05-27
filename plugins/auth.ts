// plugins/auth.ts
import { H3Event } from 'h3'; // H3Event 型をインポート
import type { User } from '~/composables/useAuth'; // User 型を composables からインポート (パス注意)

export default defineNuxtPlugin(async (nuxtApp) => {
  const userState = useState<User | null>('user', () => null); // useState を直接取得・設定

  // サーバーサイドでのみ実行
  if (process.server) {
    // console.log('[Auth Plugin - Server] Running...');

    // ssrContext から H3Event を取得 (Nuxt のバージョンによってパスが異なる可能性あり)
    const event = nuxtApp.ssrContext?.event as H3Event | undefined;

    // リクエストヘッダーを準備
    let headers: HeadersInit | undefined = undefined;
    if (event) {
      // Node.js のリクエストオブジェクトから cookie ヘッダーを取得
      const cookieHeader = event.node.req.headers.cookie;
      if (cookieHeader) {
        headers = { cookie: cookieHeader }; // Cookie をヘッダーに設定
        // console.log('[Auth Plugin - Server] Forwarding cookie header to /api/user');
      } else {
        // console.log('[Auth Plugin - Server] No cookie header found in incoming request.');
      }
    } else {
      console.warn('[Auth Plugin - Server] Could not get event from ssrContext to forward cookie.');
    }

    try {
      // /api/user を直接呼び出し、取得した Cookie ヘッダーを渡す
      const data = await $fetch<{ user: User | null }>('/api/user', {
          headers: headers, // ★ Cookie を含むヘッダーを渡す
          // ignoreResponseError: true // 401エラーなどをキャッチするため (任意)
      });
      // 取得したユーザー情報で useState を直接更新
      userState.value = data.user;
      // console.log('[Auth Plugin - Server] User state set via plugin:', userState.value?.userId);
    } catch (error: any) {
      // 401 Unauthorized などのエラーは正常なケース（未ログイン）もある
      if (error.statusCode !== 401) {
         console.error('[Auth Plugin - Server] Failed to fetch user:', error);
      } else {
         // console.log('[Auth Plugin - Server] User is not authenticated (401).');
      }
      userState.value = null; // エラー時や未認証時は null
    }
  }

  // クライアントサイドでは、サーバーから送られてくるペイロードによって
  // userState が自動的に（またはハイドレーション時に）復元されるのを期待する。
});