import * as SQLite from 'expo-sqlite';

const DB_NAME = 'datespot.db';

let _db: SQLite.SQLiteDatabase | null = null;

export function getDb(): SQLite.SQLiteDatabase {
  if (!_db) {
    _db = SQLite.openDatabaseSync(DB_NAME);
  }
  return _db;
}

export async function initDb(): Promise<void> {
  const db = getDb();

  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS visits (
      id          TEXT PRIMARY KEY,
      venue_name  TEXT NOT NULL,
      lat         REAL NOT NULL,
      lng         REAL NOT NULL,
      visited_at  TEXT NOT NULL,
      rating      INTEGER NOT NULL DEFAULT 0,
      rank_order  REAL NOT NULL DEFAULT 0,
      notes       TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}
