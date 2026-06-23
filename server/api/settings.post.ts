// server/api/settings.post.ts
import { defineEventHandler, createError, readBody } from 'h3';
import { z } from 'zod';
import { prisma } from '~/server/utils/prisma';
import { requireSession } from '~/server/utils/auth';

// --- フォント設定のバリデーションスキーマ ---
// fontFamily は CSS に渡されるため長さ上限を設け、fontSize は表示可能な範囲に制限する。
const fontSettingsSchema = z.object({
  fontFamily: z.string().min(1).max(100),
  fontSize: z.number().int().min(6).max(72),
});

export default defineEventHandler(async (event) => {
  const { user } = await requireSession(event);
  const userId = user.id;

  const rawBody = await readBody(event);

  const parsed = fontSettingsSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request: Invalid font settings data format',
    });
  }
  const fontSettingsData = parsed.data;

  try {
    const settingsDataString = JSON.stringify(fontSettingsData);
    await prisma.setting.upsert({
      where: { userId },
      update: { data: settingsDataString },
      create: { userId, data: settingsDataString },
    });
    return { success: true };
  } catch (dbError: any) {
    if (dbError.statusCode) throw dbError;
    throw createError({
      statusCode: 500,
      statusMessage:
        'Internal Server Error: Failed to save font settings state to DB',
    });
  }
});
