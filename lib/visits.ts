import { getDb } from './db';

export type Rating = number;
export type Price = 0 | 1 | 2 | 3; // Free $ $$ $$$
export type Triage = 'bad' | 'okay' | 'great';
export type DateType = 'first' | 'casual' | 'special' | 'friend' | 'solo' | 'so' | 'secret';
export type ActivityType =
  | 'food'
  | 'drinks'
  | 'outdoors'
  | 'view'
  | 'entertainment'
  | 'other';

export const ACTIVITY_TYPES: { value: ActivityType; label: string; emoji: string }[] = [
  { value: 'food', label: 'Food', emoji: '🍽' },
  { value: 'drinks', label: 'Drinks', emoji: '🍸' },
  { value: 'outdoors', label: 'Outdoors', emoji: '🌿' },
  { value: 'view', label: 'Pretty View', emoji: '🌅' },
  { value: 'entertainment', label: 'Entertainment', emoji: '🎬' },
  { value: 'other', label: 'Other', emoji: '✨' },
];

export const PRICE_LABELS: Record<Price, string> = { 0: 'Free', 1: '$', 2: '$$', 3: '$$$' };

export const DATE_TYPES: { value: DateType; label: string }[] = [
  { value: 'first',   label: 'First Date' },
  { value: 'casual',  label: 'Casual Date' },
  { value: 'special', label: 'Special Occasion' },
  { value: 'friend',  label: 'Friend Date' },
  { value: 'solo',    label: 'Solo Date' },
  { value: 'so',      label: 'With S/O' },
  { value: 'secret',  label: 'Secret' },
];

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
  triage: Triage;
  date_type: DateType | null;
  created_at: string;
  photos: string[];
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
  triage: Triage;
  date_type?: DateType;
  photos?: string[];
}

function parseRow(row: any): Visit {
  return {
    ...row,
    photos: row.photos ? JSON.parse(row.photos) : [],
  };
}

export function getAllVisits(): Visit[] {
  const db = getDb();
  const rows = db.getAllSync<any>('SELECT * FROM visits ORDER BY rating DESC');
  return rows.map(parseRow);
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
  const rows = db.getAllSync<any>(
    `SELECT * FROM visits ${where} ORDER BY rank_order DESC`,
    params
  );
  return rows.map(parseRow);
}

export function getVisitById(id: string): Visit | null {
  const db = getDb();
  const row = db.getFirstSync<any>('SELECT * FROM visits WHERE id = ?', [id]);
  return row ? parseRow(row) : null;
}

export function insertVisit(v: NewVisit): void {
  const db = getDb();
  db.runSync(
    `INSERT INTO visits (id, venue_name, lat, lng, visited_at, rating, rank_order, notes, activity_type, price, triage, date_type, photos)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)`,
    [v.id, v.venue_name, v.lat, v.lng, v.visited_at, v.rank_order, v.notes ?? null, v.activity_type, v.price, v.triage, v.date_type ?? null, JSON.stringify(v.photos ?? [])]
  );
  recomputeRatings();
}

export function deleteVisit(id: string): void {
  const db = getDb();
  db.runSync('DELETE FROM visits WHERE id = ?', [id]);
  recomputeRatings();
}

export function updateVisit(
  id: string,
  updates: Partial<Pick<Visit, 'venue_name' | 'notes' | 'visited_at' | 'activity_type' | 'price' | 'photos' | 'date_type'>>
): void {
  const db = getDb();
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.venue_name !== undefined) { fields.push('venue_name = ?'); values.push(updates.venue_name); }
  if (updates.notes !== undefined) { fields.push('notes = ?'); values.push(updates.notes ?? null); }
  if (updates.visited_at !== undefined) { fields.push('visited_at = ?'); values.push(updates.visited_at); }
  if (updates.activity_type !== undefined) { fields.push('activity_type = ?'); values.push(updates.activity_type); }
  if (updates.price !== undefined) { fields.push('price = ?'); values.push(updates.price); }
  if (updates.photos !== undefined) { fields.push('photos = ?'); values.push(JSON.stringify(updates.photos)); }
  if (updates.date_type !== undefined) { fields.push('date_type = ?'); values.push(updates.date_type ?? null); }

  if (fields.length === 0) return;
  values.push(id);
  db.runSync(`UPDATE visits SET ${fields.join(', ')} WHERE id = ?`, values);
}

export function recomputeRatings(): void {
  const db = getDb();
  const tiers: Array<{ triage: Triage; min: number; max: number }> = [
    { triage: 'great', min: 7.0, max: 10.0 },
    { triage: 'okay',  min: 4.0, max: 6.9  },
    { triage: 'bad',   min: 2.0, max: 3.9  },
  ];
  for (const { triage, min, max } of tiers) {
    const pool = db.getAllSync<{ id: string; rank_order: number }>(
      'SELECT id, rank_order FROM visits WHERE triage = ? ORDER BY rank_order ASC',
      [triage]
    );
    if (pool.length === 0) continue;
    const n = pool.length;
    pool.forEach((v, i) => {
      const pct = n === 1 ? 1 : i / (n - 1);
      const rating = Math.round((min + pct * (max - min)) * 10) / 10;
      db.runSync('UPDATE visits SET rating = ? WHERE id = ?', [rating, v.id]);
    });
  }
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

export function friendlyDate(raw: string): string {
  if (!raw) return '';
  if (!/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw;
  // Parse as local date to avoid UTC-offset "Today/Yesterday" errors in western timezones.
  const [year, month, day] = raw.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  if (isNaN(d.getTime())) return raw;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((todayStart.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return d.toLocaleDateString('en-US', { weekday: 'long' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
