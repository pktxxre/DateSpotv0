import { supabase } from './supabase';
import { ActivityType, Price } from './visits';

export type SeedSpot = {
  id: string;
  user_id: string;
  venue_name: string;
  lat: number;
  lng: number;
  activity_type: ActivityType;
  price: Price;
  rating: number;
  rank_order: number;
  notes: string | null;
  triage: string;
  is_seed: boolean;
  visited_at: string;
  created_at: string;
};

function deduplicateByVenue(spots: SeedSpot[]): SeedSpot[] {
  const groups = new Map<string, SeedSpot[]>();
  for (const spot of spots) {
    const key = spot.venue_name.trim().toLowerCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(spot);
  }

  const merged = Array.from(groups.values()).map(group => {
    if (group.length === 1) return group[0];
    // Canonical row = highest-rated entry (its id, notes, activity_type stay)
    const sorted = [...group].sort((a, b) => b.rating - a.rating);
    const best = sorted[0];
    const avgRating = Math.round(
      (group.reduce((s, g) => s + g.rating, 0) / group.length) * 10
    ) / 10;
    const triage = avgRating >= 7.0 ? 'great' : avgRating >= 4.0 ? 'okay' : 'bad';
    return {
      ...best,
      lat: group.reduce((s, g) => s + g.lat, 0) / group.length,
      lng: group.reduce((s, g) => s + g.lng, 0) / group.length,
      rating: avgRating,
      rank_order: Math.max(...group.map(g => g.rank_order)),
      triage,
    };
  });

  return merged.sort((a, b) => b.rank_order - a.rank_order);
}

export async function getSeedSpots(): Promise<SeedSpot[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('visits')
    .select('*')
    .eq('is_seed', true)
    .order('rank_order', { ascending: false });
  if (error) {
    console.error('getSeedSpots error:', error.message);
    return [];
  }
  return deduplicateByVenue((data ?? []) as SeedSpot[]);
}

export async function getSeedSpotById(id: string): Promise<SeedSpot | null> {
  if (!supabase) return null;
  // Fetch the canonical row first to get the venue_name
  const { data: row, error } = await supabase
    .from('visits')
    .select('*')
    .eq('id', id)
    .eq('is_seed', true)
    .single();
  if (error || !row) return null;

  // Fetch all seed rows for this venue and return the averaged spot
  const { data: siblings } = await supabase
    .from('visits')
    .select('*')
    .eq('is_seed', true)
    .ilike('venue_name', row.venue_name);

  const group = ((siblings ?? [row]) as SeedSpot[]);
  const [merged] = deduplicateByVenue(group);
  // Keep the requested id so the detail screen URL stays consistent
  return { ...merged, id };
}
