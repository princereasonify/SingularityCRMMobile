import { useEffect, useState } from 'react';
import { b2cUserService } from '../../api/b2c/b2cUserService';
import { b2cCounselorService } from '../../api/b2c/b2cCounselorService';

/**
 * Shared B2CAdmin "view as" roster — mirrors the web's src/components/b2c/useFieldStaff.js
 * + PersonFilter.jsx exactly (same two endpoints, same label format, same cache shape),
 * so every B2C admin filter dropdown across the app (leads list, pipeline, counseling
 * queue, geo-compliance) shows the identical "Name · City · N students" text and stays
 * in sync with a single fetch instead of each screen re-querying + re-formatting on its own.
 *
 * `city` and `activeLeads` are never computed client-side — both come straight from the
 * backend's grouped-by-agent/counselor lead queries (B2CUserService.MapUsersWithCounselorStatsAsync,
 * B2CCounselorService.GetCounselorsAsync — PrimaryCity / ActiveLeadsCount).
 */

export interface FieldStaffAgent {
  id: number;
  name: string;
  city: string | null;
  activeLeads: number | null;
  isManager: boolean;
}

export interface FieldStaffCounselor {
  id: number;
  userId: number;
  name: string;
  city: string | null;
  activeLeads: number | null;
}

export type FieldPersonSelection =
  | { kind: 'agent'; agentId: number; name: string; isManager?: boolean }
  | { kind: 'counselor'; counselorId: number; counselorUserId: number; name: string };

interface FieldStaffData {
  agents: FieldStaffAgent[];
  counselors: FieldStaffCounselor[];
}

// Module-level cache shared across every hook instance/screen — always fetches BOTH
// rosters together regardless of whether a given screen needs counselors, de-duped via
// a single in-flight promise so several screens mounting at once fire one request, not N.
let cache: FieldStaffData | null = null;
let inflight: Promise<FieldStaffData> | null = null;

async function fetchFieldStaff(): Promise<FieldStaffData> {
  const [usersRes, counselorsRes] = await Promise.all([
    b2cUserService.getUsers({ role: 'Agent', pageSize: 200 }).catch(() => null),
    b2cCounselorService.getCounselors({ pageSize: 200 }).catch(() => null),
  ]);
  const agentItems = usersRes?.data?.items ?? [];
  const counselorItems = counselorsRes?.data?.items ?? [];
  return {
    agents: agentItems.map(u => ({
      id: u.id,
      name: u.name,
      city: u.primaryCity ?? null,
      activeLeads: u.activeLeadsCount ?? null,
      isManager: !!u.isManager,
    })),
    counselors: counselorItems.map(c => ({
      id: c.id,
      userId: c.userId,
      name: c.name,
      city: c.primaryCity ?? null,
      activeLeads: c.activeLeadsCount ?? null,
    })),
  };
}

/**
 * `enabled` (default true) exists for screens shared across roles where only
 * some viewers use the roster (e.g. B2CLeadsListScreen/B2CPipelineScreen render
 * the "view as" filter for B2CAdmin only, but Agent/Counselor also mount the
 * same screen component) — `getUsers` is B2CAdmin-only server-side, so an
 * Agent/Counselor firing it would just be a guaranteed-403 wasted request.
 * Screens reachable by B2CAdmin alone can ignore this and always get the data.
 */
export function useFieldStaff(enabled: boolean = true): FieldStaffData & { loading: boolean } {
  const [state, setState] = useState<FieldStaffData & { loading: boolean }>(() => ({
    agents: cache?.agents ?? [],
    counselors: cache?.counselors ?? [],
    loading: !cache && enabled,
  }));

  useEffect(() => {
    if (!enabled) return;
    if (cache) { setState({ ...cache, loading: false }); return; }
    if (!inflight) {
      inflight = fetchFieldStaff()
        .then(result => { cache = result; return result; })
        .finally(() => { inflight = null; });
    }
    let live = true;
    inflight.then(result => { if (live) setState({ ...result, loading: false }); });
    return () => { live = false; };
  }, [enabled]);

  return state;
}

/** Call after creating/editing/deleting an agent or counselor so every open filter
 *  dropdown picks up the change on next mount instead of showing stale rosters. */
export function invalidateFieldStaff(): void {
  cache = null;
  inflight = null;
}

/** "Priya Shah · Ahmedabad · 15 students" — city and count are dropped from the label
 *  (not shown as blank/zero) when the backend has nothing for that person yet. */
export function personOptionLabel(
  p: { name: string; city?: string | null; activeLeads?: number | null },
  opts?: { isManager?: boolean },
): string {
  const parts = [p.name];
  if (p.city) parts.push(p.city);
  if (typeof p.activeLeads === 'number') {
    parts.push(`${p.activeLeads} ${p.activeLeads === 1 ? 'student' : 'students'}`);
  }
  return parts.join(' · ') + (opts?.isManager ? ' • Manager' : '');
}

/**
 * Builds the flat `{label, value}[]` a Trigger+Dropdown pair renders — an "Everyone" row,
 * then every agent, then every counselor (when included). Encoded value: '' | 'a:<id>' | 'c:<id>',
 * matching every existing B2C screen's agentId/counselorId query-param pattern.
 */
export function buildPersonFilterOptions(
  agents: FieldStaffAgent[],
  counselors: FieldStaffCounselor[],
  opts?: { includeCounselors?: boolean; allLabel?: string },
): { label: string; value: string }[] {
  const includeCounselors = opts?.includeCounselors ?? true;
  const options = [{ label: opts?.allLabel ?? 'Everyone', value: '' }];
  for (const a of agents) {
    options.push({ label: personOptionLabel(a, { isManager: a.isManager }), value: `a:${a.id}` });
  }
  if (includeCounselors) {
    for (const c of counselors) {
      options.push({ label: personOptionLabel(c), value: `c:${c.id}` });
    }
  }
  return options;
}

/** Decodes an encoded filter value ('' | 'a:<id>' | 'c:<id>') back into the full selection,
 *  resolving the display name/isManager/counselorUserId from the current roster. */
export function resolvePersonSelection(
  value: string,
  agents: FieldStaffAgent[],
  counselors: FieldStaffCounselor[],
): FieldPersonSelection | null {
  if (!value) return null;
  const [kind, idStr] = value.split(':');
  const id = Number(idStr);
  if (kind === 'a') {
    const a = agents.find(x => x.id === id);
    return { kind: 'agent', agentId: id, name: a?.name ?? 'Agent', isManager: a?.isManager };
  }
  const c = counselors.find(x => x.id === id);
  return { kind: 'counselor', counselorId: id, counselorUserId: c?.userId ?? id, name: c?.name ?? 'Counselor' };
}
