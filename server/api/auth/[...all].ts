// server/api/auth/[...all].ts
// Better Auth の汎用ハンドラー。全 /api/auth/* ルートをキャッチする。
import { auth } from '~/server/utils/auth';

export default defineEventHandler((event) => {
  return auth.handler(toWebRequest(event));
});
