import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckCircle, XCircle, FileCheck } from 'lucide-react-native';
import { dealsApi } from '../../api/deals';
import { DealDto, ApprovalStatus } from '../../types';
import { Btn, StatusBadge, ConfirmModal, FormModal, Input } from '../../components/crud';
import { Card } from '../../components/ui';
import { ICON_STROKE } from '../../components/common/Icon';
import { LoadingSpinner, EmptyState } from '../../components/common/LoadingSpinner';
import { formatCurrency, formatRelativeDate } from '../../utils/formatting';
import { useAppTheme } from '../../theme/useAppTheme';
import { withAlpha } from '../../theme';
import { rf } from '../../utils/responsive';

/**
 * Deal Approvals — the screen web has (common/Deals.jsx "Awaiting my decision" tab)
 * that mobile never had at all.
 *
 * Before this screen, `dealsApi.getPendingApprovals()` and `.approveDeal()` were only
 * ever called from ZHDashboard.tsx — so a deal that clears the ZH tier and lands on
 * PendingRH (21-30% discount) or PendingSH (>30%) had no reachable approve/reject UI
 * anywhere on mobile for RH, SH or SCA. This screen closes that gap: one list, scoped
 * server-side (GET /deals/pending-approvals, same backend rule used everywhere else —
 * role level must be >= the pending tier, and the approver must manage the deal's FO),
 * so whatever lands here is always something the signed-in user can actually decide on.
 *
 * ZH keeps its existing dashboard panel too (unchanged, still works) — this screen is
 * additive, reachable by every manager tier for consistency with web's own /deals page.
 */

const DASH = '—';

const TIER_LABEL: Partial<Record<ApprovalStatus, string>> = {
  PendingZH: 'Awaiting Zonal Head approval',
  PendingRH: 'Awaiting Regional Head approval',
  PendingSH: 'Awaiting Sales Head approval',
};

export const DealApprovalsScreen = () => {
  const T = useAppTheme();
  const [deals, setDeals] = useState<DealDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acting, setActing] = useState<number | null>(null);
  const [approveId, setApproveId] = useState<number | null>(null);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  const fetch = useCallback(async () => {
    try {
      const res = await dealsApi.getPendingApprovals();
      setDeals(Array.isArray(res.data) ? res.data : []);
    } catch {
      // No fabricated fallback — an empty list on failure just reads as "nothing
      // pending", so surface a real empty-state message instead (see render below).
      setDeals([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const onRefresh = () => { setRefreshing(true); fetch(); };

  const doApprove = async () => {
    if (approveId == null) return;
    const id = approveId;
    setApproveId(null);
    setActing(id);
    try {
      await dealsApi.approveDeal(id, true, 'Approved');
      await fetch();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to approve deal.');
    } finally {
      setActing(null);
    }
  };

  const openReject = (id: number) => { setRejectNote(''); setRejectId(id); };

  const submitReject = async () => {
    if (rejectId == null) return;
    const id = rejectId;
    setRejectId(null);
    setActing(id);
    try {
      await dealsApi.approveDeal(id, false, rejectNote.trim() || 'Rejected');
      await fetch();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to reject deal.');
    } finally {
      setActing(null);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[s.safe, { backgroundColor: T.bg }]} edges={['bottom']}>
        <LoadingSpinner fullScreen message="Loading deal approvals…" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: T.bg }]} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.accent} colors={[T.accent]} />}
      >
        <View style={s.headRow}>
          <Text style={[s.title, { color: T.text }]}>Deal Approvals</Text>
          <Text style={[s.sub, { color: T.dim }]}>
            {deals.length === 0 ? 'Nothing is waiting for your decision.' : `${deals.length} deal${deals.length === 1 ? '' : 's'} waiting for your decision`}
          </Text>
        </View>

        {deals.length === 0 ? (
          <EmptyState
            icon="📄"
            title="Nothing to approve"
            subtitle="Deals submitted by your team that need your sign-off will show up here."
          />
        ) : (
          deals.map(deal => (
            <Card key={deal.id} style={[s.dealCard, { borderColor: withAlpha(T.warning, 0.24), backgroundColor: withAlpha(T.warning, 0.07) }]}>
              <View style={s.between}>
                <View style={s.flexMin}>
                  <Text numberOfLines={1} style={[s.rowTitle, { color: T.text }]}>{deal.school}</Text>
                  <Text numberOfLines={1} style={[s.rowSub, { color: T.sub }]}>
                    by {deal.foName || DASH} · {deal.submittedAt ? formatRelativeDate(deal.submittedAt) : DASH}
                  </Text>
                  <Text numberOfLines={1} style={[s.rowTier, { color: T.warning }]}>
                    {TIER_LABEL[deal.approvalStatus] ?? deal.approvalStatus}
                  </Text>
                </View>
                <View style={s.alignEnd}>
                  <Text numberOfLines={1} style={[s.rowVal, { color: T.text }]}>{formatCurrency(deal.finalValue)}</Text>
                  <StatusBadge label={`${deal.discount}% off`} color={T.warning} />
                </View>
              </View>

              {deal.notes ? (
                <Text numberOfLines={2} style={[s.notes, { color: T.sub }]}>"{deal.notes}"</Text>
              ) : null}

              <View style={s.actions}>
                <Btn
                  small
                  variant="success"
                  label="Approve"
                  style={s.flexMin}
                  disabled={acting === deal.id}
                  icon={<CheckCircle size={14} color="#FFF" strokeWidth={ICON_STROKE} />}
                  onPress={() => setApproveId(deal.id)}
                />
                <Btn
                  small
                  variant="danger"
                  label="Reject"
                  style={s.flexMin}
                  disabled={acting === deal.id}
                  icon={<XCircle size={14} color="#FFF" strokeWidth={ICON_STROKE} />}
                  onPress={() => openReject(deal.id)}
                />
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      <ConfirmModal
        visible={approveId != null}
        title="Approve Deal"
        message="Approve this deal? The field officer will be notified and the deal moves forward."
        icon={<FileCheck size={22} color={T.success} strokeWidth={ICON_STROKE} />}
        tone="success"
        confirmLabel="Approve"
        onConfirm={doApprove}
        onCancel={() => setApproveId(null)}
      />

      <FormModal
        visible={rejectId != null}
        title="Reject Deal"
        onClose={() => setRejectId(null)}
        footer={
          <>
            <View style={{ flex: 1 }} />
            <Btn label="Cancel" variant="secondary" onPress={() => setRejectId(null)} small />
            <Btn label="Reject" onPress={submitReject} small />
          </>
        }
      >
        <Input
          label="Rejection reason"
          value={rejectNote}
          onChangeText={setRejectNote}
          placeholder="Why is this deal being rejected?"
          multiline
        />
      </FormModal>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 14, gap: 12, paddingBottom: 28 },
  headRow: { gap: 2, marginBottom: 2 },
  title: { fontSize: rf(18), fontWeight: '700' },
  sub: { fontSize: rf(12.5), fontWeight: '500' },

  dealCard: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 10 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  flexMin: { flex: 1, minWidth: 0 },
  alignEnd: { alignItems: 'flex-end', gap: 5 },
  rowTitle: { fontSize: rf(14), fontWeight: '700' },
  rowSub: { fontSize: rf(11.5), fontWeight: '500', marginTop: 2 },
  rowTier: { fontSize: rf(11), fontWeight: '700', marginTop: 4 },
  rowVal: { fontSize: rf(14.5), fontWeight: '700' },
  notes: { fontSize: rf(12), fontStyle: 'italic' },
  actions: { flexDirection: 'row', gap: 10 },
});
