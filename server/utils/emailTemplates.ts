// server/utils/emailTemplates.ts
// メール確認・パスワードリセット用のメールテンプレート

/**
 * メール確認メールの HTML とテキスト本文を生成する。
 * @param url  確認リンクURL (Better Auth から渡される)
 */
export function emailVerificationTemplate(url: string): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = 'メールアドレスの確認 — Netvibesもどき';
  const text = [
    'Netvibesもどきをご利用いただきありがとうございます。',
    '',
    'メールアドレスの確認を完了するには、以下のリンクをクリックしてください：',
    '',
    url,
    '',
    'このリンクは1時間で有効期限が切れます。',
    '',
    'このメールに心当たりがない場合は、このメールを破棄してください。',
  ].join('\n');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #333;">Netvibesもどき — メールアドレスの確認</h2>
      <p>Netvibesもどきをご利用いただきありがとうございます。</p>
      <p>メールアドレスの確認を完了するには、以下のボタンをクリックしてください：</p>
      <p style="text-align: center; margin: 32px 0;">
        <a href="${url}"
           style="display: inline-block; background-color: #007bff; color: #fff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-size: 16px;">
          メールアドレスを確認
        </a>
      </p>
      <p style="color: #666; font-size: 14px;">
        ボタンが機能しない場合は、以下のURLを直接ブラウザに貼り付けてください：<br>
        <a href="${url}" style="word-break: break-all;">${url}</a>
      </p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
      <p style="color: #999; font-size: 12px;">
        このリンクは1時間で有効期限が切れます。<br>
        このメールに心当たりがない場合は、破棄してください。
      </p>
    </div>
  `;

  return { subject, html, text };
}

/**
 * パスワードリセットメールの HTML とテキスト本文を生成する。
 * @param url  リセットリンクURL (Better Auth から渡される)
 */
export function passwordResetTemplate(url: string): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = 'パスワードリセット — Netvibesもどき';
  const text = [
    'パスワードリセットのリクエストを受け付けました。',
    '',
    '新しいパスワードを設定するには、以下のリンクをクリックしてください：',
    '',
    url,
    '',
    'このリンクは1時間で有効期限が切れます。',
    '',
    'パスワードリセットをリクエストしていない場合は、このメールを無視してください。',
  ].join('\n');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #333;">Netvibesもどき — パスワードリセット</h2>
      <p>パスワードリセットのリクエストを受け付けました。</p>
      <p>新しいパスワードを設定するには、以下のボタンをクリックしてください：</p>
      <p style="text-align: center; margin: 32px 0;">
        <a href="${url}"
           style="display: inline-block; background-color: #007bff; color: #fff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-size: 16px;">
          パスワードをリセット
        </a>
      </p>
      <p style="color: #666; font-size: 14px;">
        ボタンが機能しない場合は、以下のURLを直接ブラウザに貼り付けてください：<br>
        <a href="${url}" style="word-break: break-all;">${url}</a>
      </p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
      <p style="color: #999; font-size: 12px;">
        このリンクは1時間で有効期限が切れます。<br>
        パスワードリセットをリクエストしていない場合は、このメールを無視してください。
      </p>
    </div>
  `;

  return { subject, html, text };
}
