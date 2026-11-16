// Which city and town a point is in: GSI's reverse geocoder (国土地理院
// 逆ジオコーダー). Answers {"results": {"muniCd": "28204", "lv01Nm": "甲子園口北町"}},
// or {} for the sea and places outside Japan.

import { fetchWithAgent } from './http';

export const GEOCODER_URL = 'https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress';
const TIMEOUT_MS = 5000;

export interface Place {
  /** The municipality code, 5 digits without the check digit (28204 Nishinomiya). */
  muniCd: string;
  /** The town (町・大字), or "" when the geocoder has none. */
  town: string;
}

/** The place of a point, or null when the geocoder knows none there. Throws when it does not answer. */
export async function placeOf([lon, lat]: [number, number], url = GEOCODER_URL, fetchFn: typeof fetch = fetchWithAgent): Promise<Place | null> {
  const res = await fetchFn(`${url}?lat=${lat.toFixed(6)}&lon=${lon.toFixed(6)}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new GeocoderError(res.status);
  const body = (await res.json().catch(() => null)) as { results?: { muniCd?: unknown; lv01Nm?: unknown } } | null;
  const r = body?.results;
  if (!r || typeof r.muniCd !== 'string' || !/^\d{5}$/.test(r.muniCd)) return null;
  return { muniCd: r.muniCd, town: typeof r.lv01Nm === 'string' && r.lv01Nm !== '－' ? r.lv01Nm : '' };
}

export class GeocoderError extends Error {
  constructor(readonly status: number) {
    super(`geocoder failed: ${status}`);
  }
}
