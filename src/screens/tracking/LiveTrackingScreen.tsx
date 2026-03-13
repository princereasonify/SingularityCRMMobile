import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  MapPin,
  Navigation,
  Clock,
  Check,
  X,
  Users,
  Filter,
} from 'lucide-react-native';
import { trackingApi } from '../../api/tracking';
import { LiveLocationDto, AllowanceDto } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/Card';
import { Badge, RoleBadge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { LoadingSpinner, EmptyState } from '../../components/common/LoadingSpinner';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { Avatar } from '../../components/common/Avatar';
import { ROLE_COLORS } from '../../utils/constants';
import { formatCurrency, formatDate, formatRelativeDate, toISODate } from '../../utils/formatting';
import { rf } from '../../utils/responsive';

type TabKey = 'live' | 'allowances';
type FilterKey = 'all' | 'active' | 'ended';

export const LiveTrackingScreen = () => {
  const { user } = useAuth();
  const roleColor = user?.role ? ROLE_COLORS[user.role as keyof typeof ROLE_COLORS] : ROLE_COLORS.ZH;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('live');

  // Live section
  const [liveUsers, setLiveUsers] = useState<LiveLocationDto[]>([]);
  const [filter, setFilter] = useState<FilterKey>('all');
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Allowances section
  const [allowances, setAllowances] = useState<AllowanceDto[]>([]);
  const [allowancesLoading, setAllowancesLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState(() => {
    const now = new Date();
    return toISODate(new Date(now.getFullYear(), now.getMonth(), 1));
  });
  const [dateTo, setDateTo] = useState(() => toISODate(new Date()));
  const [approveLoading, setApproveLoading] = useState<number | null>(null);

  const fetchLiveLocations = useCallback(async () => {
    try {
      const res = await trackingApi.getLiveLocations();
      setLiveUsers(res.data as LiveLocationDto[]);
    } catch {
      setLiveUsers([]);
    }
  }, []);

  const fetchAllowances = useCallback(async () => {
    setAllowancesLoading(true);
    try {
      const res = await trackingApi.getAllowances(dateFrom, dateTo);
      setAllowances(res.data as AllowanceDto[]);
    } catch {
      setAllowances([]);
    } finally {
      setAllowancesLoading(false);
    }
  }, [dateFrom, dateTo]);

  const fetchAll = useCallback(async () => {
    try {
      await Promise.all([fetchLiveLocations(), fetchAllowances()]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchLiveLocations, fetchAllowances]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Auto-refresh every 30 seconds for live locations
  useEffect(() => {
    autoRefreshRef.current = setInterval(() => {
      fetchLiveLocations();
    }, 30000);
    return () => {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    };
  }, [fetchLiveLocations]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAll();
  };

  const filteredUsers = liveUsers.filter((u) => {
    if (filter === 'active') return u.status === 'active';
    if (filter === 'ended') return u.status === 'ended';
    return true;
  });

  const activeCount = liveUsers.filter((u) => u.status === 'active').length;

  const handleApprove = (id: number, approved: boolean) => {
    const action = approved ? 'approve' : 'reject';
    Alert.alert(
      `${approved ? 'Approve' : 'Reject'} Allowance`,
      `Are you sure you want to ${action} this allowance?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: approved ? 'Approve' : 'Reject',
          style: approved ? 'default' : 'destructive',
          onPress: async () => {
            setApproveLoading(id);
            try {
              await trackingApi.approveAllowance(id, { approved });
              await fetchAllowances();
            } catch {
              Alert.alert('Error', `Failed to ${action} allowance.`);
            } finally {
              setApproveLoading(null);
            }
          },
        },
      ],
    );
  };

  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const totalAllowance = allowances.reduce((sum, a) => sum + a.grossAmount, 0);

  if (loading) return <LoadingSpinner fullScreen color={roleColor.primary} message="Loading tracking..." />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title="Live Tracking"
        subtitle={user?.role === 'SH' ? 'National Head' : user?.role === 'RH' ? user?.region : user?.zone}
        color={roleColor.primary}
      />

      {/* Tab Switcher */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'live' && { borderBottomColor: roleColor.primary }]}
          onPress={() => setActiveTab('live')}
        >
          <Text style={[styles.tabText, activeTab === 'live' && { color: roleColor.primary }]}>
            Live Map
          </Text>
          {activeCount > 0 && (
            <View style={[styles.countBadge, { backgroundColor: roleColor.primary }]}>
              <Text style={styles.countBadgeText}>{activeCount}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'allowances' && { borderBottomColor: roleColor.primary }]}
          onPress={() => setActiveTab('allowances')}
        >
          <Text style={[styles.tabText, activeTab === 'allowances' && { color: roleColor.primary }]}>
            Allowances
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[roleColor.primary]} />}
      >
        {activeTab === 'live' ? (
          <>
            {/* Filter Chips */}
            <View style={styles.filterRow}>
              <Filter size={16} color="#6B7280" />
              {(['all', 'active', 'ended'] as FilterKey[]).map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[
                    styles.filterChip,
                    filter === f && { backgroundColor: roleColor.primary },
                  ]}
                  onPress={() => setFilter(f)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      filter === f && { color: '#FFF' },
                    ]}
                  >
                    {f === 'all' ? 'All' : f === 'active' ? 'Active Only' : 'Ended'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Active Count */}
            <View style={styles.activeCountRow}>
              <Users size={16} color={roleColor.primary} />
              <Text style={styles.activeCountText}>
                {activeCount} active of {liveUsers.length} tracked users
              </Text>
            </View>

            {/* Live User Cards */}
            {filteredUsers.length === 0 ? (
              <EmptyState title="No users found" subtitle="No tracked users match the current filter." icon="📍" />
            ) : (
              filteredUsers.map((u) => (
                <Card key={u.userId} style={styles.userCard}>
                  <View style={styles.userCardHeader}>
                    <View style={styles.userLeft}>
                      <View style={styles.avatarWrap}>
                        <Avatar initials={getInitials(u.name)} color={roleColor.primary} size={42} />
                        <View
                          style={[
                            styles.statusIndicator,
                            { backgroundColor: u.status === 'active' ? '#14B8A6' : '#9CA3AF' },
                          ]}
                        />
                      </View>
                      <View style={styles.userInfo}>
                        <Text style={styles.userName}>{u.name}</Text>
                        <View style={styles.userMeta}>
                          <RoleBadge role={u.role} />
                          {u.zoneName && <Text style={styles.userZone}>{u.zoneName}</Text>}
                        </View>
                      </View>
                    </View>
                  </View>

                  <View style={styles.userStats}>
                    <View style={styles.userStat}>
                      <Clock size={14} color="#6B7280" />
                      <Text style={styles.userStatLabel}>Last Seen</Text>
                      <Text style={styles.userStatValue}>{formatRelativeDate(u.lastSeen)}</Text>
                    </View>
                    <View style={styles.userStat}>
                      <Navigation size={14} color="#6B7280" />
                      <Text style={styles.userStatLabel}>Speed</Text>
                      <Text style={styles.userStatValue}>{u.speedKmh?.toFixed(0) ?? '--'} km/h</Text>
                    </View>
                    <View style={styles.userStat}>
                      <MapPin size={14} color="#6B7280" />
                      <Text style={styles.userStatLabel}>Distance</Text>
                      <Text style={styles.userStatValue}>{u.totalDistanceKm.toFixed(1)} km</Text>
                    </View>
                    <View style={styles.userStat}>
                      <Text style={styles.userStatCurrency}>{formatCurrency(u.allowanceAmount)}</Text>
                      <Text style={styles.userStatLabel}>Allowance</Text>
                    </View>
                  </View>
                </Card>
              ))
            )}
          </>
        ) : (
          <>
            {/* Date Range Picker */}
            <Card style={styles.section}>
              <Text style={styles.sectionTitle}>Date Range</Text>
              <View style={styles.dateRangeRow}>
                <View style={styles.dateInputWrap}>
                  <Text style={styles.dateInputLabel}>From</Text>
                  <TextInput
                    style={styles.dateInput}
                    value={dateFrom}
                    onChangeText={setDateFrom}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
                <View style={styles.dateInputWrap}>
                  <Text style={styles.dateInputLabel}>To</Text>
                  <TextInput
                    style={styles.dateInput}
                    value={dateTo}
                    onChangeText={setDateTo}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
                <Button
                  title="Go"
                  onPress={fetchAllowances}
                  color={roleColor.primary}
                  size="sm"
                  style={styles.goButton}
                />
              </View>
            </Card>

            {/* Allowance Table */}
            {allowancesLoading ? (
              <LoadingSpinner color={roleColor.primary} message="Loading allowances..." />
            ) : allowances.length === 0 ? (
              <EmptyState title="No allowances" subtitle="No allowance records for the selected period." icon="💰" />
            ) : (
              <>
                {allowances.map((a) => (
                  <Card key={a.id} style={styles.allowanceCard}>
                    <View style={styles.allowanceHeader}>
                      <View style={styles.allowanceUserInfo}>
                        <Text style={styles.allowanceName}>{a.userName}</Text>
                        <View style={styles.allowanceMetaRow}>
                          <RoleBadge role={a.role} />
                          <Text style={styles.allowanceDateText}>{formatDate(a.allowanceDate)}</Text>
                        </View>
                      </View>
                      <Badge
                        label={a.approved ? 'Approved' : 'Pending'}
                        color={a.approved ? '#22C55E' : '#F59E0B'}
                      />
                    </View>

                    <View style={styles.allowanceDetails}>
                      <View style={styles.allowanceDetailItem}>
                        <Text style={styles.allowanceDetailLabel}>Distance</Text>
                        <Text style={styles.allowanceDetailValue}>{a.distanceKm.toFixed(1)} km</Text>
                      </View>
                      <View style={styles.allowanceDetailItem}>
                        <Text style={styles.allowanceDetailLabel}>Rate</Text>
                        <Text style={styles.allowanceDetailValue}>{formatCurrency(a.ratePerKm)}/km</Text>
                      </View>
                      <View style={styles.allowanceDetailItem}>
                        <Text style={styles.allowanceDetailLabel}>Amount</Text>
                        <Text style={[styles.allowanceDetailValue, { fontWeight: '700' }]}>
                          {formatCurrency(a.grossAmount)}
                        </Text>
                      </View>
                    </View>

                    {a.approvedByName && (
                      <Text style={styles.approvedBy}>
                        Approved by {a.approvedByName}
                        {a.approvedAt ? ` on ${formatDate(a.approvedAt)}` : ''}
                      </Text>
                    )}

                    {a.remarks && (
                      <Text style={styles.remarks}>Remarks: {a.remarks}</Text>
                    )}

                    {!a.approved && (
                      <View style={styles.approvalActions}>
                        <Button
                          title="Approve"
                          onPress={() => handleApprove(a.id, true)}
                          color="#22C55E"
                          size="sm"
                          loading={approveLoading === a.id}
                          disabled={approveLoading !== null}
                          style={styles.approvalBtn}
                        />
                        <Button
                          title="Reject"
                          onPress={() => handleApprove(a.id, false)}
                          variant="danger"
                          size="sm"
                          loading={approveLoading === a.id}
                          disabled={approveLoading !== null}
                          style={styles.approvalBtn}
                        />
                      </View>
                    )}
                  </Card>
                ))}

                {/* Total Footer */}
                <Card style={styles.totalFooter}>
                  <Text style={styles.totalLabel}>Total Allowance</Text>
                  <Text style={styles.totalValue}>{formatCurrency(totalAllowance)}</Text>
                </Card>
              </>
            )}
          </>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 14 },
  section: { padding: 16 },
  sectionTitle: { fontSize: rf(15), fontWeight: '700', color: '#111827', marginBottom: 12 },

  // Tab Bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    gap: 6,
  },
  tabText: { fontSize: rf(14), fontWeight: '600', color: '#9CA3AF' },
  countBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  countBadgeText: { fontSize: rf(11), fontWeight: '700', color: '#FFF' },

  // Filters
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  filterChipText: { fontSize: rf(12), fontWeight: '600', color: '#374151' },

  // Active Count
  activeCountRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  activeCountText: { fontSize: rf(13), color: '#6B7280', fontWeight: '500' },

  // User Card
  userCard: { padding: 16 },
  userCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  userLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  avatarWrap: { position: 'relative' },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FFF',
    position: 'absolute',
    bottom: 0,
    right: -2,
  },
  userInfo: { flex: 1 },
  userName: { fontSize: rf(15), fontWeight: '700', color: '#111827' },
  userMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  userZone: { fontSize: rf(12), color: '#9CA3AF' },

  userStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 14,
    gap: 8,
  },
  userStat: {
    flex: 1,
    minWidth: '22%',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    gap: 4,
  },
  userStatLabel: { fontSize: rf(10), color: '#9CA3AF', fontWeight: '500' },
  userStatValue: { fontSize: rf(12), fontWeight: '700', color: '#111827' },
  userStatCurrency: { fontSize: rf(14), fontWeight: '700', color: '#111827' },

  // Date Range
  dateRangeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  dateInputWrap: { flex: 1 },
  dateInputLabel: { fontSize: rf(12), fontWeight: '500', color: '#6B7280', marginBottom: 4 },
  dateInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: rf(13),
    color: '#111827',
  },
  goButton: { marginBottom: 2 },

  // Allowance Card
  allowanceCard: { padding: 16 },
  allowanceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  allowanceUserInfo: { flex: 1, marginRight: 8 },
  allowanceName: { fontSize: rf(14), fontWeight: '700', color: '#111827' },
  allowanceMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  allowanceDateText: { fontSize: rf(12), color: '#9CA3AF' },
  allowanceDetails: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
  },
  allowanceDetailItem: { flex: 1, alignItems: 'center' },
  allowanceDetailLabel: { fontSize: rf(11), color: '#9CA3AF', fontWeight: '500' },
  allowanceDetailValue: { fontSize: rf(13), fontWeight: '600', color: '#111827', marginTop: 2 },
  approvedBy: { fontSize: rf(12), color: '#6B7280', marginTop: 10 },
  remarks: { fontSize: rf(12), color: '#9CA3AF', fontStyle: 'italic', marginTop: 4 },
  approvalActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  approvalBtn: { flex: 1 },

  // Total Footer
  totalFooter: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: { fontSize: rf(15), fontWeight: '700', color: '#111827' },
  totalValue: { fontSize: rf(18), fontWeight: '700', color: '#111827' },
});
