// Settings of the demo Worker (wrangler.jsonc vars and secrets).

import type { BridgeMessage } from '../engine/packages/fiware/src/bridge';

export interface Env {
  // Vars
  BROKER_URL: string;
  BROKER_TENANT: string;
  POINTSMAN_URL: string;
  /** Bookings per day for the whole demo (the bookings of the last day are counted). */
  DAILY_LIMIT?: string;
  /** GSI's reverse geocoder: which city and town a point is in. */
  GEOCODER_URL?: string;
  // Secrets
  BROKER_API_KEY: string;
  /** The bridge: a Pointsman token limited to bulky-waste-intake and bulky-waste-slot. Without it, no bookings are taken. */
  POINTSMAN_TOKEN?: string;
  /** The bridge: the secret every broker subscription sends (x-bridge-secret). */
  NOTIFY_SECRET?: string;
  // Bindings
  ASSETS: Fetcher;
  /** Bookings per visitor and minute, and for all visitors together. */
  REQUEST_LIMIT?: RateLimit;
  ALL_REQUESTS_LIMIT?: RateLimit;
  /** The bridge's queue: the slot route builds on the intake, and chained routes run only from the queue. */
  BRIDGE_QUEUE?: Queue<BridgeMessage>;
  /** Its dead-letter queue, as a producer: messages no retry can fix go there at once. */
  BRIDGE_DLQ?: Queue<BridgeMessage>;
}

const isServiceUrl = (value: string) => {
  const u = URL.parse(value);
  return !!u && (u.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(u.hostname));
};

/** Throws naming the first missing or invalid setting for reading the broker. */
export function checkEnv(env: Env): void {
  for (const name of ['BROKER_URL', 'BROKER_TENANT', 'BROKER_API_KEY'] as const) if (!env[name]) throw new Error(`${name} is not set`);
  if (!isServiceUrl(env.BROKER_URL)) throw new Error('BROKER_URL must be an https URL (http only for localhost)');
}

/**
 * Whether bookings are taken: the bridge and its queue (the slot route is a
 * chained route), so no booking waits for a decision that never comes.
 */
export function bridgeReady(env: Env): boolean {
  return !!env.POINTSMAN_TOKEN && !!env.NOTIFY_SECRET && isServiceUrl(env.POINTSMAN_URL ?? '') && !!env.BRIDGE_QUEUE;
}

/** The URL without trailing slashes (a loop, not a regex that can take long on many slashes). */
export const trimUrl = (u: string) => {
  let end = u.length;
  while (end > 0 && u[end - 1] === '/') end -= 1;
  return u.slice(0, end);
};
