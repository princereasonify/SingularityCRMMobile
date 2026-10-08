import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import {
  MapPin, Presentation, Phone, UserCheck, Clock, Bell, ChevronRight,
} from 'lucide-react-native';
import { ICON_STROKE } from '../../components/common/Icon';
import { Card } from '../../components/ui';
import { weeklyPlanApi } from '../../api/weeklyPlan';
import { useAppTheme } from '../../theme/useAppTheme';
import { withAlpha, SOFT_TINT } from '../../theme';
import { isoDate } from '../../utils/dates';
import { rf } from '../../utils/responsive';

/**
 * "Team Plans — Today & Tomorrow" for the ZH and RH dashboards. Mirrors web
 * zh/ZoneDashboard.jsx + rh/RegionDashboard.jsx: read this week's team plans, keep only
 * the ones a manager has signed off (Approved / EditedByManager), prefer the manager's
 * edits over the FO's draft, and bucket every activity onto today or tomorrow.
 */

export type TeamActivity = {
  type?: string;
  schoolName?: string;
  notes?: string;
  foName?: string;
};

type Buckets = { today: TeamActivity[]; tomorrow: TeamActivity[] };

const EMPTY: Buckets = { today: [], tomorrow: [] };

/** Backend stores planData/managerEdits as a JSON string — tolerate both string and array. */
const parseDays = (raw: any): any[] => {
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== 'string') return [];
  try {
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
};

/** Loads and buckets the team's approved activities; `reload` re-reads them. */
export const useTeamActivities = () => {
  const [acts, setActs] = useState<Buckets>(EMPTY);
  const tokenRef = useRef(0);

  const reload = useCallback(async () => {
    const token = ++tokenRef.current;
    // All three keys are LOCAL calendar days — the plan's `date` fields are local too.
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const todayKey = isoDate(today);
    const tomorrowKey = isoDate(tomorrow);

    try {
      const res = await weeklyPlanApi.getTeam(isoDate(monday));
      if (tokenRef.current !== token) return;
      const next: Buckets = { today: [], tomorrow: [] };
      (res.data || []).forEach((p: any) => {
        if (p?.status !== 'Approved' && p?.status !== 'EditedByManager') return;
        parseDays(p.managerEdits || p.planData).forEach((d: any) => {
          (d?.activities || []).forEach((act: any) => {
            const item: TeamActivity = { ...act, foName: p.userName };
            if (d.date === todayKey) next.today.push(item);
            if (d.date === tomorrowKey) next.tomorrow.push(item);
          });
        });
      });
      setActs(next);
    } catch {
      // Web swallows this too — the panel simply stays hidden.
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  return { teamActivities: acts, reloadTeamActivities: reload };
};

const ACT_ICON: Record<string, any> = {
  Visit: MapPin, Demo: Presentation, Call: Phone, Meeting: UserCheck, FollowUp: Clock,
};

export const hasTeamActivities = (b: Buckets) => b.today.length > 0 || b.tomorrow.length > 0;

/**
 * The panel itself. `wide` = the bounded iPad layout, where the list scrolls internally
 * (same contract as each dashboard's PanelBody); on the phone the page scrolls.
 */
export const TeamPlansPanel = ({
  activities, wide, onViewAll,
}: {
  activities: Buckets;
  wide: boolean;
  onViewAll: () => void;
}) => {
  const T = useAppTheme();

  const renderList = (acts: TeamActivity[], label: string) => (
    <View style={[s.list, { backgroundColor: T.cardAlt, borderColor: T.line }]}>
      <View style={s.listHead}>
        <Bell size={13} color={T.accent} strokeWidth={ICON_STROKE} />
        <Text numberOfLines={1} style={[s.listLbl, { color: T.text }]}>{label}</Text>
        <View style={s.spacer} />
        <View style={[s.countPill, { backgroundColor: T.accent }]}>
          <Text style={s.countPillTxt}>{acts.length}</Text>
        </View>
      </View>
      {acts.map((act, i) => {
        const Ico = ACT_ICON[act.type || ''] || Clock;
        return (
          <View key={i} style={[s.row, { backgroundColor: T.card, borderColor: T.line }]}>
            <View style={[s.rowIcon, { backgroundColor: withAlpha(T.accent, SOFT_TINT) }]}>
              <Ico size={14} color={T.accent} strokeWidth={ICON_STROKE} />
            </View>
            <View style={s.flexMin}>
              <Text numberOfLines={1} style={[s.rowTitle, { color: T.text }]}>
                {act.schoolName || 'Activity'}
              </Text>
              <Text numberOfLines={2} style={[s.rowSub, { color: T.sub }]}>
                {act.foName} · {act.type}{act.notes ? ` · ${act.notes}` : ''}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );

  const body = (
    <>
      {activities.today.length > 0 && renderList(activities.today, "Today's Activities")}
      {activities.tomorrow.length > 0 && renderList(activities.tomorrow, "Tomorrow's Activities")}
    </>
  );

  return (
    <Card style={[s.panel, { padding: 13 }, !wide && s.panelPhone]}>
      <View style={s.head}>
        <Text numberOfLines={1} style={[s.h3, { color: T.text }]}>Team Plans — Today & Tomorrow</Text>
        <View style={s.spacer} />
        <TouchableOpacity onPress={onViewAll} activeOpacity={0.8} hitSlop={8} style={s.linkBtn}>
          <Text style={[s.link, { color: T.accent }]}>View All Plans</Text>
          <ChevronRight size={12} color={T.accent} strokeWidth={ICON_STROKE} />
        </TouchableOpacity>
      </View>
      {wide ? (
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.gap}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
        >
          {body}
        </ScrollView>
      ) : (
        <View style={s.gap}>{body}</View>
      )}
    </Card>
  );
};

const s = StyleSheet.create({
  panel: { flex: 1 },
  panelPhone: { minHeight: 190 },
  scroll: { flex: 1, minHeight: 0 },
  gap: { gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  h3: { fontSize: rf(13.5), fontWeight: '700', flexShrink: 1, minWidth: 0 },
  spacer: { flex: 1, minWidth: 0 },
  linkBtn: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 1 },
  link: { fontSize: rf(10.5), fontWeight: '700' },

  list: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 10, gap: 6 },
  listHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  listLbl: {
    fontSize: rf(10.5), fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4,
    flexShrink: 1, minWidth: 0,
  },
  countPill: { flexShrink: 0, minWidth: 20, paddingHorizontal: 7, paddingVertical: 1, borderRadius: 9 },
  countPillTxt: { fontSize: rf(9.5), fontWeight: '700', color: '#FFF', textAlign: 'center' },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 9, padding: 9,
    borderRadius: 10, borderWidth: StyleSheet.hairlineWidth,
  },
  rowIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  flexMin: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: rf(12.5), fontWeight: '600' },
  rowSub: { fontSize: rf(10.5), fontWeight: '400', marginTop: 1 },
});
