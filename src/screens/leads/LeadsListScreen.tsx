import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  TextInput, RefreshControl, useWindowDimensions, Alert, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, UserCheck, X, Bell } from 'lucide-react-native';
import messaging from '@react-native-firebase/messaging';
import { requestFCMPermission } from '../../services/pushNotificationService';
import { leadsApi } from '../../api/leads';
import { LeadListDto, UserDto } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/Card';
import { Badge, StageBadge } from '../../components/common/Badge';
import { LoadingSpinner, EmptyState } from '../../components/common/LoadingSpinner';
import { ProgressBar } from '../../components/common/ProgressBar';
import { SelectPicker } from '../../components/common/SelectPicker';
import { ROLE_COLORS, STAGE_COLORS, getScoreColor } from '../../utils/constants';
import { formatCurrency, formatRelativeDate, isOverdue } from '../../utils/formatting';
import { rf, isTablet } from '../../utils/responsive';

const FILTERS = ['All', 'Active', 'Hot', 'Won', 'Unassigned'];

export const LeadsListScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const role = user?.role || 'FO';
  const isManager = role !== 'FO';
  const COLOR = ROLE_COLORS[role];
  const { width } = useWindowDimensions();
  const tablet = width >= 768;

  const [leads, setLeads] = useState<LeadListDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  // Notification permission banner
  const [showNotifBanner, setShowNotifBanner] = useState(false);

  useEffect(() => {
    messaging().hasPermission().then((status) => {
      const granted =
        status === messaging.AuthorizationStatus.AUTHORIZED ||
        status === messaging.AuthorizationStatus.PROVISIONAL;
      if (!granted) setShowNotifBanner(true);
    }).catch(() => {});
  }, []);

  const handleEnableNotifications = async () => {
    try {
      await requestFCMPermission();
    } catch {}
    setShowNotifBanner(false);
  };

  // Assign modal
  const [fos, setFos] = useState<UserDto[]>([]);
  const [assignModal, setAssignModal] = useState<{ leadId: number; school: string; currentFoId?: number } | null>(null);
  const [selectedFoId, setSelectedFoId] = useState<string | number>('');
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    if (isManager) {
      leadsApi.getAssignableFOs().then((r) => setFos(Array.isArray(r.data) ? r.data : (r.data as any)?.items ?? [])).catch(() => {});
    }
  }, [isManager]);

  const handleAssign = async () => {
    if (!selectedFoId || !assignModal) return;
    setAssigning(true);
    try {
      await leadsApi.assignLead(assignModal.leadId, Number(selectedFoId));
      setAssignModal(null);
      fetchLeads(page, true);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to assign lead');
    } finally {
      setAssigning(false);
    }
  };

  const fetchLeads = useCallback(async (pg = 1, reset = false) => {
    try {
      const stage = filter === 'Won' ? 'Won' : undefined;
      const res = await leadsApi.getLeads({ page: pg, pageSize: 20, search: search || undefined, stage });
      const items = res.data?.items ?? [];
      let filtered = items;
      if (filter === 'Active') filtered = items.filter(l => !['Won', 'Lost'].includes(l.stage));
      if (filter === 'Hot') filtered = items.filter(l => l.score >= 70);
      if (filter === 'Unassigned') filtered = items.filter(l => !l.foId);
      if (reset) setLeads(filtered);
      else setLeads((prev) => [...prev, ...filtered]);
      setTotalPages(res.data?.totalPages ?? 1);
    } catch {
      if (reset) setLeads([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [search, filter]);

  useEffect(() => {
    setLoading(true);
    setPage(1);
    fetchLeads(1, true);
  }, [search, filter]);

  const handleLoadMore = () => {
    if (page < totalPages && !loadingMore) {
      setLoadingMore(true);
      const next = page + 1;
      setPage(next);
      fetchLeads(next, false);
    }
  };

  const renderLead = ({ item }: { item: LeadListDto }) => {
    const overdue = isOverdue(item.lastActivityDate, 5);
    return (
      <Card style={tablet ? { ...styles.leadCard, ...styles.leadCardTablet } : styles.leadCard} onPress={() => navigation.navigate('LeadDetail', { leadId: item.id })}>
        <View style={styles.leadHeader}>
          <View style={styles.leadTitleRow}>
            {overdue && !['Won', 'Lost'].includes(item.stage) && (
              <View style={styles.overdueIndicator} />
            )}
            <Text style={styles.leadSchool} numberOfLines={2}>{item.school}</Text>
          </View>
          <View style={styles.leadHeaderRight}>
            <StageBadge stage={item.stage} />
            {isManager && (
              <TouchableOpacity
                style={styles.assignIconBtn}
                onPress={(e) => {
                  e.stopPropagation?.();
                  setAssignModal({ leadId: item.id, school: item.school, currentFoId: item.foId ?? undefined });
                  setSelectedFoId('');
                }}
              >
                <UserCheck size={15} color="#7C3AED" />
              </TouchableOpacity>
            )}
          </View>
        </View>
        <View style={styles.leadMeta}>
          <Text style={styles.metaText}>{item.board}</Text>
          <Text style={styles.metaDot}>•</Text>
          <Text style={styles.metaText}>{item.city}</Text>
          <Text style={styles.metaDot}>•</Text>
          <Text style={styles.metaText}>{item.type}</Text>
        </View>
        <View style={styles.leadFooter}>
          <View style={styles.footerLeft}>
            <Text style={styles.leadValue}>{formatCurrency(item.value)}</Text>
            {item.foName && isManager && (
              <Text style={styles.foName} numberOfLines={1}>👤 {item.foName}</Text>
            )}
          </View>
          <View style={styles.footerRight}>
            <View style={[styles.scorePill, { backgroundColor: getScoreColor(item.score) + '22' }]}>
              <Text style={[styles.scoreText, { color: getScoreColor(item.score) }]}>{item.score}</Text>
            </View>
            {item.lastActivityDate && (
              <Text style={styles.lastActivity}>{formatRelativeDate(item.lastActivityDate)}</Text>
            )}
          </View>
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Assign / Reassign Modal */}
      <Modal visible={!!assignModal} transparent animationType="slide" onRequestClose={() => setAssignModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Assign / Reassign Lead</Text>
              <TouchableOpacity onPress={() => setAssignModal(null)}>
                <X size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSub}>
              Assign <Text style={styles.modalSubBold}>{assignModal?.school}</Text> to a Field Officer:
            </Text>
            <SelectPicker
              label="Select Field Officer"
              options={fos.map((fo) => ({ label: `${fo.name}${(fo as any).zone ? ` (${(fo as any).zone})` : ''}${fo.id === assignModal?.currentFoId ? ' (Current)' : ''}`, value: fo.id }))}
              value={selectedFoId}
              onChange={(v) => setSelectedFoId(v)}
              accentColor="#7C3AED"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setAssignModal(null)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, (!selectedFoId || assigning) && { opacity: 0.5 }]}
                onPress={handleAssign}
                disabled={!selectedFoId || assigning}
              >
                <Text style={styles.modalConfirmText}>{assigning ? 'Assigning...' : 'Assign'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {loading ? (
        <LoadingSpinner fullScreen color={COLOR.primary} message="Loading leads..." />
      ) : (
        <FlatList
          data={leads}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderLead}
          contentContainerStyle={[styles.list, leads.length === 0 && styles.listEmpty]}
          key={tablet ? 'grid' : 'list'}
          numColumns={tablet ? 2 : 1}
          columnWrapperStyle={tablet ? styles.columnWrapper : undefined}
          ListHeaderComponent={
            <>
            {showNotifBanner && (
              <View style={styles.notifBanner}>
                <Bell size={16} color="#FFF" />
                <Text style={styles.notifBannerText} numberOfLines={2}>
                  Enable push notifications to stay updated on leads, deals, and approvals
                </Text>
                <TouchableOpacity style={styles.notifEnableBtn} onPress={handleEnableNotifications}>
                  <Text style={styles.notifEnableText}>Enable</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowNotifBanner(false)} hitSlop={8}>
                  <X size={16} color="#FFF" />
                </TouchableOpacity>
              </View>
            )}
            <View style={styles.controlsCard}>
              <View style={styles.controlsTopRow}>
                <View style={styles.searchBar}>
                  <Search size={16} color="#9CA3AF" />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search school, city, contact..."
                    placeholderTextColor="#9CA3AF"
                    value={search}
                    onChangeText={setSearch}
                  />
                </View>
              </View>
              <View style={styles.filterRow}>
                {FILTERS.map((f) => (
                  <TouchableOpacity
                    key={f}
                    style={[
                      styles.filterChip,
                      filter === f && { backgroundColor: COLOR.primary, borderColor: COLOR.primary },
                    ]}
                    onPress={() => setFilter(f)}
                  >
                    <Text style={[styles.filterText, filter === f && { color: '#FFF' }]}>{f}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            </>
          }
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); setPage(1); fetchLeads(1, true); }} colors={[COLOR.primary]} />}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={<EmptyState title="No leads found" subtitle="Try adjusting your search or filters" icon="📋" />}
          ListFooterComponent={loadingMore ? <LoadingSpinner color={COLOR.primary} /> : null}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  controlsCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  controlsTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    gap: 8,
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchInput: { flex: 1, fontSize: rf(14), color: '#111827' },
  filterRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 100,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterText: { fontSize: rf(12), color: '#374151', fontWeight: '700' },
  list: { padding: 12, gap: 10 },
  listEmpty: { flex: 1 },
  columnWrapper: { gap: 10 },
  leadCard: { marginBottom: 2 },
  leadCardTablet: { flex: 1 },
  leadHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  leadHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  assignIconBtn: { padding: 5, backgroundColor: '#F3E8FF', borderRadius: 8 },
  leadTitleRow: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginRight: 8 },
  overdueIndicator: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444', marginTop: 5 },
  leadSchool: { flex: 1, fontSize: rf(15), fontWeight: '700', color: '#111827' },
  leadMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10 },
  metaText: { fontSize: rf(12), color: '#9CA3AF' },
  metaDot: { fontSize: rf(12), color: '#D1D5DB' },
  leadFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerLeft: { gap: 2 },
  leadValue: { fontSize: rf(15), fontWeight: '700', color: '#111827' },
  foName: { fontSize: rf(12), color: '#6B7280' },
  footerRight: { alignItems: 'flex-end', gap: 4 },
  scorePill: { borderRadius: 100, paddingHorizontal: 8, paddingVertical: 3 },
  scoreText: { fontSize: rf(12), fontWeight: '700' },
  lastActivity: { fontSize: rf(11), color: '#9CA3AF' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: rf(17), fontWeight: '700', color: '#111827' },
  modalSub: { fontSize: rf(13), color: '#6B7280', marginBottom: 16 },
  modalSubBold: { fontWeight: '700', color: '#111827' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalCancelBtn: { flex: 1, paddingVertical: 12, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, alignItems: 'center' },
  modalCancelText: { fontSize: rf(14), color: '#6B7280', fontWeight: '600' },
  modalConfirmBtn: { flex: 1, paddingVertical: 12, backgroundColor: '#7C3AED', borderRadius: 12, alignItems: 'center' },
  modalConfirmText: { fontSize: rf(14), color: '#FFF', fontWeight: '700' },
  notifBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#0D9488', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 10,
  },
  notifBannerText: { flex: 1, color: '#FFF', fontSize: rf(12), fontWeight: '500' },
  notifEnableBtn: { backgroundColor: '#FFF', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  notifEnableText: { color: '#0D9488', fontSize: rf(12), fontWeight: '700' },
});
