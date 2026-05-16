import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { ActivityType, Price } from './visits';

const GEOCODE_CACHE_KEY = 'geocode_cache_v1';

// Minimum resolved visits in a city before user-contributed Top Spots are shown.
// Below this threshold getSeedSpots() is the sole source.
const TOP_SPOTS_MIN_THRESHOLD = 50;

export type TopSpot = {
  canonical_place_id: string;
  canonical_name: string;
  canonical_lat: number;
  canonical_lng: number;
  osm_place_id: string | null;
  city: string | null;
  activity_type: ActivityType | null;
  visit_count: number;
  last_visited_at: string;
};

export async function getTopSpots(city: string): Promise<TopSpot[]> {
  if (!supabase || !city) return [];
  const { data, error } = await supabase
    .from('top_spots')
    .select('*')
    .eq('city', city)
    .order('visit_count', { ascending: false })
    .limit(50);
  if (error) {
    console.error('getTopSpots error:', error.message);
    return [];
  }
  const spots = (data ?? []) as TopSpot[];
  // Gate: only surface user-contributed spots once enough signal exists
  if (spots.reduce((sum, s) => sum + s.visit_count, 0) < TOP_SPOTS_MIN_THRESHOLD) {
    return [];
  }
  return spots;
}

export type SeedSpot = {
  id: string;
  user_id: string;
  venue_name: string;
  lat: number;
  lng: number;
  address: string | null;
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

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`,
      { headers: { 'User-Agent': 'DateSpotApp/1.0 (atloexo@gmail.com)' }, signal: controller.signal }
    );
    const data = await res.json();
    if (!data || data.length === 0) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

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
      // Prefer address from whichever group member has one
      address: group.find(g => g.address)?.address ?? null,
      lat: group.reduce((s, g) => s + g.lat, 0) / group.length,
      lng: group.reduce((s, g) => s + g.lng, 0) / group.length,
      rating: avgRating,
      rank_order: Math.max(...group.map(g => g.rank_order)),
      triage,
    };
  });

  return merged.sort((a, b) => b.rank_order - a.rank_order);
}

export async function resolveCoordinates(spots: SeedSpot[]): Promise<SeedSpot[]> {
  type CoordCache = Record<string, { lat: number; lng: number }>;
  let cache: CoordCache = {};
  try {
    const raw = await AsyncStorage.getItem(GEOCODE_CACHE_KEY);
    if (raw) cache = JSON.parse(raw) as CoordCache;
  } catch {}

  const result: SeedSpot[] = [];
  let cacheUpdated = false;

  for (const spot of spots) {
    if (!spot.address) {
      result.push(spot);
      continue;
    }
    const cached = cache[spot.address];
    if (cached) {
      result.push({ ...spot, lat: cached.lat, lng: cached.lng });
      continue;
    }
    // Cache miss — hit Nominatim and store result
    const coords = await geocodeAddress(spot.address);
    if (coords) {
      cache[spot.address] = coords;
      cacheUpdated = true;
      result.push({ ...spot, lat: coords.lat, lng: coords.lng });
    } else {
      result.push(spot);
    }
    // Respect Nominatim's 1 req/sec policy
    await new Promise(r => setTimeout(r, 1100));
  }

  if (cacheUpdated) {
    try {
      await AsyncStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(cache));
    } catch {}
  }

  return result;
}

// Returns seed spots immediately after the Supabase query — no geocoding.
// Coordinates in Supabase are authoritative; the geocode cache is cleared on first run.
export async function getSeedSpotsRaw(): Promise<SeedSpot[]> {
  AsyncStorage.removeItem(GEOCODE_CACHE_KEY).catch(() => {});
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

export async function getSeedSpots(): Promise<SeedSpot[]> {
  const deduped = await getSeedSpotsRaw();
  const withAddresses = deduped.filter(s => s.address);
  if (withAddresses.length === 0) return deduped;
  return resolveCoordinates(deduped);
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
  if (!merged) return null;

  // Resolve address to coordinates if present (use cache when available)
  if (merged.address) {
    try {
      const raw = await AsyncStorage.getItem(GEOCODE_CACHE_KEY);
      const cache = raw ? (JSON.parse(raw) as Record<string, { lat: number; lng: number }>) : {};
      const cached = cache[merged.address];
      if (cached) {
        return { ...merged, lat: cached.lat, lng: cached.lng, id };
      }
    } catch {}
    const coords = await geocodeAddress(merged.address);
    if (coords) {
      return { ...merged, lat: coords.lat, lng: coords.lng, id };
    }
  }

  // Keep the requested id so the detail screen URL stays consistent
  return { ...merged, id };
}
