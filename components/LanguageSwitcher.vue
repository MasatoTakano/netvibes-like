<!-- components/LanguageSwitcher.vue -->
<template>
  <div class="language-switcher">
    <select v-model="locale">
      <option
        v-for="lang in availableLocales"
        :key="lang.code"
        :value="lang.code"
      >
        {{ lang.name }}
      </option>
    </select>
  </div>
</template>

<script setup lang="ts">
  import { useI18n } from '#imports';

  const { locale, locales, setLocale } = useI18n();

  const availableLocales = computed(() => {
    return (locales.value as Array<{ code: string; name?: string }>).filter(
      (l) => l.name,
    );
  });

  watch(locale, (newLocale) => {
    setLocale(newLocale);
  });
</script>

<style scoped>
  .language-switcher select {
    padding: 5px;
    border-radius: 4px;
    border: 1px solid #ccc;
  }
</style>
