import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Menu, Sun, Moon, Bell, ChevronDown, User, Settings as SettingsIcon, LogOut } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useAppTheme } from '../../theme/useAppTheme';
import { GradientBackground } from '../common/GradientBackground';
import { LogoutModal } from '../common/LogoutModal';
import { NAV_BY_ROLE, groupForRoute } from '../../navigation/navConfig';
import { isTabletDevice } from '../../utils/responsive';

const ROLE_NAME: Record<string, string> = {
  FO: 'Field Officer',
  ZH: 'Zonal Head',
  RH: 'Regional Head',
  SH: 'Sales Head',
  SCA: 'SuperSale Admin',
};

const initialsOf = (name?: string) =>
  (name ?? '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase() || 'U';

interface Props {
  /** Current screen title (the active route name). */
  title: string;
  /** Phone-only hamburger. */
  onMenu?: () => void;
  /** Unread notifications → red dot. */
  hasUnread?: boolean;
  onNotifications?: () => void;
  onProfile?: () => void;
  onSettings?: () => void;
}

export const AppTopbar = ({ title, onMenu, hasUnread, onNotifications, onProfile, onSettings }: Props) => {
  const T = useAppTheme();
  const insets = useSafeAreaInsets();
  const { mode, toggle } = useTheme();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [showLogout, setShowLogout] = useState(false);

  const groups = NAV_BY_ROLE[user?.role ?? 'FO'] ?? [];
  const group = groupForRoute(groups, title);
  const roleName = ROLE_NAME[user?.role ?? 'FO'] ?? 'Field Officer';
  const initials = initialsOf(user?.name);

  const handleLogout = () => {
    setShowLogout(false);
    setTimeout(() => logout(), 350);
  };

  const action = (onPress: () => void, label: string, child: React.ReactNode) => (
    <TouchableOpacity
      accessibilityLabel={label}
      onPress={onPress}
      activeOpacity={0.75}
      style={[styles.action, { backgroundColor: T.card, borderColor: T.line }]}
    >
      {child}
    </TouchableOpacity>
  );

  return (
    <View
      style={[
        styles.bar,
        {
          paddingTop: insets.top + 8, // LAYOUT_SPEC A6
          paddingBottom: 10,
          paddingHorizontal: isTabletDevice ? 22 : 16,
          backgroundColor: T.isDark ? 'rgba(19,16,9,0.92)' : 'rgba(255,255,255,0.92)',
          borderBottomColor: T.line,
        },
      ]}
    >
      {/* Phone-only hamburger (on tablet the collapse chip lives in the sidebar) */}
      {!isTabletDevice &&
        action(() => onMenu?.(), 'Open navigation', <Menu size={18} color={T.text} strokeWidth={2} />)}

      {/* Title + breadcrumb */}
      <View style={styles.titleBlock}>
        <Text numberOfLines={1} style={[styles.title, { color: T.text }]}>
          {title}
        </Text>
        {isTabletDevice && (
          <Text numberOfLines={1} style={[styles.crumb, { color: T.sub }]}>
            {roleName}
            {group ? ` · ${group}` : ''}
          </Text>
        )}
      </View>

      <View style={{ flex: 1 }} />

      {/* Actions */}
      <View style={styles.cluster}>
        {action(
          toggle,
          'Toggle theme',
          mode === 'dark'
            ? <Moon size={18} color={T.text} strokeWidth={1.5} />
            : <Sun size={18} color={T.text} strokeWidth={1.5} />,
        )}

        {action(
          () => onNotifications?.(),
          'Notifications',
          <View>
            <Bell size={18} color={T.text} strokeWidth={1.5} />
            {hasUnread && <View style={[styles.dot, { borderColor: T.card }]} />}
          </View>,
        )}

        {/* Profile pill — whole pill toggles the dropdown */}
        <TouchableOpacity
          accessibilityLabel="Account menu"
          onPress={() => setOpen(v => !v)}
          activeOpacity={0.75}
          style={[styles.pill, { backgroundColor: T.card, borderColor: T.line }]}
        >
          <View style={styles.avatar}>
            <GradientBackground glow={false} style={StyleSheet.absoluteFillObject} />
            <Text style={styles.avatarTxt}>{initials}</Text>
          </View>
          {isTabletDevice && (
            <Text numberOfLines={1} style={[styles.pillName, { color: T.text }]}>
              {user?.name}
            </Text>
          )}
          <ChevronDown size={15} color={T.sub} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      {/* ── Profile dropdown ── */}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.scrim} onPress={() => setOpen(false)}>
          <Pressable
            onPress={() => {}}
            style={[
              styles.menu,
              {
                top: insets.top + 58,
                backgroundColor: T.card,
                borderColor: T.line,
              },
            ]}
          >
            {/* Header */}
            <View style={[styles.menuHead, { borderBottomColor: T.line }]}>
              <View style={styles.avatarLg}>
                <GradientBackground glow={false} style={StyleSheet.absoluteFillObject} />
                <Text style={styles.avatarTxtLg}>{initials}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={[styles.menuName, { color: T.text }]}>{user?.name}</Text>
                <Text numberOfLines={1} style={[styles.menuMail, { color: T.sub }]}>{user?.email}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.menuItem}
              activeOpacity={0.7}
              onPress={() => { setOpen(false); onProfile?.(); }}
            >
              <User size={16} color={T.text} strokeWidth={1.9} />
              <Text style={[styles.menuTxt, { color: T.text }]}>My profile</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              activeOpacity={0.7}
              onPress={() => { setOpen(false); onSettings?.(); }}
            >
              <SettingsIcon size={16} color={T.text} strokeWidth={1.9} />
              <Text style={[styles.menuTxt, { color: T.text }]}>Settings</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              activeOpacity={0.7}
              onPress={() => { setOpen(false); setTimeout(() => setShowLogout(true), 220); }}
            >
              <LogOut size={16} color={T.danger} strokeWidth={1.9} />
              <Text style={[styles.menuTxt, { color: T.danger }]}>Sign out</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <LogoutModal
        visible={showLogout}
        onCancel={() => setShowLogout(false)}
        onConfirm={handleLogout}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    zIndex: 10,
  },
  titleBlock: { justifyContent: 'center', maxWidth: '46%' },
  title: { fontSize: 17, fontWeight: '800', letterSpacing: -0.4 },
  crumb: { fontSize: 11.5, fontWeight: '400', marginTop: 1 },

  cluster: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  action: {
    width: 40, height: 40, borderRadius: 12, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  dot: {
    position: 'absolute', top: -2, right: -2,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#E9573F', borderWidth: 2,
  },

  pill: {
    height: 42, borderRadius: 22, borderWidth: 1,
    flexDirection: 'row', alignItems: 'center', gap: 8, padding: 5, paddingRight: 10,
  },
  avatar: {
    width: 32, height: 32, borderRadius: 16, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarTxt: { fontSize: 12, fontWeight: '700', color: '#FFF' },
  pillName: { fontSize: 13, fontWeight: '600', maxWidth: 120 },

  // Dropdown — width 230 · radius 16 · shadow 0 16 40 rgba(0,0,0,.18) · pad 8
  scrim: { flex: 1 },
  menu: {
    position: 'absolute', right: 16, width: 230,
    borderRadius: 16, borderWidth: 1, padding: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18, shadowRadius: 40, elevation: 16,
  },
  menuHead: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 8, paddingTop: 4, paddingBottom: 12,
    borderBottomWidth: 1, marginBottom: 6,
  },
  avatarLg: {
    width: 40, height: 40, borderRadius: 20, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarTxtLg: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  menuName: { fontSize: 13.5, fontWeight: '700' },
  menuMail: { fontSize: 11, fontWeight: '400', marginTop: 1 },

  menuItem: {
    height: 38, flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 10, borderRadius: 10,
  },
  menuTxt: { fontSize: 13, fontWeight: '500' },
});
