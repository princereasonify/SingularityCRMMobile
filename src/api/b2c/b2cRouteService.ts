import { apiClient } from '../client';
import { RouteMatrixDto, RoutePlanDto, SaveRoutePlanRequest } from '../../types/b2c';

export const b2cRouteService = {
  /**
   * Real driving durations/distances between points.
   *
   * Server-side because Distance Matrix is billable and its key is IP-restricted — it must
   * never sit in an app bundle. The optimizer itself runs on-device: it is pure arithmetic over
   * this matrix and re-runs whenever a student is ticked, so a round trip per tick would be
   * both slow and pointless.
   */
  getMatrix: (points: { latitude: number; longitude: number }[]) =>
    apiClient.post<RouteMatrixDto>('/b2c/routes/matrix', { points }),

  /**
   * Commits the optimised order for a day so arrivals can be confirmed against it. Re-saving
   * the same day replaces it — the planner is re-run freely until the day is closed.
   */
  savePlan: (payload: SaveRoutePlanRequest) =>
    apiClient.post<RoutePlanDto>('/b2c/route-plans/save', payload),

  /** The saved plan for a day, with whatever the tracker has confirmed so far. */
  getPlan: (date: string) =>
    apiClient.get<RoutePlanDto | null>('/b2c/route-plans', { params: { date } }),
};
