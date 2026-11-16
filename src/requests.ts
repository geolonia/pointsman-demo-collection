// Bookings: a resident asks for bulky waste to be collected. The booking is
// a `ServiceRequest` entity in the broker. The Worker looks up each item in
// the city's catalogue and works out what one more stop costs each day
// (src/plan.ts), so Pointsman's profiles read plain numbers and flags:
// bulky-waste-intake (can it be planned?), then bulky-waste-slot (which day?).
//
// No name, phone number or address is asked for: the demo needs none, and
// the booking is deleted after a day.

import type { Entity } from './broker';
import type { CatalogItem } from './catalog';
import type { City } from './cities';
import type { LonLat, SlotSummary } from './plan';

export const REQUEST_TYPE = 'ServiceRequest';
const ID = /^urn:ngsi-ld:ServiceRequest:demo-[0-9a-f-]{36}$/;
export const isRequestId = (id: string) => ID.test(id);
export const requestId = (uuid: string) => `urn:ngsi-ld:ServiceRequest:demo-${uuid}`;

/** What bulky-waste-intake reads (the subscription watches the same). */
export const INTAKE_INPUTS = ['itemKinds', 'maxItemKinds', 'notCollectedCount', 'carryOut'];
/** What bulky-waste-slot reads, and the intake it builds on. */
export const SLOT_INPUTS = ['dateNeed', 'slotCosts', 'intake'];

export const DATE_NEEDS = ['fixed', 'preferred', 'any'] as const;
export type DateNeed = (typeof DATE_NEEDS)[number];

const MAX_LINES = 20;
const MAX_QTY = 10;

export class RequestError extends Error {}

export interface Booking {
  location: LonLat;
  items: { id: string; qty: number }[];
  /** YYYY-MM-DD, or null with dateNeed "any". */
  wishedDay: string | null;
  dateNeed: DateNeed;
  carryOut: boolean;
  lang: 'ja' | 'en';
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The booking from a request body, checked; throws a message for the page on anything else. */
export function parseBooking(body: unknown): Booking {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) throw new RequestError('not an object');
  const b = body as Record<string, unknown>;
  for (const key of Object.keys(b)) {
    if (!['location', 'items', 'wishedDay', 'dateNeed', 'carryOut', 'lang'].includes(key)) throw new RequestError(`unknown field "${key}"`);
  }
  const loc = b.location;
  if (!Array.isArray(loc) || loc.length !== 2 || !loc.every((n) => typeof n === 'number' && Number.isFinite(n))) throw new RequestError('location must be [longitude, latitude]');
  const [lon, lat] = loc as [number, number];
  // Roughly the two cities: the geocoder decides the rest.
  if (lon < 135.1 || lon > 135.5 || lat < 34.6 || lat > 34.95) throw new RequestError('the place is outside the demo area');
  if (!Array.isArray(b.items) || b.items.length < 1 || b.items.length > MAX_LINES) throw new RequestError(`items must be a list of 1 to ${MAX_LINES}`);
  const seen = new Set<string>();
  const items = b.items.map((line: unknown) => {
    const l = line as { id?: unknown; qty?: unknown } | null;
    if (typeof l !== 'object' || l === null || typeof l.id !== 'string' || l.id.length > 120) throw new RequestError('each item needs an id');
    if (typeof l.qty !== 'number' || !Number.isInteger(l.qty) || l.qty < 1 || l.qty > MAX_QTY) throw new RequestError(`qty must be a whole number from 1 to ${MAX_QTY}`);
    if (seen.has(l.id)) throw new RequestError('each item once (use qty)');
    seen.add(l.id);
    return { id: l.id, qty: l.qty };
  });
  if (!DATE_NEEDS.includes(b.dateNeed as DateNeed)) throw new RequestError(`dateNeed must be one of ${DATE_NEEDS.join(', ')}`);
  const dateNeed = b.dateNeed as DateNeed;
  let wishedDay: string | null = null;
  if (b.wishedDay !== undefined && b.wishedDay !== null) {
    if (typeof b.wishedDay !== 'string' || !DAY.test(b.wishedDay) || Number.isNaN(Date.parse(`${b.wishedDay}T00:00:00Z`))) throw new RequestError('wishedDay must be YYYY-MM-DD');
    wishedDay = b.wishedDay;
  }
  if (dateNeed !== 'any' && !wishedDay) throw new RequestError('a wished day is needed unless any day is fine');
  if (b.carryOut !== undefined && typeof b.carryOut !== 'boolean') throw new RequestError('carryOut must be true or false');
  return { location: [lon, lat], items, wishedDay: dateNeed === 'any' ? null : wishedDay, dateNeed, carryOut: b.carryOut === true, lang: b.lang === 'ja' ? 'ja' : 'en' };
}

