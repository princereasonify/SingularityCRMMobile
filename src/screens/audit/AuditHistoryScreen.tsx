import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlusCircle, Edit3, Trash2, ArrowLeft } from 'lucide-react-native';
import { auditApi } from '../../api/audit';
import { AuditLog } from '../../types';
import { LoadingSpinner, EmptyState } from '../../components/common/LoadingSpinner';
import { Card, Badge } from '../../components/ui';

import { useAppTheme } from '../../theme/useAppTheme';
import { formatDateTime } from '../../utils/formatting';
import { rf } from '../../utils/responsive';
import { withAlpha, type AppTheme } from '../../theme';

const actionConfig = (T: AppTheme) => ({
  Created: { icon: PlusCircle, color: T.success },
  Updated: { icon: Edit3, color: T.info },
  Deleted: { icon: Trash2, color: T.danger },
});

export const AuditHistoryScreen = ({ navigation, route }: any) => {
  const { entityType, entityId, title } = route.params as {
    entityType: string;
    entityId: number;
    title?: string;
  };
  const T = useAppTheme();
  const insets = useSafeAreaInsets();
  const CONFIG = actionConfig(T);

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
    const cfg = CONFIG[item.action] ?? CONFIG.Updated;
    const Icon = cfg.icon;
    const fields = item.changedFields ? Object.entries(item.changedFields) : [];
    const isLast = index === logs.length - 1;

    return (
      <View style={styles.logRow}>
        {/* Timeline line */}
        <View style={styles.timelineCol}>
          <View style={[styles.iconCircle, { backgroundColor: withAlpha(cfg.color, 0.13) }]}>
            <Icon size={14} color={cfg.color} />
          </View>
          {!isLast && <View style={[styles.timelineLine, { backgroundColor: T.line }]} />}
        </View>

        <Card style={styles.logCard}>
          <View style={styles.logHeader}>
            <Badge label={item.action} color={cfg.color} />
            <Text style={[styles.logTime, { color: T.dim }]}>{formatDateTime(item.performedAt)}</Text>
          </View>
          <Text style={[styles.logBy, { color: T.sub }]}>by {item.performedByName}</Text>

          {fields.length > 0 && (
            <View style={[styles.fieldsTable, { borderColor: T.line }]}>
              <View style={[styles.fieldsHeader, { backgroundColor: T.cardAlt }]}>
                <Text style={[styles.fieldHeaderCell, { flex: 1.2, color: T.sub }]}>Field</Text>
                <Text style={[styles.fieldHeaderCell, { color: T.sub }]}>Before</Text>
                <Text style={[styles.fieldHeaderCell, { color: T.sub }]}>After</Text>
              </View>
              {fields.map(([field, change]) => (
                <View key={field} style={[styles.fieldRow, { borderTopColor: T.line }]}>
                  <Text style={[styles.fieldCell, styles.fieldName, { flex: 1.2, color: T.text }]} numberOfLines={1}>
                    {field}
                  </Text>
                  <Text style={[styles.fieldCell, { color: T.danger }]} numberOfLines={1}>
                    {change.old != null ? String(change.old) : '—'}
                  </Text>
                  <Text style={[styles.fieldCell, { color: T.success }]} numberOfLines={1}>
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
    <View style={[styles.root, { backgroundColor: T.bg }]}>
      {/* Plain themed header — one header treatment across every page. */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: T.line }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: T.card, borderColor: T.line }]}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ArrowLeft size={20} color={T.text} />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={[styles.headerTitle, { color: T.text }]} numberOfLines={1}>Change History</Text>
            <Text style={[styles.headerSub, { color: T.sub }]} numberOfLines={1}>
              {title ?? `${entityType} #${entityId}`}
            </Text>
          </View>
        </View>
      </View>

      {loading ? (
        <LoadingSpinner fullScreen color={T.accent} message="Loading history..." />
      ) : (
        <FlatList
          data={logs}
          keyExtractor={item => String(item.id)}
          renderItem={renderLog}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + 24 },
            logs.length === 0 && styles.listEmpty,
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadLogs(); }}
              tintColor={T.accent}
            />
          }
          ListEmptyComponent={
            <EmptyState title="No history yet" subtitle="Changes will appear here" icon="📋" />
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Plain themed header — one header treatment across every page.
  header: { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: {
    width: 40, height: 40, borderRadius: 12, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  headerText: { flex: 1, minWidth: 0 },
  headerTitle: { fontWeight: '700', fontSize: rf(20), letterSpacing: -0.3 },
  headerSub: { fontWeight: '400', fontSize: rf(12.5), marginTop: 1 },

  list: { padding: 16, gap: 0 },
  listEmpty: { flex: 1 },
  logRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  timelineCol: { alignItems: 'center', width: 32 },
  iconCircle: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', zIndex: 1,
  },
  timelineLine: { flex: 1, width: 2, marginVertical: 4 },
  logCard: { flex: 1, marginBottom: 12 },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  logTime: { fontWeight: '400', fontSize: rf(11) },
  logBy: { fontWeight: '400', fontSize: rf(12), marginBottom: 8 },
  fieldsTable: {
    borderWidth: 1, borderRadius: 8, overflow: 'hidden',
  },
  fieldsHeader: {
    flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 6,
  },
  fieldHeaderCell: { flex: 1, fontWeight: '700', fontSize: rf(11) },
  fieldRow: {
    flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  fieldCell: { flex: 1, fontWeight: '400', fontSize: rf(12) },
  fieldName: { fontWeight: '600' },
});
