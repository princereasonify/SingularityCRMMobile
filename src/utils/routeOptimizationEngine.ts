/**
 * routeOptimizationEngine — VRPTW (Vehicle Routing Problem with Time Windows) for a field
 * agent's day.
 *
 * Replaces the greedy nearest-neighbour pass that used to order stops by straight-line distance.
 * Two things were wrong with that:
 *
 *   1. Haversine is not travel time. Two homes 800 m apart across a railway line can be a
 *      fifteen-minute drive; a river, a one-way system or a flyover with no exit all make the
 *      shortest line the slowest road. Scheduling on it produces a route that looks tight on a
 *      map and cannot be driven.
 *   2. Nearest-neighbour ignores commitments. An appointment at 09:00 is not a preference — the
 *        family is waiting. A planner that treats it as one more point to sort will cheerfully
 *        put the nearest stop first and make the agent late for the only stop that was promised.
 *
 * So: fixed appointments are ANCHORS taken in time order, flexible leads are inserted into the
 * gaps between them only where the arithmetic says the next anchor is still reachable, and a
 * 2-opt pass then untangles any crossings the insertion order left behind.
 *
 * Pure arithmetic over a matrix the caller supplies — no I/O, no platform APIs — so the same
 * engine runs on web and mobile and is trivially testable. The billable road lookup that feeds
 * it lives on the server (POST /b2c/routes/matrix).
 *
 * Mirrored in Sales_CRM_Web/src/utils/routeOptimizationEngine.js — keep the two in step.
 */

// ─── Parameters ────────────────────────────────────────────────────────────────
/** When a day starts if nothing forces it earlier. */
export const DEFAULT_START_HOUR = 9;
/** Time spent with one family. */
export const DWELL_MINUTES = 30;
/** Never cut an appointment finer than this. Absorbs traffic noise and parking. */
export const BUFFER_MINUTES = 10;

const MIN = 60_000;

// ─── Types ─────────────────────────────────────────────────────────────────────

/**
 * A location the day can include. Deliberately polymorphic: an institutional visit (a school)
 * and a residential one (a student's home) differ only in how long you stay and how strongly
 * they should be kept, so they are the same type with different numbers.
 */
export interface RouteStopInput {
  id: string | number;
  name: string;
  latitude: number;
  longitude: number;
  /** 'institutional' visits tend to run longer than a doorstep conversation. */
  leadType?: 'institutional' | 'b2c_student';
  /** Overrides DWELL_MINUTES for this stop — a school demo is not a 30-minute call. */
  dwellMinutes?: number;
  /**
   * A promised time. Present ⇒ this stop is an ANCHOR: its position is fixed by the clock, not
   * chosen by the optimizer. Absent ⇒ flexible, inserted wherever it fits.
   */
  appointmentAt?: Date | null;
  /** Higher wins when two flexible stops compete for the same gap. */
  priority?: number;
}

export interface PlannedStop extends RouteStopInput {
  /** Position in the final order, 0-based. */
  stopOrderIndex: number;
  isFixedAppointment: boolean;
  /** When the agent is expected to arrive. */
  eta: Date;
  /** eta + dwell. */
  departure: Date;
  /** Drive from the previous stop, in seconds. */
  travelSecondsFromPrev: number;
  /** Drive from the previous stop, in metres. */
  travelMetresFromPrev: number;
  /** An anchor the plan cannot reach in time. Reported, never silently reordered. */
  isLate: boolean;
}

export interface RoutePlanResult {
  stops: PlannedStop[];
  /** Flexible stops that did not fit without making a promised time impossible. */
  unscheduled: RouteStopInput[];
  /** When to set off. Derived backwards from the first stop. */
  departBy: Date;
  totalTravelSeconds: number;
  totalTravelMetres: number;
  /** Human-readable countdown, e.g. "Leave by 08:20 am to reach your 09:00 am stop". */
  alerts: string[];
  /** How the order was produced — recorded with the saved plan. */
  optimizationMethod: 'VRPTW_2OPT_ROAD_MATRIX' | 'VRPTW_2OPT_HAVERSINE';
}

/**
 * [origin][destination] driving cost. `durations` in seconds, `distances` in metres, indexed by
 * position in the points array the matrix was built from. -1 means unreachable.
 */
export interface RouteMatrix {
  durations: number[][];
  distances: number[][];
}

// ─── Matrix access ─────────────────────────────────────────────────────────────

