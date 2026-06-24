<template>
  <div class="settings-page">
    <h2>{{ $t('settings.title') }}</h2>

    <!-- プロフィール（名前変更） -->
    <section class="settings-section">
      <h3>{{ $t('settings.profile') }}</h3>
      <form class="settings-form" @submit.prevent="handleUpdateName">
        <div class="form-group">
          <label for="email">{{ $t('common.email') }}</label>
          <input id="email" :value="user?.email" type="email" disabled />
        </div>
        <div class="form-group">
          <label for="name">{{ $t('common.name') }}</label>
          <input
            id="name"
            v-model="editName"
            type="text"
            autocomplete="name"
            :placeholder="$t('settings.namePlaceholder')"
          />
        </div>
        <div v-if="profileError" class="error-message">
          {{ profileError }}
        </div>
        <div v-if="profileSuccess" class="success-message">
          {{ profileSuccess }}
        </div>
        <button
          type="submit"
          class="button button-primary"
          :disabled="isSavingProfile || editName === (user?.name ?? '')"
        >
          <span v-if="isSavingProfile">{{ $t('common.loading') }}...</span>
          <span v-else>{{ $t('settings.saveName') }}</span>
        </button>
      </form>
    </section>

    <!-- メール確認状態 -->
    <section class="settings-section">
      <h3>{{ $t('settings.emailVerification') }}</h3>
      <div class="verification-status">
        <span v-if="user?.emailVerified" class="verified">
          ✅ {{ $t('settings.emailVerified') }}
        </span>
        <span v-else class="not-verified">
          ⚠️ {{ $t('settings.emailNotVerified') }}
        </span>
        <button
          v-if="!user?.emailVerified"
          class="button button-secondary"
          :disabled="isResending"
          @click="handleResendVerification"
        >
          {{ isResending ? $t('common.loading') + '...' : $t('settings.resendVerification') }}
        </button>
      </div>
    </section>

    <!-- パスワード変更 -->
    <section class="settings-section">
      <h3>{{ $t('settings.changePassword') }}</h3>
      <form class="settings-form" @submit.prevent="handleChangePassword">
        <div class="form-group">
          <label for="current-password">{{ $t('settings.currentPassword') }}</label>
          <input
            id="current-password"
            v-model="currentPassword"
            type="password"
            required
            autocomplete="current-password"
          />
        </div>
        <div class="form-group">
          <label for="new-password">{{ $t('settings.newPassword') }}</label>
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
          <label for="confirm-new-password">{{ $t('settings.confirmNewPassword') }}</label>
          <input
            id="confirm-new-password"
            v-model="confirmNewPassword"
            type="password"
            required
            autocomplete="new-password"
          />
        </div>
        <div v-if="passwordError" class="error-message">
          {{ passwordError }}
        </div>
        <div v-if="passwordSuccess" class="success-message">
          {{ passwordSuccess }}
        </div>
        <button type="submit" class="button button-primary" :disabled="isSavingPassword">
          <span v-if="isSavingPassword">{{ $t('common.loading') }}...</span>
          <span v-else>{{ $t('settings.changePasswordButton') }}</span>
        </button>
      </form>
    </section>

    <!-- アカウント削除 -->
    <section class="settings-section danger-zone">
      <h3>{{ $t('settings.deleteAccount') }}</h3>
      <p class="danger-text">{{ $t('settings.deleteAccountWarning') }}</p>
      <form class="settings-form" @submit.prevent="handleDeleteAccount">
        <div class="form-group">
          <label for="delete-password">{{ $t('settings.confirmPasswordToDelete') }}</label>
          <input
            id="delete-password"
            v-model="deletePassword"
            type="password"
            required
            autocomplete="current-password"
            :disabled="isDeleting"
          />
        </div>
        <div v-if="deleteError" class="error-message">
          {{ deleteError }}
        </div>
        <button type="submit" class="button button-danger" :disabled="isDeleting">
          <span v-if="isDeleting">{{ $t('common.loading') }}...</span>
          <span v-else>{{ $t('settings.deleteButton') }}</span>
        </button>
      </form>
    </section>

    <!-- 戻る・ログアウト -->
    <div class="settings-footer">
      <NuxtLink to="/" class="button button-secondary">{{
        $t('settings.backToDashboard')
      }}</NuxtLink>
      <button class="button button-secondary" @click="handleLogout">
        {{ $t('logout.button') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref } from 'vue';
  import { useAuth } from '~/composables/useAuth';

  const { t } = useI18n();
  const {
    user,
    updateName,
    changePassword,
    deleteAccount,
    resendVerificationEmail,
    logout,
  } = useAuth();

  // --- プロフィール（名前変更） ---
  const editName = ref(user.value?.name ?? '');
  const isSavingProfile = ref(false);
  const profileError = ref<string | null>(null);
  const profileSuccess = ref<string | null>(null);

  const handleUpdateName = async () => {
    isSavingProfile.value = true;
    profileError.value = null;
    profileSuccess.value = null;
    try {
      await updateName(editName.value);
      profileSuccess.value = t('settings.nameUpdated');
    } catch (err: any) {
      profileError.value = err?.message || t('common.error.generic');
    } finally {
      isSavingProfile.value = false;
    }
  };

  // --- メール確認再送 ---
  const isResending = ref(false);
  const handleResendVerification = async () => {
    isResending.value = true;
    try {
      await resendVerificationEmail();
      profileSuccess.value = t('settings.verificationSent');
    } catch (err: any) {
      profileError.value = err?.message || t('common.error.generic');
    } finally {
      isResending.value = false;
    }
  };

  // --- パスワード変更 ---
  const currentPassword = ref('');
  const newPassword = ref('');
  const confirmNewPassword = ref('');
  const isSavingPassword = ref(false);
  const passwordError = ref<string | null>(null);
  const passwordSuccess = ref<string | null>(null);

  const handleChangePassword = async () => {
    passwordError.value = null;
    passwordSuccess.value = null;

    if (newPassword.value !== confirmNewPassword.value) {
      passwordError.value = t('resetPassword.mismatch');
      return;
    }
    if (newPassword.value.length < 8) {
      passwordError.value = t('signup.error.Password must be at least 8 characters long');
      return;
    }

    isSavingPassword.value = true;
    try {
      await changePassword(currentPassword.value, newPassword.value);
      passwordSuccess.value = t('settings.passwordChanged');
      currentPassword.value = '';
      newPassword.value = '';
      confirmNewPassword.value = '';
    } catch (err: any) {
      passwordError.value = err?.message || t('common.error.generic');
    } finally {
      isSavingPassword.value = false;
    }
  };

  // --- アカウント削除 ---
  const deletePassword = ref('');
  const isDeleting = ref(false);
  const deleteError = ref<string | null>(null);

  const handleDeleteAccount = async () => {
    deleteError.value = null;
    isDeleting.value = true;
    try {
      await deleteAccount(deletePassword.value);
      await navigateTo('/signup');
    } catch (err: any) {
      deleteError.value = err?.message || t('common.error.generic');
    } finally {
      isDeleting.value = false;
    }
  };

  // --- ログアウト ---
  const handleLogout = async () => {
    await logout();
  };

  useHead({ title: t('settings.title') });
</script>

<style scoped>
  .settings-page {
    max-width: 560px;
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

  .settings-section {
    margin-bottom: 32px;
    padding-bottom: 24px;
    border-bottom: 1px solid #eee;
  }

  .settings-section:last-of-type {
    border-bottom: none;
  }

  .settings-section h3 {
    margin-bottom: 16px;
    color: #555;
    font-size: 1.1em;
  }

  .settings-form .form-group {
    margin-bottom: 16px;
  }

  .settings-form label {
    display: block;
    margin-bottom: 6px;
    font-weight: bold;
    color: #555;
    font-size: 0.9em;
  }

  .settings-form input {
    width: 100%;
    padding: 10px;
    border: 1px solid #ccc;
    border-radius: 4px;
    box-sizing: border-box;
    font-size: 1em;
  }

  .settings-form input:disabled {
    background-color: #f5f5f5;
    cursor: not-allowed;
  }

  .input-hint {
    font-size: 0.85em;
    color: #777;
    margin-top: 4px;
  }

  .verification-status {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .verified {
    color: #155724;
    font-weight: 500;
  }

  .not-verified {
    color: #856404;
    font-weight: 500;
  }

  .button {
    display: inline-block;
    padding: 10px 24px;
    font-size: 0.95em;
    cursor: pointer;
    border: none;
    border-radius: 4px;
    text-decoration: none;
  }

  .button-primary {
    background-color: #007bff;
    color: #fff;
  }

  .button-primary:hover:not(:disabled) {
    background-color: #0056b3;
  }

  .button-secondary {
    background-color: #e2e6ea;
    color: #333;
  }

  .button-secondary:hover:not(:disabled) {
    background-color: #dae0e5;
  }

  .button-danger {
    background-color: #dc3545;
    color: #fff;
  }

  .button-danger:hover:not(:disabled) {
    background-color: #c82333;
  }

  .button:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .error-message {
    color: #dc3545;
    background-color: #f8d7da;
    border: 1px solid #f5c6cb;
    padding: 10px;
    border-radius: 4px;
    margin-bottom: 12px;
    text-align: center;
    font-size: 0.9em;
  }

  .success-message {
    color: #155724;
    background-color: #d4edda;
    border: 1px solid #c3e6cb;
    padding: 10px;
    border-radius: 4px;
    margin-bottom: 12px;
    text-align: center;
    font-size: 0.9em;
  }

  .danger-zone {
    border: 1px solid #f5c6cb;
    border-radius: 6px;
    padding: 20px;
    background-color: #fff5f5;
  }

  .danger-zone h3 {
    color: #dc3545;
  }

  .danger-text {
    color: #721c24;
    font-size: 0.9em;
    margin-bottom: 12px;
  }

  .settings-footer {
    display: flex;
    justify-content: space-between;
    gap: 12px;
  }

  .settings-footer .button {
    flex: 1;
    text-align: center;
  }
</style>
