// server/api/layout.get.ts
import { defineEventHandler, createError } from 'h3';
import { prisma } from '~/server/utils/prisma';
import { requireSession } from '~/server/utils/auth';
import { defaultLayoutData } from '~/constants';

export default defineEventHandler(async (event) => {
  const { user } = await requireSession(event);
  const userId = user.id;

  try {
    const layoutRecord = await prisma.layout.findUnique({
      where: { userId },
      select: { data: true },
    });

    if (layoutRecord?.data) {
      try {
        return JSON.parse(layoutRecord.data);
      } catch {
        throw createError({
          statusCode: 500,
          statusMessage:
            'Internal Server Error: Failed to parse layout data from DB',
        });
      }
    }

    return defaultLayoutData;
  } catch (error: any) {
    if (error.statusCode) throw error;
    throw createError({
      statusCode: 500,
      statusMessage:
        'Internal Server Error: Failed to load layout state from DB',
    });
  }
});
