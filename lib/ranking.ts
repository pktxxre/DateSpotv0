export type { Triage } from './visits';

export interface ComparisonState<T extends { rank_order: number; id: string }> {
  lo: number;
  hi: number;
  mid: number;
  count: number;
  sorted: T[];
}

export type ComparisonResult = 'better' | 'worse';

const MAX_COMPARISONS = 7;

export function startComparison<T extends { rank_order: number; id: string }>(
  existing: T[],
  filterFn: (v: T) => boolean
): ComparisonState<T> | null {
  const pool = existing.filter(filterFn);
  if (pool.length === 0) return null;

  const sorted = [...pool].sort((a, b) => b.rank_order - a.rank_order);
  const n = sorted.length;
  const mid = Math.floor(n / 2);
  return { lo: 0, hi: n, mid, count: 0, sorted };
}

export function advance<T extends { rank_order: number; id: string }>(
  state: ComparisonState<T>,
  result: ComparisonResult
): ComparisonState<T> | null {
  const { lo, hi, mid, count, sorted } = state;
  const nextCount = count + 1;

  let nextLo = lo;
  let nextHi = hi;

  if (result === 'better') {
    nextHi = mid;
  } else {
    nextLo = mid + 1;
  }

  const nextMid = Math.floor((nextLo + nextHi) / 2);
  const done = nextLo >= nextHi || nextCount >= MAX_COMPARISONS;

  if (done) return null;

  return { lo: nextLo, hi: nextHi, mid: nextMid, count: nextCount, sorted };
}

export function resolveRankOrder<T extends { rank_order: number; id: string }>(
  state: ComparisonState<T> | null,
  existing: T[]
): number {
  if (existing.length === 0) return 1000;

  if (state === null) {
    const sorted = [...existing].sort((a, b) => b.rank_order - a.rank_order);
    return sorted[0].rank_order + 1;
  }

  return rankOrderAt(state.sorted, state.lo);
}

export function resolveAtMid<T extends { rank_order: number; id: string }>(
  state: ComparisonState<T>,
  _existing: T[]
): number {
  return rankOrderAt(state.sorted, state.mid);
}

function rankOrderAt<T extends { rank_order: number }>(sorted: T[], insertAt: number): number {
  if (insertAt === 0) return sorted[0].rank_order + 1000;
  if (insertAt >= sorted.length) return sorted[sorted.length - 1].rank_order - 1000;
  const above = sorted[insertAt - 1].rank_order;
  const below = sorted[insertAt].rank_order;
  return (above + below) / 2;
}

export function currentComparison<T extends { rank_order: number; id: string }>(
  state: ComparisonState<T>
): T {
  return state.sorted[state.mid];
}
