import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Switch, TouchableOpacity, Alert,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { GradientBackground } from '../../components/common/GradientBackground';
import { Card } from '../../components/ui';
import { Fonts } from '../../theme';
import { useAppTheme } from '../../theme/useAppTheme';
import { rf, isTabletDevice } from '../../utils/responsive';
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
  const T = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const twoWide = isTabletDevice && width > height;

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
    <View style={[styles.root, { backgroundColor: T.bg }]}>
      {/* Sunstone hero header */}
      <GradientBackground glow style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerIcon}>
            <Settings size={20} color="#FFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>{t('settings.title') || 'Settings'}</Text>
            <Text style={styles.headerSub} numberOfLines={1}>Preferences & account</Text>
          </View>
        </View>
      </GradientBackground>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 28, gap: 12 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={twoWide ? styles.centeredWide : undefined}>

          {/* Offline status banner */}
          {!isOnline && (
            <View style={[styles.offlineBanner, { backgroundColor: T.danger }]}>
              <WifiOff size={16} color="#FFF" />
              <Text style={styles.offlineBannerText}>{t('offline.banner')}</Text>
            </View>
          )}

          {/* Language */}
          <Card style={styles.section}>
            <SectionTitle icon={<Globe size={16} color={T.accent} />} title={t('settings.language')} />
            <View style={styles.langRow}>
              {(['en', 'hi'] as Language[]).map(lang => (
                <TouchableOpacity
                  key={lang}
                  style={[
                    styles.langChip,
                    { backgroundColor: T.cardAlt, borderColor: T.line },
                    language === lang && { backgroundColor: T.accent, borderColor: T.accent },
                  ]}
                  onPress={() => setLang(lang)}
                >
                  <Text style={[styles.langChipText, { color: language === lang ? '#FFF' : T.sub }]}>
                    {lang === 'en' ? t('settings.english') : t('settings.hindi')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Card>

          {/* Notifications */}
          <Card style={styles.section}>
            <SectionTitle icon={<Bell size={16} color={T.accent} />} title={t('settings.notifications')} />
            <ToggleRow
              icon={<MessageSquare size={16} color={T.success} />}
              label={t('settings.whatsappNotifications')}
              value={whatsapp}
              onValueChange={toggleWhatsapp}
              trackColor={T.accent}
            />
            <ToggleRow
              icon={<Bell size={16} color={T.info} />}
              label={t('settings.pushNotifications')}
              value={push}
              onValueChange={togglePush}
              trackColor={T.accent}
              last
            />
          </Card>

          {/* Offline Mode */}
          <Card style={styles.section}>
            <SectionTitle
              icon={isOnline
                ? <Wifi size={16} color={T.success} />
                : <WifiOff size={16} color={T.danger} />}
              title={t('settings.offlineMode')}
            />
            <View style={styles.offlineRow}>
              <View style={[styles.statusDot, { backgroundColor: isOnline ? T.success : T.danger }]} />
              <Text style={[styles.offlineStatus, { color: T.text }]}>{isOnline ? 'Online' : 'Offline'}</Text>
              {pendingCount > 0 && (
                <Text style={[styles.pendingBadge, { color: T.warning }]}>{pendingCount} {t('settings.pendingSync')}</Text>
              )}
            </View>
            <View style={styles.cacheButtons}>
              <TouchableOpacity
                style={[styles.cacheBtn, { borderColor: T.accent }]}
                onPress={handleSync}
                disabled={isSyncing || !isOnline}
              >
                <RefreshCw size={14} color={T.accent} />
                <Text style={[styles.cacheBtnText, { color: T.accent }]}>
                  {isSyncing ? t('offline.syncing') : t('settings.syncNow')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.cacheBtn, { borderColor: T.line }]}
                onPress={handleClearCache}
              >
                <Database size={14} color={T.dim} />
                <Text style={[styles.cacheBtnText, { color: T.dim }]}>{t('settings.clearCache')}</Text>
              </TouchableOpacity>
            </View>
          </Card>

          {/* AI Usage */}
          {!loadingPrefs && aiQuotas.length > 0 && (
            <Card style={styles.section}>
              <SectionTitle icon={<RefreshCw size={16} color={T.accent} />} title={t('settings.aiUsage')} />
              {aiQuotas.map(q => {
                const pct = q.limit > 0 ? (q.used / q.limit) * 100 : 0;
                const barColor = pct >= 100 ? T.danger : pct >= 66 ? T.warning : T.success;
                return (
                  <View key={q.endpoint} style={styles.quotaRow}>
                    <View style={styles.quotaInfo}>
                      <Text style={[styles.quotaLabel, { color: T.text }]}>{getQuotaLabel(q.endpoint)}</Text>
                      <Text style={[styles.quotaCount, { color: barColor }]}>
                        {q.used}/{q.limit}
                      </Text>
                    </View>
                    <View style={[styles.quotaBarBg, { backgroundColor: T.cardAlt }]}>
                      <View style={[styles.quotaBarFill, { width: `${Math.min(pct, 100)}%`, backgroundColor: barColor }]} />
                    </View>
                  </View>
                );
              })}
            </Card>
          )}

          {/* Dashboard Customization */}
          <Card style={styles.section}>
            <SectionTitle icon={<LayoutDashboard size={16} color={T.accent} />} title={t('settings.dashboard')} />
            <TouchableOpacity
              style={styles.navRow}
              onPress={() => navigation.navigate('DashboardCustomize')}
            >
              <Text style={[styles.navRowText, { color: T.text }]}>{t('settings.customizeDashboard')}</Text>
              <ChevronRight size={16} color={T.dim} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.navRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.line, marginTop: 2 }]}
              onPress={() => navigation.navigate('UserManual')}
            >
              <Text style={[styles.navRowText, { color: T.text }]}>📖 User Manual</Text>
              <ChevronRight size={16} color={T.dim} />
            </TouchableOpacity>
          </Card>

          {/* SH Admin Config */}
          {(user?.role === 'SH' || user?.role === 'SCA') && (
            <Card style={styles.section}>
              <SectionTitle icon={<Settings size={16} color={T.accent} />} title="Admin Configuration" />
              <TouchableOpacity
                style={styles.navRow}
                onPress={() => navigation.navigate('AllowanceConfig')}
              >
                <Text style={[styles.navRowText, { color: T.text }]}>💰 Allowance Config</Text>
                <ChevronRight size={16} color={T.dim} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.navRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.line, marginTop: 2 }]}
                onPress={() => navigation.navigate('VisitFieldConfig')}
              >
                <Text style={[styles.navRowText, { color: T.text }]}>📝 Visit Field Config</Text>
                <ChevronRight size={16} color={T.dim} />
              </TouchableOpacity>
            </Card>
          )}

          {/* Account */}
          <Card style={styles.section}>
            <SectionTitle icon={<LogOut size={16} color={T.danger} />} title={t('settings.account')} />
            {user && (
              <View style={styles.userRow}>
                <View style={[styles.userAvatar, { backgroundColor: T.accentSoft }]}>
                  <Text style={[styles.userAvatarText, { color: T.accent }]}>
                    {user.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.userInfo}>
                  <Text style={[styles.userName, { color: T.text }]}>{user.name}</Text>
                  <Text style={[styles.userEmail, { color: T.sub }]}>{user.email}</Text>
                  <Text style={[styles.userRole, { color: T.accent }]}>{user.role}</Text>
                </View>
              </View>
            )}
            <TouchableOpacity
              style={[styles.logoutBtn, { borderColor: T.danger + '33', backgroundColor: T.danger + '14' }]}
              onPress={handleLogout}
            >
              <LogOut size={16} color={T.danger} />
              <Text style={[styles.logoutText, { color: T.danger }]}>{t('settings.logout')}</Text>
            </TouchableOpacity>
          </Card>

          <Text style={[styles.version, { color: T.dim }]}>{t('settings.version')} 1.0.0</Text>
        </View>
      </ScrollView>
    </View>
  );
};