export interface Line {
  item: CatalogItem;
  qty: number;
}

/** Counts and the fee of a booking's items. */
export function tally(lines: Line[]) {
  let itemCount = 0, notCollectedCount = 0, feeTotal = 0, feeKnown = true, twoPerson = false;
  for (const { item, qty } of lines) {
    itemCount += qty;
    if (!item.collected) {
      notCollectedCount += qty;
      continue;
    }
    if (item.fee === null) feeKnown = false;
    else feeTotal += item.fee * qty;
    if (item.twoPerson) twoPerson = true;
  }
  return { itemCount, notCollectedCount, feeTotal, feeKnown, twoPerson };
}

export interface Costs extends SlotSummary {
  /** The days looked at, with what one more stop costs each. */
  days: { date: string; extraMin: number; feasible: boolean; stops: number }[];
  /** "mock" today; "vroom" once the real planner runs. */
  planner: 'mock';
}

const P = (value: unknown, extra: Record<string, unknown> = {}) => ({ type: 'Property', value, ...extra });

/** The booking entity (normalized NGSI-LD, core context). */
export function toRequestEntity(args: { uuid: string; booking: Booking; city: City; area: { key: string }; town: string; lines: Line[]; costs: Costs }): Entity {
  const { uuid, booking, city, area, town, lines, costs } = args;
  const t = tally(lines);
  return {
    id: requestId(uuid),
    type: REQUEST_TYPE,
    category: P('bulky-waste'),
    municipality: P(city.code),
    area: P(area.key),
    // The town only (町・大字), never an address: enough for a person to see where.
    ...(town && { town: P(town) }),
    location: { type: 'GeoProperty', value: { type: 'Point', coordinates: booking.location } },
    items: P(lines.map(({ item, qty }) => ({ item: item.id, name: item.name.ja, qty, collected: item.collected, ...(item.fee !== null && { fee: item.fee }) }))),
    refCatalogItem: { type: 'Relationship', object: lines.map((l) => l.item.id) },
    itemCount: P(t.itemCount),
    itemKinds: P(lines.length),
    // Left out when the city publishes no limit: the intake then has none.
    ...(city.maxItemKinds !== null && { maxItemKinds: P(city.maxItemKinds) }),
    notCollectedCount: P(t.notCollectedCount),
    // Only when every collected item has a published fee.
    ...(t.feeKnown && { feeTotal: P(t.feeTotal, { unitCode: 'JPY' }) }),
    twoPerson: P(t.twoPerson),
    carryOut: P(booking.carryOut),
    dateNeed: P(booking.dateNeed),
    ...(booking.wishedDay && { wishedDay: P(booking.wishedDay) }),
    slotCosts: P(costs),
    status: P('requested'),
    lang: P(booking.lang),
  };
}

const valueOf = (e: Entity, name: string): unknown => (e[name] as { value?: unknown } | undefined)?.value;

/**
 * The collection day of a booking, when it has one: the day the resident
 * chose from the offers, else what bulky-waste-slot decided (the wished day,
 * or the cheapest day). Null while it has none.
 */
export function dayOf(e: Entity): string | null {
  const chosen = valueOf(e, 'confirmedDay');
  if (typeof chosen === 'string') return chosen;
  const slot = e.slot as { value?: unknown; finalAction?: { value?: unknown } } | undefined;
  const action = typeof slot?.finalAction?.value === 'string' ? slot.finalAction.value : slot?.value;
  const costs = valueOf(e, 'slotCosts') as Partial<Costs> | undefined;
  if (action === 'accept') return (costs?.wishedDay ?? valueOf(e, 'wishedDay') ?? null) as string | null;
  if (action === 'assign_best') return costs?.bestDay ?? null;
  return null;
}
