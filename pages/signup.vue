<template>
  <div class="auth-page">
    <h2>{{ $t('signup.title') }}</h2>
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
  import { ref } from 'vue';
  import { useRouter } from 'vue-router';

  const { t } = useI18n();
  const router = useRouter();

  // --- リアクティブな状態 ---
  const email = ref('');
  const password = ref('');
  const name = ref('');
  const isLoading = ref(false);
  const error = ref<any>(null);
  const successMessage = ref<string | null>(null);

  // --- エラーメッセージの算出プロパティ ---
  const errorMessage = computed(() => {
    if (!error.value) return null;
    // APIからのエラーメッセージを優先
    if (error.value.data?.statusMessage) {
      return error.value.data.statusMessage;
    }
    // その他のネットワークエラーなど
    return t('common.error.generic');
  });

  // --- サインアップ処理 ---
  const handleSignup = async () => {
    isLoading.value = true;
    error.value = null;
    successMessage.value = null;

    try {
      // --- APIリクエスト ---
      const response = await $fetch('/api/signup', {
        method: 'POST',
        body: {
          email: email.value,
          password: password.value,
          name: name.value || undefined,
        },
      });

      // --- 成功処理 ---
      if (response && response.success) {
        successMessage.value = t('signup.success');

        // 成功したらログインページにリダイレクト（少し待ってから）
        setTimeout(() => {
          router.push('/login');
        }, 500); // 0.5 秒待つ
      } else {
        // APIが成功レスポンスで success: false を返す場合（通常はエラーでキャッチされるはず）
        throw new Error('Signup failed unexpectedly.');
      }
    } catch (err: any) {
      // --- エラー処理 ---
      console.error('[ERROR] Signup failed:', err);
      // エラーをエラー表示領域に表示
      error.value = err;
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
