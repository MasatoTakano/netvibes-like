// server/api/settings.get.ts
import { defineEventHandler, createError, getCookie, setCookie } from 'h3';
import { PrismaClient } from '@prisma/client';
import { lucia } from '~/server/utils/auth';
// DEFAULT_GLOBAL_SETTINGS は backgroundColor を含まない FontSettings 型になっている想定
import { DEFAULT_GLOBAL_SETTINGS } from '~/constants';
// FontSettings 型をインポート (types/index.ts で定義されている場合)
import type { FontSettings, GlobalSettings } from '~/types';

// Prisma Client のインスタンスを作成
const prisma = new PrismaClient();

export default defineEventHandler(async (event): Promise<FontSettings> => {
  // 返り値の型を FontSettings に指定
  console.log('[API GET /api/settings] Request received.');

  // --- 1. 認証チェック ---
  const sessionId = getCookie(event, lucia.sessionCookieName);
  if (!sessionId) {
    console.log('[API GET /api/settings] No session cookie found.');
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
    console.log('[API GET /api/settings] Invalid session.');
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
    console.log('[API GET /api/settings] Session refreshed.');
  }

  const userId = session.userId;
  console.log(`[API GET /api/settings] Authenticated user: ${userId}`);

  // --- 2. データベースから設定データを取得 ---
  try {
    console.log(
      `[API GET /api/settings] Attempting to load settings for user ${userId}...`,
    );

    const settingRecord = await prisma.setting.findUnique({
      where: { userId: userId },
      select: { data: true, updatedAt: true },
    });

    console.log(
      '[API GET /api/settings] Raw result from Prisma:',
      settingRecord,
    );

    if (settingRecord && settingRecord.data) {
      console.log(
        `[API GET /api/settings] Found settings data (updated_at: ${settingRecord.updatedAt}) for user ${userId}.`,
      );

      try {
        // DBのJSON文字列をJSオブジェクトに変換 (型は一旦 GlobalSettings のまま受ける)
        const parsedSetting: GlobalSettings = JSON.parse(settingRecord.data);
        console.log(
          '[API GET /api/settings] Successfully parsed settings data.',
        );

        // backgroundColor を除外して返す ---
        const fontSettings: FontSettings = {
          fontFamily:
            parsedSetting.fontFamily || DEFAULT_GLOBAL_SETTINGS.fontFamily, // フォールバックを追加
          fontSize: parsedSetting.fontSize || DEFAULT_GLOBAL_SETTINGS.fontSize, // フォールバックを追加
        };
        return fontSettings;
      } catch (parseError: any) {
        console.error(
          `[API GET /api/settings] Error parsing settings data for user ${userId}:`,
          parseError,
        );
        console.error(
          '[API GET /api/settings] Faulty JSON string:',
          settingRecord.data,
        );
        console.warn(
          `[API GET /api/settings] Parsing failed, returning default settings for user ${userId}.`,
        );
        // デフォルト設定 (backgroundColor なし) を返す
        return DEFAULT_GLOBAL_SETTINGS;
      }
    } else {
      if (!settingRecord) {
        console.log(
          `[API GET /api/settings] No settings record found in DB for user ${userId}. Returning default settings.`,
        );
      } else {
        console.log(
          `[API GET /api/settings] Settings record found, but data is empty for user ${userId}. Returning default settings.`,
        );
      }
      // デフォルト設定 (backgroundColor なし) を返す
      return DEFAULT_GLOBAL_SETTINGS;
    }
  } catch (dbError: any) {
    console.error(
      `[API GET /api/settings] Database error fetching settings for user ${userId}:`,
      dbError,
    );
    throw createError({
      statusCode: 500,
      statusMessage:
        'Internal Server Error: Failed to load settings state from DB',
      message: dbError.message,
    });
  }
});
