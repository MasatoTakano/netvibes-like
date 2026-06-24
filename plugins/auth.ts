// plugins/auth.ts
// SSR時にBetter Authセッションを検証し、ユーザー状態を初期化する。
import type { H3Event } from 'h3';
import type { User } from '~/composables/useAuth';

export default defineNuxtPlugin(async (nuxtApp) => {
  const userState = useState<User | null>('user', () => null);

  if (process.server) {
    const event = nuxtApp.ssrContext?.event as H3Event | undefined;
    if (event) {
      try {
        const { auth } = await import('~/server/utils/auth');
        const session = await auth.api.getSession({
          headers: event.node.req.headers as any,
        });
        if (session) {
          userState.value = {
            userId: session.user.id,
            email: session.user.email,
            name: session.user.name,
            emailVerified: session.user.emailVerified,
          };
        }
      } catch (error) {
        console.error('[Auth Plugin] Session check failed:', error);
      }
    }
  }
});
