// server/plugins/envCheck.ts
// サーバー起動時に Better Auth 環境変数を検証する。
// production で必須要件を満たさない場合はプロセスを停止する (fail-fast)。

import { validateAuthEnv } from '~/server/utils/envValidation';

export default defineNitroPlugin(() => {
  const result = validateAuthEnv(process.env);

  for (const warning of result.warnings) {
    console.warn(`[env] ${warning}`);
  }

  if (!result.ok) {
    for (const error of result.errors) {
      console.error(`[env] FATAL: ${error}`);
    }
    console.error('[env] Aborting startup due to invalid environment configuration.');
    process.exit(1);
  }
});
