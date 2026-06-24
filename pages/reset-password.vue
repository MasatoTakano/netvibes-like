<template>
  <div class="auth-page">
    <h2>{{ $t('resetPassword.title') }}</h2>

    <!-- トークン無効・期限切れ -->
    <div v-if="tokenError" class="error-message">
      {{ tokenError }}
    </div>
    <div v-else-if="tokenError" class="auth-switch">
      <NuxtLink to="/forgot-password">{{
        $t('resetPassword.requestAgain')
      }}</NuxtLink>
    </div>

    <!-- パスワードリセット成功 -->
    <template v-else-if="isSuccess">
      <div class="success-message">
        {{ $t('resetPassword.success') }}
      </div>
      <NuxtLink to="/login" class="button button-primary">{{
        $t('resetPassword.goToLogin')
      }}</NuxtLink>
    </template>

    <!-- パスワードリセットフォーム -->
    <form v-else class="auth-form" @submit.prevent="handleSubmit">
      <div class="form-group">
        <label for="new-password">{{ $t('resetPassword.newPassword') }}</label>
        <input
          id="new-password"
          v-model="newPassword"
          type="password"
          required
          autocomplete="new-password"
        />
        <p class="input-hint">{{ $t('signup.passwordHint') }}</p>
      </div>
      <div class="form-group">
        <label for="confirm-password">{{
          $t('resetPassword.confirmPassword')
        }}</label>
        <input
          id="confirm-password"
          v-model="confirmPassword"
          type="password"
          required
          autocomplete="new-password"
        />
      </div>

      <div v-if="error" class="error-message">
        {{ error }}
      </div>

      <button type="submit" :disabled="isLoading" class="button button-primary">
        <span v-if="isLoading">{{ $t('common.loading') }}...</span>
        <span v-else>{{ $t('resetPassword.button') }}</span>
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed } from 'vue';
  import { useAuth } from '~/composables/useAuth';

  const { t } = useI18n();
  const route = useRoute();
  const { resetPassword } = useAuth();

  // --- クエリパラメータからトークン取得 ---
  // Better Auth の reset-password callback が ?token=xxx または ?error=INVALID_TOKEN を付与する
  const token = computed(() => (route.query.token as string) || '');
  const urlError = computed(() => (route.query.error as string) || '');
  const tokenError = ref<string | null>(null);

  // URLにerrorパラメータがある場合（トークン無効/期限切れ）
  if (urlError.value) {
    tokenError.value = t('resetPassword.invalidToken');
  }

  // --- リアクティブな状態 ---
  const newPassword = ref('');
  const confirmPassword = ref('');
  const isLoading = ref(false);
  const isSuccess = ref(false);
  const error = ref<string | null>(null);

  // --- パスワードリセット処理 ---
  const handleSubmit = async () => {
    error.value = null;

    // パスワード一致チェック
    if (newPassword.value !== confirmPassword.value) {
      error.value = t('resetPassword.mismatch');
      return;
    }

    // パスワード長チェック
    if (newPassword.value.length < 8) {
      error.value = t('signup.error.Password must be at least 8 characters long');
      return;
    }

    isLoading.value = true;

    try {
      await resetPassword(newPassword.value, token.value);
      isSuccess.value = true;
    } catch (err: any) {
      console.error('[ERROR] Password reset failed:', err);
      error.value = err?.message || t('common.error.generic');
    } finally {
      isLoading.value = false;
    }
  };

  useHead({
    title: t('resetPassword.title'),
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
  .auth-form input[type='password'] {
    width: 100%;
    padding: 12px;
    border: 1px solid #ccc;
    border-radius: 4px;
    box-sizing: border-box;
    font-size: 1em;
  }
  .input-hint {
    font-size: 0.85em;
    color: #777;
    margin-top: 5px;
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
  .success-message {
    color: #155724;
    background-color: #d4edda;
    border: 1px solid #c3e6cb;
    padding: 10px;
    border-radius: 4px;
    margin-bottom: 15px;
    text-align: center;
    font-size: 0.9em;
  }
  .button[type='submit'],
  .button.button-primary {
    display: inline-block;
    width: 100%;
    padding: 12px;
    font-size: 1.1em;
    cursor: pointer;
    text-align: center;
    text-decoration: none;
    border: none;
    border-radius: 4px;
    background-color: #007bff;
    color: #fff;
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
