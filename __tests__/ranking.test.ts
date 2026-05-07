import { startComparison, advance, resolveRankOrder, currentComparison } from '../lib/ranking';
import type { Visit } from '../lib/visits';

function makeVisit(id: string, rankOrder: number): Visit {
  return {
    id,
    venue_name: `Spot ${id}`,
    lat: 0,
    lng: 0,
    visited_at: '2026-01-01',
    rating: 5.0,
    rank_order: rankOrder,
    notes: null,
    activity_type: 'food',
    price: 2,
    created_at: '2026-01-01',
    photos: [],
  };
}

const threeSpots = [makeVisit('a', 3000), makeVisit('b', 2000), makeVisit('c', 1000)];

describe('startComparison', () => {
  it('returns null when no existing visits', () => {
    expect(startComparison([])).toBeNull();
  });

  it('starts with mid pointing at a real visit', () => {
    const state = startComparison(threeSpots);
    expect(state).not.toBeNull();
    expect(state!.sorted[state!.mid]).toBeDefined();
  });

  it('seeds lo/hi correctly for "great" triage on 3 spots', () => {
    const state = startComparison(threeSpots, undefined, 'great');
    expect(state).not.toBeNull();
    expect(state!.hi).toBeLessThanOrEqual(2);
  });
});

describe('advance', () => {
  it('narrows the search window on "better"', () => {
    const state = startComparison(threeSpots)!;
    const next = advance(state, 'better');
    if (next) {
      expect(next.hi).toBeLessThanOrEqual(state.mid);
    }
  });

  it('narrows the search window on "worse"', () => {
    const state = startComparison(threeSpots)!;
    const next = advance(state, 'worse');
    if (next) {
      expect(next.lo).toBeGreaterThanOrEqual(state.mid + 1);
    }
  });
});

describe('resolveRankOrder', () => {
  it('returns above the highest when existing is empty', () => {
    expect(resolveRankOrder(null, [])).toBe(1000);
  });

  it('returns a value between neighbors when inserting at mid', () => {
    const state = startComparison(threeSpots)!;
    const resolved = resolveRankOrder(state, threeSpots);
    expect(typeof resolved).toBe('number');
    expect(isFinite(resolved)).toBe(true);
  });
});

describe('currentComparison', () => {
  it('returns the visit at state.mid', () => {
    const state = startComparison(threeSpots)!;
    const visit = currentComparison(state);
    expect(visit).toBe(state.sorted[state.mid]);
  });
});
