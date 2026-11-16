// The Worker's API with a fake broker and geocoder (global fetch stubbed),
// the cleanup, the subscriptions, and the page's security headers.

import { env as cfEnv } from 'cloudflare:workers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Entity } from '../src/broker';
import { type CatalogRow, toCatalogEntity } from '../src/catalog';
import type { Env } from '../src/env';
import demo, { cleanup, INTAKE_ROUTE, SLOT_ROUTE } from '../src/index';
import { INTAKE_INPUTS, SLOT_INPUTS } from '../src/requests';
import setupScript from '../scripts/setup.mjs?raw';

// Without the rate limits (5 a minute): the tests send more; one test below uses a fake limit.
const { REQUEST_LIMIT: _r, ALL_REQUESTS_LIMIT: _a, ...unlimited } = cfEnv as unknown as Env;
const env = unlimited as Env;
const BROKER = 'https://geolonia-demo.geonicdb.jp/ngsi-ld/v1';
const PAGE = 'https://collection.test';
const ctx = { waitUntil: (p: Promise<unknown>) => void p.catch(() => {}), passThroughOnException: () => {}, props: {} } as unknown as ExecutionContext;
const get = (path: string, init: RequestInit = {}, e: Env = env) => demo.fetch(new Request(`${PAGE}${path}`, init), e, ctx);
const post = (path: string, body: unknown, headers: Record<string, string> = { origin: PAGE }) =>
  get(path, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });

const row = (key: string, extra: Partial<CatalogRow> = {}): CatalogRow => ({
  key, name: { ja: key, en: key }, category: 'furniture', fee: 400, collected: true, twoPerson: false, source: 'https://www.nishi.or.jp/', ...extra,
});
const CATALOG: Entity[] = [
  toCatalogEntity('28204', row('chair')),
  toCatalogEntity('28204', row('sofa', { fee: 1200, twoPerson: true })),
  toCatalogEntity('28204', row('washing-machine', { fee: null, collected: false, category: 'appliance', advice: { ja: '家電リサイクル', en: 'Home appliance recycling' } })),
  toCatalogEntity('28206', row('chair')),
  // Not well formed: left out.
  { id: 'urn:ngsi-ld:CatalogItem:28204:broken', type: 'CatalogItem', municipality: { type: 'Property', value: '28204' } },
];
const ITEM = (city: string, key: string) => `urn:ngsi-ld:CatalogItem:${city}:${key}`;

/** Points and what the fake geocoder says about them. */
const PLACES: Record<string, { muniCd: string; lv01Nm: string } | null> = {
  '135.359500,34.746500': { muniCd: '28204', lv01Nm: '長田町' },
  '135.243000,34.829000': { muniCd: '28204', lv01Nm: '山口町下山口五丁目' },
  '135.306500,34.733500': { muniCd: '28206', lv01Nm: '業平町' },
  '135.200000,34.700000': { muniCd: '28100', lv01Nm: '' },
  '135.300000,34.650000': null,
};

type Call = { method: string; url: string; headers: Headers; body: string };
let calls: Call[] = [];
let stored: Entity[] = [];
let count: number | null = 0;

