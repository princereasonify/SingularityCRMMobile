import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Download, Eye, BarChart2, TrendingUp, Users, Map, DollarSign, GraduationCap, Settings } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { ROLE_COLORS, REPORTS } from '../../utils/constants';
import { rf, getCardWidth } from '../../utils/responsive';

const CATEGORIES = ['All', 'Performance', 'Pipeline', 'Analysis', 'Territory', 'Finance', 'Onboarding', 'Custom'];

const ICONS: Record<number, React.ReactNode> = {
  1: <BarChart2 size={24} color="#3B82F6" />,
  2: <TrendingUp size={24} color="#F59E0B" />,
  3: <Users size={24} color="#8B5CF6" />,
  4: <TrendingUp size={24} color="#EF4444" />,
  5: <Map size={24} color="#22C55E" />,
  6: <Users size={24} color="#F97316" />,
  7: <DollarSign size={24} color="#14B8A6" />,
  8: <GraduationCap size={24} color="#6366F1" />,
  9: <Settings size={24} color="#6B7280" />,
};

const ICON_BG: Record<number, string> = {
  1: '#EFF6FF', 2: '#FFFBEB', 3: '#F5F3FF', 4: '#FEF2F2',
  5: '#F0FDF4', 6: '#FFF7ED', 7: '#ECFDF5', 8: '#EEF2FF', 9: '#F9FAFB',
};

export const ReportsScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const role = user?.role || 'RH';
  const COLOR = ROLE_COLORS[role];
  const { width } = useWindowDimensions();
  const tablet = width >= 768;
  const [category, setCategory] = useState('All');

  const accessible = REPORTS.filter((r) => r.roles.includes(role));
  const filtered = category === 'All' ? accessible : accessible.filter((r) => r.category === category);

  const cols = tablet ? 3 : 1;
  const cardW = getCardWidth(cols, tablet ? 48 + (cols - 1) * 12 : 32);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={[styles.header, { backgroundColor: COLOR.primary }]}>
        <Text style={styles.headerTitle}>Reports Library</Text>
        <Text style={styles.headerSub}>{accessible.length} reports available</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.catChip, category === cat && { backgroundColor: '#FFF' }]}
              onPress={() => setCategory(cat)}
            >
              <Text style={[styles.catText, category === cat && { color: COLOR.primary }]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, tablet && styles.contentTablet]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.grid, tablet && { flexDirection: 'row', flexWrap: 'wrap', gap: 14 }]}>
          {filtered.map((report) => (
            <Card key={report.id} style={tablet ? { ...styles.reportCard, width: cardW } : styles.reportCard}>
              <View style={styles.reportHeader}>
                <View style={[styles.iconWrap, { backgroundColor: ICON_BG[report.id] }]}>
                  {ICONS[report.id]}
                </View>
                <View style={styles.reportMeta}>
                  <Badge label={report.category} color="#6B7280" size="sm" />
                  <View style={styles.rolesList}>
                    {report.roles.map((r) => (
                      <View key={r} style={[styles.rolePill, { backgroundColor: ROLE_COLORS[r as keyof typeof ROLE_COLORS]?.primary || '#6B7280' }]}>
                        <Text style={styles.rolePillText}>{r}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
              <Text style={styles.reportTitle}>{report.title}</Text>
              <Text style={styles.reportDesc} numberOfLines={2}>{report.description}</Text>
              <View style={styles.reportActions}>
                <TouchableOpacity
                  style={[styles.reportBtn, { borderColor: COLOR.primary }]}
                  onPress={() => Alert.alert('View Report', `Opening "${report.title}"...`)}
                >
                  <Eye size={14} color={COLOR.primary} />
                  <Text style={[styles.reportBtnText, { color: COLOR.primary }]}>View</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.reportBtn, { borderColor: '#6B7280' }]}
                  onPress={() => Alert.alert('Export', `Exporting "${report.title}" as PDF...`)}
                >
                  <Download size={14} color="#6B7280" />
                  <Text style={[styles.reportBtnText, { color: '#6B7280' }]}>Export</Text>
                </TouchableOpacity>
              </View>
            </Card>
          ))}
        </View>

        {filtered.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyTitle}>No reports in this category</Text>
          </View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  headerTitle: { fontSize: rf(22), fontWeight: '700', color: '#FFF' },
  headerSub: { fontSize: rf(13), color: 'rgba(255,255,255,0.75)', marginTop: 2, marginBottom: 12 },
  catScroll: {},
  catChip: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.2)', marginRight: 6,
  },
  catText: { fontSize: rf(12), color: 'rgba(255,255,255,0.9)', fontWeight: '600' },
  scroll: { flex: 1 },
  content: { padding: 14, gap: 10 },
  contentTablet: { padding: 24 },
  grid: { gap: 10 },
  reportCard: { padding: 16 },
  reportHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  iconWrap: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  reportMeta: { flex: 1, gap: 4 },
  rolesList: { flexDirection: 'row', gap: 4 },
  rolePill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 100 },
  rolePillText: { fontSize: rf(10), fontWeight: '700', color: '#FFF' },
  reportTitle: { fontSize: rf(16), fontWeight: '700', color: '#111827', marginBottom: 6 },
  reportDesc: { fontSize: rf(13), color: '#6B7280', lineHeight: 19, marginBottom: 14 },
  reportActions: { flexDirection: 'row', gap: 8 },
  reportBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: 8, borderRadius: 8, borderWidth: 1.5,
  },
  reportBtnText: { fontSize: rf(13), fontWeight: '600' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: rf(16), fontWeight: '600', color: '#374151', textAlign: 'center' },
});
