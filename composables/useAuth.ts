// composables/useAuth.ts
import { useState } from '#app'; // ★ 再度追加 (または確認)
import { computed } from 'vue'; // ★ 再度追加 (または確認)
import { navigateTo } from '#app'; // navigateTo は必要
// $fetch や useRouter は logout で使うなら必要

// User 型定義 (ここか別の型ファイルで)
export interface User {
  userId: string;
  email: string;
  name: string | null;
}


export const useAuth = () => {
  // useState はプラグインで設定された値を取得するだけ
  const user = useState<User | null>('user');
  const isLoggedIn = computed(() => !!user.value);

  const setUserSession = (userData: User | null) => {
    user.value = userData;
  };

  // fetchUser はクライアントサイドで強制的に更新したい場合などに使う（任意）
  const fetchUserClient = async () => {
    // console.log('fetchUserClient called');
    try {
      const data = await $fetch<{ user: User | null }>('/api/user');
      user.value = data.user;
    } catch (error) {
      console.error('Failed to fetch user on client:', error);
      user.value = null;
    }
  };


  const logout = async () => {
    try {
      await $fetch('/api/logout', { method: 'POST' });
      user.value = null;
      await navigateTo('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return {
    user,
    isLoggedIn,
    fetchUserClient, // 名前を変更 (任意)
    logout,
    setUserSession,
  };
};