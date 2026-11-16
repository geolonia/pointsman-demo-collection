// The context broker (GeonicDB): the demo tenant's entities.

import { type Env, trimUrl } from './env';
import { fetchWithAgent } from './http';

/** A normalized NGSI-LD entity. */
export type Entity = { id: string; type: string } & Record<string, unknown>;

/** The demo's types have no datamodels.jp context yet: their terms are in the core context (default vocabulary). */
export const CORE_CONTEXT = 'https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context-v1.8.jsonld';
/** A broker that hangs must not hold the page's request open. */
const TIMEOUT_MS = 10_000;
const PAGE = 1000;
const link = (ctx: string) => `<${ctx}>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"`;

export class Broker {
  private readonly base: string;
  // A wrapper, not `fetch` itself: Workers refuse `this.fetchFn()` with the
  // global fetch as a property ("Illegal invocation").
  constructor(private readonly env: Env, private readonly fetchFn: typeof fetch = fetchWithAgent) {
    this.base = `${trimUrl(env.BROKER_URL)}/ngsi-ld/v1`;
  }

  private call(path: string, init: { method?: string; body?: unknown } = {}): Promise<Response> {
    return this.fetchFn(`${this.base}${path}`, {
      method: init.method ?? 'GET',
      headers: {
        'x-api-key': this.env.BROKER_API_KEY,
        'NGSILD-Tenant': this.env.BROKER_TENANT,
        accept: 'application/json',
        link: link(CORE_CONTEXT),
        ...(init.body !== undefined && { 'content-type': 'application/json' }),
      },
      ...(init.body !== undefined && { body: JSON.stringify(init.body) }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  }

  /** Creates an entity (normalized, core context). */
  async create(entity: Entity): Promise<void> {
    const res = await this.call('/entities', { method: 'POST', body: entity });
    if (res.status !== 201) throw new BrokerError('create', res.status);
  }

  /** Changes attributes of an entity (PATCH: only those given). */
  async patch(id: string, attrs: Record<string, unknown>): Promise<void> {
    const res = await this.call(`/entities/${encodeURIComponent(id)}/attrs`, { method: 'PATCH', body: attrs });
    if (res.status !== 204 && res.status !== 207) throw new BrokerError('patch', res.status);
    if (res.status === 207) throw new BrokerError('patch (partly)', res.status);
  }

  /** An entity as stored (with system attributes when asked), or null. */
  async get(id: string, { sysAttrs = false } = {}): Promise<Entity | null> {
    const res = await this.call(`/entities/${encodeURIComponent(id)}${sysAttrs ? '?options=sysAttrs' : ''}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new BrokerError('get', res.status);
    return (await res.json()) as Entity;
  }

  /**
   * Entities of a type, paged, at most `max`; `q` an NGSI-LD query. With
   * `sysAttrs`, each has createdAt. `complete`: the last page was short, so
   * nothing was left out.
   */
  async list(type: string, { q, max = 5000, sysAttrs = false }: { q?: string; max?: number; sysAttrs?: boolean } = {}): Promise<{ query: string; entities: Entity[]; complete: boolean }> {
    const params = new URLSearchParams({ type });
    if (q) params.set('q', q);
    const query = `/entities?${params}`;
    const all: Entity[] = [];
    for (let offset = 0; offset < max; offset += PAGE) {
      const res = await this.call(`${query}&limit=${PAGE}&offset=${offset}${sysAttrs ? '&options=sysAttrs' : ''}`);
      if (!res.ok) throw new BrokerError('list', res.status);
      const batch = (await res.json()) as unknown;
      if (!Array.isArray(batch)) throw new BrokerError('list (not a list)', res.status);
      all.push(...(batch as Entity[]));
      if (batch.length < PAGE) {
        // Pages of an unordered query can overlap: complete only when every entity came once.
        return { query, entities: all, complete: new Set(all.map((e) => e.id)).size === all.length };
      }
    }
    return { query, entities: all, complete: false };
  }

  /** How many entities of a type the broker holds (NGSILD-Results-Count), or null when it does not say. */
  async count(type: string): Promise<number | null> {
    const res = await this.call(`/entities?type=${encodeURIComponent(type)}&limit=1&count=true`);
    if (!res.ok) throw new BrokerError('count', res.status);
    await res.body?.cancel();
    const n = Number(res.headers.get('NGSILD-Results-Count') ?? NaN);
    return Number.isInteger(n) && n >= 0 ? n : null;
  }

  /** Deletes an entity; a missing one is fine. */
  async delete(id: string): Promise<void> {
    const res = await this.call(`/entities/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 404) throw new BrokerError('delete', res.status);
  }
}

export class BrokerError extends Error {
  constructor(what: string, readonly status: number) {
    // Only the status: bodies may echo what was sent.
    super(`broker ${what} failed: ${status}`);
  }
}
