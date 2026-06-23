// lib/auth-client.ts
// Better Auth Vue クライアント。フロントエンドから認証APIを呼び出す。
import { createAuthClient } from 'better-auth/vue';

export const authClient = createAuthClient({
  baseURL: typeof window !== 'undefined'
    ? window.location.origin
    : process.env.BETTER_AUTH_URL || 'http://localhost:3000',
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
} = authClient;
