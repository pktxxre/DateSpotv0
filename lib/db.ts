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
      id            TEXT PRIMARY KEY,
      venue_name    TEXT NOT NULL,
      lat           REAL NOT NULL,
      lng           REAL NOT NULL,
      visited_at    TEXT NOT NULL,
      rating        INTEGER NOT NULL DEFAULT 0,
      rank_order    REAL NOT NULL DEFAULT 0,
      notes         TEXT,
      activity_type TEXT NOT NULL DEFAULT 'other',
      price         INTEGER NOT NULL DEFAULT 2,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS future_spots (
      id         TEXT PRIMARY KEY,
      venue_name TEXT NOT NULL,
      lat        REAL NOT NULL,
      lng        REAL NOT NULL,
      notes      TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS stacks (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      rating     REAL NOT NULL DEFAULT 0,
      rank_order REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS stack_visits (
      stack_id   TEXT NOT NULL REFERENCES stacks(id) ON DELETE CASCADE,
      visit_id   TEXT NOT NULL REFERENCES visits(id),
      position   INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (stack_id, visit_id)
    );
  `);

  // Migrate stacks table
  const stackCols = db.getAllSync<{ name: string }>(
    `PRAGMA table_info(stacks)`
  ).map((r) => r.name);

  if (!stackCols.includes('tier')) {
    db.runSync(`ALTER TABLE stacks ADD COLUMN tier TEXT`);
  }
  if (!stackCols.includes('tier_note')) {
    db.runSync(`ALTER TABLE stacks ADD COLUMN tier_note TEXT`);
  }

  // Migrate existing installs that are missing columns
  const cols = db.getAllSync<{ name: string }>(
    `PRAGMA table_info(visits)`
  ).map((r) => r.name);

  if (!cols.includes('activity_type')) {
    db.runSync(`ALTER TABLE visits ADD COLUMN activity_type TEXT NOT NULL DEFAULT 'other'`);
  }
  if (!cols.includes('price')) {
    db.runSync(`ALTER TABLE visits ADD COLUMN price INTEGER NOT NULL DEFAULT 2`);
  }
  if (!cols.includes('photos')) {
    db.runSync(`ALTER TABLE visits ADD COLUMN photos TEXT`);
  }
  if (!cols.includes('triage')) {
    db.runSync(`ALTER TABLE visits ADD COLUMN triage TEXT NOT NULL DEFAULT 'okay'`);
  }
  if (!cols.includes('date_type')) {
    db.runSync(`ALTER TABLE visits ADD COLUMN date_type TEXT`);
  }
  if (!cols.includes('is_seed')) {
    db.runSync(`ALTER TABLE visits ADD COLUMN is_seed INTEGER NOT NULL DEFAULT 0`);
  }
  if (!cols.includes('canonical_place_id')) {
    db.runSync(`ALTER TABLE visits ADD COLUMN canonical_place_id TEXT`);
  }
  if (!cols.includes('canonical_name')) {
    db.runSync(`ALTER TABLE visits ADD COLUMN canonical_name TEXT`);
  }
  if (!cols.includes('canonical_lat')) {
    db.runSync(`ALTER TABLE visits ADD COLUMN canonical_lat REAL`);
  }
  if (!cols.includes('canonical_lng')) {
    db.runSync(`ALTER TABLE visits ADD COLUMN canonical_lng REAL`);
  }
  if (!cols.includes('resolution_status')) {
    db.runSync(`ALTER TABLE visits ADD COLUMN resolution_status TEXT NOT NULL DEFAULT 'pending'`);
  }
  if (!cols.includes('address')) {
    db.runSync(`ALTER TABLE visits ADD COLUMN address TEXT`);
  }

  // Migrate future_spots canonical columns
  const futureColNames = db.getAllSync<{ name: string }>(
    `PRAGMA table_info(future_spots)`
  ).map((r) => r.name);

  if (!futureColNames.includes('canonical_place_id')) {
    db.runSync(`ALTER TABLE future_spots ADD COLUMN canonical_place_id TEXT`);
  }
  if (!futureColNames.includes('canonical_name')) {
    db.runSync(`ALTER TABLE future_spots ADD COLUMN canonical_name TEXT`);
  }
  if (!futureColNames.includes('canonical_lat')) {
    db.runSync(`ALTER TABLE future_spots ADD COLUMN canonical_lat REAL`);
  }
  if (!futureColNames.includes('canonical_lng')) {
    db.runSync(`ALTER TABLE future_spots ADD COLUMN canonical_lng REAL`);
  }
  if (!futureColNames.includes('resolution_status')) {
    db.runSync(`ALTER TABLE future_spots ADD COLUMN resolution_status TEXT NOT NULL DEFAULT 'pending'`);
  }
}

export async function clearUserData(): Promise<void> {
  const db = getDb();
  await db.execAsync(`
    DELETE FROM stack_visits;
    DELETE FROM stacks;
    DELETE FROM visits;
    DELETE FROM future_spots;
  `);
}
