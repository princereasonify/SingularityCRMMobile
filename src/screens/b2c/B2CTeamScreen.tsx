import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Users, Mail, Phone } from 'lucide-react-native';
import { SearchBar, ListCard, Avatar, StatusBadge } from '../../components/crud';
import { StatTile } from '../../components/ui';
import { b2cUserService } from '../../api/b2c/b2cUserService';
import { useAppTheme } from '../../theme/useAppTheme';
import { useResponsive, Responsive } from '../../hooks/useResponsive';

/**
 * B2CTeamScreen — manager "My Team" view. Mirrors web B2CTeam.jsx: the agents who
 * report to this manager (getMyTeam), with team-size / active-leads / active-agents
 * KPIs and a per-agent list (name, email, mobile, active leads, active/inactive).
 * Read-only, like the web page — no create/edit/delete.
 */

interface TeamMember {
  id: number;
  name: string;
  email: string;
  mobile?: string | null;
  activeLeadsCount?: number;
  isActive?: boolean;
}

const DASH = '—';

const initialsOf = (name?: string) =>
  (name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

export const B2CTeamScreen = () => {
  const T = useAppTheme();
  const r = useResponsive();

  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const fetchTeam = useCallback(async () => {
    try {
      const res = await b2cUserService.getMyTeam();
      setTeam((res.data as TeamMember[]) ?? []);
    } catch {
      setTeam([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { setLoading(true); fetchTeam(); }, [fetchTeam]);

  const totalActive = team.reduce((sum, a) => sum + (a.activeLeadsCount || 0), 0);
  const activeAgents = team.filter(a => a.isActive).length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return team;
    return team.filter(a =>
      (a.name || '').toLowerCase().includes(q) ||
      (a.email || '').toLowerCase().includes(q) ||
      (a.mobile || '').toLowerCase().includes(q),
    );
  }, [team, search]);

  // Two cards per row on a tablet, one on a phone — these rows carry far too many fields
  // to survive as table columns. Width is computed rather than a percentage: `49%` twice
  // plus the gap overflows the row and silently collapses the grid back to one column.
  const cardW: number | '100%' = r.isTablet
    ? (Math.min(r.width, r.maxContentWidth) - r.gutter * 2 - r.gap) / 2
    : '100%';

  const s = useMemo(() => makeStyles(r), [r]);

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: T.bg }]} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchTeam(); }}
            tintColor={T.accent}
            colors={[T.accent]}
          />
        }
      >
        <Text style={[s.subtitle, { color: T.dim }]}>The agents who report to you</Text>

        <View style={s.statsRow}>
          <StatTile
            label="Team size"
            value={team.length}
            icon={<Users size={16} color={T.accent} strokeWidth={2.2} />}
            style={s.stat}
          />
          <StatTile label="Active leads" value={totalActive} tint={T.warning} style={s.stat} />
          <StatTile label="Active agents" value={activeAgents} tint={T.success} style={s.stat} />
        </View>

        {team.length > 0 && (
          <SearchBar value={search} onChangeText={setSearch} placeholder="Search team…" />
        )}

        {loading ? (
          <ActivityIndicator color={T.accent} style={{ marginTop: 48 }} />
        ) : team.length === 0 ? (
          <View style={[s.empty, { backgroundColor: T.card, borderColor: T.line }]}>
            <Text style={[s.emptyTitle, { color: T.text }]}>No team yet</Text>
            <Text style={[s.emptyTxt, { color: T.dim }]}>No agents assigned to you yet.</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={[s.empty, { backgroundColor: T.card, borderColor: T.line }]}>
            <Text style={[s.emptyTitle, { color: T.text }]}>No matches</Text>
            <Text style={[s.emptyTxt, { color: T.dim }]}>No agents match “{search.trim()}”.</Text>
          </View>
        ) : (
          <View style={s.grid}>
            {filtered.map(a => (
              <ListCard key={a.id} style={{ alignItems: 'flex-start', width: cardW }}>
                <Avatar initials={initialsOf(a.name)} />
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={s.rowTop}>
                    <Text style={[s.name, { color: T.text }, { flex: 1 }]} numberOfLines={1}>{a.name}</Text>
                    <StatusBadge
                      label={a.isActive ? 'Active' : 'Inactive'}
                      color={a.isActive ? T.success : T.danger}
                    />
                  </View>
                  <View style={s.metaRow}>
                    <Mail size={11} color={T.dim} strokeWidth={2} />
                    <Text style={[s.sub, { color: T.dim }]} numberOfLines={1}>{a.email || DASH}</Text>
                  </View>
                  <View style={s.metaRow}>
                    <Phone size={11} color={T.dim} strokeWidth={2} />
                    <Text style={[s.sub, { color: T.dim }]} numberOfLines={1}>{a.mobile || DASH}</Text>
                  </View>
                  <Text style={[s.sub, { color: T.sub }]}>
                    {(a.activeLeadsCount ?? 0)} active lead{(a.activeLeadsCount ?? 0) === 1 ? '' : 's'}
                  </Text>
                </View>
              </ListCard>
            ))}
          </View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

/**
 * Styles are a function of the live layout metrics, not a module-level constant: a
 * `StyleSheet.create` evaluated at import freezes every font size and padding at the launch
 * orientation, which is what leaves an iPad clipped and overlapping after a rotation.
 */
const makeStyles = (r: Responsive) => StyleSheet.create({
  safe: { flex: 1 },
  // Gutter/gap follow the device; the cap keeps a full-bleed iPad line readable.
  scroll: { padding: r.gutter, gap: r.gap, maxWidth: r.maxContentWidth, width: '100%', alignSelf: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: r.gap, alignItems: 'flex-start' },
  subtitle: { fontSize: r.rf(12.5), fontWeight: '500' },
  // Three tiles across a phone clips the labels; they wrap instead and fill a tablet row.
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: r.gap },
  stat: { flexGrow: 1, flexBasis: r.isTablet ? 200 : 140, minWidth: 130 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  name: { fontSize: r.rf(13.5), fontWeight: '700' },
  sub: { fontSize: r.rf(11.5), fontWeight: '500', flexShrink: 1 },
  empty: { borderRadius: 16, borderWidth: 1, paddingVertical: 46, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: r.rf(14), fontWeight: '700' },
  emptyTxt: { fontSize: r.rf(12.5), fontWeight: '500', textAlign: 'center' },
});