/** Great-circle metres. Only used to synthesise a matrix when the road one is unavailable. */
export function haversineMetres(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const R = 6371000, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude), dLng = toRad(b.longitude - a.longitude);
  const x = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/**
 * A last-resort matrix from straight lines at an assumed city speed.
 *
 * Explicitly a FALLBACK. It is what the old planner did for everything, and it is wrong for all
 * the reasons in the file header — but a planner that refuses to plan when the network is down
 * is worse than one that plans approximately and says so. The result is tagged
 * VRPTW_2OPT_HAVERSINE so nobody mistakes it for a road-matrix plan later.
 */
const FALLBACK_SPEED_KMH = 25;
export function haversineMatrix(points: RouteStopInput[]): RouteMatrix {
  const n = points.length;
  const durations: number[][] = [], distances: number[][] = [];
  for (let i = 0; i < n; i++) {
    durations[i] = []; distances[i] = [];
    for (let j = 0; j < n; j++) {
      const m = i === j ? 0 : haversineMetres(points[i], points[j]);
      distances[i][j] = Math.round(m);
      durations[i][j] = Math.round((m / 1000 / FALLBACK_SPEED_KMH) * 3600);
    }
  }
  return { durations, distances };
}

/** Travel seconds, treating an unreachable pair as prohibitively expensive rather than free. */
const dur = (m: RouteMatrix, i: number, j: number): number => {
  const v = m.durations?.[i]?.[j];
  // -1 (no drivable route) must never read as 0 — that would look like "already there" and pull
  // an unreachable stop to the front of the day.
  return v == null || v < 0 ? Number.POSITIVE_INFINITY : v;
};
const dist = (m: RouteMatrix, i: number, j: number): number => {
  const v = m.distances?.[i]?.[j];
  return v == null || v < 0 ? 0 : v;
};

const dwellMs = (s: RouteStopInput): number =>
  (s.dwellMinutes ?? (s.leadType === 'institutional' ? 45 : DWELL_MINUTES)) * MIN;

// ─── The optimizer ─────────────────────────────────────────────────────────────

export interface OptimizeOptions {
  /** Where the day starts. Omit when unknown — the first stop then becomes the origin. */
  origin?: { latitude: number; longitude: number } | null;
  /** The local day being planned, as `yyyy-mm-dd`. Anchors outside it are treated as flexible. */
  dateStr: string;
  /** Earliest possible departure — "now" for today, midnight for a future date. */
  earliest: Date;
  /** Road matrix over [origin, ...stops]. Omit to fall back to straight lines. */
  matrix?: RouteMatrix | null;
}

/**
 * Orders one day's stops around the appointments that cannot move.
 *
 * The matrix is indexed [0] = origin, [1..n] = stops in the order given. When no origin is
 * supplied index 0 is the first stop, which is why `originIndex` is resolved once up front.
 */
