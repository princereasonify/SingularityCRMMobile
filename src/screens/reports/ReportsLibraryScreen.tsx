import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  BarChart3, TrendingDown, AlertOctagon, Map, Users, TrendingUp,
  School, Settings, Download, Eye, X,
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { ROLE_COLORS } from '../../utils/constants';
import { rf } from '../../utils/responsive';

const REPORT_DEFS = [
  { id: 1, title: 'Monthly Performance', desc: 'Revenue, targets, win rate, conversion — by region, zone, FO.', icon: BarChart3, roles: ['ZH', 'RH', 'SH'], color: '#2563EB', bg: '#DBEAFE', category: 'Performance' },
  { id: 2, title: 'Deal Aging', desc: 'Deals stuck in the same stage for 10+ days.', icon: AlertOctagon, roles: ['ZH', 'RH', 'SH'], color: '#D97706', bg: '#FEF3C7', category: 'Pipeline' },
  { id: 3, title: 'Conversion Funnel', desc: 'Stage-by-stage drop-off rates across the pipeline.', icon: BarChart3, roles: ['ZH', 'RH', 'SH'], color: '#7C3AED', bg: '#EDE9FE', category: 'Pipeline' },
  { id: 4, title: 'Lost Deal Analysis', desc: 'Full breakdown of lost deals by reason, FO, zone, value.', icon: TrendingDown, roles: ['RH', 'SH'], color: '#DC2626', bg: '#FEE2E2', category: 'Analysis' },
  { id: 5, title: 'Territory Coverage', desc: 'Map-based: schools contacted vs unreached by district.', icon: Map, roles: ['RH', 'SH'], color: '#0D9488', bg: '#CCFBF1', category: 'Territory' },
  { id: 6, title: 'Team Leaderboard', desc: 'FO rankings across all KPIs for a selectable period.', icon: Users, roles: ['ZH', 'RH', 'SH'], color: '#7C3AED', bg: '#EDE9FE', category: 'Performance' },
  { id: 7, title: 'Revenue Forecast', desc: 'Weighted pipeline forecast vs official target.', icon: TrendingUp, roles: ['RH', 'SH'], color: '#059669', bg: '#D1FAE5', category: 'Finance' },
  { id: 8, title: 'School Onboarding', desc: 'Won deals through kickoff, ERP setup, go-live tracking.', icon: School, roles: ['ZH', 'RH', 'SH'], color: '#0891B2', bg: '#CFFAFE', category: 'Onboarding' },
  { id: 9, title: 'Custom Report Builder', desc: 'Build your own: choose dimensions + metrics, save as named report.', icon: Settings, roles: ['RH', 'SH'], color: '#6B7280', bg: '#F3F4F6', category: 'Custom' },
];

const CATEGORIES = ['All', 'Performance', 'Pipeline', 'Analysis', 'Territory', 'Finance', 'Onboarding', 'Custom'];

const ROLE_TAG_COLORS: Record<string, { bg: string; text: string }> = {
  SH:  { bg: '#DBEAFE', text: '#2563EB' },
  RH:  { bg: '#FFEDD5', text: '#EA580C' },
  ZH:  { bg: '#EDE9FE', text: '#7C3AED' },
  FO:  { bg: '#CCFBF1', text: '#0D9488' },
  SCA: { bg: '#FEE2E2', text: '#DC2626' },
};

