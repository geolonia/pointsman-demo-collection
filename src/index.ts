// The demo Worker: the booking page's API and the FIWARE bridge. The pages
// themselves are static (site/).
//
//   GET  /api/config               the cities, their areas and limits, whether bookings are taken
//   GET  /api/catalog?city=28204   a city's CatalogItem entities (from the broker)
//   GET  /api/place?lon=&lat=      which city, area and town a point is in (GSI)
//   POST /api/requests             a booking (ServiceRequest), with the mock route costs
//   GET  /api/requests/{id}        the booking with Pointsman's results and their Decision entities
//   POST /api/requests/{id}/day    the resident picks one of the offered days
//   POST /notify                   the broker's subscriptions: the bridge asks Pointsman
//
// See README.md.

import { type BridgeConfig, type BridgeMessage, decisionEntityId, handleQueueBatch, handleRequest, type Route, taskEntityId } from '../engine/packages/fiware/src/bridge';
import { Broker, BrokerError, type Entity } from './broker';
import { CATALOG_TYPE, type CatalogItem, fromCatalogEntity } from './catalog';
import { areaOf, CITIES, type City, cityByCode, WINDOW_DAYS } from './cities';
import { bridgeReady, checkEnv, type Env, trimUrl } from './env';
import { GeocoderError, placeOf } from './geocode';
import { fetchWithAgent } from './http';
import { collectionDays, dayCosts, SERVICE_MIN, SERVICE_TWO_PERSON_MIN, type Stop, summarize, todayJst } from './plan';
import { type Costs, dayOf, INTAKE_INPUTS, isRequestId, type Line, parseBooking, REQUEST_TYPE, RequestError, SLOT_INPUTS, tally, toRequestEntity } from './requests';

const CATALOG_CACHE_S = 600;
/** Demo bookings live this long; the hourly cleanup deletes them with their Decision and Task entities. */
const KEEP_MS = 24 * 3600_000;
const MAX_BODY = 16_000;
/** A booking without a result after this long is sent to the bridge again (hourly, at most MAX_RETRIES a run). */
const RETRY_AFTER_MS = 2 * 60_000;
const RETRY_UNTIL_MS = 2 * 3600_000;
const MAX_RETRIES = 20;

/** Step 1: can the booking be planned? Rules only (profile in the private deployment config). */
export const INTAKE_ROUTE: Route = {
  type: REQUEST_TYPE,
  profile: 'bulky-waste-intake',
  inputs: INTAKE_INPUTS,
  attribute: 'intake',
  decisionEntity: true,
  // A person arranges carrying out of the home; any app that lists Task entities shows the work.
  task: { actions: ['review'], priority: { review: 3 } },
};

/**
 * Step 2: which day? Builds on the intake (a chained route: runs from the
 * queue only). Its subscription notifies /notify?route=slot once the intake
 * is written.
 */
export const SLOT_ROUTE: Route = {
  type: REQUEST_TYPE,
  profile: 'bulky-waste-slot',
  inputs: SLOT_INPUTS,
  attribute: 'slot',
  name: 'slot',
  decisionEntity: true,
  requires: { intake: { attribute: 'intake', rerunOnReview: true } },
  task: { actions: ['review'], priority: { review: 2 } },
};

export function bridgeConfig(env: Env): BridgeConfig {
  return {
    routes: [INTAKE_ROUTE, SLOT_ROUTE],
    ...(env.BRIDGE_QUEUE && { queue: env.BRIDGE_QUEUE }),
    ...(env.BRIDGE_DLQ && { deadLetter: env.BRIDGE_DLQ }),
    notifySecret: env.NOTIFY_SECRET ?? '',
    pointsman: { url: trimUrl(env.POINTSMAN_URL), token: env.POINTSMAN_TOKEN ?? '' },
    broker: { url: trimUrl(env.BROKER_URL), apiKey: env.BROKER_API_KEY, tenant: env.BROKER_TENANT },
    fetch: fetchWithAgent,
  };
}

/** Headers on every answer of the Worker (the page's files get theirs from site/_headers). */
const SECURITY = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
};

const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { ...SECURITY, 'cache-control': 'no-store', ...extra } });

/** What the page needs to know about the cities. */
export function publicConfig(env: Env, now = new Date()) {
  return {
    bookings: bridgeReady(env),
    today: todayJst(now),
    windowDays: WINDOW_DAYS,
    cities: CITIES.map((c) => ({
      code: c.code, slug: c.slug, name: c.name, maxItemKinds: c.maxItemKinds, leadDays: c.leadDays, putOutBy: c.putOutBy, carryOutService: c.carryOutService,
      areas: c.areas.map((a) => ({ key: a.key, name: a.name, depot: a.depot, days: collectionDays(a, firstDay(c, now), WINDOW_DAYS) })),
    })),
  };
}

