// server/api/settings.post.ts
import { defineEventHandler, createError, readBody } from 'h3';
import { z } from 'zod';
import { prisma } from '~/server/utils/prisma';
import { requireSession } from '~/server/utils/auth';

const fontSettingsSchema = z.object({
  fontFamily: z.string(),
  fontSize: z.number(),
});

export default defineEventHandler(async (event) => {
  const { userId } = await requireSession(event);

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