beforeEach(async () => {
  calls = [];
  stored = [...CATALOG];
  count = 0;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input, init);
    const body = req.body ? await req.text() : '';
    calls.push({ method: req.method, url: req.url, headers: req.headers, body });
    const url = new URL(req.url);
    if (url.hostname === 'mreversegeocoder.gsi.go.jp') {
      const p = PLACES[`${url.searchParams.get('lon')},${url.searchParams.get('lat')}`];
      return Response.json(p ? { results: p } : {});
    }
    if (url.pathname === '/ngsi-ld/v1/entities' && req.method === 'POST') {
      stored.push(JSON.parse(body) as Entity);
      return new Response(null, { status: 201 });
    }
    if (url.pathname === '/ngsi-ld/v1/entities') {
      const type = url.searchParams.get('type');
      const q = /^(\w+)=="([^"]*)"$/.exec(url.searchParams.get('q') ?? '');
      const all = stored.filter((e) => e.type === type && (!q || (e[q[1]!] as { value?: unknown } | undefined)?.value === q[2]));
      const headers: Record<string, string> = url.searchParams.get('count') === 'true' && count !== null ? { 'NGSILD-Results-Count': String(count) } : {};
      const offset = Number(url.searchParams.get('offset') ?? 0);
      return Response.json(all.slice(offset, offset + Number(url.searchParams.get('limit') ?? 20)), { headers });
    }
    const m = url.pathname.match(/^\/ngsi-ld\/v1\/entities\/([^/]+)(\/attrs)?$/);
    const one = m && stored.find((e) => e.id === decodeURIComponent(m[1]!));
    if (m?.[2] && req.method === 'PATCH') {
      if (!one) return new Response(null, { status: 404 });
      Object.assign(one, JSON.parse(body));
      return new Response(null, { status: 204 });
    }
    if (m && req.method === 'DELETE') {
      stored = stored.filter((e) => e !== one);
      return new Response(null, { status: one ? 204 : 404 });
    }
    return one ? Response.json(one) : new Response(null, { status: 404 });
  });
  await caches.default.delete(new Request(`${PAGE}/api/catalog?city=28204`));
});
afterEach(() => vi.restoreAllMocks());

const booking = (extra: Record<string, unknown> = {}) => ({
  location: [135.3595, 34.7465], items: [{ id: ITEM('28204', 'chair'), qty: 2 }], dateNeed: 'any', carryOut: false, lang: 'ja', ...extra,
});

