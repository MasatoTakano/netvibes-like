// server/api/settings.get.ts
import { defineEventHandler, createError } from 'h3';
import { prisma } from '~/server/utils/prisma';
import { requireSession } from '~/server/utils/auth';
import { DEFAULT_GLOBAL_SETTINGS } from '~/constants';
import type { FontSettings, GlobalSettings } from '~/types';

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
        const parsedSetting: GlobalSettings = JSON.parse(settingRecord.data);
        const fontSettings: FontSettings = {
          fontFamily:
            parsedSetting.fontFamily || DEFAULT_GLOBAL_SETTINGS.fontFamily,
          fontSize:
            parsedSetting.fontSize || DEFAULT_GLOBAL_SETTINGS.fontSize,
        };
        return fontSettings;
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
