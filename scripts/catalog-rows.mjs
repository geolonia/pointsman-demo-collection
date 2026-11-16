// The catalogue rows of both cities from data/<city>/items.json (the items
// the city collects, with fees) and data/<city>/rules.json `not_accepted`
// (what it does not collect as bulky waste, with where to take it), as
// CatalogItem entities (src/catalog.ts). Keys are a hash of the Japanese
// name, so they stay the same when the lists are reordered.

import { toCatalogEntity } from '../src/catalog.ts';

export const CITY_FILES = [
  { code: '28204', dir: 'data/nishinomiya' },
  { code: '28206', dir: 'data/ashiya' },
];

/** 12 hex digits of two FNV-1a hashes: stable, no dependencies (the tests run it in the Workers runtime). */
function hash(text) {
  let a = 0x811c9dc5, b = 0x01000193 ^ 0x9e3779b9;
  for (const c of new TextEncoder().encode(text)) {
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c, 0x01000193 + 0x3c6ef372) >>> 0;
  }
  return (a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0')).slice(0, 12);
}
const key = (prefix, name) => `${prefix}-${hash(name)}`;

/** The rows of one city, from its two files. Throws on a duplicate name, so two items never share a key. */
export function rowsOf(itemsFile, rules, dir = 'data') {
  const items = Array.isArray(itemsFile) ? itemsFile : itemsFile.items;
  const rows = [
    ...items.map((i) => ({
      key: key('i', i.name_ja),
      name: { ja: i.name_ja, en: i.name_en },
      category: i.category,
      fee: i.fee_yen ?? null,
      collected: true,
      twoPerson: i.two_person === true,
      ...(i.size_note && { size: i.size_note }),
      source: i.source_url,
    })),
    ...rules.not_accepted.map((x) => ({
      key: key('x', x.item_ja),
      name: { ja: x.item_ja, en: x.item_en },
      category: 'other',
      fee: null,
      collected: false,
      twoPerson: false,
      // The city's advice is summarized in English; in Japanese the page links the city's own page.
      advice: { ja: x.advice_ja ?? '粗大ごみとしては収集しません。出し方は市のページをご覧ください。', en: x.advice_en ?? 'Not collected as bulky waste. See the city’s page for how to dispose of it.' },
      source: x.source_url ?? x.source_urls[0],
    })),
  ];
  const keys = new Set(rows.map((r) => r.key));
  if (keys.size !== rows.length) throw new Error(`${dir}: ${rows.length - keys.size} duplicate item names`);
  return rows;
}

/** Entities from the files as read (`read(path)` gives the parsed JSON). */
export function catalogEntities(read) {
  return CITY_FILES.flatMap((c) => rowsOf(read(`${c.dir}/items.json`), read(`${c.dir}/rules.json`), c.dir).map((r) => toCatalogEntity(c.code, r)));
}
