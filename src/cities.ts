// The demo's two cities, and their areas in the mock plan (src/plan.ts).
// The rules come from each city's published bulky waste pages
// (data/<city>/rules.json, with sources); the facilities from
// data/facilities.json. Made-up stops are placed around a few neighbourhood
// centres; they stand for other residents' bookings, not real ones.

import type { LonLat, PlanArea } from './plan';

export interface City {
  /** The municipality code, 5 digits (as GSI's geocoder gives it). */
  code: string;
  slug: string;
  name: { ja: string; en: string };
  /** Kinds of item one booking may have, or null when the city publishes no limit. */
  maxItemKinds: number | null;
  /** The earliest collection day in the demo: this many days after today (JST). Real waits are longer (README). */
  leadDays: number;
  /** Items must be out by this time on the day (the city's page). */
  putOutBy: string;
  /** The city's service that carries bulky waste out of the home, or null when it has none. */
  carryOutService: { ja: string; en: string } | null;
  /** The demo's areas of the city: the first whose towns match, else the last. */
  areas: (PlanArea & { key: string; name: { ja: string; en: string }; towns?: RegExp })[];
}

/** How many days ahead the plan looks. */
export const WINDOW_DAYS = 14;

const MON_TO_FRI = [1, 2, 3, 4, 5];
/**
 * Where the trucks unload (data/facilities.json, from GSI's address search).
 * Since 2026-04-01 Nishinomiya's bulky waste goes to the east centre at
 * Naruohama, for both areas; Ashiya's to its centre at Hamakaze-cho. All
 * three plants are on reclaimed land by the sea.
 */
const EAST_CENTRE: LonLat = [135.362885, 34.68906];
const ASHIYA_CENTRE: LonLat = [135.322495, 34.718613];
const ring = (at: LonLat, km = 0.8) => ({ at, km });

export const CITIES: City[] = [
  {
    code: '28204',
    slug: 'nishinomiya',
    name: { ja: '西宮市', en: 'Nishinomiya' },
    // LINE bookings take up to 5 kinds of item (data/nishinomiya/rules.json).
    maxItemKinds: 5,
    leadDays: 3,
    // The web page says 8:00, the 2026 booklet 8:30: the earlier one.
    putOutBy: '08:00',
    // にこやか収集 does not cover bulky waste.
    carryOutService: null,
    areas: [
      {
        key: 'nishinomiya-north',
        name: { ja: '西宮市北部', en: 'North Nishinomiya' },
        // 山口町 and 塩瀬町 (名塩, 生瀬): north of the Rokko mountains.
        towns: /^(山口町|塩瀬町)/,
        depot: EAST_CENTRE,
        anchors: [ring([135.2430, 34.8290]), ring([135.3110, 34.8150]), ring([135.3297, 34.8086], 0.6)],
        baseline: [3, 9],
        weekdays: MON_TO_FRI,
      },
      {
        key: 'nishinomiya-south',
        name: { ja: '西宮市南部', en: 'South Nishinomiya' },
        depot: EAST_CENTRE,
        anchors: [ring([135.3595, 34.7465]), ring([135.3617, 34.7215]), ring([135.3250, 34.7440]), ring([135.3555, 34.7720]),
          ring([135.3540, 34.7330]), ring([135.3780, 34.7220]), ring([135.3170, 34.7560])],
        baseline: [10, 22],
        weekdays: MON_TO_FRI,
      },
    ],
  },
  {
    code: '28206',
    slug: 'ashiya',
    name: { ja: '芦屋市', en: 'Ashiya' },
    // No limit published.
    maxItemKinds: null,
    leadDays: 3,
    putOutBy: '08:30',
    carryOutService: { ja: 'さわやか収集', en: 'Sawayaka collection' },
    areas: [
      {
        key: 'ashiya',
        name: { ja: '芦屋市', en: 'Ashiya' },
        depot: ASHIYA_CENTRE,
        anchors: [ring([135.3065, 34.7335], 0.6), ring([135.3170, 34.7260], 0.6), ring([135.3000, 34.7400], 0.6),
          ring([135.3010, 34.7140], 0.5), ring([135.2990, 34.7480], 0.6)],
        baseline: [6, 16],
        weekdays: MON_TO_FRI,
      },
    ],
  },
];

export const cityByCode = (code: string) => CITIES.find((c) => c.code === code);
export const cityBySlug = (slug: string) => CITIES.find((c) => c.slug === slug);

/** The plan area of a town in a city. */
export function areaOf(city: City, town: string): City['areas'][number] {
  return city.areas.find((a) => a.towns?.test(town)) ?? city.areas[city.areas.length - 1]!;
}