function ViewModal({ report, onClose }: { report: any; onClose: () => void }) {
  return (
    <Modal visible={!!report} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }} edges={['top']}>
        <View style={vm.header}>
          <View style={{ flex: 1 }}>
            <Text style={vm.title}>{report?.title}</Text>
            <Text style={vm.sub}>{report?.desc}</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={8}><X size={22} color="#6B7280" /></TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={vm.content}>
          {report?.id === 1 ? (
            <View>
              <View style={vm.tableHeader}>
                {['Region', 'Revenue', 'Target', '%', 'Win%'].map(h => <Text key={h} style={vm.th}>{h}</Text>)}
              </View>
              {[['West','₹14.2Cr','₹40Cr','35%','31%'],['South','₹22.1Cr','₹50Cr','44%','38%'],['North','₹18.5Cr','₹50Cr','37%','33%'],['East','₹8.2Cr','₹30Cr','27%','22%']].map((row, i) => (
                <View key={i} style={[vm.tableRow, i % 2 === 0 && { backgroundColor: '#F9FAFB' }]}>
                  {row.map((cell, ci) => <Text key={ci} style={vm.td}>{cell}</Text>)}
                </View>
              ))}
            </View>
          ) : report?.id === 2 ? (
            <View style={{ gap: 10 }}>
              {[{ school: 'Vibgyor High Thane', stage: 'Qualified', days: 20, fo: 'Vikram Nair' }, { school: 'Euro Kids Malad', stage: 'Contacted', days: 13, fo: 'Vikram Nair' }].map((d, i) => (
                <View key={i} style={vm.agingCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={vm.agingSchool}>{d.school}</Text>
                    <Text style={vm.agingMeta}>{d.fo} · {d.stage}</Text>
                  </View>
                  <Text style={vm.agingDays}>{d.days}d</Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={vm.preview}>
              <BarChart3 size={40} color="#D1D5DB" />
              <Text style={vm.previewTitle}>Interactive preview coming soon</Text>
              <Text style={vm.previewSub}>Use Export to download full data</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const vm = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', backgroundColor: '#FFF' },
  title: { fontSize: rf(17), fontWeight: '700', color: '#111827' },
  sub: { fontSize: rf(12), color: '#6B7280', marginTop: 2 },
  content: { padding: 16, paddingBottom: 32 },
  tableHeader: { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#F3F4F6', borderRadius: 8, marginBottom: 4 },
  th: { flex: 1, fontSize: rf(11), fontWeight: '700', color: '#6B7280', textAlign: 'center' },
  tableRow: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8 },
  td: { flex: 1, fontSize: rf(12), color: '#111827', textAlign: 'center' },
  agingCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#FDE68A' },
  agingSchool: { fontSize: rf(13), fontWeight: '700', color: '#111827' },
  agingMeta: { fontSize: rf(11), color: '#6B7280', marginTop: 2 },
  agingDays: { fontSize: rf(15), fontWeight: '800', color: '#DC2626' },
  preview: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  previewTitle: { fontSize: rf(14), fontWeight: '600', color: '#9CA3AF' },
  previewSub: { fontSize: rf(12), color: '#9CA3AF' },
});

export const ReportsLibraryScreen = () => {
  const { user } = useAuth();
  const role = user?.role || 'FO';
  const COLOR = ROLE_COLORS[role as keyof typeof ROLE_COLORS];
  const [activeCategory, setActiveCategory] = useState('All');
  const [viewReport, setViewReport] = useState<any>(null);

  const accessible = REPORT_DEFS.filter(r => r.roles.includes(role));
  const filtered = accessible.filter(r => activeCategory === 'All' || r.category === activeCategory);

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.pageTitle}>Reports Library</Text>
        <Text style={s.pageSub}>Centralised library of all standard and custom reports</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.catRow}>
          {CATEGORIES.map(cat => (
            <TouchableOpacity key={cat} style={[s.catChip, activeCategory === cat && { backgroundColor: COLOR.primary, borderColor: COLOR.primary }]} onPress={() => setActiveCategory(cat)}>
              <Text style={[s.catText, activeCategory === cat && { color: '#FFF' }]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {filtered.length === 0 ? (
          <View style={s.empty}><Text style={s.emptyText}>No reports available for your role in this category</Text></View>
        ) : (
          <View style={s.grid}>
            {filtered.map(report => {
              const Icon = report.icon;
              return (
                <View key={report.id} style={s.card}>
                  <View style={s.cardTop}>
                    <View style={[s.cardIcon, { backgroundColor: report.bg }]}>
                      <Icon size={20} color={report.color} />
                    </View>
                    <View style={s.roleTags}>
                      {report.roles.map(r => {
                        const rc = ROLE_TAG_COLORS[r] || { bg: '#F3F4F6', text: '#6B7280' };
                        return (
                          <View key={r} style={[s.roleTag, { backgroundColor: rc.bg }]}>
                            <Text style={[s.roleTagText, { color: rc.text }]}>{r}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                  <Text style={s.cardCat}>{report.category}</Text>
                  <Text style={s.cardTitle}>{report.title}</Text>
                  <Text style={s.cardDesc}>{report.desc}</Text>
                  <View style={s.cardActions}>
                    <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#DBEAFE' }]} onPress={() => setViewReport(report)}>
                      <Eye size={14} color="#2563EB" /><Text style={[s.actionText, { color: '#2563EB' }]}>View</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#F3F4F6' }]} onPress={() => Alert.alert('Export', `Exporting ${report.title}...`)}>
                      <Download size={14} color="#6B7280" /><Text style={[s.actionText, { color: '#6B7280' }]}>Export</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
      <ViewModal report={viewReport} onClose={() => setViewReport(null)} />
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 16, paddingBottom: 48 },
  pageTitle: { fontSize: rf(20), fontWeight: '800', color: '#111827' },
  pageSub: { fontSize: rf(13), color: '#6B7280', marginBottom: 12 },
  catRow: { gap: 8, paddingRight: 16, marginBottom: 16 },
  catChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 100, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E5E7EB' },
  catText: { fontSize: rf(12), fontWeight: '700', color: '#6B7280' },
  grid: { gap: 12 },
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#F3F4F6', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, elevation: 1 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  cardIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  roleTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, flex: 1, justifyContent: 'flex-end' },
  roleTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 100 },
  roleTagText: { fontSize: rf(10), fontWeight: '700' },
  cardCat: { fontSize: rf(10), color: '#9CA3AF', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  cardTitle: { fontSize: rf(15), fontWeight: '700', color: '#111827', marginBottom: 4 },
  cardDesc: { fontSize: rf(12), color: '#6B7280', lineHeight: 18, marginBottom: 12 },
  cardActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 10 },
  actionText: { fontSize: rf(12), fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: rf(14), color: '#9CA3AF', textAlign: 'center' },
});
