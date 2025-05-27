// server/api/layout.get.ts
import { defineEventHandler, createError, getCookie, setCookie } from 'h3'; // h3 から必要なものをインポート
import { PrismaClient } from '@prisma/client';
import { lucia } from '~/server/utils/auth';
import { defaultLayoutData } from '~/constants'; // デフォルトレイアウトをインポート (パスを適切に設定)

// Prisma Client のインスタンスを作成 (シングルトンが望ましい)
const prisma = new PrismaClient();

export default defineEventHandler(async (event) => {
  console.log('[API GET /api/layout] Request received.');

  // --- 1. 認証チェック ---
  const sessionId = getCookie(event, lucia.sessionCookieName);
  if (!sessionId) {
    console.log('[API GET /api/layout] No session cookie found.');
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized: No session' });
  }

  const { session, user } = await lucia.validateSession(sessionId);

  if (!session) {
    // セッションが無効な場合、クライアントの Cookie をクリアする
    const sessionCookie = lucia.createBlankSessionCookie();
    setCookie(event, sessionCookie.name, sessionCookie.value, sessionCookie.attributes);
    console.log('[API GET /api/layout] Invalid session.');
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized: Invalid session' });
  }

  // セッションの鮮度を更新 (任意)
  if (session.fresh) {
    const sessionCookie = lucia.createSessionCookie(session.id);
    setCookie(event, sessionCookie.name, sessionCookie.value, sessionCookie.attributes);
    console.log('[API GET /api/layout] Session refreshed.');
  }

  const userId = session.userId;
  console.log(`[API GET /api/layout] Authenticated user: ${userId}`);

  // --- 2. データベースからレイアウトデータを取得 ---
  try {
    console.log(`[API GET /api/layout] Attempting to load layout for user ${userId}...`);

    // Prisma を使用して、ログインユーザーの Layout レコードを検索
    const layoutRecord = await prisma.layout.findUnique({
      where: {
        userId: userId, // 認証されたユーザーIDで検索
      },
      select: { // 必要なフィールドのみ選択 (パフォーマンス向上)
        data: true,
        updatedAt: true,
      }
    });

    console.log('[API GET /api/layout] Raw result from Prisma:', layoutRecord);

    if (layoutRecord && layoutRecord.data) {
      // データが存在する場合
      console.log(`[API GET /api/layout] Found layout data (updated_at: ${layoutRecord.updatedAt}) for user ${userId}.`);

      try {
        // DBのJSON文字列をJSオブジェクトに変換
        const parsedLayout = JSON.parse(layoutRecord.data);
        console.log("[API GET /api/layout] Successfully parsed layout data.");
        return parsedLayout; // パースしたオブジェクトを返す
      } catch (parseError: any) {
        // JSONパースエラー
        console.error(`[API GET /api/layout] Error parsing layout data for user ${userId}:`, parseError);
        console.error('[API GET /api/layout] Faulty JSON string:', layoutRecord.data);
        // エラーを返す (クライアント側で適切に処理できるように)
        throw createError({
          statusCode: 500,
          statusMessage: 'Internal Server Error: Failed to parse layout data from DB',
          message: parseError.message, // エラー詳細をメッセージに含める
        });
      }

    } else {
      // データが見つからない、または data フィールドが空の場合
      if (!layoutRecord) {
        console.log(`[API GET /api/layout] No layout record found in DB for user ${userId}. Returning default layout.`);
      } else { // layoutRecord は存在するが data が空の場合
        console.log(`[API GET /api/layout] Layout record found, but data is empty for user ${userId}. Returning default layout.`);
      }
      // デフォルトのレイアウトデータを返す
      return defaultLayoutData;
    }
  } catch (dbError: any) {
    // Prisma でのデータベースアクセスエラー
    console.error(`[API GET /api/layout] Database error fetching layout for user ${userId}:`, dbError);
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error: Failed to load layout state from DB',
      message: dbError.message,
    });
  }
});