/** The first day a booking made now can be collected (JST). */
function firstDay(city: City, now: Date): string {
  return todayJst(new Date(now.getTime() + city.leadDays * 86_400_000));
}

/** A city's catalogue, from the broker; cached, but only when it is complete and not empty. */
async function catalog(env: Env, city: City, request: Request, ctx: ExecutionContext): Promise<{ query: string; items: CatalogItem[] }> {
  const key = new Request(new URL(`/api/catalog?city=${city.code}`, request.url).toString());
  const cached = await caches.default.match(key);
  if (cached) return (await cached.json()) as { query: string; items: CatalogItem[] };
  const { query, entities, complete } = await new Broker(env).list(CATALOG_TYPE, { q: `municipality=="${city.code}"` });
  const items = entities.map(fromCatalogEntity).filter((i): i is CatalogItem => i !== null && i.city === city.code);
  const body = { query, items };
  if (complete && items.length > 0) {
    ctx.waitUntil(caches.default.put(key, json(body, 200, { 'cache-control': `public, max-age=${CATALOG_CACHE_S}` })));
  }
  return body;
}

/**
 * Only the page itself may send bookings (a browser sends its origin). This
 * stops other sites from sending them in a visitor's name; scripts can set
 * any origin, so the rate and daily limits do the rest.
 */
const sameOrigin = (request: Request) => request.headers.get('origin') === new URL(request.url).origin;

/** The body as text, at most `max` bytes. */
async function boundedText(request: Request, max: number): Promise<string | null> {
  const declared = Number(request.headers.get('content-length') ?? NaN);
  if (Number.isFinite(declared) && declared > max) return null;
  const text = await request.text();
  return new TextEncoder().encode(text).byteLength > max ? null : text;
}

async function limited(env: Env, request: Request): Promise<Response | null> {
  const visitor = request.headers.get('cf-connecting-ip') ?? 'unknown';
  if (env.REQUEST_LIMIT && !(await env.REQUEST_LIMIT.limit({ key: visitor })).success) return json({ error: 'too many requests, try again in a minute' }, 429);
  if (env.ALL_REQUESTS_LIMIT && !(await env.ALL_REQUESTS_LIMIT.limit({ key: 'all' })).success) return json({ error: 'the demo is busy, try again in a minute' }, 429);
  return null;
}

/** The stops of the demo's bookings that already have a day, by day, in one area. */
async function bookedStops(broker: Broker, areaKey: string): Promise<Map<string, Stop[]>> {
  const { entities } = await broker.list(REQUEST_TYPE, { q: `area=="${areaKey}"` });
  const out = new Map<string, Stop[]>();
  for (const e of entities) {
    if (!isRequestId(e.id)) continue;
    const day = dayOf(e);
    const at = (e.location as { value?: { coordinates?: unknown } } | undefined)?.value?.coordinates;
    if (!day || !Array.isArray(at) || at.length !== 2) continue;
    const two = (e.twoPerson as { value?: unknown } | undefined)?.value === true;
    out.set(day, [...(out.get(day) ?? []), { at: at as [number, number], serviceMin: two ? SERVICE_TWO_PERSON_MIN : SERVICE_MIN }]);
  }
  return out;
}

async function createRequest(env: Env, request: Request, ctx: ExecutionContext): Promise<Response> {
  if (!bridgeReady(env)) return json({ error: 'bookings are not taken yet' }, 503);
  if (!sameOrigin(request)) return json({ error: 'origin not allowed' }, 403);
  const limit = await limited(env, request);
  if (limit) return limit;
  const text = await boundedText(request, MAX_BODY);
  if (text === null) return json({ error: 'request too large' }, 413);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ error: 'not JSON' }, 400);
  }
  try {
    const booking = parseBooking(body);
    const place = await placeOf(booking.location, env.GEOCODER_URL);
    const city = place && cityByCode(place.muniCd);
    if (!place || !city) return json({ error: 'the place is not in Nishinomiya or Ashiya' }, 400);
    if (booking.carryOut && !city.carryOutService) return json({ error: `${city.name.en} does not carry bulky waste out of the home` }, 400);
    const area = areaOf(city, place.town);
    const now = new Date();
    const days = collectionDays(area, firstDay(city, now), WINDOW_DAYS);
    if (booking.wishedDay && (booking.wishedDay < days[0]! || booking.wishedDay > days[days.length - 1]!)) {
      return json({ error: `the wished day must be from ${days[0]} to ${days[days.length - 1]}` }, 400);
    }
    const { items } = await catalog(env, city, request, ctx);
    const byId = new Map(items.map((i) => [i.id, i]));
    const lines: Line[] = booking.items.map((l) => {
      const item = byId.get(l.id);
      if (!item) throw new RequestError(`unknown item ${l.id} for ${city.name.en}`);
      return { item, qty: l.qty };
    });
    const broker = new Broker(env);
    // All demo bookings of the last day (older ones are deleted): refused at the daily limit, and when the count is unknown.
    const current = await broker.count(REQUEST_TYPE);
    if (current === null || current >= dailyLimit(env)) return json({ error: 'the demo has had enough bookings for today, try again tomorrow' }, 429);
    const stop: Stop = { at: booking.location, serviceMin: tally(lines).twoPerson ? SERVICE_TWO_PERSON_MIN : SERVICE_MIN };
    const perDay = dayCosts(area, area.key, days, stop, await bookedStops(broker, area.key));
    const costs: Costs = { ...summarize(perDay, booking.wishedDay), days: perDay, planner: 'mock' };
    const entity = toRequestEntity({ uuid: crypto.randomUUID(), booking, city, area, town: place.town, lines, costs });
    await broker.create(entity);
    return json({ id: entity.id }, 201);
  } catch (err) {
    if (err instanceof RequestError) return json({ error: err.message }, 400);
    throw err;
  }
}

