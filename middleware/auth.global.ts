// middleware/auth.global.ts
export default defineNuxtRouteMiddleware((to) => {
  // 公開ページ（ログイン不要でアクセス可能）
  const publicPages = [
    '/login',
    '/signup',
    '/forgot-password',
    '/reset-password',
    '/verify-email',
  ];
  if (publicPages.includes(to.path)) {
    return;
  }

  const { isLoggedIn } = useAuth();

  // ログイン済みでない、かつ /login 以外へのリクエストの場合、ログイン画面にリダイレクト
  if (!isLoggedIn.value && to.path !== '/login') {
    return navigateTo('/login', { redirectCode: 302 });
  }

  // ログイン済み、かつ認証系ページ（login, signup）へのリクエストの場合はメイン画面へリダイレクト
  const authPages = ['/login', '/signup'];
  if (isLoggedIn.value && authPages.includes(to.path)) {
    return navigateTo('/', { redirectCode: 302 });
  }
});
