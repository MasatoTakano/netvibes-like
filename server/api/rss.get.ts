// server/api/rss.get.ts
import { defineEventHandler, getQuery, H3Error } from 'h3';
import Parser from 'rss-parser'; // rss-parser をインポート

// rss-parser のインスタンスを作成
const parser = new Parser();

export default defineEventHandler(async (event) => {
  // クエリパラメータから 'url' を取得
  const query = getQuery(event);
  const feedUrl = query.url as string | undefined;

  // URLが提供されていない場合はエラー
  if (!feedUrl) {
    throw createError({
      statusCode: 400, // Bad Request
      statusMessage: 'Query parameter "url" is required.',
    });
  }

  console.log(`[API GET /api/rss] Received request for feed URL: ${feedUrl}`);

  try {
    // URLが有効か基本的なチェック (http/httpsで始まるか)
    if (!feedUrl.startsWith('http://') && !feedUrl.startsWith('https://')) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid feed URL protocol. Only http and https are allowed.',
      });
    }

    // rss-parser を使ってフィードをURLからパース
    // タイムアウトを設定するなど、より堅牢にすることも可能
    const feed = await parser.parseURL(feedUrl);

    console.log(`[API GET /api/rss] Successfully parsed feed: "${feed.title}" (${feed.items.length} items)`);

    // 必要なデータだけを抽出・整形して返すこともできるが、
    // まずはパース結果全体 (items を含む) を返す
    // (クライアント側で itemCount に基づいて表示件数を絞る想定)
    return {
      title: feed.title,
      link: feed.link,
      items: feed.items, // items 配列をそのまま返す
    };

  } catch (error: any) {
    console.error(`[API GET /api/rss] Error fetching or parsing feed URL "${feedUrl}":`, error);

    // エラーの種類に応じてステータスコードを調整
    let statusCode = 500; // Internal Server Error (default)
    let statusMessage = 'Failed to fetch or parse RSS feed.';

    if (error.message.includes('Status code')) {
        // HTTPエラーコードが含まれている場合 (例: 404 Not Found)
        const match = error.message.match(/Status code (\d+)/);
        if (match && match[1]) {
            const httpStatus = parseInt(match[1], 10);
            // 4xx系のエラーはクライアントエラーとして扱うこともできる
            if (httpStatus >= 400 && httpStatus < 500) {
                statusCode = httpStatus;
                statusMessage = `Failed to fetch feed: ${httpStatus}`;
            }
        }
    } else if (error instanceof H3Error) {
        // createError で生成されたエラーの場合
        statusCode = error.statusCode;
        statusMessage = error.statusMessage || statusMessage;
    } else if (error.code === 'ENOTFOUND' || error.message.includes('Invalid URL')) {
        // DNS解決エラーや無効なURL
        statusCode = 400; // Bad Request として扱う
        statusMessage = 'Invalid or unreachable feed URL.';
    }

    // createError でエラーをラップして返す
    throw createError({
      statusCode: statusCode,
      statusMessage: statusMessage,
      // エラーの詳細を message に含める (開発中は便利)
      // 本番環境では詳細をログに留め、クライアントには汎用メッセージを返すのが望ましい場合も
      message: error.message || 'An unexpected error occurred.',
    });
  }
});