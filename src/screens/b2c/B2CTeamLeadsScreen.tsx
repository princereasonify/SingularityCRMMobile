import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Filter, Users, Phone, MapPin } from 'lucide-react-native';
import { ICON_STROKE } from '../../components/common/Icon';
import {
  SearchBar, Trigger, Dropdown, FilterChip, Pagination, ListCard, Avatar, StatusBadge,
} from '../../components/crud';
import { b2cLeadService } from '../../api/b2c/b2cLeadService';
import { b2cUserService } from '../../api/b2c/b2cUserService';
import { B2CLeadListDto, B2C_LEAD_STAGES } from '../../types/b2c';
import { useAppTheme } from '../../theme/useAppTheme';
import { rf } from '../../utils/responsive';

/** Web parity: B2CTeamLeads.jsx pages 20 at a time — all leads across the manager's agents. */
const PAGE_SIZE = 20;
const DASH = '—';

interface TeamAgent { id: number; name: string }

const initialsOf = (name?: string) =>
  (name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

export const B2CTeamLeadsScreen = ({ navigation }: any) => {
  const T = useAppTheme();

  const [leads, setLeads] = useState<B2CLeadListDto[]>([]);
  const [team, setTeam] = useState<TeamAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState('');
  const [agentId, setAgentId] = useState(''); // '' = all my agents; otherwise the agent id as a string
  const [openStage, setOpenStage] = useState(false);
  const [openAgent, setOpenAgent] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    b2cUserService.getMyTeam()
      .then(res => setTeam((res.data ?? []) as TeamAgent[]))
      .catch(() => setTeam([]));
  }, []);

  const fetchLeads = useCallback(async (pg = 1) => {
    try {
      const res = await b2cLeadService.getTeamLeads({
        page: pg, pageSize: PAGE_SIZE,
        search: search || undefined,
        stage: stage || undefined,
        agentId: agentId ? Number(agentId) : undefined,
      });
      setLeads(res.data?.items ?? []);
      setTotalPages(res.data?.totalPages ?? 1);
      setTotalCount(res.data?.totalCount ?? 0);
    } catch {
      setLeads([]); setTotalPages(1); setTotalCount(0);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [search, stage, agentId]);

  useEffect(() => {
    setLoading(true); setPage(1); fetchLeads(1);
  }, [fetchLeads]);

  const goToPage = (p: number) => {
    if (p < 1 || p > totalPages || p === page) return;
    setPage(p); setLoading(true); fetchLeads(p);
  };

  const openDetail = (id: number) => navigation.navigate('B2CLeadDetail', { leadId: id });

  const from = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, totalCount);
  const agentLabel = agentId ? (team.find(a => String(a.id) === agentId)?.name ?? 'Agent') : 'Agent';

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: T.bg }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchLeads(page); }} tintColor={T.accent} colors={[T.accent]} />}
      >
        <Text style={[s.subtitle, { color: T.sub }]}>All leads across your agents</Text>

        <View style={[s.card, { backgroundColor: T.card, borderColor: T.line }]}>
          <View style={s.searchRow}>
            <SearchBar value={search} onChangeText={setSearch} placeholder="Search students…" style={{ flex: 1, minWidth: 180 }} />
            <Trigger label={agentLabel} open={openAgent} onPress={() => { setOpenAgent(v => !v); setOpenStage(false); }} icon={<Users size={14} color={T.sub} strokeWidth={ICON_STROKE} />} />
            <Trigger label={stage || 'Stage'} open={openStage} onPress={() => { setOpenStage(v => !v); setOpenAgent(false); }} icon={<Filter size={14} color={T.sub} strokeWidth={ICON_STROKE} />} />
          </View>

          {openAgent && (
            <Dropdown style={{ width: '100%' }} maxHeight={280} value={agentId}
              onSelect={v => { setAgentId(v); setOpenAgent(false); }}
              options={[{ label: 'All my agents', value: '' }, ...team.map(a => ({ label: a.name, value: String(a.id) }))]} />
          )}
          {openStage && (
            <Dropdown style={{ width: '100%' }} maxHeight={280} value={stage}
              onSelect={v => { setStage(v); setOpenStage(false); }}
              options={[{ label: 'All stages', value: '' }, ...B2C_LEAD_STAGES.map(x => ({ label: x, value: x }))]} />
          )}

          <View style={s.countRow}>
            <Text style={[s.count, { color: T.dim }]}>{totalCount} lead{totalCount === 1 ? '' : 's'} found</Text>
            {agentId !== '' && <FilterChip label={agentLabel} onRemove={() => setAgentId('')} />}
            {stage !== '' && <FilterChip label={stage} onRemove={() => setStage('')} />}
          </View>
        </View>

        {loading ? (
          <ActivityIndicator color={T.accent} style={{ marginTop: 48 }} />
        ) : leads.length === 0 ? (
          <View style={[s.empty, { backgroundColor: T.card, borderColor: T.line }]}>
            <Text style={[s.emptyTitle, { color: T.text }]}>No team leads found</Text>
            <Text style={[s.emptyTxt, { color: T.dim }]}>Try adjusting your search or filters.</Text>
          </View>
        ) : (
          <>
            <View style={{ gap: 8 }}>
              {leads.map(lead => (
                <ListCard key={lead.id} onPress={() => openDetail(lead.id)} style={s.rowCard}>
                  <Avatar initials={initialsOf(lead.studentName)} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={s.rowTop}>
                      <Text style={[s.name, { color: T.text }, { flex: 1 }]} numberOfLines={1}>{lead.studentName}</Text>
                      <StatusBadge label={lead.stage} color={T.accent} />
                    </View>
                    <View style={s.subRow}>
                      <Phone size={10} color={T.dim} strokeWidth={ICON_STROKE} />
                      <Text style={[s.sub, { color: T.dim }]} numberOfLines={1}>{lead.mobileNumber || DASH}</Text>
                      <MapPin size={10} color={T.dim} strokeWidth={ICON_STROKE} style={{ marginLeft: 6 }} />
                      <Text style={[s.sub, { color: T.dim }]} numberOfLines={1}>{[lead.city, lead.state].filter(Boolean).join(', ') || DASH}</Text>
                    </View>
                    <Text style={[s.sub, { color: lead.assignedAgentName ? T.sub : T.dim }]} numberOfLines={1}>
                      {lead.assignedAgentName || 'Unassigned'}
                    </Text>
                  </View>
                </ListCard>
              ))}
            </View>

            {totalPages > 1 && (
              <View style={s.pgRow}>
                <Text style={[s.count, { color: T.dim }]}>Showing {from}{DASH}{to} of {totalCount}</Text>
                <Pagination page={page} pageCount={totalPages} onChange={goToPage} />
              </View>
            )}
          </>
        )}
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 14, gap: 12 },
  subtitle: { fontSize: rf(12.5), fontWeight: '500' },
  card: { borderRadius: 16, borderWidth: 1, padding: 12, gap: 10 },
  searchRow: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  count: { fontSize: rf(11.5), fontWeight: '600' },
  rowCard: { alignItems: 'flex-start' },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 3, flexWrap: 'wrap' },
  name: { fontSize: rf(13.5), fontWeight: '700' },
  sub: { fontSize: rf(11.5), fontWeight: '500' },
  pgRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  empty: { borderRadius: 16, borderWidth: 1, paddingVertical: 46, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: rf(14), fontWeight: '700' },
  emptyTxt: { fontSize: rf(12.5), fontWeight: '500', textAlign: 'center' },
});
