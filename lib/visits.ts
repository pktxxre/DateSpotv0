import { getDb } from './db';

export type Rating = number;
export type Price = 1 | 2 | 3; // $ $$ $$$
export type ActivityType =
  | 'food'
  | 'drinks'
  | 'outdoors'
  | 'view'
  | 'culture'
  | 'entertainment'
  | 'other';

export const ACTIVITY_TYPES: { value: ActivityType; label: string; emoji: string }[] = [
  { value: 'food', label: 'Food', emoji: '🍽' },
  { value: 'drinks', label: 'Drinks', emoji: '🍸' },
  { value: 'outdoors', label: 'Outdoors', emoji: '🌿' },
  { value: 'view', label: 'Pretty view', emoji: '🌅' },
  { value: 'culture', label: 'Culture', emoji: '🎭' },
  { value: 'entertainment', label: 'Entertainment', emoji: '🎬' },
  { value: 'other', label: 'Other', emoji: '✨' },
];

export const PRICE_LABELS: Record<Price, string> = { 1: '$', 2: '$$', 3: '$$$' };

export interface Visit {
  id: string;
  venue_name: string;
  lat: number;
  lng: number;
  visited_at: string;
  rating: Rating;
  rank_order: number;
  notes: string | null;
  activity_type: ActivityType;
  price: Price;
  created_at: string;
}

export interface NewVisit {
  id: string;
  venue_name: string;
  lat: number;
  lng: number;
  visited_at: string;
  rank_order: number;
  notes?: string;
  activity_type: ActivityType;
  price: Price;
}

export function getAllVisits(): Visit[] {
  const db = getDb();
  return db.getAllSync<Visit>(
    'SELECT * FROM visits ORDER BY rank_order DESC'
  );
}

export function getVisitsFiltered(opts: {
  query?: string;
  activityType?: ActivityType | null;
  price?: Price | null;
}): Visit[] {
  const db = getDb();
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (opts.query) {
    conditions.push(`(venue_name LIKE ? OR notes LIKE ?)`);
    params.push(`%${opts.query}%`, `%${opts.query}%`);
  }
  if (opts.activityType) {
    conditions.push(`activity_type = ?`);
    params.push(opts.activityType);
  }
  if (opts.price) {
    conditions.push(`price = ?`);
    params.push(opts.price);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return db.getAllSync<Visit>(
    `SELECT * FROM visits ${where} ORDER BY rank_order DESC`,
    params
  );
}

export function insertVisit(v: NewVisit): void {
  const db = getDb();
  db.runSync(
    `INSERT INTO visits (id, venue_name, lat, lng, visited_at, rating, rank_order, notes, activity_type, price)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
    [v.id, v.venue_name, v.lat, v.lng, v.visited_at, v.rank_order, v.notes ?? null, v.activity_type, v.price]
  );
  recomputeRatings();
}

export function recomputeRatings(): void {
  const db = getDb();
  const visits = db.getAllSync<{ id: string; rank_order: number }>(
    'SELECT id, rank_order FROM visits ORDER BY rank_order ASC'
  );
  if (visits.length === 0) return;

  const n = visits.length;
  visits.forEach((v, i) => {
    const pct = n === 1 ? 1 : i / (n - 1);
    const rating = Math.round(pct * 100) / 10; // 0.0–10.0, one decimal
    db.runSync('UPDATE visits SET rating = ? WHERE id = ?', [rating, v.id]);
  });
}

export function updateRankOrder(id: string, rank_order: number): void {
  const db = getDb();
  db.runSync('UPDATE visits SET rank_order = ? WHERE id = ?', [rank_order, id]);
}

export function ratingColor(rating: number): string {
  if (rating >= 7.0) return '#34c759';
  if (rating >= 4.0) return '#ff9500';
  return '#ff3b30';
}

export function formatRating(rating: number): string {
  return rating.toFixed(1);
}