async function getRequest(env: Env, id: string): Promise<Response> {
  const broker = new Broker(env);
  const entity = await broker.get(id);
  if (!entity) return json({ error: 'not found' }, 404);
  // The Decision entities as stored, without a context: their terms come back as full IRIs.
  const decisionOf = async (attribute: string) => {
    const ref = (entity[attribute] as { decision?: { object?: unknown } } | undefined)?.decision?.object;
    return typeof ref === 'string' && ref.startsWith('urn:ngsi-ld:Decision:') ? broker.get(ref) : null;
  };
  const [intakeDecision, slotDecision] = await Promise.all([decisionOf('intake'), decisionOf('slot')]);
  return json({ entity, intakeDecision, slotDecision, day: dayOf(entity), query: `/entities/${encodeURIComponent(id)}` });
}

/** The resident picks one of the offered days (only after bulky-waste-slot offered days). */
async function chooseDay(env: Env, id: string, request: Request): Promise<Response> {
  if (!sameOrigin(request)) return json({ error: 'origin not allowed' }, 403);
  const limit = await limited(env, request);
  if (limit) return limit;
  const text = await boundedText(request, 1000);
  let day: unknown;
  try {
    day = (JSON.parse(text ?? '') as { day?: unknown }).day;
  } catch {
    return json({ error: 'not JSON' }, 400);
  }
  const broker = new Broker(env);
  const entity = await broker.get(id);
  if (!entity) return json({ error: 'not found' }, 404);
  const slot = entity.slot as { value?: unknown; finalAction?: { value?: unknown } } | undefined;
  const action = slot?.finalAction?.value ?? slot?.value;
  if (action !== 'offer_days') return json({ error: 'no days were offered for this booking' }, 409);
  if ((entity.confirmedDay as { value?: unknown } | undefined)?.value) return json({ error: 'a day is already chosen' }, 409);
  const offers = ((entity.slotCosts as { value?: Partial<Costs> } | undefined)?.value?.offers ?? []) as string[];
  if (typeof day !== 'string' || !offers.includes(day)) return json({ error: 'pick one of the offered days' }, 400);
  await broker.patch(id, { confirmedDay: { type: 'Property', value: day }, status: { type: 'Property', value: 'confirmed' } });
  return json({ id, day });
}

const dailyLimit = (env: Env) => {
  const n = Number(env.DAILY_LIMIT);
  return Number.isInteger(n) && n > 0 ? n : 300;
};

/**
 * Every hour: deletes bookings older than a day, with their Decision and Task
 * entities; and sends bookings without a result after RETRY_AFTER_MS (and
 * younger than RETRY_UNTIL_MS) to the bridge again. One failing booking never
 * stops the others.
 */
