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
  rating: Rating;
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
  db.runSync(
    `INSERT INTO visits (id, venue_name, lat, lng, visited_at, rating, rank_order, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [v.id, v.venue_name, v.lat, v.lng, v.visited_at, v.rating, v.rank_order, v.notes ?? null]
  );
}

export function getVisitsSortedByRank(): Visit[] {
  const db = getDb();
  return db.getAllSync<Visit>(
    'SELECT * FROM visits ORDER BY rank_order DESC'
  );
}

// Used by the comparison rating engine to recompute rank_order for all visits
// after inserting a new one at a given fractional index position.
export function updateRankOrder(id: string, rank_order: number): void {
  const db = getDb();
  db.runSync('UPDATE visits SET rank_order = ? WHERE id = ?', [rank_order, id]);
}

export function ratingColor(rating: Rating): string {
  switch (rating) {
    case 3: return '#34c759'; // green
    case 2: return '#ff9500'; // amber
    case 1: return '#ff3b30'; // red
  }
}
