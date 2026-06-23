// server/api/user.get.ts
import { defineEventHandler } from 'h3';
import { auth } from '~/server/utils/auth';

export default defineEventHandler(async (event) => {
  try {
    const session = await auth.api.getSession({
      headers: event.node.req.headers as any,
    });

    if (!session) {
      return { user: null };
    }

    return {
      user: {
        userId: session.user.id,
        email: session.user.email,
        name: session.user.name,
      },
    };
  } catch {
    // 未認証の場合は user: null を返す
    return { user: null };
  }
});
