// The mock collection plan: what one more stop would cost each collection
// day. A stand-in for Vroom (VROOM, a route optimiser) and OSRM (road
// distances), so the demo runs without them; the profiles read the same
// numbers either way (src/requests.ts `slotCosts`).
//
// Each day has one truck with a crew of two. Its route starts and ends at the
// city's facility, and visits the day's stops in nearest-neighbour order.
// The stops are made-up ones (seeded, so a day always has the same ones) and
// the demo's own booked requests. Distances are straight lines times a road
// factor, at a town driving speed. Rough on purpose: the point is that a day
// near other stops costs less than a day far from them.

/** A point: longitude, latitude (WGS 84). */
export type LonLat = [number, number];

export interface Stop {
  at: LonLat;
  /** Minutes at the stop: carrying the items to the truck. */
  serviceMin: number;
}

/** One city (or one area of a city) in the plan. */
export interface PlanArea {
  /** Where the truck starts and ends: the facility the items go to. */
  depot: LonLat;
  /** Where made-up stops are placed: centres of neighbourhoods, with a radius in km. */
  anchors: { at: LonLat; km: number }[];
  /** Made-up stops a day, before the demo's own (at least, at most). */
  baseline: [number, number];
  /** Collection weekdays, 0 = Sunday. */
  weekdays: number[];
}

/** Limits of one truck a day. */
export const SHIFT_MIN = 6 * 60;
export const MAX_STOPS = 30;
/** Straight line to road distance (rough, for towns). */
const ROAD_FACTOR = 1.4;
const SPEED_KMH = 20;
/** Minutes a stop takes: one person's items, and items for two people. */
export const SERVICE_MIN = 5;
export const SERVICE_TWO_PERSON_MIN = 8;

const R_KM = 6371;
const rad = (d: number) => (d * Math.PI) / 180;

/** Distance in km on the sphere. */
export function km(a: LonLat, b: LonLat): number {
  const dLat = rad(b[1] - a[1]);
  const dLon = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Driving minutes between two points (mock). */
export const driveMin = (a: LonLat, b: LonLat) => (km(a, b) * ROAD_FACTOR / SPEED_KMH) * 60;

/** A small seeded random generator (mulberry32), so a day's made-up stops never change. */
function random(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  let s = h >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The made-up stops of one day in an area: always the same for the same key and date. */
export function baselineStops(area: PlanArea, key: string, date: string): Stop[] {
  const next = random(`${key}:${date}`);
  const [lo, hi] = area.baseline;
  const n = lo + Math.floor(next() * (hi - lo + 1));
  const stops: Stop[] = [];
  for (let i = 0; i < n; i++) {
    const anchor = area.anchors[Math.floor(next() * area.anchors.length)]!;
    // A point within the anchor's radius, evenly over the disc.
    const r = anchor.km * Math.sqrt(next());
    const angle = 2 * Math.PI * next();
    const dLat = (r * Math.cos(angle)) / 111.32;
    const dLon = (r * Math.sin(angle)) / (111.32 * Math.cos(rad(anchor.at[1])));
    stops.push({ at: [anchor.at[0] + dLon, anchor.at[1] + dLat], serviceMin: next() < 0.25 ? SERVICE_TWO_PERSON_MIN : SERVICE_MIN });
  }
  return stops;
}

/** The route of a day: depot, the stops in nearest-neighbour order, depot. */
export function route(depot: LonLat, stops: Stop[]): Stop[] {
  const left = [...stops];
  const out: Stop[] = [];
  let at = depot;
  while (left.length > 0) {
    let best = 0;
    for (let i = 1; i < left.length; i++) if (km(at, left[i]!.at) < km(at, left[best]!.at)) best = i;
    const [s] = left.splice(best, 1);
    out.push(s!);
    at = s!.at;
  }
  return out;
}

/** Minutes of a route: driving from the depot through the stops and back, and the time at each stop. */
export function routeMin(depot: LonLat, ordered: Stop[]): number {
  let total = 0;
  let at = depot;
  for (const s of ordered) {
    total += driveMin(at, s.at) + s.serviceMin;
    at = s.at;
  }
  return total + driveMin(at, depot);
}

export interface Insertion {
  /** Extra minutes of the day's route with the new stop (driving and the stop itself), rounded. */
  extraMin: number;
  /** Whether the truck can still take it: stops and minutes within the day's limits. */
  feasible: boolean;
  /** Stops on that day before the new one. */
  stops: number;
}

/** The cheapest place for one more stop in a day's route (between two stops, or next to the depot). */
export function insertion(depot: LonLat, ordered: Stop[], stop: Stop): Insertion {
  const points = [depot, ...ordered.map((s) => s.at), depot];
  let extra = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    extra = Math.min(extra, driveMin(a, stop.at) + driveMin(stop.at, b) - driveMin(a, b));
  }
  const extraMin = extra + stop.serviceMin;
  const feasible = ordered.length + 1 <= MAX_STOPS && routeMin(depot, ordered) + extraMin <= SHIFT_MIN;
  return { extraMin: Math.round(extraMin), feasible, stops: ordered.length };
}

/** A date as YYYY-MM-DD (UTC parts of a date that stands for a day in Japan). */
export const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/** Japan's date today (JST, UTC+9). */
export const todayJst = (now: Date) => isoDay(new Date(now.getTime() + 9 * 3600_000));

/** The collection days from `from` (inclusive) for `days` calendar days. Holidays are not left out (a demo). */
export function collectionDays(area: PlanArea, from: string, days: number): string[] {
  const out: string[] = [];
  const start = new Date(`${from}T00:00:00Z`);
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * 86_400_000);
    if (area.weekdays.includes(d.getUTCDay())) out.push(isoDay(d));
  }
  return out;
}

export interface DayCost extends Insertion {
  date: string;
}

/**
 * What one more stop costs on each collection day. `booked` are the demo's
 * requests already given a day (by date), added to the made-up stops.
 */
export function dayCosts(area: PlanArea, key: string, days: string[], stop: Stop, booked: Map<string, Stop[]>): DayCost[] {
  return days.map((date) => {
    const stops = [...baselineStops(area, key, date), ...(booked.get(date) ?? [])];
    return { date, ...insertion(area.depot, route(area.depot, stops), stop) };
  });
}

/** What the slot profile reads (src/requests.ts `slotCosts`). */
export interface SlotSummary {
  /** The day the resident wished for, when it is a collection day in the window. */
  wishedDay: string | null;
  wishedFeasible: boolean;
  /** Extra minutes on the wished day; -1 when it is not a collection day in the window. */
  wishedExtraMin: number;
  /** The cheapest feasible day, and its extra minutes (-1 when none). */
  bestDay: string | null;
  bestFound: boolean;
  bestExtraMin: number;
  /** The days to offer: the cheapest feasible ones, earliest first among equals, at most 3. */
  offers: string[];
}

export function summarize(costs: DayCost[], wished: string | null): SlotSummary {
  const wishedCost = wished ? costs.find((c) => c.date === wished) : undefined;
  const feasible = costs.filter((c) => c.feasible).sort((a, b) => a.extraMin - b.extraMin || a.date.localeCompare(b.date));
  const best = feasible[0];
  return {
    wishedDay: wishedCost?.date ?? null,
    wishedFeasible: wishedCost?.feasible ?? false,
    wishedExtraMin: wishedCost?.extraMin ?? -1,
    bestDay: best?.date ?? null,
    bestFound: !!best,
    bestExtraMin: best?.extraMin ?? -1,
    offers: feasible.slice(0, 3).map((c) => c.date).sort(),
  };
}
