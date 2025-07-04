// server/api/layout.post.ts
import {
  defineEventHandler,
  createError,
  getCookie,
  setCookie,
  readBody,
} from 'h3'; // readBody もインポート
import { PrismaClient } from '@prisma/client';
import { lucia } from '~/server/utils/auth';

// Prisma Client のインスタンスを作成
const prisma = new PrismaClient();

export default defineEventHandler(async (event) => {
  console.log('[API POST /api/layout] Request received.');

  // --- 1. 認証チェック ---
  const sessionId = getCookie(event, lucia.sessionCookieName);
  if (!sessionId) {
    console.log('[API POST /api/layout] No session cookie found.');
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized: No session',
    });
  }

  const { session, user } = await lucia.validateSession(sessionId);

  if (!session) {
    const sessionCookie = lucia.createBlankSessionCookie();
    setCookie(
      event,
      sessionCookie.name,
      sessionCookie.value,
      sessionCookie.attributes,
    );
    console.log('[API POST /api/layout] Invalid session.');
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized: Invalid session',
    });
  }

  // セッションの鮮度を更新 (任意)
  if (session.fresh) {
    const sessionCookie = lucia.createSessionCookie(session.id);
    setCookie(
      event,
      sessionCookie.name,
      sessionCookie.value,
      sessionCookie.attributes,
    );
    console.log('[API POST /api/layout] Session refreshed.');
  }

  const userId = session.userId;
  console.log(`[API POST /api/layout] Authenticated user: ${userId}`);

  console.log(`[API POST /api/layout] Valid session found. User object:`, user);
  console.log(
    `[API POST /api/layout] Extracted userId:`,
    userId,
    `(Type: ${typeof userId})`,
  );

  // userId が undefined でないことを確認してから DB 操作へ進むチェックを追加 (より安全)
  if (typeof userId !== 'string' || userId.length === 0) {
    console.error(
      `[API POST /api/layout] userId is invalid or undefined after validation! userId: ${userId}`,
    );
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error: User ID is missing in session',
    });
  }

  console.log(
    `[API POST /api/layout] Authenticated user confirmed with valid userId: ${userId}`,
  );

  // --- 2. リクエストボディの取得と検証 ---
  let layoutDataFromClient;
  try {
    layoutDataFromClient = await readBody(event);
    console.log(
      `[API POST /api/layout] Received layout data for user ${userId}:`,
      layoutDataFromClient,
    );

    // --- 入力データバリデーション ---
    if (!layoutDataFromClient || typeof layoutDataFromClient !== 'object') {
      throw createError({
        statusCode: 400,
        statusMessage:
          'Bad Request: Invalid layout data format (must be an object/array)',
      });
    }

    // 必要であれば、配列であること、各要素が特定のプロパティを持つことなどをチェック
    if (!Array.isArray(layoutDataFromClient)) {
      console.warn(
        `[API POST /api/layout] Received non-array layout data for user ${userId}. Type: ${typeof layoutDataFromClient}`,
      );
    }
  } catch (readError: any) {
    console.error(
      `[API POST /api/layout] Error reading request body for user ${userId}:`,
      readError,
    );
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request: Could not read request body',
      message: readError.message,
    });
  }

  // --- 3. データベースへの保存 ---
  try {
    // 受け取ったレイアウトデータ (JSオブジェクト/配列) をJSON文字列に変換
    const layoutDataString = JSON.stringify(layoutDataFromClient);
    console.log(
      `[API POST /api/layout] Stringified layout data length for user ${userId}: ${layoutDataString.length}`,
    );

    // Prisma を使用して、ユーザーのレイアウトデータを更新または作成 (upsert)
    const upsertResult = await prisma.layout.upsert({
      where: {
        userId: userId, // ログインユーザーで検索
      },
      update: {
        // 存在する場合の更新データ
        data: layoutDataString,
        // updatedAt は自動で更新される
      },
      create: {
        // 存在しない場合の作成データ
        userId: userId,
        data: layoutDataString,
      },
      select: {
        // 結果として何を取得するか (デバッグ用に updatedAt を取得)
        updatedAt: true,
      },
    });

    console.log(
      `[API POST /api/layout] Layout saved successfully for user ${userId}. DB updatedAt: ${upsertResult.updatedAt}`,
    );

    return { success: true };
  } catch (dbError: any) {
    // データベースエラー
    console.error(
      `[API POST /api/layout] Database error saving layout for user ${userId}:`,
      dbError,
    );

    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error: Failed to save layout state to DB',
      message: dbError.message,
    });
  }
});
