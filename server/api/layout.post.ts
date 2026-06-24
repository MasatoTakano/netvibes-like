// server/api/layout.post.ts
import { defineEventHandler, createError, readBody } from 'h3';
import { z } from 'zod';
import { prisma } from '~/server/utils/prisma';
import { requireSession } from '~/server/utils/auth';
import { validateCalendarIframeTag } from '~/server/utils/calendar';
import { AVAILABLE_FONTS } from '~/constants';
import { MAX_CALENDAR_IFRAME_TAG_LENGTH } from '~/utils/calendarHosts';

// --- バリデーション制限値 ---
const LIMITS = {
  MAX_ID_LENGTH: 100,
  MAX_TITLE_LENGTH: 200,
  MAX_CONTENT_LENGTH: 100_000, // 100KB
  MAX_DESCRIPTION_LENGTH: 1000,
  MAX_FEED_TITLE_LENGTH: 200,
  MAX_URL_LENGTH: 2000,
  MAX_PANES: 10,
  MAX_WIDGETS_PER_PANE: 20,
  MAX_BOOKMARKS_PER_WIDGET: 200,
} as const;

// --- 共通スキーマ部品 ---
const idSchema = z.string().max(LIMITS.MAX_ID_LENGTH);
const titleSchema = z.string().max(LIMITS.MAX_TITLE_LENGTH).optional();

// fontFamily は AVAILABLE_FONTS の allowlist に限定 (null = グローバル設定を使用)
const fontSchema = z
  .enum(AVAILABLE_FONTS as [string, ...string[]])
  .nullable()
  .optional();

// fontSize は settings.post.ts と同じ範囲 (6px〜72px)
const fontSizeSchema = z.number().int().min(6).max(72).nullable().optional();

const isCollapsedSchema = z.boolean().optional();

// URL は http: / https: のみ許可 (javascript: 等の危険スキームを拒否)
const httpUrlSchema = z.string().max(LIMITS.MAX_URL_LENGTH).refine(
  (val) => {
    try {
      const u = new URL(val);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  },
  { message: 'URL must use http: or https: scheme' },
);

// --- レイアウトデータのバリデーションスキーマ ---
// types/index.ts の PaneData / Widget 型に対応
const widgetSchema = z.discriminatedUnion('type', [
  z.object({
    id: idSchema,
    type: z.literal('note'),
    title: titleSchema,
    content: z.string().max(LIMITS.MAX_CONTENT_LENGTH),
    fontFamily: fontSchema,
    fontSize: fontSizeSchema,
    isCollapsed: isCollapsedSchema,
  }),
  z.object({
    id: idSchema,
    type: z.literal('rss'),
    feedUrl: httpUrlSchema,
    itemCount: z.number().int().min(1).max(50),
    feedTitle: z.string().max(LIMITS.MAX_FEED_TITLE_LENGTH).optional(),
    fontFamily: fontSchema,
    fontSize: fontSizeSchema,
    updateIntervalMinutes: z
      .number()
      .int()
      .min(1)
      .max(1440)
      .nullable()
      .optional(),
    isCollapsed: isCollapsedSchema,
  }),
  z.object({
    id: idSchema,
    type: z.literal('calendar'),
    iframeTag: z.string().max(MAX_CALENDAR_IFRAME_TAG_LENGTH),
    isCollapsed: isCollapsedSchema,
  }),
  z.object({
    id: idSchema,
    type: z.literal('bookmark'),
    title: titleSchema,
    bookmarks: z
      .array(
        z.object({
          id: idSchema,
          title: z.string().max(LIMITS.MAX_TITLE_LENGTH),
          description: z
            .string()
            .max(LIMITS.MAX_DESCRIPTION_LENGTH)
            .optional(),
          url: httpUrlSchema,
        }),
      )
      .max(LIMITS.MAX_BOOKMARKS_PER_WIDGET),
    fontFamily: fontSchema,
    fontSize: fontSizeSchema,
    columns: z.number().int().min(1).max(4).nullable().optional(),
    isCollapsed: isCollapsedSchema,
  }),
]);

const paneSchema = z.object({
  id: idSchema,
  size: z.number().min(0).max(100),
  widgets: z.array(widgetSchema).max(LIMITS.MAX_WIDGETS_PER_PANE),
});

// 多層防御: カレンダーウィジェットの iframeTag をサーバー側で検証する。
// ※ discriminatedUnion の各要素に refine を付けると ZodEffects 化して
//    差別化型の要件を満たさなくなるため、全体に superRefine で検証する。
const layoutSchema = z.array(paneSchema).max(LIMITS.MAX_PANES).superRefine((panes, ctx) => {
  panes.forEach((pane, paneIdx) => {
    pane.widgets.forEach((widget, widgetIdx) => {
      if (widget.type === 'calendar') {
        const result = validateCalendarIframeTag(widget.iframeTag);
        if (!result.ok) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: result.reason,
            path: [paneIdx, 'widgets', widgetIdx, 'iframeTag'],
          });
        }
      }
    });
  });
});

export default defineEventHandler(async (event) => {
  const { user } = await requireSession(event);
  const userId = user.id;

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
