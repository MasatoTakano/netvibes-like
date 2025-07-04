// server/api/settings.post.ts
import {
  defineEventHandler,
  createError,
  getCookie,
  setCookie,
  readBody,
} from 'h3';
import { PrismaClient } from '@prisma/client';
import { lucia } from '~/server/utils/auth';
// FontSettings 型をインポート
import type { FontSettings } from '~/types';

// Prisma Client のインスタンスを作成
const prisma = new PrismaClient();

// 設定データの基本的な型チェック (backgroundColor のチェックを削除)
// Zod などを使うとより厳密にできる
function isValidFontSettingsData(data: any): data is FontSettings {
  // 型ガードを使用
  if (typeof data !== 'object' || data === null) return false;
  // 必須プロパティの存在と型をチェック
  if (typeof data.fontFamily !== 'string') return false;
  if (typeof data.fontSize !== 'number') return false;
  // backgroundColor のチェックを削除
  // if (typeof data.backgroundColor !== 'string') return false;
  // 他に予期しないプロパティがないかチェックするのも良い (オプション)
  const allowedKeys = ['fontFamily', 'fontSize'];
  for (const key in data) {
    if (!allowedKeys.includes(key)) {
      console.warn(
        `[API POST /api/settings] Validation: Unexpected key found: ${key}`,
      );
      // return false; // 厳密にするなら false を返す
    }
  }
  return true;
}

export default defineEventHandler(async (event) => {
  console.log('[API POST /api/settings] Request received.');

  // --- 1. 認証チェック ---
  const sessionId = getCookie(event, lucia.sessionCookieName);
  if (!sessionId) {
    console.log('[API POST /api/settings] No session cookie found.');
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized: No session',
    });
  }

  const { session } = await lucia.validateSession(sessionId);

  if (!session) {
    const sessionCookie = lucia.createBlankSessionCookie();
    setCookie(
      event,
      sessionCookie.name,
      sessionCookie.value,
      sessionCookie.attributes,
    );
    console.log('[API POST /api/settings] Invalid session.');
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized: Invalid session',
    });
  }

  if (session.fresh) {
    const sessionCookie = lucia.createSessionCookie(session.id);
    setCookie(
      event,
      sessionCookie.name,
      sessionCookie.value,
      sessionCookie.attributes,
    );
    console.log('[API POST /api/settings] Session refreshed.');
  }

  const userId = session.userId;
  console.log(`[API POST /api/settings] Authenticated user: ${userId}`);

  // --- 2. リクエストボディの取得と検証 ---
  let fontSettingsData: FontSettings; // 型を FontSettings に変更
  try {
    const rawBody = await readBody(event);
    console.log(
      `[API POST /api/settings] Received raw body for user ${userId}:`,
      rawBody,
    );

    // --- 入力データバリデーション ---
    if (!isValidFontSettingsData(rawBody)) {
      // 検証関数名を変更
      console.warn(
        `[API POST /api/settings] Invalid font settings data received for user ${userId}:`,
        rawBody,
      );
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request: Invalid font settings data format',
      });
    }
    // バリデーションが通れば型が保証される
    fontSettingsData = rawBody;
  } catch (readError: any) {
    console.error(
      `[API POST /api/settings] Error reading or validating request body for user ${userId}:`,
      readError,
    );
    if (readError.statusCode === 400) throw readError;
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request: Could not read or validate request body',
      message: readError.message,
    });
  }

  // --- 3. データベースへの保存 ---
  try {
    // 受け取った FontSettings データ (JSオブジェクト) をJSON文字列に変換
    // この時点で backgroundColor は含まれていないはず
    const settingsDataString = JSON.stringify(fontSettingsData);
    console.log(
      `[API POST /api/settings] Stringified font settings data length for user ${userId}: ${settingsDataString.length}`,
    );

    const upsertResult = await prisma.setting.upsert({
      where: { userId: userId },
      update: { data: settingsDataString },
      create: { userId: userId, data: settingsDataString },
      select: { updatedAt: true },
    });

    console.log(
      `[API POST /api/settings] Font settings saved successfully for user ${userId}. DB updatedAt: ${upsertResult.updatedAt}`,
    );
    return { success: true };
  } catch (dbError: any) {
    console.error(
      `[API POST /api/settings] Database error saving font settings for user ${userId}:`,
      dbError,
    );
    throw createError({
      statusCode: 500,
      statusMessage:
        'Internal Server Error: Failed to save font settings state to DB',
      message: dbError.message,
    });
  }
});
