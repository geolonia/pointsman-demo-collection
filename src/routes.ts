// The bridge's two routes for a booking: the intake, then the day. In a
// module of their own, without the Workers runtime, so that the page's smoke
// tests (e2e/) write results with the same routes as the Worker.

import type { Route } from '../engine/packages/fiware/src/bridge';
import { INTAKE_INPUTS, REQUEST_TYPE, SLOT_INPUTS } from './requests';

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
