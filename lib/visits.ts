import { getDb } from './db';

export type Rating = 1 | 2 | 3; // 1=bad, 2=ok, 3=great

export interface Visit {
  id: string;
  venue_name: string;
  lat: number;
  lng: number;
  visited_at: string;
  rating: Rating;
  rank_order: number;
  notes: string | null;
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
}

export function getAllVisits(): Visit[] {
  const db = getDb();
  return db.getAllSync<Visit>(
    'SELECT * FROM visits ORDER BY rank_order DESC'
  );
}

export function insertVisit(v: NewVisit): void {
  const db = getDb();
  // Insert with placeholder rating; recomputeRatings sets the real value
  db.runSync(
    `INSERT INTO visits (id, venue_name, lat, lng, visited_at, rating, rank_order, notes)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
    [v.id, v.venue_name, v.lat, v.lng, v.visited_at, v.rank_order, v.notes ?? null]
  );
  recomputeRatings();
}

// Recompute 1/2/3 ratings for every visit based on rank_order percentile.
// Bottom third → 1, middle → 2, top third → 3.
// Called after every insert so pin colors stay accurate as the list grows.
export function recomputeRatings(): void {
  const db = getDb();
  const visits = db.getAllSync<{ id: string; rank_order: number }>(
    'SELECT id, rank_order FROM visits ORDER BY rank_order ASC'
  );
  if (visits.length === 0) return;

  const n = visits.length;
  visits.forEach((v, i) => {
    const pct = n === 1 ? 1 : i / (n - 1);
    const rating: Rating = pct >= 0.67 ? 3 : pct >= 0.34 ? 2 : 1;
    db.runSync('UPDATE visits SET rating = ? WHERE id = ?', [rating, v.id]);
  });
}

export function updateRankOrder(id: string, rank_order: number): void {
  const db = getDb();
  db.runSync('UPDATE visits SET rank_order = ? WHERE id = ?', [rank_order, id]);
}

export function ratingColor(rating: Rating): string {
  switch (rating) {
    case 3: return '#34c759';
    case 2: return '#ff9500';
    case 1: return '#ff3b30';
  }
}
