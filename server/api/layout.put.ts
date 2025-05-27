// server/api/layout.put.ts
import { defineEventHandler, readBody } from 'h3';
import { getDb } from '~/server/utils/db';

export default defineEventHandler(async (event) => {
  try {
    // Read the request body (should contain the panesData array)
    const newState = await readBody(event);

    // Basic validation (ensure it's an array)
    if (!Array.isArray(newState)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid request body: Expected an array.',
      });
    }

    const db = getDb();
    const stateJson = JSON.stringify(newState);

    // Use INSERT OR REPLACE to either insert the first row or update the existing one
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO layout_state (id, state_json)
      VALUES (1, ?)
    `);
    const info = stmt.run(stateJson);

    console.log(`Layout state saved successfully. Changes: ${info.changes}`);
    return { success: true, message: 'Layout saved.' };

  } catch (error: any) {
    console.error('Error saving layout state:', error);
    // Throw an error that Nuxt can handle
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to save layout state',
      message: error.message,
    });
  }
});