<template>
  <div class="auth-page">
    <h2>{{ $t('login.title') }}</h2>
    <form class="auth-form" @submit.prevent="handleLogin">
      <div class="form-group">
        <label for="email">{{ $t('common.email') }}</label>
        <input
          id="email"
          v-model="email"
          type="email"
          required
          autocomplete="email"
        />
      </div>
      <div class="form-group">
        <label for="password">{{ $t('common.password') }}</label>
        <input
          id="password"
          v-model="password"
          type="password"
          required
          autocomplete="current-password"
        />
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
  import { useAuth } from '~/composables/useAuth';
  import { navigateTo } from '#app';

  const { t } = useI18n();
  const { login } = useAuth();

  // --- リアクティブな状態 ---
  const email = ref('');
  const password = ref('');
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // --- エラーメッセージ ---
  const errorMessage = computed(() => {
    if (!error.value) return null;
    return error.value;
  });

  // --- ログイン処理 ---
  const handleLogin = async () => {
    isLoading.value = true;
    error.value = null;

    try {
      await login(email.value, password.value);
      await navigateTo('/');
    } catch (err: any) {
      console.error('[ERROR] Login failed:', err);
      // Better Auth クライアントのエラーは { message, code } 形式
      error.value = err?.message || t('common.error.generic');
    } finally {
      isLoading.value = false;
    }
  };

  // --- ページメタ情報 ---
  useHead({
    title: t('login.title'),
  });
</script>

<style scoped>
  .auth-page {
    max-width: 400px;
    margin: 50px auto;
    padding: 30px;
    border: 1px solid #eee;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    background-color: #fff;
  }

  h2 {
    text-align: center;
    margin-bottom: 30px;
    color: #333;
  }
  .auth-form .form-group {
    margin-bottom: 20px;
  }
  .auth-form label {
    display: block;
    margin-bottom: 8px;
    font-weight: bold;
    color: #555;
  }
  .auth-form input[type='email'],
  .auth-form input[type='password'] {
    width: 100%;
    padding: 12px;
    border: 1px solid #ccc;
    border-radius: 4px;
    box-sizing: border-box;
    font-size: 1em;
  }
  .error-message {
    color: #dc3545;
    background-color: #f8d7da;
    border: 1px solid #f5c6cb;
    padding: 10px;
    border-radius: 4px;
    margin-bottom: 15px;
    text-align: center;
    font-size: 0.9em;
  }
  .button[type='submit'] {
    width: 100%;
    padding: 12px;
    font-size: 1.1em;
    cursor: pointer;
  }
  .button:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
  .auth-switch {
    margin-top: 25px;
    text-align: center;
    font-size: 0.9em;
    color: #555;
  }
  .auth-switch a {
    color: #007bff;
    text-decoration: none;
    font-weight: bold;
  }
  .auth-switch a:hover {
    text-decoration: underline;
  }
</style>