export async function cleanup(env: Env, now = Date.now()): Promise<{ deleted: number; retried: number; skipped: number; failed: number }> {
  const broker = new Broker(env);
  const out = { deleted: 0, retried: 0, skipped: 0, failed: 0 };
  let attempts = 0;
  const { entities } = await broker.list(REQUEST_TYPE, { sysAttrs: true });
  for (const e of entities) {
    // Only the demo's own bookings: never anything else, whatever the broker lists.
    if (e.type !== REQUEST_TYPE || !isRequestId(e.id)) continue;
    const created = Date.parse(String(e.createdAt ?? ''));
    if (!Number.isFinite(created)) {
      out.skipped += 1;
      continue;
    }
    try {
      if (now - created > KEEP_MS) {
        for (const route of [INTAKE_ROUTE, SLOT_ROUTE]) {
          const result = e[route.attribute] as { decisionId?: { value?: unknown }; inputHash?: { value?: unknown } } | undefined;
          if (typeof result?.decisionId?.value === 'string') await broker.delete(decisionEntityId(result.decisionId.value));
          if (typeof result?.inputHash?.value === 'string') await broker.delete(await taskEntityId(e.id, route.attribute, result.inputHash.value));
        }
        await broker.delete(e.id);
        out.deleted += 1;
      } else if (now - created > RETRY_AFTER_MS && now - created < RETRY_UNTIL_MS && attempts < MAX_RETRIES && bridgeReady(env) && (!e.intake || !e.slot)) {
        attempts += 1;
        const fresh = await broker.get(e.id);
        if (!fresh) continue;
        // As the subscription would, with the booking as stored (no system attributes).
        const notification = new Request(`https://worker.internal/notify${e.intake ? '?route=slot' : ''}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-bridge-secret': env.NOTIFY_SECRET! },
          body: JSON.stringify({ type: 'Notification', data: [fresh] }),
        });
        const res = await handleRequest(notification, bridgeConfig(env));
        if (res.status !== 200 && res.status !== 202) throw new Error(`retry answered ${res.status}`);
        out.retried += 1;
      }
    } catch (err) {
      out.failed += 1;
      console.error(`cleanup ${e.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return out;
}

const decoded = (s: string): string | null => {
  try {
    return decodeURIComponent(s);
  } catch {
    return null;
  }
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/notify') {
      if (!bridgeReady(env)) return json({ error: 'the bridge is not configured' }, 503);
      return handleRequest(request, bridgeConfig(env));
    }
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    const dayPath = url.pathname.match(/^\/api\/requests\/([^/]+)\/day$/);
    const posting = request.method === 'POST' && (url.pathname === '/api/requests' || !!dayPath);
    if (request.method !== 'GET' && !posting) return json({ error: 'method not allowed' }, 405, { allow: 'GET' });
    // Static: answered also when the broker is not set up, so the page still has its map.
    if (url.pathname === '/api/config') return json(publicConfig(env), 200, { 'cache-control': 'public, max-age=60' });
    try {
      if (url.pathname === '/api/place') {
        const lon = Number(url.searchParams.get('lon'));
        const lat = Number(url.searchParams.get('lat'));
        if (!Number.isFinite(lon) || !Number.isFinite(lat)) return json({ error: 'lon and lat are needed' }, 400);
        const place = await placeOf([lon, lat], env.GEOCODER_URL);
        const city = place && cityByCode(place.muniCd);
        if (!place || !city) return json({ error: 'not in the demo area' }, 404);
        const area = areaOf(city, place.town);
        return json({ city: city.code, area: area.key, town: place.town }, 200, { 'cache-control': 'public, max-age=3600' });
      }
      checkEnv(env);
      if (url.pathname === '/api/catalog') {
        const city = cityByCode(url.searchParams.get('city') ?? '');
        if (!city) return json({ error: 'unknown city' }, 400);
        return json(await catalog(env, city, request, ctx), 200, { 'cache-control': `public, max-age=${CATALOG_CACHE_S}` });
      }
      if (url.pathname === '/api/requests' && posting) return await createRequest(env, request, ctx);
      const rq = dayPath ?? url.pathname.match(/^\/api\/requests\/([^/]+)$/);
      if (rq) {
        const id = decoded(rq[1]!);
        if (!id || !isRequestId(id)) return json({ error: 'not a booking id' }, 400);
        return dayPath ? await chooseDay(env, id, request) : await getRequest(env, id);
      }
      return json({ error: 'not found' }, 404);
    } catch (err) {
      console.error(err instanceof Error ? err.message : err);
      if (err instanceof GeocoderError) return json({ error: 'the address service did not answer' }, 502);
      return json({ error: err instanceof BrokerError ? 'the data platform did not answer' : 'something went wrong' }, 502);
    }
  },

  async scheduled(_event: ScheduledController, env: Env): Promise<void> {
    checkEnv(env);
    const r = await cleanup(env);
    if (r.deleted || r.retried || r.skipped || r.failed) console.log(`cleanup: ${JSON.stringify(r)}`);
  },

  async queue(batch: MessageBatch<BridgeMessage>, env: Env): Promise<void> {
    if (!bridgeReady(env)) {
      batch.retryAll({ delaySeconds: 300 });
      return;
    }
    await handleQueueBatch(batch, bridgeConfig(env));
  },
} satisfies ExportedHandler<Env, BridgeMessage>;

export type { Entity };
