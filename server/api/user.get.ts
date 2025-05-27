// server/api/user.get.ts
import { lucia } from '~/server/utils/auth';

export default defineEventHandler(async (event) => {
  // リクエストからセッションIDを取得 (Lucia が Cookie を自動で読む)
  const sessionId = getCookie(event, lucia.sessionCookieName);
  if (!sessionId) {
    // セッション Cookie がなければ未認証
    return { user: null };
  }

  // セッションを検証
  const { session, user } = await lucia.validateSession(sessionId);

  // セッションの鮮度を更新 (任意だが推奨)
  // 新しい有効期限でセッションを更新し、新しい Cookie を発行する場合
  if (session && session.fresh) {
    const sessionCookie = lucia.createSessionCookie(session.id);
    setCookie(event, sessionCookie.name, sessionCookie.value, sessionCookie.attributes);
  }
  // セッションが無効だった場合 (期限切れなど)
  if (!session) {
    // 無効なセッションを示す Cookie を発行
    const sessionCookie = lucia.createBlankSessionCookie();
    setCookie(event, sessionCookie.name, sessionCookie.value, sessionCookie.attributes);
    return { user: null };
  }

  // 有効なセッションがあればユーザー情報を返す
  // getUserAttributes で定義したものが user オブジェクトに含まれる
  return { user: user };
});