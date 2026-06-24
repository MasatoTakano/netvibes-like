// server/api/settings.get.ts
import { defineEventHandler, createError } from 'h3';
import { z } from 'zod';
import { prisma } from '~/server/utils/prisma';
import { requireSession } from '~/server/utils/auth';
import { AVAILABLE_FONTS, DEFAULT_GLOBAL_SETTINGS } from '~/constants';
import type { FontSettings } from '~/types';

// --- 保存済み設定の read 時検証スキーマ（settings.post.ts と同一方針） ---
const fontSettingsSchema = z.object({
  fontFamily: z.enum(AVAILABLE_FONTS as [string, ...string[]]),
  fontSize: z.number().int().min(6).max(72),
});

export default defineEventHandler(async (event): Promise<FontSettings> => {
  const { user } = await requireSession(event);
  const userId = user.id;

  try {
    const settingRecord = await prisma.setting.findUnique({
      where: { userId },
      select: { data: true },
    });

    if (settingRecord?.data) {
      try {
        const raw = JSON.parse(settingRecord.data);
        const parsed = fontSettingsSchema.safeParse(raw);
        if (parsed.success) {
          return {
            fontFamily: parsed.data.fontFamily,
            fontSize: parsed.data.fontSize,
          };
        }
        return DEFAULT_GLOBAL_SETTINGS;
      } catch {
        return DEFAULT_GLOBAL_SETTINGS;
      }
    }

    return DEFAULT_GLOBAL_SETTINGS;
  } catch (error: any) {
    if (error.statusCode) throw error;
    throw createError({
      statusCode: 500,
      statusMessage:
        'Internal Server Error: Failed to load settings state from DB',
    });
  }
});
