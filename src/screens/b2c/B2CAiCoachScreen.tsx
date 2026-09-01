import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Mic, TrendingUp, TrendingDown, Minus, Users } from 'lucide-react-native';
import { Card, StatTile, SectionLabel } from '../../components/ui';
import { Pagination, Avatar } from '../../components/crud';
import { b2cRecordingService } from '../../api/b2c/b2cRecordingService';
import { CounselorQualityOverviewItem } from '../../types/b2c';
import { useAppTheme } from '../../theme/useAppTheme';
import { useResponsive, Responsive } from '../../hooks/useResponsive';

/**
 * B2CAiCoach — admin (B2CAdmin) COUNSELOR QUALITY OVERVIEW. Read-only dashboard
 * mirroring the web AI-coach admin view: a per-counselor leaderboard sourced from
 * b2cRecordingService.getQualityOverview (PaginatedResult<CounselorQualityOverviewItem>).
 * Green B2C tokens only — no hardcoded colours. The counselor's own record→analyse
 * flow lives in B2CCounselorRecordingScreen; this is the aggregate manager view.
 */

const PAGE_SIZE = 20;

const initialsOf = (name?: string) =>
  (name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

export const B2CAiCoachScreen = () => {
  const T = useAppTheme();
  const r = useResponsive();

  // Score → theme colour band (mirrors the web dimColor thresholds).
  const scoreColor = (score: number) =>
    score >= 80 ? T.success : score >= 60 ? T.accent : score >= 40 ? T.warning : T.danger;

  const [items, setItems] = useState<CounselorQualityOverviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchList = useCallback(async (pg = 1) => {
    try {
      const res = await b2cRecordingService.getQualityOverview({ page: pg, pageSize: PAGE_SIZE });
      setItems(res.data?.items ?? []);
      setTotalPages(res.data?.totalPages ?? 1);
      setTotalCount(res.data?.totalCount ?? 0);
    } catch {
      setItems([]); setTotalPages(1); setTotalCount(0);
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { setLoading(true); fetchList(1); }, [fetchList]);

  const goToPage = (p: number) => {
    if (p < 1 || p > totalPages || p === page) return;
    setPage(p); setLoading(true); fetchList(p);
  };

  // Summary tiles across the current page (backend paginates; this is the visible set).
  const avgOfAvg = items.length ? items.reduce((sum, c) => sum + (c.avgScore || 0), 0) / items.length : 0;
  const totalSessions = items.reduce((sum, c) => sum + (c.totalSessions || 0), 0);

  const trendMeta = (trend?: string) => {
    const t = (trend || '').toLowerCase();
    if (t === 'improving') return { color: T.success, icon: <TrendingUp size={12} color={T.success} strokeWidth={2.4} /> };
    if (t === 'declining') return { color: T.danger, icon: <TrendingDown size={12} color={T.danger} strokeWidth={2.4} /> };
    return { color: T.sub, icon: <Minus size={12} color={T.sub} strokeWidth={2.4} /> };
  };

  // Two leaderboard cards per row on a tablet; computed width, because two 49% cards plus
  // the gap overflow the row and collapse the grid back to one column.
  const cardW: number | '100%' = r.isTablet
    ? (Math.min(r.width, r.maxContentWidth) - r.gutter * 2 - r.gap) / 2
    : '100%';

  const s = useMemo(() => makeStyles(r), [r]);

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: T.bg }]} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchList(page); }} tintColor={T.accent} colors={[T.accent]} />}
      >
        {loading ? (
          <ActivityIndicator color={T.accent} style={{ marginTop: 48 }} />
        ) : items.length === 0 ? (
          <View style={[s.empty, { backgroundColor: T.card, borderColor: T.line }]}>
            <Mic size={30} color={T.dim} strokeWidth={1.8} />
            <Text style={[s.emptyTitle, { color: T.text }]}>No coaching data yet</Text>
            <Text style={[s.emptyTxt, { color: T.dim }]}>Counselor quality scores appear here once sessions are recorded and analysed.</Text>
          </View>
        ) : (
          <>
            <View style={s.grid}>
              <StatTile style={s.cell} label="Counselors" value={totalCount} icon={<Users size={16} color={T.accent} />} />
              <StatTile style={s.cell} label="Avg AI Score" value={avgOfAvg.toFixed(1)} tint={T.success} icon={<TrendingUp size={16} color={T.success} />} />
              <StatTile style={s.cell} label="Sessions" value={totalSessions} tint={T.info} icon={<Mic size={16} color={T.info} />} />
            </View>

            <View style={s.section}>
              <SectionLabel>Counselor Quality Overview</SectionLabel>
              <View style={s.cards}>
                {items.map(c => {
                  const tm = trendMeta(c.trend);
                  const sc = scoreColor(c.avgScore || 0);
                  return (
                    <Card key={c.counselorId} style={{ padding: 14, width: cardW }}>
                      <View style={s.rowTop}>
                        <Avatar initials={initialsOf(c.counselorName)} />
                        <View style={{ flex: 1 }}>
                          <Text style={[s.name, { color: T.text }]} numberOfLines={1}>{c.counselorName}</Text>
                          <Text style={[s.sub, { color: T.dim }]}>{c.totalSessions} session{c.totalSessions === 1 ? '' : 's'}</Text>
                        </View>
                        {!!c.trend && (
                          <View style={[s.trend, { backgroundColor: T.cardAlt }]}>
                            {tm.icon}
                            <Text style={[s.trendTxt, { color: tm.color }]}>{c.trend}</Text>
                          </View>
                        )}
                      </View>

                      {/* Overall AI score bar — the web's dimColor thresholds, green tokens. */}
                      <View style={s.scoreRow}>
                        <View style={[s.track, { backgroundColor: T.cardAlt }]}>
                          <View style={[s.fill, { width: `${Math.min(100, Math.max(0, c.avgScore || 0))}%`, backgroundColor: sc }]} />
                        </View>
                        <Text style={[s.scoreVal, { color: T.text }]}>{c.avgScore != null ? Math.round(c.avgScore) : '—'}</Text>
                      </View>
                    </Card>
                  );
                })}
              </View>
            </View>

            {totalPages > 1 && (
              <View style={s.pgRow}><Pagination page={page} pageCount={totalPages} onChange={goToPage} /></View>
            )}
          </>
        )}
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: r.gap },
  cell: { flexBasis: r.isTablet ? '31%' : '47.5%', flexGrow: 1 },
  section: { gap: 2 },
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: r.gap, alignItems: 'flex-start' },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { fontSize: r.rf(13.5), fontWeight: '700' },
  sub: { fontSize: r.rf(11.5), fontWeight: '500', marginTop: 2 },
  trend: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, height: 22, borderRadius: 11 },
  trendTxt: { fontSize: r.rf(11), fontWeight: '700' },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  track: { flex: 1, height: 8, borderRadius: 999, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 999 },
  scoreVal: { fontSize: r.rf(14), fontWeight: '800', minWidth: 30, textAlign: 'right' },
  pgRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 },
  empty: { borderRadius: 16, borderWidth: 1, paddingVertical: 46, paddingHorizontal: 20, alignItems: 'center', gap: 10 },
  emptyTitle: { fontSize: r.rf(14), fontWeight: '700' },
  emptyTxt: { fontSize: r.rf(12.5), fontWeight: '500', textAlign: 'center', lineHeight: 18 },
});
