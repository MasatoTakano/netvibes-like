// server/api/user.get.ts
import { defineEventHandler } from 'h3';
import { prisma } from '~/server/utils/prisma';
import { requireSession } from '~/server/utils/auth';

export default defineEventHandler(async (event) => {
  try {
    const { userId } = await requireSession(event);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    });
    return { user };
  } catch {
    // 未認証の場合は user: null を返す
    return { user: null };
  }
});
