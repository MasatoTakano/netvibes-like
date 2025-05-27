// middleware/auth.global.ts
export default defineNuxtRouteMiddleware((to, from) => {
  // 公開ページへのリクエスト
  const publicPages = ['/login', '/signup'];
  if (publicPages.includes(to.path)) {
    return;
  }

  const { user, isLoggedIn } = useAuth();

  // ログイン済みでない、かつ /login 以外へのリクエストの場合、ログイン画面にリダイレクト
  if (!isLoggedIn.value && to.path !== '/login') {
    return navigateTo('/login', { redirectCode: 302 });
  }

  // ログイン済み、かつ公開ページへのリクエストの場合はメイン画面へリダイレクト
  if (isLoggedIn.value && publicPages.includes(to.path)) {
    return navigateTo('/', { redirectCode: 302 });
  }
});