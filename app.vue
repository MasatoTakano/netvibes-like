// app.vue
<script setup lang="ts">
// useAuth のインポートは不要
// const { fetchUser } = useAuth(); // 削除

// if (process.server) { // 削除
//   await fetchUser(); // 削除
// } // 削除
</script>
<template>
  <div>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>