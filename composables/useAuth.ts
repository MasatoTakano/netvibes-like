// composables/useAuth.ts
import { useState } from '#app';
import { computed } from 'vue';
import { authClient } from '~/lib/auth-client';

// User 型定義（アプリ全体で使用）
export interface User {
  userId: string;
  email: string;
  name: string;
  emailVerified: boolean;
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

  // Googleログイン（新規・既存をBetter Authが自動判定）
  const loginWithGoogle = async () => {
    await authClient.signIn.social({
      provider: 'google',
      callbackURL: '/',
    });
  };

  // パスワードリセット要求（メール送信）
  const requestPasswordReset = async (email: string) => {
    const result = await authClient.requestPasswordReset({
      email,
      redirectTo: '/reset-password',
    });
    if (result.error) {
      throw result.error;
    }
  };

  // パスワードリセット実行
  const resetPassword = async (newPassword: string, token: string) => {
    const result = await authClient.resetPassword({
      newPassword,
      token,
    });
    if (result.error) {
      throw result.error;
    }
  };

  // 確認メール再送
  const resendVerificationEmail = async () => {
    if (!user.value?.email) return;
    const result = await authClient.sendVerificationEmail({
      email: user.value.email,
    });
    if (result.error) {
      throw result.error;
    }
  };

  // 名前変更
  const updateName = async (name: string) => {
    const result = await authClient.updateUser({ name });
    if (result.error) {
      throw result.error;
    }
    // ローカル状態を更新
    if (user.value) {
      user.value = { ...user.value, name };
    }
  };

  // パスワード変更
  const changePassword = async (
    currentPassword: string,
    newPassword: string,
  ) => {
    const result = await authClient.changePassword({
      currentPassword,
      newPassword,
    });
    if (result.error) {
      throw result.error;
    }
  };

  // アカウント削除（パスワード確認必須）
  const deleteAccount = async (password: string) => {
    const result = await authClient.deleteUser({
      password,
      callbackURL: '/signup',
    });
    if (result.error) {
      throw result.error;
    }
    user.value = null;
  };

  return {
    user,
    isLoggedIn,
    fetchUser,
    login,
    signup,
    logout,
    setUserSession,
    requestPasswordReset,
    resetPassword,
    resendVerificationEmail,
    updateName,
    changePassword,
    deleteAccount,
    loginWithGoogle,
  };
};
