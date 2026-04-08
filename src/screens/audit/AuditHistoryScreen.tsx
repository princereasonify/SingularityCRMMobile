import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PlusCircle, Edit3, Trash2 } from 'lucide-react-native';
import { auditApi } from '../../api/audit';
import { AuditLog } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { Card } from '../../components/common/Card';
import { LoadingSpinner, EmptyState } from '../../components/common/LoadingSpinner';
import { ROLE_COLORS } from '../../utils/constants';
import { formatDateTime } from '../../utils/formatting';
import { rf } from '../../utils/responsive';

const ACTION_CONFIG = {
  Created: { icon: PlusCircle, color: '#16A34A', bg: '#F0FDF4' },
  Updated: { icon: Edit3, color: '#2563EB', bg: '#EFF6FF' },
  Deleted: { icon: Trash2, color: '#DC2626', bg: '#FEF2F2' },
};

export const AuditHistoryScreen = ({ navigation, route }: any) => {
  const { entityType, entityId, title } = route.params as {
    entityType: string;
    entityId: number;
    title?: string;
  };
  const { user } = useAuth();
  const COLOR = ROLE_COLORS[(user?.role || 'FO') as keyof typeof ROLE_COLORS];

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadLogs = async () => {
    try {
      const res = await auditApi.getEntityHistory(entityType, entityId);
      setLogs((res.data as any) ?? []);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadLogs(); }, [entityType, entityId]);

  const renderLog = ({ item, index }: { item: AuditLog; index: number }) => {
    const cfg = ACTION_CONFIG[item.action] ?? ACTION_CONFIG.Updated;
    const Icon = cfg.icon;
    const fields = item.changedFields ? Object.entries(item.changedFields) : [];
    const isLast = index === logs.length - 1;

    return (
      <View style={styles.logRow}>
        {/* Timeline line */}
        <View style={styles.timelineCol}>
          <View style={[styles.iconCircle, { backgroundColor: cfg.bg }]}>
            <Icon size={14} color={cfg.color} />
          </View>
          {!isLast && <View style={styles.timelineLine} />}
        </View>

        <Card style={styles.logCard}>
          <View style={styles.logHeader}>
            <View style={[styles.actionBadge, { backgroundColor: cfg.bg }]}>
              <Text style={[styles.actionText, { color: cfg.color }]}>{item.action}</Text>
            </View>
            <Text style={styles.logTime}>{formatDateTime(item.performedAt)}</Text>
          </View>
          <Text style={styles.logBy}>by {item.performedByName}</Text>

          {fields.length > 0 && (
            <View style={styles.fieldsTable}>
              <View style={styles.fieldsHeader}>
                <Text style={[styles.fieldHeaderCell, { flex: 1.2 }]}>Field</Text>
                <Text style={styles.fieldHeaderCell}>Before</Text>
                <Text style={styles.fieldHeaderCell}>After</Text>
              </View>
              {fields.map(([field, change]) => (
                <View key={field} style={styles.fieldRow}>
                  <Text style={[styles.fieldCell, styles.fieldName, { flex: 1.2 }]} numberOfLines={1}>
                    {field}
                  </Text>
                  <Text style={[styles.fieldCell, styles.oldValue]} numberOfLines={1}>
                    {change.old != null ? String(change.old) : '—'}
                  </Text>
                  <Text style={[styles.fieldCell, styles.newValue]} numberOfLines={1}>
                    {change.new != null ? String(change.new) : '—'}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </Card>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScreenHeader
        title="Change History"
        subtitle={title ?? `${entityType} #${entityId}`}
        color={COLOR.primary}
        onBack={() => navigation.goBack()}
      />
      {loading ? (
        <LoadingSpinner fullScreen color={COLOR.primary} message="Loading history..." />
      ) : (
        <FlatList
          data={logs}
          keyExtractor={item => String(item.id)}
          renderItem={renderLog}
          contentContainerStyle={[styles.list, logs.length === 0 && styles.listEmpty]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadLogs(); }}
              colors={[COLOR.primary]}
            />
          }
          ListEmptyComponent={
            <EmptyState title="No history yet" subtitle="Changes will appear here" icon="📋" />
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  list: { padding: 16, gap: 0 },
  listEmpty: { flex: 1 },
  logRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  timelineCol: { alignItems: 'center', width: 32 },
  iconCircle: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', zIndex: 1,
  },
  timelineLine: { flex: 1, width: 2, backgroundColor: '#E5E7EB', marginVertical: 4 },
  logCard: { flex: 1, marginBottom: 12 },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  actionBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 },
  actionText: { fontSize: rf(12), fontWeight: '700' },
  logTime: { fontSize: rf(11), color: '#9CA3AF' },
  logBy: { fontSize: rf(12), color: '#6B7280', marginBottom: 8 },
  fieldsTable: {
    borderWidth: 1, borderColor: '#F3F4F6', borderRadius: 8, overflow: 'hidden',
  },
  fieldsHeader: {
    flexDirection: 'row', backgroundColor: '#F9FAFB', paddingHorizontal: 10, paddingVertical: 6,
  },
  fieldHeaderCell: { flex: 1, fontSize: rf(11), fontWeight: '700', color: '#6B7280' },
  fieldRow: {
    flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 6,
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
  },
  fieldCell: { flex: 1, fontSize: rf(12) },
  fieldName: { color: '#374151', fontWeight: '600' },
  oldValue: { color: '#DC2626' },
  newValue: { color: '#16A34A' },
});
