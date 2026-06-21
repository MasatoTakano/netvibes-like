// server/api/layout.post.ts
import { defineEventHandler, createError, readBody } from 'h3';
import { z } from 'zod';
import { prisma } from '~/server/utils/prisma';
import { requireSession } from '~/server/utils/auth';

// --- レイアウトデータのバリデーションスキーマ ---
// types/index.ts の PaneData / Widget 型に対応
const widgetSchema = z.discriminatedUnion('type', [
  z.object({
    id: z.string(),
    type: z.literal('note'),
    title: z.string().optional(),
    content: z.string(),
    fontFamily: z.string().nullable().optional(),
    fontSize: z.number().nullable().optional(),
    isCollapsed: z.boolean().optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal('rss'),
    feedUrl: z.string(),
    itemCount: z.number(),
    feedTitle: z.string().optional(),
    fontFamily: z.string().nullable().optional(),
    fontSize: z.number().nullable().optional(),
    updateIntervalMinutes: z.number().nullable().optional(),
    isCollapsed: z.boolean().optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal('calendar'),
    iframeTag: z.string(),
    isCollapsed: z.boolean().optional(),
  }),
]);

const paneSchema = z.object({
  id: z.string(),
  size: z.number(),
  widgets: z.array(widgetSchema),
});

const layoutSchema = z.array(paneSchema);

export default defineEventHandler(async (event) => {
  const { userId } = await requireSession(event);

  const rawBody = await readBody(event);

  // --- 入力値バリデーション (Zod) ---
  const parsed = layoutSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request: Invalid layout data format',
    });
  }
  const layoutDataFromClient = parsed.data;

  try {
    const layoutDataString = JSON.stringify(layoutDataFromClient);

    await prisma.layout.upsert({
      where: { userId },
      update: { data: layoutDataString },
      create: { userId, data: layoutDataString },
    });

    return { success: true };
  } catch (dbError: any) {
    if (dbError.statusCode) throw dbError;
    throw createError({
      statusCode: 500,
      statusMessage:
        'Internal Server Error: Failed to save layout state to DB',
    });
  }
});
