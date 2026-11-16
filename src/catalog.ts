// The cities' bulky waste catalogues: one `CatalogItem` entity per item a
// city lists, with its fee, and the items the city does not collect as bulky
// waste (with where to take them instead). Loaded from data/<city>/items.json
// by scripts/load-catalog.mjs; the Worker reads them from the broker.

import type { Entity } from './broker';

export const CATALOG_TYPE = 'CatalogItem';

/** An item as the data files have it (data/<city>/items.json, normalized by the loader). */
export interface CatalogRow {
  /** Stable within the city: the loader keeps it from the file. */
  key: string;
  name: { ja: string; en: string };
  category: string;
  /** Yen per item, or null when the city does not publish a fee for it. */
  fee: number | null;
  /** False: the city does not collect it as bulky waste. */
  collected: boolean;
  /** Two workers carry it (a sofa, a wardrobe). */
  twoPerson: boolean;
  /** Size note as the city publishes it. */
  size?: string;
  /** Where to take it instead, when not collected. */
  advice?: { ja: string; en: string };
  source: string;
}

/** An item as the page and the Worker use it. */
export interface CatalogItem extends CatalogRow {
  id: string;
  city: string;
}

const KEY = /^[a-z0-9-]{1,64}$/;
export const catalogItemId = (city: string, key: string) => `urn:ngsi-ld:CatalogItem:${city}:${key}`;
const ID = /^urn:ngsi-ld:CatalogItem:(\d{5}):([a-z0-9-]{1,64})$/;
export const isCatalogItemId = (id: string) => ID.test(id);

const P = (value: unknown, extra: Record<string, unknown> = {}) => ({ type: 'Property', value, ...extra });

export function toCatalogEntity(city: string, row: CatalogRow): Entity {
  if (!KEY.test(row.key)) throw new Error(`bad item key ${JSON.stringify(row.key)}`);
  return {
    id: catalogItemId(city, row.key),
    type: CATALOG_TYPE,
    municipality: P(city),
    name: { type: 'LanguageProperty', languageMap: { ja: row.name.ja, en: row.name.en } },
    category: P(row.category),
    ...(row.fee !== null && { fee: P(row.fee, { unitCode: 'JPY' }) }),
    collected: P(row.collected),
    twoPerson: P(row.twoPerson),
    ...(row.size && { sizeNote: P(row.size) }),
    ...(row.advice && { advice: { type: 'LanguageProperty', languageMap: { ja: row.advice.ja, en: row.advice.en } } }),
    source: P(row.source),
  };
}

const value = (e: Entity, name: string): unknown => (e[name] as { value?: unknown } | undefined)?.value;
const lang = (e: Entity, name: string): { ja: string; en: string } | undefined => {
  const m = (e[name] as { languageMap?: Record<string, unknown> } | undefined)?.languageMap;
  return m && typeof m.ja === 'string' ? { ja: m.ja, en: typeof m.en === 'string' ? m.en : m.ja } : undefined;
};

/** An entity back into an item, or null when it is not a well-formed item of the demo. */
export function fromCatalogEntity(e: Entity): CatalogItem | null {
  const m = ID.exec(e.id);
  const name = lang(e, 'name');
  const category = value(e, 'category');
  const collected = value(e, 'collected');
  const twoPerson = value(e, 'twoPerson');
  const fee = value(e, 'fee');
  const source = value(e, 'source');
  if (!m || e.type !== CATALOG_TYPE || value(e, 'municipality') !== m[1] || !name || typeof category !== 'string'
    || typeof collected !== 'boolean' || typeof twoPerson !== 'boolean' || typeof source !== 'string') return null;
  if (fee !== undefined && (typeof fee !== 'number' || !Number.isFinite(fee) || fee < 0)) return null;
  const size = value(e, 'sizeNote');
  const advice = lang(e, 'advice');
  return {
    id: e.id, city: m[1]!, key: m[2]!, name, category, fee: typeof fee === 'number' ? fee : null, collected, twoPerson, source,
    ...(typeof size === 'string' && { size }),
    ...(advice && { advice }),
  };
}