export function optimizeRoute(
  inputs: RouteStopInput[],
  opts: OptimizeOptions,
): RoutePlanResult {
  const method: RoutePlanResult['optimizationMethod'] =
    opts.matrix ? 'VRPTW_2OPT_ROAD_MATRIX' : 'VRPTW_2OPT_HAVERSINE';

  if (inputs.length === 0) {
    return {
      stops: [], unscheduled: [], departBy: opts.earliest,
      totalTravelSeconds: 0, totalTravelMetres: 0, alerts: [], optimizationMethod: method,
    };
  }

  // One index space for everything: 0 = origin, 1..n = the stops.
  const originPoint = opts.origin ?? inputs[0];
  const nodes = [originPoint as RouteStopInput, ...inputs];
  const matrix = opts.matrix ?? haversineMatrix(nodes);
  // Keyed by ID, not by object identity: a PlannedStop is a SPREAD COPY of its input, so
  // inputs.indexOf(plannedStop) is -1 — which silently became index 0 (the origin) and made
  // every post-2-opt travel time zero. That is what let an unreachable appointment report as
  // arriving exactly on time.
  const indexById = new Map<string | number, number>(inputs.map((s, i) => [s.id, i + 1]));
  const idxOf = (s: RouteStopInput) => indexById.get(s.id) ?? 0;
  const ORIGIN = 0;

  // An appointment only anchors the day it belongs to. One booked for tomorrow is a commitment,
  // but not one that constrains today, so it is planned as flexible.
  const onThisDay = (s: RouteStopInput) =>
    !!s.appointmentAt && localDateStr(s.appointmentAt) === opts.dateStr;

  const anchors = inputs.filter(onThisDay)
    .sort((a, b) => a.appointmentAt!.getTime() - b.appointmentAt!.getTime());
  const flexible = inputs.filter(s => !onThisDay(s))
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

  // ── Step 1: depart early enough for the first promise ────────────────────────
  // Anchoring the day rigidly at 09:00 would report a 09:00 stop twelve kilometres out as
  // unreachable when the real answer is "leave at half past eight".
  const dayStart = new Date(`${opts.dateStr}T${String(DEFAULT_START_HOUR).padStart(2, '0')}:00`);
  let clock = Math.max(opts.earliest.getTime(), Math.min(
    dayStart.getTime(),
    anchors.length
      ? anchors[0].appointmentAt!.getTime() - dur(matrix, ORIGIN, idxOf(anchors[0])) * 1000 - BUFFER_MINUTES * MIN
      : dayStart.getTime(),
  ));

  const route: PlannedStop[] = [];
  const pool = [...flexible];
  let cursor = ORIGIN;

  const place = (s: RouteStopInput, arriveMs: number, late = false) => {
    const i = idxOf(s);
    route.push({
      ...s,
      stopOrderIndex: route.length,
      isFixedAppointment: onThisDay(s),
      eta: new Date(arriveMs),
      departure: new Date(arriveMs + dwellMs(s)),
      travelSecondsFromPrev: Number.isFinite(dur(matrix, cursor, i)) ? dur(matrix, cursor, i) : 0,
      travelMetresFromPrev: dist(matrix, cursor, i),
      isLate: late,
    });
    cursor = i;
    clock = arriveMs + dwellMs(s);
  };

  // ── Steps 2–3: fill each gap, then take the anchor ───────────────────────────
  for (const anchor of anchors) {
    const aIdx = idxOf(anchor);
    const promised = anchor.appointmentAt!.getTime();

    // Insert flexible stops while they genuinely fit before the promise.
    for (;;) {
      if (pool.length === 0) break;

      // ΔCost(i, X, j) = travel(i,X) + dwell(X) + travel(X,j) − travel(i,j)
      let best = -1, bestCost = Number.POSITIVE_INFINITY;
      for (let k = 0; k < pool.length; k++) {
        const xIdx = idxOf(pool[k]);
        const cost = dur(matrix, cursor, xIdx) + dwellMs(pool[k]) / 1000 + dur(matrix, xIdx, aIdx)
                   - dur(matrix, cursor, aIdx);
        if (cost < bestCost) { bestCost = cost; best = k; }
      }
      if (best === -1 || !Number.isFinite(bestCost)) break;

      const cand = pool[best];
      const xIdx = idxOf(cand);
      const arriveX = clock + dur(matrix, cursor, xIdx) * 1000;
      const reachAnchor = arriveX + dwellMs(cand) + dur(matrix, xIdx, aIdx) * 1000;

      // Feasibility gate: ETA(X) + dwell(X) + travel(X,j) ≤ promised − buffer.
      if (reachAnchor > promised - BUFFER_MINUTES * MIN) break;

      pool.splice(best, 1);
      place(cand, arriveX);
    }

    // The anchor itself. Arriving early means waiting, which is fine and shown as the promised
    // time; arriving late is reported rather than fixed by reordering, because the remedy —
    // drop a stop or call the family — is the agent's decision, not the planner's.
    const arrive = clock + dur(matrix, cursor, aIdx) * 1000;
    place(anchor, Math.max(arrive, promised), arrive > promised);
  }

  // ── Everything left, cheapest-next ──────────────────────────────────────────
  while (pool.length) {
    let best = 0, bestCost = dur(matrix, cursor, idxOf(pool[0]));
    for (let k = 1; k < pool.length; k++) {
      const c = dur(matrix, cursor, idxOf(pool[k]));
      if (c < bestCost) { bestCost = c; best = k; }
    }
    const next = pool.splice(best, 1)[0];
    place(next, clock + (Number.isFinite(bestCost) ? bestCost : 0) * 1000);
  }

  // ── Step 4: 2-opt, within anchor boundaries only ────────────────────────────
  twoOptWithinAnchors(route, matrix, idxOf, ORIGIN);
  recomputeSchedule(route, matrix, idxOf, ORIGIN, clockStart(route, opts, matrix, idxOf, ORIGIN, anchors));

  const totalTravelSeconds = route.reduce((a, s) => a + s.travelSecondsFromPrev, 0);
  const totalTravelMetres = route.reduce((a, s) => a + s.travelMetresFromPrev, 0);
  const departBy = route.length
    ? new Date(route[0].eta.getTime() - route[0].travelSecondsFromPrev * 1000)
    : opts.earliest;

  return {
    stops: route,
    unscheduled: pool,
    departBy,
    totalTravelSeconds,
    totalTravelMetres,
    alerts: buildAlerts(route, departBy),
    optimizationMethod: method,
  };
}

// ─── 2-opt ─────────────────────────────────────────────────────────────────────

