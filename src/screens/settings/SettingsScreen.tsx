import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Switch, TouchableOpacity, Alert,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Globe, Bell, Wifi, WifiOff, Database,
  RefreshCw, LayoutDashboard, LogOut, ChevronRight, Settings, ArrowLeft,
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useOffline } from '../../context/OfflineContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requestFCMPermission, unregisterFcm } from '../../services/pushNotificationService';
import { OfflineCache } from '../../services/OfflineCache';
import { ICON_STROKE } from '../../components/common/Icon';
import { IconBtn } from '../../components/crud';
import { Card } from '../../components/ui';

import { useAppTheme } from '../../theme/useAppTheme';
import { withAlpha } from '../../theme';
import { rf, isTabletDevice } from '../../utils/responsive';
import { Language } from '../../i18n';

/** Device-local push preference. Not a server row — see the note on `push` below. */
const PUSH_PREF_KEY = 'settings_push_enabled';

export const SettingsScreen = ({ navigation }: any) => {
  const { user, logout } = useAuth();
  const { language, setLang, t } = useLanguage();
  const { isOnline, pendingCount, isSyncing, syncManually } = useOffline();
  const T = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const twoWide = isTabletDevice && width > height;

  /**
   * Push preference.
   *
   * There is no WhatsApp toggle any more: the backend has no WhatsApp integration
   * at all, and the switch wrote to `PUT /settings/me`, which no controller serves —
   * so it 404'd into a catch, never persisted, and reset on reopen. A switch wired
   * to nothing is worse than no switch.
   *
   * Push is real and is now enforced device-side rather than by a preference row:
   * ON registers this device's FCM token, OFF deletes it, so the server genuinely
   * cannot reach this device. The choice is remembered locally.
   */
  const [push, setPush] = useState(true);

  const loadSettings = useCallback(async () => {
    try {
      const saved = await AsyncStorage.getItem(PUSH_PREF_KEY);
      if (saved != null) setPush(saved === '1');
    } catch {}
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const togglePush = async (val: boolean) => {
    setPush(val);
    try {
      await AsyncStorage.setItem(PUSH_PREF_KEY, val ? '1' : '0');
      if (val) await requestFCMPermission();
      else await unregisterFcm();
    } catch {
      // Revert the switch if we couldn't actually apply it — never show a state we
      // didn't achieve (the old toggle's failure mode).
      setPush(!val);
    }
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

  return (
    <View style={[styles.root, { backgroundColor: T.bg }]}>
      {/* Plain themed title block on T.bg — the drawer/topbar supplies the nav header,
          so this must NOT re-apply insets.top (it would double-pad). */}
      <View style={styles.header}>
        <IconBtn kind="view" label="Back" onPress={() => navigation.goBack()}>
          <ArrowLeft size={16} color={T.accent} strokeWidth={ICON_STROKE} />
        </IconBtn>
        <View style={styles.headerTextWrap}>
          <Text style={[styles.headerTitle, { color: T.text }]} numberOfLines={1}>
            {t('settings.title') || 'Settings'}
          </Text>
          <Text style={[styles.headerSub, { color: T.sub }]} numberOfLines={1}>
            App preferences
          </Text>
        </View>
      </View>

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

          {/* Help. "Customize Dashboard" used to sit above this and was removed:
              it reads/writes GET+PUT /dashboard/config, which DashboardController
              does not serve, so arranging widgets and tapping save persisted
              nothing. The screen itself is left in place for when the endpoint
              exists — only the dead entry point is gone. */}
          <Card style={styles.section}>
            <SectionTitle icon={<LayoutDashboard size={16} color={T.accent} />} title={t('settings.dashboard')} />
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
              style={[styles.logoutBtn, { borderColor: withAlpha(T.danger, 0.20), backgroundColor: withAlpha(T.danger, 0.08) }]}
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
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10,
  },
  headerTextWrap: { flex: 1, minWidth: 0 },
  headerTitle: { fontWeight: '700', fontSize: rf(20), letterSpacing: -0.3 },
  headerSub: { fontWeight: '500', fontSize: rf(12.5), marginTop: 2 },

  scroll: { flex: 1 },
  centeredWide: { width: '100%', maxWidth: 720, alignSelf: 'center', gap: 12 },

  offlineBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, padding: 12,
  },
  offlineBannerText: { color: '#FFF', fontSize: rf(13), fontWeight: '600', flex: 1 },
  section: { gap: 0 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  sectionTitle: { fontSize: rf(14), fontWeight: '700' },
  langRow: { flexDirection: 'row', gap: 10 },
  langChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 100, borderWidth: 1,
  },
  langChipText: { fontSize: rf(13), fontWeight: '600' },
  toggleRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  toggleRowLast: { borderBottomWidth: 0 },
  toggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  toggleLabel: { fontSize: rf(14), fontWeight: '600' },
  offlineRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  offlineStatus: { fontSize: rf(14), fontWeight: '600' },
  pendingBadge: {
    marginLeft: 'auto',
    fontSize: rf(12), fontWeight: '600',
  },
  cacheButtons: { flexDirection: 'row', gap: 10 },
  cacheBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 12, borderWidth: 1,
  },
  cacheBtnText: { fontSize: rf(13), fontWeight: '600' },
  quotaRow: { marginBottom: 12 },
  quotaInfo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  quotaLabel: { fontSize: rf(13), fontWeight: '600' },
  quotaCount: { fontSize: rf(13), fontWeight: '700' },
  quotaBarBg: { height: 6, borderRadius: 3 },
  quotaBarFill: { height: 6, borderRadius: 3 },
  navRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12,
  },
  navRowText: { fontSize: rf(14), fontWeight: '600' },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  userAvatar: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  userAvatarText: { fontSize: rf(20), fontWeight: '700' },
  userInfo: { flex: 1 },
  userName: { fontSize: rf(16), fontWeight: '700' },
  userEmail: { fontSize: rf(13), fontWeight: '400' },
  userRole: { fontSize: rf(12), fontWeight: '600', marginTop: 2 },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 12, justifyContent: 'center',
    borderWidth: 1, borderRadius: 12,
  },
  logoutText: { fontSize: rf(14), fontWeight: '700' },
  version: { textAlign: 'center', fontSize: rf(12), fontWeight: '400', paddingTop: 8 },
});
