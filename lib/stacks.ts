import { getDb } from './db';

export interface Stack {
  id: string;
  name: string;
  rating: number;
  rank_order: number;
  created_at: string;
}

export interface StackSummary extends Stack {
  spot_count: number;
  first_spot: string | null;
  last_spot: string | null;
}

export interface StackVisitRow {
  visit_id: string;
  venue_name: string;
  triage: string;
  activity_type: string;
  rating: number;
  visited_at: string;
  position: number;
  photos: string[];
}

export interface StackDetail extends Stack {
  visits: StackVisitRow[];
}

export function createStack(name: string, visitIds: string[]): Stack {
  const db = getDb();
  const id = `stack_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();

  db.withTransactionSync(() => {
    db.runSync(
      `INSERT INTO stacks (id, name, rating, rank_order, created_at) VALUES (?, ?, 0, 0, ?)`,
      [id, name, now]
    );
    visitIds.forEach((visitId, position) => {
      db.runSync(
        `INSERT INTO stack_visits (stack_id, visit_id, position) VALUES (?, ?, ?)`,
        [id, visitId, position]
      );
    });
  });

  recomputeStackRatings();
  return getStackById(id)!;
}

export function getAllStacks(): StackSummary[] {
  const db = getDb();
  return db.getAllSync<StackSummary>(`
    SELECT
      s.id, s.name, s.rating, s.rank_order, s.created_at,
      COUNT(sv.visit_id) AS spot_count,
      MIN(CASE WHEN sv.position = 0 THEN v.venue_name END) AS first_spot,
      MAX(CASE WHEN sv.position = (
        SELECT MAX(position) FROM stack_visits WHERE stack_id = s.id
      ) THEN v.venue_name END) AS last_spot
    FROM stacks s
    LEFT JOIN stack_visits sv ON sv.stack_id = s.id
    LEFT JOIN visits v ON v.id = sv.visit_id
    GROUP BY s.id
    ORDER BY s.rank_order DESC, s.created_at DESC
  `);
}

export function getStackById(id: string): Stack | null {
  const db = getDb();
  return db.getFirstSync<Stack>(`SELECT * FROM stacks WHERE id = ?`, [id]) ?? null;
}

export function getStackDetail(id: string): StackDetail | null {
  const stack = getStackById(id);
  if (!stack) return null;
  const db = getDb();
  const rows = db.getAllSync<Omit<StackVisitRow, 'photos'> & { photos: string | null }>(`
    SELECT sv.visit_id, sv.position, v.venue_name, v.triage, v.activity_type, v.rating, v.visited_at, v.photos
    FROM stack_visits sv
    JOIN visits v ON v.id = sv.visit_id
    WHERE sv.stack_id = ?
    ORDER BY sv.position ASC
  `, [id]);
  const visits: StackVisitRow[] = rows.map(r => ({
    ...r,
    photos: r.photos ? JSON.parse(r.photos) : [],
  }));
  return { ...stack, visits };
}

export function getStacksForVisit(visitId: string): StackSummary[] {
  const db = getDb();
  return db.getAllSync<StackSummary>(`
    SELECT
      s.id, s.name, s.rating, s.rank_order, s.created_at,
      COUNT(sv2.visit_id) AS spot_count,
      MIN(CASE WHEN sv2.position = 0 THEN v2.venue_name END) AS first_spot,
      MAX(CASE WHEN sv2.position = (
        SELECT MAX(position) FROM stack_visits WHERE stack_id = s.id
      ) THEN v2.venue_name END) AS last_spot
    FROM stacks s
    JOIN stack_visits sv ON sv.stack_id = s.id AND sv.visit_id = ?
    LEFT JOIN stack_visits sv2 ON sv2.stack_id = s.id
    LEFT JOIN visits v2 ON v2.id = sv2.visit_id
    GROUP BY s.id
  `, [visitId]);
}

export function updateStack(id: string, name: string): void {
  const db = getDb();
  db.runSync(`UPDATE stacks SET name = ? WHERE id = ?`, [name, id]);
}

export function deleteStack(id: string): void {
  const db = getDb();
  db.runSync(`DELETE FROM stacks WHERE id = ?`, [id]);
}

export function addVisitToStack(stackId: string, visitId: string): void {
  const db = getDb();
  const maxPos = db.getFirstSync<{ maxPos: number | null }>(
    `SELECT MAX(position) AS maxPos FROM stack_visits WHERE stack_id = ?`,
    [stackId]
  );
  const nextPos = (maxPos?.maxPos ?? -1) + 1;
  db.runSync(
    `INSERT OR IGNORE INTO stack_visits (stack_id, visit_id, position) VALUES (?, ?, ?)`,
    [stackId, visitId, nextPos]
  );
  recomputeStackRatings();
}

export function removeVisitFromStack(stackId: string, visitId: string): void {
  const db = getDb();
  db.runSync(
    `DELETE FROM stack_visits WHERE stack_id = ? AND visit_id = ?`,
    [stackId, visitId]
  );
  const count = db.getFirstSync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM stack_visits WHERE stack_id = ?`,
    [stackId]
  );
  if ((count?.n ?? 0) < 2) {
    db.runSync(`DELETE FROM stacks WHERE id = ?`, [stackId]);
  } else {
    recomputeStackRatings();
  }
}

export function updateStackRankOrder(id: string, rank_order: number): void {
  const db = getDb();
  db.runSync(`UPDATE stacks SET rank_order = ? WHERE id = ?`, [rank_order, id]);
}

export function recomputeStackRatings(): void {
  const db = getDb();
  const stacks = db.getAllSync<{ id: string }>(`SELECT id FROM stacks`);
  for (const { id } of stacks) {
    const result = db.getFirstSync<{ avg_rating: number | null }>(
      `SELECT AVG(v.rating) AS avg_rating
       FROM stack_visits sv JOIN visits v ON v.id = sv.visit_id
       WHERE sv.stack_id = ?`,
      [id]
    );
    const rating = result?.avg_rating ?? 0;
    db.runSync(`UPDATE stacks SET rating = ? WHERE id = ?`, [Math.round(rating * 10) / 10, id]);
  }
}
