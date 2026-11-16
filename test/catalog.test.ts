// The cities' data files and the catalogue entities made from them.

import { describe, expect, it } from 'vitest';
import type { Entity } from '../src/broker';
import { fromCatalogEntity, isCatalogItemId } from '../src/catalog';
// @ts-expect-error: a plain JavaScript module of the scripts.
import { catalogEntities } from '../scripts/catalog-rows.mjs';
import ashiyaItems from '../data/ashiya/items.json';
import ashiyaRules from '../data/ashiya/rules.json';
import nishinomiyaItems from '../data/nishinomiya/items.json';
import nishinomiyaRules from '../data/nishinomiya/rules.json';

const FILES: Record<string, unknown> = {
  'data/nishinomiya/items.json': nishinomiyaItems, 'data/nishinomiya/rules.json': nishinomiyaRules,
  'data/ashiya/items.json': ashiyaItems, 'data/ashiya/rules.json': ashiyaRules,
};
const entities = catalogEntities((path: string) => FILES[path]) as Entity[];
const items = entities.map(fromCatalogEntity);

describe('the catalogue', () => {
  it('has both cities, every entity well formed, and unique ids', () => {
    expect(items.every((i) => i !== null)).toBe(true);
    expect(new Set(entities.map((e) => e.id)).size).toBe(entities.length);
    expect(entities.every((e) => isCatalogItemId(e.id))).toBe(true);
    for (const city of ['28204', '28206']) {
      const mine = items.filter((i) => i!.city === city);
      expect(mine.length, city).toBeGreaterThan(200);
      // Fees in 300-yen stickers, as both cities sell them.
      expect(mine.filter((i) => i!.collected).every((i) => i!.fee !== null && i!.fee > 0 && i!.fee % 300 === 0), city).toBe(true);
      // The home appliance recycling items are never collected as bulky waste.
      expect(mine.some((i) => !i!.collected && i!.name.ja.includes('エアコン')), city).toBe(true);
      expect(mine.filter((i) => !i!.collected).every((i) => i!.advice && i!.fee === null), city).toBe(true);
    }
  });

  it('cites an official page of the city for every item', () => {
    for (const i of items) expect(i!.source, i!.name.ja).toMatch(i!.city === '28204' ? /^https:\/\/www\.nishi\.or\.jp\// : /^https:\/\/www\.city\.ashiya\.lg\.jp\//);
  });
});
