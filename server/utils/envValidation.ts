// server/utils/envValidation.ts
// Better Auth 関連環境変数の fail-fast 検証。
// production では必須要件を満たさない場合、起動時にプロセスを停止する。

export interface EnvValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

/** BETTER_AUTH_SECRET の最小長（バイト）。32 bytes = 64 hex chars 相当 */
const MIN_SECRET_LENGTH = 32;

/**
 * Better Auth 関連環境変数を検証する。
 *
 * production:
 *   - BETTER_AUTH_SECRET が必須・32文字以上
 *   - BETTER_AUTH_URL が https:// 必須
 *
 * development:
 *   - BETTER_AUTH_SECRET 未設定は警告のみ（起動は継続）
 *   - BETTER_AUTH_URL の https は強要しない
 */
export function validateAuthEnv(env: NodeJS.ProcessEnv): EnvValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const isProduction = env.NODE_ENV === 'production';

  const secret = env.BETTER_AUTH_SECRET ?? '';
  const baseURL = env.BETTER_AUTH_URL ?? '';
  const secretTrimmed = secret.trim();

  // --- BETTER_AUTH_SECRET ---
  if (secretTrimmed === '') {
    if (isProduction) {
      errors.push(
        'BETTER_AUTH_SECRET is required in production. Generate one with: openssl rand -hex 32',
      );
    } else {
      warnings.push(
        'BETTER_AUTH_SECRET is not set. Sessions are insecure. Generate one with: openssl rand -hex 32',
      );
    }
  } else if (secretTrimmed.length < MIN_SECRET_LENGTH) {
    if (isProduction) {
      errors.push(
        `BETTER_AUTH_SECRET must be at least ${MIN_SECRET_LENGTH} characters long (got ${secretTrimmed.length}). Use: openssl rand -hex 32`,
      );
    } else {
      warnings.push(
        `BETTER_AUTH_SECRET is shorter than ${MIN_SECRET_LENGTH} characters. Use: openssl rand -hex 32`,
      );
    }
  }

  // --- BETTER_AUTH_URL ---
  if (baseURL === '') {
    if (isProduction) {
      errors.push('BETTER_AUTH_URL is required in production.');
    } else {
      warnings.push('BETTER_AUTH_URL is not set. Defaulting to http://localhost:3000');
    }
  } else if (isProduction && !baseURL.startsWith('https://')) {
    errors.push(
      `BETTER_AUTH_URL must use https:// in production (got "${baseURL}").`,
    );
  }

  return { ok: errors.length === 0, errors, warnings };
}
