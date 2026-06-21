// plugins/auth.ts
import { H3Event } from 'h3';
import type { User } from '~/composables/useAuth';

export default defineNuxtPlugin(async (nuxtApp) => {
  const userState = useState<User | null>('user', () => null);

  // サーバーサイドでのみ実行
  if (process.server) {
    const event = nuxtApp.ssrContext?.event as H3Event | undefined;

    // リクエストヘッダーを準備
    let headers: HeadersInit | undefined = undefined;
    if (event) {
      const cookieHeader = event.node.req.headers.cookie;
      if (cookieHeader) {
        headers = { cookie: cookieHeader };
      }
    } else {
      console.warn(
        '[Auth Plugin - Server] Could not get event from ssrContext to forward cookie.',
      );
    }

    try {
      // /api/user を直接呼び出し、取得した Cookie ヘッダーを渡す
      const data = await $fetch<{ user: User | null }>('/api/user', {
        headers: headers,
      });
      userState.value = data.user;
    } catch (error: any) {
      // 401 Unauthorized などのエラーは正常なケース（未ログイン）もある
      if (error.statusCode !== 401) {
        console.error('[Auth Plugin - Server] Failed to fetch user:', error);
      }
      userState.value = null;
    }
  }

  // クライアントサイドでは、サーバーから送られてくるペイロードによって
  // userState が自動的に（またはハイドレーション時に）復元されるのを期待する。
});