describe('GET /api/config', () => {
  it('answers without the broker, with both cities and their collection days', async () => {
    const res = await get('/api/config', {}, { ...env, BROKER_API_KEY: '' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { bookings: boolean; cities: { code: string; areas: { key: string; days: string[] }[] }[] };
    expect(body.cities.map((c) => c.code)).toEqual(['28204', '28206']);
    expect(body.cities[0]!.areas.map((a) => a.key)).toEqual(['nishinomiya-north', 'nishinomiya-south']);
    expect(body.cities[0]!.areas[0]!.days.length).toBeGreaterThan(5);
    expect(calls).toHaveLength(0);
  });

  it('says bookings are closed without the bridge', async () => {
    const res = await get('/api/config', {}, { ...env, POINTSMAN_TOKEN: '' });
    expect(((await res.json()) as { bookings: boolean }).bookings).toBe(false);
  });
});

describe('GET /api/place', () => {
  it('names the city, the area and the town', async () => {
    expect(await (await get('/api/place?lon=135.3595&lat=34.7465')).json()).toEqual({ city: '28204', area: 'nishinomiya-south', town: '長田町' });
    expect(await (await get('/api/place?lon=135.243&lat=34.829')).json()).toEqual({ city: '28204', area: 'nishinomiya-north', town: '山口町下山口五丁目' });
    expect(await (await get('/api/place?lon=135.3065&lat=34.7335')).json()).toEqual({ city: '28206', area: 'ashiya', town: '業平町' });
    const gsi = calls[0]!;
    expect(gsi.url).toContain('mreversegeocoder.gsi.go.jp');
    expect(gsi.headers.get('user-agent')).toContain('pointsman-demo-collection');
  });

  it('is 404 for other cities and the sea, 400 without a point', async () => {
    expect((await get('/api/place?lon=135.2&lat=34.7')).status).toBe(404);
    expect((await get('/api/place?lon=135.3&lat=34.65')).status).toBe(404);
    expect((await get('/api/place?lon=x')).status).toBe(400);
  });
});

describe('GET /api/catalog', () => {
  it('gives the city\'s well-formed items, from the broker with key and tenant', async () => {
    const res = await get('/api/catalog?city=28204');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { query: string; items: { key: string; fee: number | null; advice?: unknown }[] };
    expect(body.items.map((i) => i.key)).toEqual(['chair', 'sofa', 'washing-machine']);
    expect(body.items[2]).toMatchObject({ fee: null, advice: { en: 'Home appliance recycling' } });
    expect(body.query).toBe('/entities?type=CatalogItem&q=municipality%3D%3D%2228204%22');
    expect(calls[0]!.headers.get('x-api-key')).toBe(env.BROKER_API_KEY);
    expect(calls[0]!.headers.get('ngsild-tenant')).toBe('pointsman_collection');
  });

  it('refuses an unknown city', async () => {
    expect((await get('/api/catalog?city=13101')).status).toBe(400);
  });
});

describe('POST /api/requests', () => {
  it('creates a booking with counts, the fee and the route costs, and no address', async () => {
    const res = await post('/api/requests', booking({ items: [{ id: ITEM('28204', 'chair'), qty: 2 }, { id: ITEM('28204', 'sofa'), qty: 1 }] }));
    expect(res.status).toBe(201);
    const { id } = (await res.json()) as { id: string };
    expect(id).toMatch(/^urn:ngsi-ld:ServiceRequest:demo-[0-9a-f-]{36}$/);
    const e = stored.find((s) => s.id === id)!;
    const v = (n: string) => (e[n] as { value: unknown }).value;
    expect(v('municipality')).toBe('28204');
    expect(v('area')).toBe('nishinomiya-south');
    expect(v('town')).toBe('長田町');
    expect(v('itemCount')).toBe(3);
    expect(v('itemKinds')).toBe(2);
    expect(v('maxItemKinds')).toBe(5);
    expect(v('notCollectedCount')).toBe(0);
    expect(v('feeTotal')).toBe(2000);
    expect(v('twoPerson')).toBe(true);
    expect(v('dateNeed')).toBe('any');
    expect(e.wishedDay).toBeUndefined();
    const costs = v('slotCosts') as { days: unknown[]; bestFound: boolean; offers: string[]; planner: string };
    expect(costs.planner).toBe('mock');
    expect(costs.days.length).toBeGreaterThan(5);
    expect(costs.bestFound).toBe(true);
    expect(costs.offers.length).toBe(3);
    expect(Object.keys(e)).not.toContain('address');
    // Every input the profiles read is on the entity.
    for (const name of [...INTAKE_INPUTS, ...SLOT_INPUTS.filter((n) => n !== 'intake')]) expect(e[name], name).toBeDefined();
  });

  it('counts items the city does not collect, and leaves the fee out when one is not published', async () => {
    const res = await post('/api/requests', booking({ items: [{ id: ITEM('28204', 'washing-machine'), qty: 1 }] }));
    expect(res.status).toBe(201);
    const e = stored[stored.length - 1]!;
    expect((e.notCollectedCount as { value: number }).value).toBe(1);
    expect((e.feeTotal as { value: number }).value).toBe(0);
  });

  it('follows each city: Ashiya has no kinds limit and carries items out, Nishinomiya does not', async () => {
    expect((await post('/api/requests', booking({ location: [135.3065, 34.7335], items: [{ id: ITEM('28206', 'chair'), qty: 1 }], carryOut: true }))).status).toBe(201);
    const e = stored[stored.length - 1]!;
    expect((e.area as { value: string }).value).toBe('ashiya');
    expect(e.maxItemKinds).toBeUndefined();
    expect((e.carryOut as { value: boolean }).value).toBe(true);
    expect((await post('/api/requests', booking({ carryOut: true }))).status).toBe(400);
  });

  it('checks the wished day against the window', async () => {
    const config = (await (await get('/api/config')).json()) as { cities: { areas: { key: string; days: string[] }[] }[] };
    const days = config.cities[0]!.areas.find((a) => a.key === 'nishinomiya-south')!.days;
    expect((await post('/api/requests', booking({ dateNeed: 'preferred', wishedDay: days[1] }))).status).toBe(201);
    expect((stored[stored.length - 1]!.wishedDay as { value: string }).value).toBe(days[1]);
    expect((await post('/api/requests', booking({ dateNeed: 'preferred', wishedDay: '2020-01-01' }))).status).toBe(400);
    expect((await post('/api/requests', booking({ dateNeed: 'fixed' }))).status).toBe(400);
  });

  it('refuses items of the other city, unknown fields, places outside the cities and other origins', async () => {
    expect((await post('/api/requests', booking({ items: [{ id: ITEM('28206', 'chair'), qty: 1 }] }))).status).toBe(400);
    expect((await post('/api/requests', booking({ name: 'Tanaka' }))).status).toBe(400);
    expect((await post('/api/requests', booking({ location: [135.2, 34.7] }))).status).toBe(400);
    expect((await post('/api/requests', booking({ items: [{ id: ITEM('28204', 'chair'), qty: 11 }] }))).status).toBe(400);
    expect((await post('/api/requests', booking(), { origin: 'https://evil.test' })).status).toBe(403);
    expect(stored.filter((e) => e.type === 'ServiceRequest')).toHaveLength(0);
  });

  it('is closed without the bridge, and at the daily limit', async () => {
    const res = await demo.fetch(new Request(`${PAGE}/api/requests`, { method: 'POST', headers: { origin: PAGE }, body: JSON.stringify(booking()) }), { ...env, NOTIFY_SECRET: '' }, ctx);
    expect(res.status).toBe(503);
    count = 300;
    expect((await post('/api/requests', booking())).status).toBe(429);
    count = null;
    expect((await post('/api/requests', booking())).status).toBe(429);
  });

  it('refuses a large body while reading it, with or without a length', async () => {
    const big = JSON.stringify(booking({ pad: 'x'.repeat(20_000) }));
    expect((await post('/api/requests', JSON.parse(big))).status).toBe(413);
    // Streamed, so the Worker does not know the length before reading.
    const stream = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(big)); c.close(); } });
    const res = await demo.fetch(new Request(`${PAGE}/api/requests`, { method: 'POST', headers: { origin: PAGE }, body: stream, duplex: 'half' } as RequestInit), env, ctx);
    expect(res.status).toBe(413);
  });

  it('is limited per visitor', async () => {
    const keys: string[] = [];
    const limit = { limit: async ({ key }: { key: string }) => (keys.push(key), { success: false }) } as unknown as RateLimit;
    const res = await demo.fetch(new Request(`${PAGE}/api/requests`, { method: 'POST', headers: { origin: PAGE, 'cf-connecting-ip': '192.0.2.1' }, body: JSON.stringify(booking()) }), { ...env, REQUEST_LIMIT: limit }, ctx);
    expect(res.status).toBe(429);
    expect(keys).toEqual(['192.0.2.1']);
  });
});