const SectionTitle = ({ icon, title }: { icon: React.ReactNode; title: string }) => {
  const T = useAppTheme();
  return (
    <View style={styles.sectionHeader}>
      {icon}
      <Text style={[styles.sectionTitle, { color: T.text }]}>{title}</Text>
    </View>
  );
};

const ToggleRow = ({ icon, label, value, onValueChange, trackColor, last }: any) => {
  const T = useAppTheme();
  return (
    <View style={[styles.toggleRow, { borderBottomColor: T.line }, last && styles.toggleRowLast]}>
      <View style={styles.toggleLeft}>
        {icon}
        <Text style={[styles.toggleLabel, { color: T.text }]}>{label}</Text>
      </View>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ true: trackColor }} />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIcon: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontFamily: Fonts.bold, fontSize: rf(20), color: '#FFF', letterSpacing: -0.4 },
  headerSub: { fontFamily: Fonts.regular, fontSize: rf(12), color: 'rgba(255,255,255,0.8)', marginTop: 1 },

  scroll: { flex: 1 },
  centeredWide: { width: '100%', maxWidth: 720, alignSelf: 'center', gap: 12 },

  offlineBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, padding: 12,
  },
  offlineBannerText: { color: '#FFF', fontSize: rf(13), fontFamily: Fonts.medium, flex: 1 },
  section: { gap: 0 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  sectionTitle: { fontSize: rf(14), fontFamily: Fonts.bold },
  langRow: { flexDirection: 'row', gap: 10 },
  langChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 100, borderWidth: 1,
  },
  langChipText: { fontSize: rf(13), fontFamily: Fonts.medium },
  toggleRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  toggleRowLast: { borderBottomWidth: 0 },
  toggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  toggleLabel: { fontSize: rf(14), fontFamily: Fonts.medium },
  offlineRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  offlineStatus: { fontSize: rf(14), fontFamily: Fonts.medium },
  pendingBadge: {
    marginLeft: 'auto',
    fontSize: rf(12), fontFamily: Fonts.medium,
  },
  cacheButtons: { flexDirection: 'row', gap: 10 },
  cacheBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 12, borderWidth: 1,
  },
  cacheBtnText: { fontSize: rf(13), fontFamily: Fonts.medium },
  quotaRow: { marginBottom: 12 },
  quotaInfo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  quotaLabel: { fontSize: rf(13), fontFamily: Fonts.medium },
  quotaCount: { fontSize: rf(13), fontFamily: Fonts.bold },
  quotaBarBg: { height: 6, borderRadius: 3 },
  quotaBarFill: { height: 6, borderRadius: 3 },
  navRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12,
  },
  navRowText: { fontSize: rf(14), fontFamily: Fonts.medium },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  userAvatar: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  userAvatarText: { fontSize: rf(20), fontFamily: Fonts.bold },
  userInfo: { flex: 1 },
  userName: { fontSize: rf(16), fontFamily: Fonts.bold },
  userEmail: { fontSize: rf(13), fontFamily: Fonts.regular },
  userRole: { fontSize: rf(12), fontFamily: Fonts.medium, marginTop: 2 },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 12, justifyContent: 'center',
    borderWidth: 1, borderRadius: 12,
  },
  logoutText: { fontSize: rf(14), fontFamily: Fonts.bold },
  version: { textAlign: 'center', fontSize: rf(12), fontFamily: Fonts.regular, paddingTop: 8 },
});
