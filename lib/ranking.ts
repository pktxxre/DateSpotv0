import { ActivityType, Visit } from './visits';

export interface ComparisonState {
  lo: number;       // index into sorted (inclusive lower bound)
  hi: number;       // index into sorted (exclusive upper bound)
  mid: number;      // index of current comparison target
  count: number;    // comparisons made so far
  sorted: Visit[];  // pool used for this session (may be category-filtered)
}

export type ComparisonResult = 'better' | 'worse';
export type Triage = 'bad' | 'okay' | 'great';

const MAX_COMPARISONS = 7;
const CATEGORY_THRESHOLD = 5; // min spots in category before category-only mode kicks in

export function startComparison(
  existing: Visit[],
  activityType?: ActivityType,
  triage?: Triage
): ComparisonState | null {
  if (existing.length === 0) return null;

  // Category-aware: use category pool if we have enough data in that category
  let pool = existing;
  if (activityType) {
    const categoryPool = existing.filter((v) => v.activity_type === activityType);
    if (categoryPool.length >= CATEGORY_THRESHOLD) {
      pool = categoryPool;
    }
  }

  const sorted = [...pool].sort((a, b) => b.rank_order - a.rank_order);
  const n = sorted.length;

  // Triage seeds the search region (sorted is DESC: index 0 = best, n-1 = worst)
  let lo = 0;
  let hi = n;
  if (triage && n >= 2) {
    if (triage === 'great') {
      hi = Math.max(1, Math.ceil(n / 3));
    } else if (triage === 'okay') {
      lo = Math.floor(n / 3);
      hi = Math.ceil((2 * n) / 3);
    } else {
      lo = Math.floor((2 * n) / 3);
    }
    // Guard: ensure hi > lo
    if (hi <= lo) hi = lo + 1;
    if (hi > n) hi = n;
  }

  const mid = Math.floor((lo + hi) / 2);
  return { lo, hi, mid, count: 0, sorted };
}

export function advance(
  state: ComparisonState,
  result: ComparisonResult
): ComparisonState | null {
  const { lo, hi, mid, count, sorted } = state;
  const nextCount = count + 1;

  let nextLo = lo;
  let nextHi = hi;

  if (result === 'better') {
    nextHi = mid; // new spot belongs above mid
  } else {
    nextLo = mid + 1; // new spot belongs below mid
  }

  const nextMid = Math.floor((nextLo + nextHi) / 2);
  const done = nextLo >= nextHi || nextCount >= MAX_COMPARISONS;

  if (done) return null;

  return { lo: nextLo, hi: nextHi, mid: nextMid, count: nextCount, sorted };
}

// Resolve rank_order at the natural end of comparison (uses state.lo as insertion point).
// Uses state.sorted so category-filtered sessions stay consistent.
export function resolveRankOrder(state: ComparisonState | null, existing: Visit[]): number {
  if (existing.length === 0) return 1000;

  if (state === null) {
    const sorted = [...existing].sort((a, b) => b.rank_order - a.rank_order);
    return sorted[0].rank_order + 1;
  }

  const { sorted, lo } = state;
  return rankOrderAt(sorted, lo);
}

// Resolve rank_order at the current mid — used by the "Too hard" button.
export function resolveAtMid(state: ComparisonState, existing: Visit[]): number {
  return rankOrderAt(state.sorted, state.mid);
}

function rankOrderAt(sorted: Visit[], insertAt: number): number {
  if (insertAt === 0) return sorted[0].rank_order + 1000;
  if (insertAt >= sorted.length) return sorted[sorted.length - 1].rank_order - 1000;
  const above = sorted[insertAt - 1].rank_order;
  const below = sorted[insertAt].rank_order;
  return (above + below) / 2;
}

export function currentComparison(state: ComparisonState): Visit {
  return state.sorted[state.mid];
}
