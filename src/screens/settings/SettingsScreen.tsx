import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Switch, TouchableOpacity, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Globe, Bell, MessageSquare, Wifi, WifiOff, Database,
  RefreshCw, LayoutDashboard, LogOut, ChevronRight, Settings,
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useOffline } from '../../context/OfflineContext';
import { settingsApi } from '../../api/settings';
import { aiApi } from '../../api/ai';
import { OfflineCache } from '../../services/OfflineCache';
import { Card } from '../../components/common/Card';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { ROLE_COLORS } from '../../utils/constants';
import { rf } from '../../utils/responsive';
import { Language } from '../../i18n';
import { AiUsageQuota } from '../../types';

const AI_ENDPOINTS = [
  { key: '/ai/daily-plan', label: 'Daily Plan', limit: 3 },
  { key: '/ai/daily-report', label: 'Daily Report', limit: 2 },
  { key: '/ai/insights', label: 'AI Insights', limit: 5 },
];

export const SettingsScreen = ({ navigation }: any) => {
  const { user, logout } = useAuth();
  const { language, setLang, t } = useLanguage();
  const { isOnline, pendingCount, isSyncing, syncManually } = useOffline();
  const COLOR = ROLE_COLORS[(user?.role || 'FO') as keyof typeof ROLE_COLORS];

  const [whatsapp, setWhatsapp] = useState(false);
  const [push, setPush] = useState(true);
  const [aiQuotas, setAiQuotas] = useState<AiUsageQuota[]>([]);
  const [loadingPrefs, setLoadingPrefs] = useState(true);

  const loadSettings = useCallback(async () => {
    try {
      const res = await settingsApi.get();
      setWhatsapp(res.data?.whatsappNotifications ?? false);
      setPush(res.data?.pushNotifications ?? true);
    } catch {}

    // Load AI quotas
    const quotas: AiUsageQuota[] = [];
    for (const ep of AI_ENDPOINTS) {
      try {
        const r = await aiApi.getUsageQuota(ep.key);
        quotas.push(r.data);
      } catch {
        quotas.push({ endpoint: ep.key, used: 0, limit: ep.limit, resetsAt: '' });
      }
    }
    setAiQuotas(quotas);
    setLoadingPrefs(false);
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const toggleWhatsapp = async (val: boolean) => {
    setWhatsapp(val);
    try { await settingsApi.update({ whatsappNotifications: val }); } catch {}
  };

  const togglePush = async (val: boolean) => {
    setPush(val);
    try { await settingsApi.update({ pushNotifications: val }); } catch {}
  };

  const handleClearCache = () => {
    Alert.alert(
      t('settings.clearCache'),
      'This will delete locally cached schools, contacts, and calendar. Data will reload from server.',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          onPress: async () => {
            await OfflineCache.clearAll();
            Alert.alert(t('common.success'), 'Cache cleared successfully.');
          },
        },
      ],
    );
  };

  const handleSync = async () => {
    const result = await syncManually();
    if (!result) return;
    Alert.alert(
      'Sync Complete',
      result.total === 0
        ? 'Nothing to sync.'
        : `${result.synced} synced, ${result.failed} failed.`,
    );
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('settings.logout'), style: 'destructive', onPress: logout },
    ]);
  };

  const getQuotaLabel = (endpoint: string) => {
    return AI_ENDPOINTS.find(e => e.key === endpoint)?.label ?? endpoint;
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title={t('settings.title')}
        color={COLOR.primary}
        onBack={() => navigation.goBack()}
      />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        {/* Offline status banner */}
        {!isOnline && (
          <View style={styles.offlineBanner}>
            <WifiOff size={16} color="#FFF" />
            <Text style={styles.offlineBannerText}>{t('offline.banner')}</Text>
          </View>
        )}

        {/* Language */}
        <Card style={styles.section}>
          <SectionTitle icon={<Globe size={16} color={COLOR.primary} />} title={t('settings.language')} />
          <View style={styles.langRow}>
            {(['en', 'hi'] as Language[]).map(lang => (
              <TouchableOpacity
                key={lang}
                style={[styles.langChip, language === lang && { backgroundColor: COLOR.primary }]}
                onPress={() => setLang(lang)}
              >
                <Text style={[styles.langChipText, language === lang && { color: '#FFF' }]}>
                  {lang === 'en' ? t('settings.english') : t('settings.hindi')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Notifications */}
        <Card style={styles.section}>
          <SectionTitle icon={<Bell size={16} color={COLOR.primary} />} title={t('settings.notifications')} />
          <ToggleRow
            icon={<MessageSquare size={16} color="#25D366" />}
            label={t('settings.whatsappNotifications')}
            value={whatsapp}
            onValueChange={toggleWhatsapp}
            trackColor={COLOR.primary}
          />
          <ToggleRow
            icon={<Bell size={16} color="#2563EB" />}
            label={t('settings.pushNotifications')}
            value={push}
            onValueChange={togglePush}
            trackColor={COLOR.primary}
            last
          />
        </Card>

        {/* Offline Mode */}
        <Card style={styles.section}>
          <SectionTitle
            icon={isOnline
              ? <Wifi size={16} color="#16A34A" />
              : <WifiOff size={16} color="#DC2626" />}
            title={t('settings.offlineMode')}
          />
          <View style={styles.offlineRow}>
            <View style={[styles.statusDot, { backgroundColor: isOnline ? '#16A34A' : '#DC2626' }]} />
            <Text style={styles.offlineStatus}>{isOnline ? 'Online' : 'Offline'}</Text>
            {pendingCount > 0 && (
              <Text style={styles.pendingBadge}>{pendingCount} {t('settings.pendingSync')}</Text>
            )}
          </View>
          <View style={styles.cacheButtons}>
            <TouchableOpacity
              style={[styles.cacheBtn, { borderColor: COLOR.primary }]}
              onPress={handleSync}
              disabled={isSyncing || !isOnline}
            >
              <RefreshCw size={14} color={COLOR.primary} />
              <Text style={[styles.cacheBtnText, { color: COLOR.primary }]}>
                {isSyncing ? t('offline.syncing') : t('settings.syncNow')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.cacheBtn, { borderColor: '#9CA3AF' }]}
              onPress={handleClearCache}
            >
              <Database size={14} color="#9CA3AF" />
              <Text style={[styles.cacheBtnText, { color: '#9CA3AF' }]}>{t('settings.clearCache')}</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* AI Usage */}
        {!loadingPrefs && aiQuotas.length > 0 && (
          <Card style={styles.section}>
            <SectionTitle icon={<RefreshCw size={16} color={COLOR.primary} />} title={t('settings.aiUsage')} />
            {aiQuotas.map(q => {
              const pct = q.limit > 0 ? (q.used / q.limit) * 100 : 0;
              const barColor = pct >= 100 ? '#DC2626' : pct >= 66 ? '#F59E0B' : '#16A34A';
              return (
                <View key={q.endpoint} style={styles.quotaRow}>
                  <View style={styles.quotaInfo}>
                    <Text style={styles.quotaLabel}>{getQuotaLabel(q.endpoint)}</Text>
                    <Text style={[styles.quotaCount, { color: barColor }]}>
                      {q.used}/{q.limit}
                    </Text>
                  </View>
                  <View style={styles.quotaBarBg}>
                    <View style={[styles.quotaBarFill, { width: `${Math.min(pct, 100)}%`, backgroundColor: barColor }]} />
                  </View>
                </View>
              );
            })}
          </Card>
        )}

        {/* Dashboard Customization */}
        <Card style={styles.section}>
          <SectionTitle icon={<LayoutDashboard size={16} color={COLOR.primary} />} title={t('settings.dashboard')} />
          <TouchableOpacity
            style={styles.navRow}
            onPress={() => navigation.navigate('DashboardCustomize')}
          >
            <Text style={styles.navRowText}>{t('settings.customizeDashboard')}</Text>
            <ChevronRight size={16} color="#9CA3AF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.navRow, { borderTopWidth: 1, borderTopColor: '#F3F4F6', marginTop: 2 }]}
            onPress={() => navigation.navigate('UserManual')}
          >
            <Text style={styles.navRowText}>📖 User Manual</Text>
            <ChevronRight size={16} color="#9CA3AF" />
          </TouchableOpacity>
        </Card>

        {/* SH Admin Config */}
        {(user?.role === 'SH' || user?.role === 'SCA') && (
          <Card style={styles.section}>
            <SectionTitle icon={<Settings size={16} color={COLOR.primary} />} title="Admin Configuration" />
            <TouchableOpacity
              style={styles.navRow}
              onPress={() => navigation.navigate('AllowanceConfig')}
            >
              <Text style={styles.navRowText}>💰 Allowance Config</Text>
              <ChevronRight size={16} color="#9CA3AF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.navRow, { borderTopWidth: 1, borderTopColor: '#F3F4F6', marginTop: 2 }]}
              onPress={() => navigation.navigate('VisitFieldConfig')}
            >
              <Text style={styles.navRowText}>📝 Visit Field Config</Text>
              <ChevronRight size={16} color="#9CA3AF" />
            </TouchableOpacity>
          </Card>
        )}

        {/* Account */}
        <Card style={styles.section}>
          <SectionTitle icon={<LogOut size={16} color="#DC2626" />} title={t('settings.account')} />
          {user && (
            <View style={styles.userRow}>
              <View style={[styles.userAvatar, { backgroundColor: COLOR.light }]}>
                <Text style={[styles.userAvatarText, { color: COLOR.primary }]}>
                  {user.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{user.name}</Text>
                <Text style={styles.userEmail}>{user.email}</Text>
                <Text style={[styles.userRole, { color: COLOR.primary }]}>{user.role}</Text>
              </View>
            </View>
          )}
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <LogOut size={16} color="#DC2626" />
            <Text style={styles.logoutText}>{t('settings.logout')}</Text>
          </TouchableOpacity>
        </Card>

        <Text style={styles.version}>{t('settings.version')} 1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const SectionTitle = ({ icon, title }: { icon: React.ReactNode; title: string }) => (
  <View style={styles.sectionHeader}>
    {icon}
    <Text style={styles.sectionTitle}>{title}</Text>
  </View>
);

const ToggleRow = ({ icon, label, value, onValueChange, trackColor, last }: any) => (
  <View style={[styles.toggleRow, last && styles.toggleRowLast]}>
    <View style={styles.toggleLeft}>
      {icon}
      <Text style={styles.toggleLabel}>{label}</Text>
    </View>
    <Switch value={value} onValueChange={onValueChange} trackColor={{ true: trackColor }} />
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  offlineBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#DC2626', borderRadius: 10, padding: 12,
  },
  offlineBannerText: { color: '#FFF', fontSize: rf(13), fontWeight: '600', flex: 1 },
  section: { gap: 0 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  sectionTitle: { fontSize: rf(14), fontWeight: '700', color: '#111827' },
  langRow: { flexDirection: 'row', gap: 10 },
  langChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 100,
    backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB',
  },
  langChipText: { fontSize: rf(13), fontWeight: '600', color: '#374151' },
  toggleRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  toggleRowLast: { borderBottomWidth: 0 },
  toggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  toggleLabel: { fontSize: rf(14), color: '#374151', fontWeight: '500' },
  offlineRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  offlineStatus: { fontSize: rf(14), color: '#374151', fontWeight: '600' },
  pendingBadge: {
    marginLeft: 'auto',
    fontSize: rf(12), color: '#F59E0B', fontWeight: '600',
  },
  cacheButtons: { flexDirection: 'row', gap: 10 },
  cacheBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1,
  },
  cacheBtnText: { fontSize: rf(13), fontWeight: '600' },
  quotaRow: { marginBottom: 12 },
  quotaInfo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  quotaLabel: { fontSize: rf(13), color: '#374151', fontWeight: '500' },
  quotaCount: { fontSize: rf(13), fontWeight: '700' },
  quotaBarBg: { height: 6, backgroundColor: '#F3F4F6', borderRadius: 3 },
  quotaBarFill: { height: 6, borderRadius: 3 },
  navRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12,
  },
  navRowText: { fontSize: rf(14), color: '#374151', fontWeight: '500' },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  userAvatar: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  userAvatarText: { fontSize: rf(20), fontWeight: '700' },
  userInfo: { flex: 1 },
  userName: { fontSize: rf(16), fontWeight: '700', color: '#111827' },
  userEmail: { fontSize: rf(13), color: '#6B7280' },
  userRole: { fontSize: rf(12), fontWeight: '600', marginTop: 2 },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 12, justifyContent: 'center',
    borderWidth: 1, borderColor: '#FEE2E2', borderRadius: 10, backgroundColor: '#FEF2F2',
  },
  logoutText: { fontSize: rf(14), fontWeight: '700', color: '#DC2626' },
  version: { textAlign: 'center', fontSize: rf(12), color: '#9CA3AF', paddingTop: 8 },
});
