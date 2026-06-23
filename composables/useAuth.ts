// composables/useAuth.ts
import { useState } from '#app';
import { computed } from 'vue';
import { authClient } from '~/lib/auth-client';

// User 型定義（アプリ全体で使用）
export interface User {
  userId: string;
  email: string;
  name: string;
}

export const useAuth = () => {
  const user = useState<User | null>('user');
  const isLoggedIn = computed(() => !!user.value);

  const setUserSession = (userData: User | null) => {
    user.value = userData;
  };

  // サーバーからユーザー情報を取得
  const fetchUser = async () => {
    try {
      const data = await $fetch<{ user: User | null }>('/api/user');
      user.value = data.user;
    } catch {
      user.value = null;
    }
  };

  // Better Auth クライアント経由のログイン
  const login = async (email: string, password: string) => {
    const result = await authClient.signIn.email({ email, password });
    if (result.error) {
      throw result.error;
    }
    await fetchUser();
  };

  // Better Auth クライアント経由のサインアップ
  const signup = async (
    email: string,
    password: string,
    name?: string,
  ) => {
    const result = await authClient.signUp.email({
      email,
      password,
      name: name || email.split('@')[0],
    });
    if (result.error) {
      throw result.error;
    }
  };

  // Better Auth クライアント経由のログアウト
  const logout = async () => {
    await authClient.signOut();
    user.value = null;
    await navigateTo('/login');
  };

  return {
    user,
    isLoggedIn,
    fetchUser,
    login,
    signup,
    logout,
    setUserSession,
  };
};
