// server/api/logout.post.ts
import { defineEventHandler, setCookie } from 'h3';
import { lucia, requireSession } from '~/server/utils/auth';

export default defineEventHandler(async (event) => {
  const { session } = await requireSession(event);

  await lucia.invalidateSession(session.id);

  const sessionCookie = lucia.createBlankSessionCookie();
  setCookie(
    event,
    sessionCookie.name,
    sessionCookie.value,
    sessionCookie.attributes,
  );

  return { success: true };
});
