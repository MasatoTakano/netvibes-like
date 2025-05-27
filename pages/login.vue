<template>
    <div class="auth-page">
      <h2>{{ $t('login.title') }}</h2>
      <form @submit.prevent="handleLogin" class="auth-form">
        <div class="form-group">
          <label for="email">{{ $t('common.email') }}</label>
          <input type="email" id="email" v-model="email" required autocomplete="email" />
        </div>
        <div class="form-group">
          <label for="password">{{ $t('common.password') }}</label>
          <input type="password" id="password" v-model="password" required autocomplete="current-password" />
        </div>
  
        <div v-if="error" class="error-message">
          {{ errorMessage }}
        </div>
  
        <button type="submit" :disabled="isLoading" class="button button-primary">
          <span v-if="isLoading">{{ $t('common.loading') }}...</span>
          <span v-else>{{ $t('login.button') }}</span>
        </button>
      </form>
      <p class="auth-switch">
        {{ $t('login.noAccount') }}
        <NuxtLink to="/signup">{{ $t('signup.title') }}</NuxtLink>
      </p>
    </div>
  </template>
  
  <script setup lang="ts">
import { ref, computed } from 'vue';
import { useAuth } from '~/composables/useAuth'; // インポートは不要なはず -> 削除
import { navigateTo } from '#app';

const { t } = useI18n();
const { setUserSession } = useAuth();

// --- リアクティブな状態 ---
const email = ref('');
const password = ref('');
const isLoading = ref(false);
const error = ref<any>(null);

// --- エラーメッセージ ---
const errorMessage = computed(() => {
  if (!error.value) return null;
  if (error.value.data?.statusMessage) {
    return error.value.data.statusMessage;
  }
  return t('common.error.generic');
});

// --- ログイン処理 ---
const handleLogin = async () => {
  isLoading.value = true;
  error.value = null;

  try {
    // --- APIリクエスト ---
    const response = await $fetch<{ success: true, user: User } >('/api/login', { // 現状のAPIの場合
      method: 'POST',
      body: {
        email: email.value,
        password: password.value,
      },
    });

    // --- 成功処理 ---
    if (response.success === true && response.user) {
      setUserSession(response.user);
      // 状態更新後にナビゲーション
      await navigateTo('/');
    } else {
      // API が成功しなかった場合 (通常はエラーになるはずだが念のため)
      throw new Error('Login failed: Invalid response from server.');
    }
  } catch (err: any) {
    // --- エラー処理 ---
    console.error('[ERROR] Login failed:', err);
    error.value = err;
  } finally {
    isLoading.value = false;
  }
};
  
  // --- ページメタ情報 ---
  useHead({
    title: t('login.title'),
  });
  
// --- レイアウト指定 ---

</script>

<style scoped>
/* サインアップページと共通のスタイルを使えるように */
/* 必要であれば signup.vue から .auth-page などのスタイルを共通のCSSファイルに移動 */
.auth-page {
  max-width: 400px;
  margin: 50px auto;
  padding: 30px;
  border: 1px solid #eee;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  background-color: #fff;
}
  
h2 { text-align: center; margin-bottom: 30px; color: #333; }
.auth-form .form-group { margin-bottom: 20px; }
.auth-form label { display: block; margin-bottom: 8px; font-weight: bold; color: #555; }
.auth-form input[type="email"],
.auth-form input[type="password"] { width: 100%; padding: 12px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; font-size: 1em; }
.error-message { color: #dc3545; background-color: #f8d7da; border: 1px solid #f5c6cb; padding: 10px; border-radius: 4px; margin-bottom: 15px; text-align: center; font-size: 0.9em; }
.button[type="submit"] { width: 100%; padding: 12px; font-size: 1.1em; cursor: pointer; }
.button:disabled { opacity: 0.7; cursor: not-allowed; }
.auth-switch { margin-top: 25px; text-align: center; font-size: 0.9em; color: #555; }
.auth-switch a { color: #007bff; text-decoration: none; font-weight: bold; }
.auth-switch a:hover { text-decoration: underline; }
</style>