/**
 * distanceProvenance.ts
 *
 * Plain-language reading of the two fields that accompany every travelled distance:
 * `distanceMethod` (how it was measured) and `distanceStatus` (whether it is finished).
 *
 * They are independent, and both matter. A map-matched total at noon is high quality and still
 * provisional, because the agent has not stopped travelling; a road-snapped total at end of day
 * is final and still second-rate. An agent who sees 18.4 km at lunch and 17.9 km on their payslip
 * has no way to tell a correction from a fault unless the screen says which is which.
 *
 * Mirrors Sales_CRM_Web/src/utils/distanceProvenance.js — the same strings on both clients, so a
 * distance never means two things depending on where it is read.
 */

export const DISTANCE_STATUS = {
  NO_DATA: 'NO_DATA',
  LIVE_PROVISIONAL: 'LIVE_PROVISIONAL',
  SETTLED: 'SETTLED',
  FALLBACK: 'FALLBACK',
} as const;

const METHOD_PHRASE: Record<string, string> = {
  MapMatched: 'measured along the roads travelled',
  RoadSnapped: 'measured along snapped roads',
  RawHaversine: 'estimated from straight lines between points',
  None: 'not enough location data to measure',
};

/** Short label for the method alone, for a breakdown cell where the header supplies context. */
export const distanceMethodLabel = (method?: string | null): string => {
  switch (method) {
    case 'MapMatched':   return 'Road matched';
    case 'RoadSnapped':  return 'Road snapped';
    case 'RawHaversine': return 'Estimated';
    case 'None':         return '—';
    default:             return '—';
  }
};

/**
 * A caption for under a distance figure.
 *
 * Status leads where it changes how the number should be read — saying a figure is still moving
 * pre-empts the "it changed" question rather than answering it later.
 */
export const distanceHint = (method?: string | null, status?: string | null): string | undefined => {
  const phrase = method ? METHOD_PHRASE[method] : undefined;

  if (status === DISTANCE_STATUS.NO_DATA) return 'Not enough location data yet';
  if (status === DISTANCE_STATUS.LIVE_PROVISIONAL) {
    return phrase ? `Still tracking — ${phrase}` : 'Still tracking — final at end of day';
  }
  if (status === DISTANCE_STATUS.FALLBACK && phrase) return `Final — ${phrase}`;
  if (status === DISTANCE_STATUS.SETTLED && phrase) return `Final — ${phrase}`;

  // Older responses carry only a method; describe that alone rather than nothing.
  return phrase ? phrase[0].toUpperCase() + phrase.slice(1) : undefined;
};

/** Whether the figure is still moving, so callers can qualify it. */
export const isProvisional = (status?: string | null): boolean =>
  status === DISTANCE_STATUS.LIVE_PROVISIONAL;

/** Confidence as a percentage, or null when the rung used reports none of its own. */
export const confidenceLabel = (matchConfidence?: number | null): string | null =>
  matchConfidence == null ? null : `${Math.round(Number(matchConfidence) * 100)}% match confidence`;
