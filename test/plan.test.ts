// The mock collection plan (src/plan.ts).

import { describe, expect, it } from 'vitest';
import { CITIES } from '../src/cities';
import { baselineStops, collectionDays, dayCosts, insertion, km, type LonLat, MAX_STOPS, route, routeMin, SERVICE_MIN, summarize, todayJst } from '../src/plan';

const south = CITIES[0]!.areas.find((a) => a.key === 'nishinomiya-south')!;

describe('distances', () => {
  it('are about right', () => {
    // Nishinomiya-Kitaguchi to Koshien: about 2.8 km.
    expect(km([135.3595, 34.7465], [135.3617, 34.7215])).toBeGreaterThan(2.6);
    expect(km([135.3595, 34.7465], [135.3617, 34.7215])).toBeLessThan(3.0);
  });
});

describe('made-up stops', () => {
  it('are the same for the same day, and differ between days', () => {
    const a = baselineStops(south, 'k', '2026-11-20');
    expect(baselineStops(south, 'k', '2026-11-20')).toEqual(a);
    expect(baselineStops(south, 'k', '2026-11-21')).not.toEqual(a);
    expect(a.length).toBeGreaterThanOrEqual(south.baseline[0]);
    expect(a.length).toBeLessThanOrEqual(south.baseline[1]);
  });

  it('lie near their neighbourhood centres', () => {
    for (const s of baselineStops(south, 'k', '2026-11-20')) {
      expect(Math.min(...south.anchors.map((x) => km(x.at, s.at) - x.km))).toBeLessThan(0.01);
    }
  });
});

describe('insertion', () => {
  const depot: LonLat = [135.33, 34.716];
  const stops = route(depot, [{ at: [135.36, 34.745], serviceMin: 5 }, { at: [135.362, 34.722], serviceMin: 5 }]);

  it('costs little next to a stop on the route, more far away', () => {
    const near = insertion(depot, stops, { at: [135.3605, 34.7445], serviceMin: SERVICE_MIN });
    const far = insertion(depot, stops, { at: [135.24, 34.83], serviceMin: SERVICE_MIN });
    expect(near.extraMin).toBeLessThan(8);
    expect(far.extraMin).toBeGreaterThan(30);
    expect(near.feasible && far.feasible).toBe(true);
    expect(near.stops).toBe(2);
  });

  it('is not feasible on a full day', () => {
    const full = Array.from({ length: MAX_STOPS }, (_, i) => ({ at: [135.36 + i * 0.0001, 34.745] as LonLat, serviceMin: 5 }));
    expect(insertion(depot, route(depot, full), { at: [135.36, 34.745], serviceMin: 5 }).feasible).toBe(false);
  });

  it('includes driving out and back for an empty day', () => {
    const one = insertion(depot, [], { at: [135.36, 34.745], serviceMin: 5 });
    expect(one.extraMin).toBe(Math.round(routeMin(depot, [{ at: [135.36, 34.745], serviceMin: 5 }])));
  });
});

describe('days', () => {
  it('are the collection weekdays from the first day', () => {
    // 2026-11-16 is a Monday.
    expect(collectionDays(south, '2026-11-16', 7)).toEqual(['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20']);
  });

  it('start from Japan\'s date', () => {
    expect(todayJst(new Date('2026-11-16T14:59:00Z'))).toBe('2026-11-16');
    expect(todayJst(new Date('2026-11-16T15:00:00Z'))).toBe('2026-11-17');
  });
});

describe('the summary', () => {
  const costs = [
    { date: '2026-11-18', extraMin: 25, feasible: true, stops: 10 },
    { date: '2026-11-19', extraMin: 6, feasible: true, stops: 12 },
    { date: '2026-11-20', extraMin: 3, feasible: false, stops: 30 },
    { date: '2026-11-23', extraMin: 6, feasible: true, stops: 8 },
    { date: '2026-11-24', extraMin: 9, feasible: true, stops: 8 },
  ];

  it('gives the wished day, the cheapest feasible day and up to three offers', () => {
    expect(summarize(costs, '2026-11-18')).toEqual({
      wishedDay: '2026-11-18', wishedFeasible: true, wishedExtraMin: 25,
      bestDay: '2026-11-19', bestFound: true, bestExtraMin: 6,
      offers: ['2026-11-19', '2026-11-23', '2026-11-24'],
    });
  });

  it('says when the wished day is not in the window, or full', () => {
    expect(summarize(costs, '2026-11-21')).toMatchObject({ wishedDay: null, wishedFeasible: false, wishedExtraMin: -1 });
    expect(summarize(costs, '2026-11-20')).toMatchObject({ wishedDay: '2026-11-20', wishedFeasible: false });
    expect(summarize(costs, null)).toMatchObject({ wishedDay: null, bestDay: '2026-11-19' });
  });

  it('finds no day when every day is full', () => {
    expect(summarize(costs.map((c) => ({ ...c, feasible: false })), null)).toMatchObject({ bestFound: false, bestDay: null, bestExtraMin: -1, offers: [] });
  });

  it('counts the demo\'s own bookings on a day', () => {
    const stop = { at: [135.36, 34.745] as LonLat, serviceMin: 5 };
    const [without] = dayCosts(south, 'k', ['2026-11-19'], stop, new Map());
    const [withOne] = dayCosts(south, 'k', ['2026-11-19'], stop, new Map([['2026-11-19', [{ at: [135.3601, 34.7451], serviceMin: 5 }]]]));
    expect(withOne!.stops).toBe(without!.stops + 1);
    expect(withOne!.extraMin).toBeLessThanOrEqual(without!.extraMin);
  });
});
