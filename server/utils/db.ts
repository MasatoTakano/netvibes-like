// server/utils/db.ts
import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import type { PaneData, GlobalSettings } from '~/types';
import { DEFAULT_GLOBAL_SETTINGS } from '~/constants';

// デフォルト設定値
const defaultGlobalSettings: GlobalSettings = {
  ...DEFAULT_GLOBAL_SETTINGS,
};

// Define the path for the database file within the project structure
// Using `.data/` directory which is often used for persistent storage
const dbDir = path.join(process.cwd(), '.data');
const dbPath = path.join(dbDir, 'layout.sqlite');

// Ensure the database directory exists
fs.mkdirSync(dbDir, { recursive: true });

let db: Database.Database;

export function getDb() {
  if (!db) {
    console.log(`Connecting to database at: ${dbPath}`);
    db = new Database(dbPath, {
      /* verbose: console.log */
    }); // Enable verbose for debugging if needed
    // Enable WAL mode for better concurrency (optional but recommended)
    db.pragma('journal_mode = WAL');
    initializeDbSchema(db);
    initializeGlobalSettingsSchema(db);
  }
  return db;
}

function initializeDbSchema(dbInstance: Database.Database) {
  const createTableStmt = dbInstance.prepare(`
      CREATE TABLE IF NOT EXISTS layout_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        state_json TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  createTableStmt.run();

  const createTriggerStmt = dbInstance.prepare(`
      CREATE TRIGGER IF NOT EXISTS update_layout_state_updated_at
      AFTER UPDATE ON layout_state FOR EACH ROW
      BEGIN
          UPDATE layout_state SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;
    `);
  createTriggerStmt.run();

  // Check if the initial row exists
  const checkRowStmt = dbInstance.prepare(
    'SELECT id FROM layout_state WHERE id = 1',
  );
  const rowExists = checkRowStmt.get();

  // If the row doesn't exist, insert an empty state (or a default state)
  if (!rowExists) {
    const insertStmt = dbInstance.prepare(`
        INSERT INTO layout_state (id, state_json) VALUES (1, ?)
        ON CONFLICT(id) DO NOTHING
      `);
    // Insert an empty array as the initial state JSON, or use default data if preferred
    insertStmt.run(JSON.stringify([]));
    console.log('Initialized layout_state row with id=1.');
  }

  console.log('Database schema initialized.');
}

// 全体設定スキーマ初期化関数
function initializeGlobalSettingsSchema(dbInstance: Database.Database) {
  // 全体設定を JSON で保存するテーブル (ID=1 の単一行)
  const createTableStmt = dbInstance.prepare(`
    CREATE TABLE IF NOT EXISTS global_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      settings_json TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  createTableStmt.run();

  // 更新日時トリガー (任意)
  const createTriggerStmt = dbInstance.prepare(`
    CREATE TRIGGER IF NOT EXISTS update_global_settings_updated_at
    AFTER UPDATE ON global_settings FOR EACH ROW
    BEGIN
        UPDATE global_settings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;
  `);
  createTriggerStmt.run();

  // ID=1 の行が存在しない場合にデフォルト設定を挿入
  const checkRowStmt = dbInstance.prepare(
    'SELECT id FROM global_settings WHERE id = 1',
  );
  const rowExists = checkRowStmt.get();
  if (!rowExists) {
    const insertStmt = dbInstance.prepare(`
      INSERT INTO global_settings (id, settings_json) VALUES (1, ?)
      ON CONFLICT(id) DO NOTHING
    `);
    insertStmt.run(JSON.stringify(defaultGlobalSettings)); // ★ デフォルト設定を使う
    console.log(
      'Initialized global_settings row with id=1 and default settings.',
    );
  }

  console.log('Global settings Database schema initialized.');
}

// レイアウト状態を保存する関数
export function saveLayoutState(state: PaneData[]): void {
  const dbInstance = getDb();
  try {
    const stateJson = JSON.stringify(state);
    // Use INSERT OR REPLACE to handle both initial insertion and updates
    // Or use UPDATE since we ensure the row exists during initialization
    const stmt = dbInstance.prepare(`
        UPDATE layout_state
        SET state_json = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
      `);
    const info = stmt.run(stateJson);
    if (info.changes > 0) {
      console.log('Layout state saved to DB.');
    } else {
      // This might happen if the row id=1 was somehow deleted after init.
      // Optionally, try inserting again.
      console.warn('Layout state update affected 0 rows. Attempting insert...');
      const insertStmt = dbInstance.prepare(`
            INSERT INTO layout_state (id, state_json) VALUES (1, ?)
            ON CONFLICT(id) DO UPDATE SET state_json = excluded.state_json, updated_at = CURRENT_TIMESTAMP
          `);
      insertStmt.run(stateJson);
      console.log('Layout state inserted/updated via fallback.');
    }
  } catch (error: any) {
    console.error('Error saving layout state:', error);
    // エラーを再スローするか、アプリケーションに応じて処理
    throw new Error(`Failed to save layout state: ${error.message}`);
  }
}

// 全体設定を読み込む関数を追加
export function loadGlobalSettings(): GlobalSettings {
  const dbInstance = getDb();
  try {
    const stmt = dbInstance.prepare(
      'SELECT settings_json FROM global_settings WHERE id = 1',
    );
    const result = stmt.get() as { settings_json: string } | undefined;

    if (result?.settings_json) {
      console.log('Global settings loaded from DB.');
      // JSON をパースして返す。失敗したらデフォルトを返す
      try {
        const parsedSettings = JSON.parse(result.settings_json);
        // デフォルト設定とマージして、不足しているキーがあれば補完する
        return { ...defaultGlobalSettings, ...parsedSettings };
      } catch (parseError) {
        console.error(
          'Error parsing global settings JSON from DB, returning default.',
          parseError,
        );
        return defaultGlobalSettings;
      }
    } else {
      console.log('No global settings found in DB, returning default.');
      return defaultGlobalSettings; // DBにデータがなければデフォルトを返す
    }
  } catch (error) {
    console.error('Error loading global settings:', error);
    return defaultGlobalSettings; // エラー時もデフォルトを返す
  }
}

// 全体設定を保存する関数
export function saveGlobalSettings(settings: GlobalSettings): void {
  const dbInstance = getDb();
  try {
    const settingsJson = JSON.stringify(settings);
    // ID=1 の行を更新 (initialize で行は保証されているはず)
    const stmt = dbInstance.prepare(`
      UPDATE global_settings
      SET settings_json = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `);
    const info = stmt.run(settingsJson);
    if (info.changes > 0) {
      console.log('Global settings saved to DB.');
    } else {
      // 念のため、更新できなかった場合のフォールバック (INSERT OR REPLACE)
      console.warn(
        'Global settings update affected 0 rows. Attempting insert/replace...',
      );
      const upsertStmt = dbInstance.prepare(`
            INSERT INTO global_settings (id, settings_json) VALUES (1, ?)n
            ON CONFLICT(id) DO UPDATE SET settings_json = excluded.settings_json, updated_at = CURRENT_TIMESTAMP
        `);
      upsertStmt.run(settingsJson);
      console.log('Global settings upserted via fallback.');
    }
  } catch (error: any) {
    console.error('Error saving global settings:', error);
    throw new Error(`Failed to save global settings: ${error.message}`);
  }
}
// Optional: Graceful shutdown handling
// In a real application, you might want to close the DB connection on app shutdown
// process.on('exit', () => db?.close());
// process.on('SIGINT', () => db?.close());
// process.on('SIGTERM', () => db?.close());

// レイアウト状態を読み込む関数
export function loadLayoutState(): PaneData[] {
  const dbInstance = getDb();
  try {
    const stmt = dbInstance.prepare(
      'SELECT state_json FROM layout_state WHERE id = 1',
    );
    const result = stmt.get() as { state_json: string } | undefined;

    if (result?.state_json) {
      console.log('Layout state loaded from DB.');
      // JSON をパースして返す。失敗したら空の配列を返す
      try {
        return JSON.parse(result.state_json);
      } catch (parseError) {
        console.error(
          'Error parsing layout state JSON from DB, returning empty array.',
          parseError,
        );
        return [];
      }
    } else {
      console.log('No layout state found in DB, returning empty array.');
      return []; // DBにデータがなければ空の配列を返す
    }
  } catch (error) {
    console.error('Error loading layout state:', error);
    return []; // エラー時も空の配列を返す
  }
}
