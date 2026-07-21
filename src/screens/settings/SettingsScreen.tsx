import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Globe, Bell, Wifi, WifiOff, Database,
  RefreshCw, LifeBuoy, LogOut, ChevronRight, Settings, ArrowLeft,
  BookOpen, Wallet, ClipboardList, Trash2,
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useOffline } from '../../context/OfflineContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requestFCMPermission, unregisterFcm } from '../../services/pushNotificationService';
import { OfflineCache } from '../../services/OfflineCache';
import { ICON_STROKE } from '../../components/common/Icon';
import { IconBtn, Btn, Toggle, Segmented, ConfirmModal, StatusBadge } from '../../components/crud';
import { LogoutModal } from '../../components/common/LogoutModal';
import { Card } from '../../components/ui';

import { useAppTheme } from '../../theme/useAppTheme';
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

  // Destructive confirms are ConfirmModal (danger), not Alert.alert — the OS alert
  // has none of the design system on it and read as a different app.
  const [confirmClear, setConfirmClear] = useState(false);
  const [showLogout, setShowLogout] = useState(false);

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

  const handleClearCache = async () => {
    setConfirmClear(false);
    await OfflineCache.clearAll();
    Alert.alert(t('common.success'), 'Cache cleared successfully.');
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

  // Same 350ms defer the sidebar/topbar use: let the modal finish dismissing before
  // logout() tears down the authed tree, or the unmount races the dismiss animation.
  const handleLogout = () => {
    setShowLogout(false);
    setTimeout(() => logout(), 350);
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
        {/* gap lives here, not on the ScrollView's contentContainer: that container has
            exactly one child (this wrapper), so its gap:12 spaced nothing and in
            portrait — where no style was applied at all — the cards stacked flush. */}
        <View style={[styles.stack, twoWide && styles.centeredWide]}>

          {/* Offline status banner */}
          {!isOnline && (
            <View style={[styles.offlineBanner, { backgroundColor: T.danger }]}>
              <WifiOff size={16} color={T.onAccent} />
              <Text style={[styles.offlineBannerText, { color: T.onAccent }]}>{t('offline.banner')}</Text>
            </View>
          )}

          {/* Language — the kit's Segmented, not two hand-rolled pill TouchableOpacities.
              Two mutually-exclusive options is exactly what Segmented is for. */}
          <Card style={styles.section}>
            <SectionTitle icon={<Globe size={16} color={T.accent} />} title={t('settings.language')} />
            <Segmented<Language>
              value={language as Language}
              onChange={setLang}
              options={[
                { label: t('settings.english'), value: 'en' },
                { label: t('settings.hindi'), value: 'hi' },
              ]}
            />
          </Card>

          {/* Notifications */}
          <Card style={styles.section}>
            <SectionTitle icon={<Bell size={16} color={T.accent} />} title={t('settings.notifications')} />
            <ToggleRow
              icon={<Bell size={16} color={T.info} />}
              label={t('settings.pushNotifications')}
              value={push}
              onToggle={() => togglePush(!push)}
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
              {/* flexShrink:1 + minWidth:0 — without it the status text and the pending
                  count paint over each other once the count string gets long in Hindi. */}
              <Text style={[styles.offlineStatus, { color: T.text }]} numberOfLines={1}>
                {isOnline ? 'Online' : 'Offline'}
              </Text>
              {pendingCount > 0 && (
                <View style={styles.pendingWrap}>
                  <StatusBadge label={`${pendingCount} ${t('settings.pendingSync')}`} color={T.warning} />
                </View>
              )}
            </View>
            {/* Kit Btn, not two bespoke bordered rows. `soft` and `secondary` are the
                spec's two non-primary faces; the old ones invented their own. */}
            <View style={styles.cacheButtons}>
              <Btn
                label={isSyncing ? t('offline.syncing') : t('settings.syncNow')}
                variant="soft"
                small
                onPress={handleSync}
                disabled={isSyncing || !isOnline}
                icon={<RefreshCw size={14} color={T.accent} strokeWidth={ICON_STROKE} />}
                style={styles.cacheBtn}
              />
              <Btn
                label={t('settings.clearCache')}
                variant="secondary"
                small
                onPress={() => setConfirmClear(true)}
                icon={<Database size={14} color={T.text} strokeWidth={ICON_STROKE} />}
                style={styles.cacheBtn}
              />
            </View>
          </Card>

          {/* Help. "Customize Dashboard" used to sit above this and was removed:
              it reads/writes GET+PUT /dashboard/config, which DashboardController
              does not serve, so arranging widgets and tapping save persisted
              nothing. The screen itself is left in place for when the endpoint
              exists — only the dead entry point is gone.

              Retitled "Help" from t('settings.dashboard') to match: the only row left
              in this card is the User Manual, so a "Dashboard" heading described the
              entry that went away rather than the one that stayed. The emoji glyphs on
              this and the Admin card are now lucide icons — they were the only
              pictograms in the app not drawn from the icon set, and they rendered at a
              different size, weight and colour on each platform. */}
          <Card style={styles.section}>
            <SectionTitle icon={<LifeBuoy size={16} color={T.accent} />} title="Help" />
            <NavRow
              icon={<BookOpen size={16} color={T.accent} strokeWidth={ICON_STROKE} />}
              label="User Manual"
              onPress={() => navigation.navigate('UserManual')}
              last
            />
          </Card>

          {/* SH Admin Config */}
          {(user?.role === 'SH' || user?.role === 'SCA') && (
            <Card style={styles.section}>
              <SectionTitle icon={<Settings size={16} color={T.accent} />} title="Admin Configuration" />
              <NavRow
                icon={<Wallet size={16} color={T.accent} strokeWidth={ICON_STROKE} />}
                label="Allowance Config"
                onPress={() => navigation.navigate('AllowanceConfig')}
              />
              <NavRow
                icon={<ClipboardList size={16} color={T.accent} strokeWidth={ICON_STROKE} />}
                label="Visit Field Config"
                onPress={() => navigation.navigate('VisitFieldConfig')}
                last
              />
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
                  <Text style={[styles.userName, { color: T.text }]} numberOfLines={1}>{user.name}</Text>
                  <Text style={[styles.userEmail, { color: T.sub }]} numberOfLines={1}>{user.email}</Text>
                  <Text style={[styles.userRole, { color: T.accent }]} numberOfLines={1}>{user.role}</Text>
                </View>
              </View>
            )}
            {/* Kit Btn (dangerGhost) — the bespoke bordered row it replaces mixed its own
                alpha values and its own radius. */}
            <Btn
              label={t('settings.logout')}
              variant="dangerGhost"
              onPress={() => setShowLogout(true)}
              icon={<LogOut size={16} color={T.danger} strokeWidth={ICON_STROKE} />}
            />
          </Card>

          <Text style={[styles.version, { color: T.dim }]}>{t('settings.version')} 1.0.0</Text>
        </View>
      </ScrollView>

      <ConfirmModal
        visible={confirmClear}
        tone="danger"
        title={t('settings.clearCache')}
        message="Locally cached schools, contacts and calendar will be deleted from this device and reloaded from the server next time you open them."
        icon={<Trash2 size={24} color={T.danger} strokeWidth={ICON_STROKE} />}
        confirmLabel="Clear cache"
        onConfirm={handleClearCache}
        onCancel={() => setConfirmClear(false)}
      />

      <LogoutModal
        visible={showLogout}
        onCancel={() => setShowLogout(false)}
        onConfirm={handleLogout}
      />
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

/** Kit Toggle, not RN's <Switch> — <Switch> renders the raw platform control and
 *  ignored the theme everywhere except its track tint. */
const ToggleRow = ({ icon, label, value, onToggle, last }: {
  icon: React.ReactNode; label: string; value: boolean; onToggle: () => void; last?: boolean;
}) => {
  const T = useAppTheme();
  return (
    <View style={[styles.toggleRow, { borderBottomColor: T.line }, last && styles.toggleRowLast]}>
      <View style={styles.toggleLeft}>
        {icon}
        <Text style={[styles.toggleLabel, { color: T.text }]} numberOfLines={2}>{label}</Text>
      </View>
      <Toggle on={value} onToggle={onToggle} />
    </View>
  );
};

/** Icon + label + chevron navigation row, shared by the Help and Admin cards. */
const NavRow = ({ icon, label, onPress, last }: {
  icon: React.ReactNode; label: string; onPress: () => void; last?: boolean;
}) => {
  const T = useAppTheme();
  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      style={[styles.navRow, { borderBottomColor: T.line }, last && styles.navRowLast]}
    >
      <View style={[styles.navRowIcon, { backgroundColor: T.accentSoft }]}>{icon}</View>
      <Text style={[styles.navRowText, { color: T.text }]} numberOfLines={1}>{label}</Text>
      <ChevronRight size={16} color={T.dim} strokeWidth={ICON_STROKE} />
    </TouchableOpacity>
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
  stack: { gap: 12 },
  centeredWide: { width: '100%', maxWidth: 720, alignSelf: 'center' },

  offlineBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, padding: 12,
  },
  offlineBannerText: { fontSize: rf(13), fontWeight: '600', flex: 1, flexShrink: 1, minWidth: 0 },
  section: { gap: 0 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  sectionTitle: { fontSize: rf(14), fontWeight: '700', flexShrink: 1, minWidth: 0 },
  toggleRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  toggleRowLast: { borderBottomWidth: 0 },
  toggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  toggleLabel: { fontSize: rf(14), fontWeight: '600', flexShrink: 1, minWidth: 0 },
  offlineRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  statusDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  offlineStatus: { fontSize: rf(14), fontWeight: '600', flexShrink: 1, minWidth: 0 },
  pendingWrap: { marginLeft: 'auto', flexShrink: 0 },
  cacheButtons: { flexDirection: 'row', gap: 10 },
  cacheBtn: { flex: 1 },

  navRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  navRowLast: { borderBottomWidth: 0 },
  navRowIcon: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  // flex:1 so the chevron stays pinned right and the label ellipsises instead of
  // pushing it off the card.
  navRowText: { fontSize: rf(14), fontWeight: '600', flex: 1, flexShrink: 1, minWidth: 0 },

  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  userAvatar: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  userAvatarText: { fontSize: rf(20), fontWeight: '700' },
  userInfo: { flex: 1, minWidth: 0 },
  userName: { fontSize: rf(16), fontWeight: '700' },
  userEmail: { fontSize: rf(13), fontWeight: '400' },
  userRole: { fontSize: rf(12), fontWeight: '600', marginTop: 2 },
  version: { textAlign: 'center', fontSize: rf(12), fontWeight: '400', paddingTop: 8 },
});
