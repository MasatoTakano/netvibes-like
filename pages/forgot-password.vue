<template>
  <div class="auth-page">
    <h2>{{ $t('forgotPassword.title') }}</h2>
    <form class="auth-form" @submit.prevent="handleSubmit">
      <div class="form-group">
        <label for="email">{{ $t('common.email') }}</label>
        <input
          id="email"
          v-model="email"
          type="email"
          required
          autocomplete="email"
          :disabled="isSubmitted"
        />
      </div>

      <div v-if="error" class="error-message">
        {{ error }}
      </div>

      <div v-if="successMessage" class="success-message">
        {{ successMessage }}
      </div>

      <button
        type="submit"
        :disabled="isLoading || isSubmitted"
        class="button button-primary"
      >
        <span v-if="isLoading">{{ $t('common.loading') }}...</span>
        <span v-else>{{ $t('forgotPassword.button') }}</span>
      </button>
    </form>
    <p class="auth-switch">
      <NuxtLink to="/login">{{ $t('forgotPassword.backToLogin') }}</NuxtLink>
    </p>
  </div>
</template>

<script setup lang="ts">
  import { ref } from 'vue';
  import { useAuth } from '~/composables/useAuth';

  const { t } = useI18n();
  const { requestPasswordReset } = useAuth();

  const email = ref('');
  const isLoading = ref(false);
  const isSubmitted = ref(false);
  const error = ref<string | null>(null);
  const successMessage = ref<string | null>(null);

  const handleSubmit = async () => {
    isLoading.value = true;
    error.value = null;
    successMessage.value = null;

    try {
      await requestPasswordReset(email.value);
      // セキュリティ上、メール存在有無を推測させない汎用メッセージ
      successMessage.value = t('forgotPassword.success');
      isSubmitted.value = true;
    } catch (err: any) {
      console.error('[ERROR] Forgot password failed:', err);
      error.value = err?.message || t('common.error.generic');
    } finally {
      isLoading.value = false;
    }
  };

  useHead({
    title: t('forgotPassword.title'),
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
  .auth-form input[type='email'] {
    width: 100%;
    padding: 12px;
    border: 1px solid #ccc;
    border-radius: 4px;
    box-sizing: border-box;
    font-size: 1em;
  }
  .auth-form input:disabled {
    background-color: #f5f5f5;
    cursor: not-allowed;
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