describe('the result and the chosen day', () => {
  async function created(slot?: string): Promise<string> {
    const { id } = (await (await post('/api/requests', booking())).json()) as { id: string };
    if (slot) Object.assign(stored.find((e) => e.id === id)!, { intake: { type: 'Property', value: 'plan' }, slot: { type: 'Property', value: slot } });
    return id;
  }

  it('gives the booking, its decisions and its day', async () => {
    const id = await created('assign_best');
    const body = (await (await get(`/api/requests/${encodeURIComponent(id)}`)).json()) as { entity: Entity; day: string | null };
    expect(body.entity.id).toBe(id);
    expect(body.day).toBe(((body.entity.slotCosts as { value: { bestDay: string } }).value).bestDay);
    expect((await get('/api/requests/urn%3Angsi-ld%3AServiceRequest%3Ax')).status).toBe(400);
  });

  it('takes one of the offered days, once, and only after days were offered', async () => {
    const id = await created('offer_days');
    const offers = (stored.find((e) => e.id === id)!.slotCosts as { value: { offers: string[] } }).value.offers;
    const path = `/api/requests/${encodeURIComponent(id)}/day`;
    expect((await post(path, { day: '2020-01-01' })).status).toBe(400);
    expect((await post(path, { day: offers[1] }, { origin: 'https://evil.test' })).status).toBe(403);
    expect((await post(path, { day: offers[1] })).status).toBe(200);
    const body = (await (await get(`/api/requests/${encodeURIComponent(id)}`)).json()) as { day: string };
    expect(body.day).toBe(offers[1]);
    expect((await post(path, { day: offers[0] })).status).toBe(409);
    const other = await created('accept');
    expect((await post(`/api/requests/${encodeURIComponent(other)}/day`, { day: offers[0] })).status).toBe(409);
  });
});

