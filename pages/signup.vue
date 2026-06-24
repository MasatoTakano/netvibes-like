<template>
  <div class="auth-page">
    <h2>{{ $t('signup.title') }}</h2>

    <!-- OAuth エラー -->
    <div v-if="oauthError" class="error-message">
      {{ oauthError }}
    </div>

    <!-- Google 登録 -->
    <button class="google-btn" @click="handleGoogleSignup">
      <svg class="google-icon" viewBox="0 0 24 24" width="18" height="18">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
      {{ $t('signup.googleButton') }}
    </button>

    <div class="divider"><span>{{ $t('common.or') }}</span></div>

    <form class="auth-form" @submit.prevent="handleSignup">
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
          autocomplete="new-password"
        />
        <p class="input-hint">{{ $t('signup.passwordHint') }}</p>
      </div>
      <div class="form-group">
        <label for="name"
          >{{ $t('common.name') }} ({{ $t('common.optional') }})</label
        >
        <input id="name" v-model="name" type="text" autocomplete="name" />
      </div>

      <div v-if="error" class="error-message">
        {{ errorMessage }}
      </div>
      <div v-if="successMessage" class="success-message">
        {{ successMessage }}
      </div>

      <button type="submit" :disabled="isLoading" class="button button-primary">
        <span v-if="isLoading">{{ $t('common.loading') }}...</span>
        <span v-else>{{ $t('signup.button') }}</span>
      </button>
    </form>
    <p class="auth-switch">
      {{ $t('signup.alreadyHaveAccount') }}
      <NuxtLink to="/login">{{ $t('login.title') }}</NuxtLink>
    </p>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed } from 'vue';
  import { useAuth } from '~/composables/useAuth';
  import { navigateTo } from '#app';

  const { t } = useI18n();
  const route = useRoute();
  const { signup, fetchUser, loginWithGoogle } = useAuth();

  // --- リアクティブな状態 ---
  const email = ref('');
  const password = ref('');
  const name = ref('');
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // --- OAuth エラー（コールバックの ?error=xxx） ---
  const oauthError = ref<string | null>(null);
  onMounted(() => {
    const err = route.query.error as string | undefined;
    if (err) {
      oauthError.value = t('login.oauthError');
    }
  });

  // --- Google サインアップ ---
  const handleGoogleSignup = () => {
    loginWithGoogle();
  };
  const successMessage = ref<string | null>(null);

  // --- エラーメッセージの算出プロパティ ---
  const errorMessage = computed(() => {
    if (!error.value) return null;
    return error.value;
  });

  // --- サインアップ処理 ---
  const handleSignup = async () => {
    isLoading.value = true;
    error.value = null;
    successMessage.value = null;

    try {
      // Better Auth 経由でサインアップ（autoSignIn: true なので自動ログインされる）
      // emailVerification.sendOnSignUp: true により確認メールが自動送信される
      await signup(email.value, password.value, name.value || undefined);

      // 自動ログインされたセッションを取得して状態を更新
      await fetchUser();

      // メインページへ遷移（メール確認バナーが表示される）
      await navigateTo('/');
    } catch (err: any) {
      console.error('[ERROR] Signup failed:', err);
      error.value = err?.message || t('common.error.generic');
    } finally {
      isLoading.value = false;
    }
  };

  // --- ページメタ情報 ---
  useHead({
    title: t('signup.title'),
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

  .google-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    width: 100%;
    padding: 12px;
    border: 1px solid #dadce0;
    border-radius: 6px;
    background-color: #fff;
    color: #3c4043;
    font-size: 1em;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .google-btn:hover {
    background-color: #f8f9fa;
  }

  .google-icon {
    flex-shrink: 0;
  }

  .divider {
    display: flex;
    align-items: center;
    text-align: center;
    color: #999;
    font-size: 0.85em;
    margin: 20px 0;
  }

  .divider::before,
  .divider::after {
    content: '';
    flex: 1;
    border-bottom: 1px solid #eee;
  }

  .divider span {
    padding: 0 12px;
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
  .auth-form input[type='password'],
  .auth-form input[type='text'] {
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
