// server/utils/email.ts
// メール送信基盤 (Resend)
// 開発環境で RESEND_API_KEY 未設定の場合はコンソールに出力して送信をスキップする。

import { Resend } from 'resend';

let resendClient: Resend | null = null;

/**
 * Resend クライアントを取得（シングルトン）。
 * RESEND_API_KEY が未設定の場合は null を返す（開発環境のフォールバック）。
 */
function getResendClient(): Resend | null {
  if (resendClient) return resendClient;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;

  resendClient = new Resend(apiKey);
  return resendClient;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * メールを送信する。
 *
 * - 本番環境 + RESEND_API_KEY 未設定 → エラーを投げる
 * - 開発環境 + RESEND_API_KEY 未設定 → コンソールに内容を出力し、送信をスキップ
 * - RESEND_API_KEY 設定済み → Resend 経由で送信
 */
export async function sendEmail({ to, subject, html, text }: SendEmailParams): Promise<void> {
  const from = process.env.EMAIL_FROM || 'onboarding@resend.dev';

  const client = getResendClient();
  if (!client) {
    // 開発フォールバック: コンソールに出力
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'RESEND_API_KEY is not set. Email cannot be sent in production.',
      );
    }
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[DEV EMAIL] (not actually sent — RESEND_API_KEY not set)');
    console.log(`  To:      ${to}`);
    console.log(`  From:    ${from}`);
    console.log(`  Subject: ${subject}`);
    console.log('  ---');
    console.log(`  ${text.replace(/\n/g, '\n  ')}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    return;
  }

  const { error } = await client.emails.send({
    from,
    to,
    subject,
    html,
    text,
  });

  if (error) {
    throw new Error(`Failed to send email: ${error.message}`);
  }
}