describe('cleanup', () => {
  it('deletes demo bookings older than a day with their Decision entities, and nothing else', async () => {
    const now = Date.parse('2026-11-16T12:00:00Z');
    const old: Entity = {
      id: 'urn:ngsi-ld:ServiceRequest:demo-11111111-2222-4333-8444-555555555555', type: 'ServiceRequest', createdAt: '2026-11-15T10:00:00Z',
      intake: { type: 'Property', value: 'plan', decisionId: { type: 'Property', value: 'd1' } },
    };
    const fresh: Entity = { id: 'urn:ngsi-ld:ServiceRequest:demo-11111111-2222-4333-8444-666666666666', type: 'ServiceRequest', createdAt: '2026-11-16T11:59:30Z' };
    const foreign: Entity = { id: 'urn:ngsi-ld:ServiceRequest:city-1', type: 'ServiceRequest', createdAt: '2026-01-01T00:00:00Z' };
    stored.push(old, fresh, foreign, { id: 'urn:ngsi-ld:Decision:d1', type: 'Decision' });
    const r = await cleanup(env, now);
    expect(r.deleted).toBe(1);
    expect(stored.map((e) => e.id)).not.toContain(old.id);
    expect(stored.map((e) => e.id)).not.toContain('urn:ngsi-ld:Decision:d1');
    expect(stored.map((e) => e.id)).toContain(fresh.id);
    expect(stored.map((e) => e.id)).toContain(foreign.id);
  });
});

describe('the subscriptions', () => {
  it('watch the inputs the bridge hashes, and the slot route waits for the intake', () => {
    const all = [...setupScript.matchAll(/watchedAttributes: (\[[^\]]*\])/g)].map((m) => JSON.parse(m[1]!.replaceAll("'", '"')) as string[]);
    expect(all[0]).toEqual(INTAKE_ROUTE.inputs);
    expect(all[1]).toEqual(SLOT_ROUTE.inputs);
    expect(setupScript).toContain("q: 'intake'");
    expect(setupScript).toContain('/notify?route=slot');
  });
});

function directives(csp: string): Record<string, string[]> {
  return Object.fromEntries(csp.split(';').map((d) => d.trim().split(/\s+/)).filter((d) => d[0]).map(([name, ...sources]) => [name!, sources]));
}
const allows = (sources: string[] | undefined, url: string) =>
  (sources ?? []).some((s) => (s.endsWith('/') ? url.startsWith(s) : url === s || url.startsWith(`${s}/`)));

describe('the page', () => {
  it('has security headers, and its CSP allows what index.html and app.js load', async () => {
    vi.restoreAllMocks();
    const res = await get('/');
    expect(res.status).toBe(200);
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    const csp = directives(res.headers.get('content-security-policy') ?? '');
    expect(csp['script-src']).not.toContain("'unsafe-inline'");
    const html = await res.text();
    expect(html.match(/<script(?![^>]*\ssrc=)[^>]*>/g)).toBeNull();
    for (const m of html.matchAll(/<script[^>]*\ssrc="(https:[^"]+)"/g)) expect(allows(csp['script-src'], m[1]!), m[1]).toBe(true);
    for (const m of html.matchAll(/<link(?=[^>]*rel="stylesheet")[^>]*\shref="(https:[^"]+)"/g)) expect(allows(csp['style-src'], m[1]!), m[1]).toBe(true);
    const app = await (await get('/app.js')).text();
    const hosts = new Set([...app.matchAll(/'(https:\/\/[a-z0-9.-]+)\//g)].map((m) => m[1]!));
    expect(hosts.size).toBeGreaterThan(0);
    for (const host of hosts) expect(allows(csp['connect-src'], host), host).toBe(true);
  });
});