/**
 * Edge-swap local search: if crossing two edges is longer than uncrossing them, reverse the
 * span between. Classic 2-opt, with one constraint — it may only reorder stops BETWEEN fixed
 * appointments. Reversing across an anchor would move a promised time, which is the one thing
 * the schedule is built to protect.
 */
function twoOptWithinAnchors(
  route: PlannedStop[], matrix: RouteMatrix,
  idxOf: (s: RouteStopInput) => number, originIndex: number,
): void {
  // Segment boundaries: the origin, every anchor, and the end of the day.
  const bounds: number[] = [-1];
  route.forEach((s, i) => { if (s.isFixedAppointment) bounds.push(i); });
  bounds.push(route.length);

  for (let b = 0; b < bounds.length - 1; b++) {
    const from = bounds[b] + 1, to = bounds[b + 1] - 1;   // inclusive flexible span
    if (to - from < 1) continue;

    let improved = true;
    // Bounded: 2-opt can otherwise ping-pong on ties, and a planner that never returns is
    // worse than a route with one crossing left in it.
    let guard = 0;
    while (improved && guard++ < 50) {
      improved = false;
      for (let a = from; a <= to - 1; a++) {
        for (let c = a + 1; c <= to; c++) {
          const prev = a === 0 ? originIndex : idxOf(route[a - 1]);
          const next = c === route.length - 1 ? null : idxOf(route[c + 1]);
          const A = idxOf(route[a]), C = idxOf(route[c]);

          const before = dur(matrix, prev, A) + (next == null ? 0 : dur(matrix, C, next));
          const after = dur(matrix, prev, C) + (next == null ? 0 : dur(matrix, A, next));
          if (after < before - 1) {          // 1s deadband, so float noise cannot loop forever
            route.splice(a, c - a + 1, ...route.slice(a, c + 1).reverse());
            improved = true;
          }
        }
      }
    }
  }
  route.forEach((s, i) => { s.stopOrderIndex = i; });
}

// ─── Schedule recomputation ────────────────────────────────────────────────────

function clockStart(
  route: PlannedStop[], opts: OptimizeOptions, matrix: RouteMatrix,
  idxOf: (s: RouteStopInput) => number, originIndex: number, anchors: RouteStopInput[],
): number {
  const dayStart = new Date(`${opts.dateStr}T${String(DEFAULT_START_HOUR).padStart(2, '0')}:00`).getTime();
  if (!anchors.length || !route.length) return Math.max(opts.earliest.getTime(), dayStart);
  const first = anchors[0];
  const leaveBy = first.appointmentAt!.getTime()
    - dur(matrix, originIndex, idxOf(first)) * 1000 - BUFFER_MINUTES * MIN;
  return Math.max(opts.earliest.getTime(), Math.min(dayStart, leaveBy));
}

/** Re-walks the route after 2-opt so every ETA reflects the final order, not the pre-swap one. */
function recomputeSchedule(
  route: PlannedStop[], matrix: RouteMatrix,
  idxOf: (s: RouteStopInput) => number, originIndex: number, startMs: number,
): void {
  let cursor = originIndex;
  let clock = startMs;
  for (const s of route) {
    const i = idxOf(s);
    const travel = dur(matrix, cursor, i);
    const seconds = Number.isFinite(travel) ? travel : 0;
    const arrive = clock + seconds * 1000;
    const promised = s.isFixedAppointment && s.appointmentAt ? s.appointmentAt.getTime() : null;

    s.travelSecondsFromPrev = seconds;
    s.travelMetresFromPrev = dist(matrix, cursor, i);
    s.eta = new Date(promised != null ? Math.max(arrive, promised) : arrive);
    s.isLate = promised != null && arrive > promised;
    s.departure = new Date(s.eta.getTime() + dwellMs(s));

    cursor = i;
    clock = s.departure.getTime();
  }
}

// ─── Alerts ────────────────────────────────────────────────────────────────────

function buildAlerts(route: PlannedStop[], departBy: Date): string[] {
  const out: string[] = [];
  if (!route.length) return out;

  const firstAnchor = route.find(s => s.isFixedAppointment);
  if (firstAnchor) {
    out.push(`Leave by ${clockLabel(departBy)} to reach your ${clockLabel(firstAnchor.appointmentAt!)} stop.`);
  } else {
    out.push(`Leave by ${clockLabel(departBy)} to finish the day as planned.`);
  }

  for (const s of route) {
    if (s.isLate) {
      out.push(`${s.name}: promised ${clockLabel(s.appointmentAt!)} but the plan arrives ${clockLabel(s.eta)} — reschedule or drop a stop.`);
    }
  }
  return out;
}

const clockLabel = (d: Date): string =>
  d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

const localDateStr = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
