// server/api/logout.post.ts
import { lucia } from '~/server/utils/auth';

export default defineEventHandler(async (event) => {
  // セッションIDを取得
  const sessionId = getCookie(event, lucia.sessionCookieName);
  if (!sessionId) {
    // セッションがなければ既にログアウト状態 or エラー
    throw createError({
        statusCode: 403, // Forbidden
        statusMessage: "Not logged in"
    });
  }

  // セッションを無効化
  await lucia.invalidateSession(sessionId);

  // セッションを削除する Cookie を発行
  const sessionCookie = lucia.createBlankSessionCookie();
  setCookie(event, sessionCookie.name, sessionCookie.value, sessionCookie.attributes);

  console.log(`Session invalidated: ${sessionId}`);
  return { success: true };
});