import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DrawerContentComponentProps } from '@react-navigation/drawer';
import { ChevronsLeft, ChevronsRight, ChevronDown, CalendarOff, LogOut } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useAppTheme } from '../../theme/useAppTheme';
import { Wordmark } from '../../theme';
import { Icon, IconName, ICON_STROKE } from '../common/Icon';
import { GradientBackground } from '../common/GradientBackground';
import { SingularityLogo } from '../common/SingularityLogo';
import { LogoutModal } from '../common/LogoutModal';
import { NAV_BY_ROLE, NavGroup } from '../../navigation/navConfig';
import { isTabletDevice } from '../../utils/responsive';

/** Spec: expanded 240 · collapsed rail 76 · phone slide-over 280. */
export const SIDEBAR_W = 240;
export const SIDEBAR_RAIL_W = 76;
export const SIDEBAR_PHONE_W = 280;

interface Props extends Partial<DrawerContentComponentProps> {
  /** Rail mode (tablet only). Phone never rails — it's a slide-over. */
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const AppSidebar = ({ collapsed = false, onToggleCollapse, ...props }: Props) => {
  const T = useAppTheme();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const [showLogout, setShowLogout] = useState(false);

  const groups: NavGroup[] = NAV_BY_ROLE[user?.role ?? 'FO'] ?? [];

  // Which route is active, straight from the navigator state.
  const activeRoute = useMemo(() => {
    const state = props.state;
    if (!state) return undefined;
    return state.routeNames?.[state.index];
  }, [props.state]);

  // Groups start EXPANDED (everything reachable at a glance) and each can be collapsed
  // independently — we track only what the user has closed, so the default is "all open".
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const toggleGroup = (label: string) => setClosed(c => ({ ...c, [label]: !c[label] }));

  // Rail hides labels, so the accordion is meaningless there — show every icon.
  const rail = collapsed && isTabletDevice;

  const go = (route: string) => {
    props.navigation?.navigate(route as never);
    if (!isTabletDevice) props.navigation?.closeDrawer?.();
  };

  const handleLogout = () => {
    setShowLogout(false);
    setTimeout(() => logout(), 350);
  };

  const navIdle = T.isDark ? 'rgba(244,238,226,0.62)' : 'rgba(33,27,18,0.60)';

  const renderItem = (route: string, label: string, icon: IconName | 'Leaves') => {
    const active = route === activeRoute;
    const color = active ? '#FFF' : navIdle;
    const glyph =
      icon === 'Leaves' ? (
        <CalendarOff size={19} color={color} strokeWidth={ICON_STROKE} />
      ) : (
        <Icon name={icon} size={19} color={color} />
      );

    return (
      <TouchableOpacity
        key={route}
        accessibilityLabel={label}
        onPress={() => go(route)}
        activeOpacity={0.8}
        style={[styles.navItem, rail && styles.navItemRail, active && styles.navItemActive]}
      >
        {active && <GradientBackground glow={false} style={StyleSheet.absoluteFillObject} />}
        {glyph}
        {!rail && (
          <Text numberOfLines={1} style={[styles.navLabel, { color, fontWeight: active ? '700' : '500' }]}>
            {label}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View
      style={[
        styles.root,
        {
          // T.card, not the invented #171310/#FCFAF6 that used to sit here: those
          // matched no spec and drifted from the palette. The sidebar reads as a
          // raised surface against the content area's T.bg, which is exactly what
          // the `card` token is for, and it now follows any palette change.
          backgroundColor: T.card,
          borderRightColor: T.line,
          paddingTop: Math.max(insets.top, 12), // LAYOUT_SPEC A1
          paddingBottom: Math.max(insets.bottom, 14),
          paddingHorizontal: rail ? 0 : 14,
        },
      ]}
    >
      {/* ── Brand header ── */}
      <View style={[styles.brand, rail && styles.brandRail]}>
        {/* The real brand mark (SingularityOnly.svg) — no tinted tile behind it. */}
        <SingularityLogo size={38} />
        {!rail && (
          <Text style={[styles.wordmark, { color: T.text }]}>
            Singularity<Text style={{ color: T.accent }}>CRM</Text>
          </Text>
        )}
      </View>
      <View style={[styles.divider, { backgroundColor: T.line }]} />

      {/* ── Collapse chip (tablet only) — sits on the divider line ── */}
      {isTabletDevice && (
        <TouchableOpacity
          onPress={onToggleCollapse}
          accessibilityLabel={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={[
            styles.chip,
            { backgroundColor: T.cardAlt, borderColor: T.line },
            rail ? styles.chipRail : styles.chipExpanded,
          ]}
        >
          {collapsed ? (
            <ChevronsRight size={16} color={T.sub} strokeWidth={2.2} />
          ) : (
            <ChevronsLeft size={16} color={T.sub} strokeWidth={2.2} />
          )}
        </TouchableOpacity>
      )}

      {/* ── Scrollable nav ── */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
        {groups.map(group => {
          const open = rail || !closed[group.label];
          return (
            <View key={group.label}>
              {rail ? (
                <Text style={[styles.groupLabelRail, { color: T.dim }]}>{group.label.slice(0, 3)}</Text>
              ) : (
                <TouchableOpacity
                  onPress={() => toggleGroup(group.label)}
                  activeOpacity={0.7}
                  style={styles.groupRow}
                >
                  <Text style={[styles.groupLabel, { color: T.dim }]}>{group.label}</Text>
                  <ChevronDown
                    size={13}
                    color={T.dim}
                    strokeWidth={2.2}
                    style={{ transform: [{ rotate: open ? '0deg' : '-90deg' }] }}
                  />
                </TouchableOpacity>
              )}
              {open && group.items.map(i => renderItem(i.route, i.label, i.icon))}
            </View>
          );
        })}
      </ScrollView>

      {/* ── Sign out ── */}
      <View style={[styles.divider, { backgroundColor: T.line, marginBottom: 0 }]} />
      <TouchableOpacity
        onPress={() => setShowLogout(true)}
        activeOpacity={0.7}
        style={[styles.signOut, rail && styles.signOutRail]}
      >
        <LogOut size={19} color={T.danger} strokeWidth={ICON_STROKE} />
        {!rail && <Text style={[styles.signOutTxt, { color: T.danger }]}>Sign out</Text>}
      </TouchableOpacity>

      <LogoutModal
        visible={showLogout}
        onCancel={() => setShowLogout(false)}
        onConfirm={handleLogout}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, borderRightWidth: 1 },

  // Brand — logo tile 38 · radius 11 · gradient · wordmark Space Grotesk 700/15/-0.3
  brand: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 6, paddingTop: 4, paddingBottom: 12 },
  brandRail: { justifyContent: 'center', paddingHorizontal: 0 },
  wordmark: { fontFamily: Wordmark.bold, fontSize: 15, letterSpacing: -0.3 },
  divider: { height: 1, marginBottom: 4 },

  // Collapse chip 26 · radius 8 · sits on the divider (margin-top -13)
  chip: {
    width: 26, height: 26, borderRadius: 8, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
    marginTop: -13, zIndex: 2,
  },
  chipExpanded: { alignSelf: 'flex-end' },
  chipRail: { alignSelf: 'center' },

  // Group label 10/700 · +1.4 · uppercase · dim
  groupRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 12, paddingHorizontal: 12, paddingBottom: 4,
  },
  groupLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase' },
  groupLabelRail: {
    fontSize: 8, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase',
    textAlign: 'center', paddingTop: 12, paddingBottom: 4,
  },

  // Nav item 42 · radius 12 · gap 12 · pad 0 12 · margin 0 6 · 3px between rows
  navItem: {
    height: 42, borderRadius: 12, flexDirection: 'row', alignItems: 'center',
    gap: 12, paddingHorizontal: 12, marginHorizontal: 6, marginBottom: 3,
    overflow: 'hidden',
  },
  navItemRail: { justifyContent: 'center', paddingHorizontal: 0, marginHorizontal: 8, gap: 0 },
  navItemActive: {
    shadowColor: '#8C5A2E', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 16, elevation: 5,
  },
  navLabel: { fontSize: 13, flex: 1 },

  // Sign out — top border · pad 11 · icon 19 · danger · 600
  signOut: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 11, paddingHorizontal: 12 },
  signOutRail: { justifyContent: 'center', paddingHorizontal: 0 },
  signOutTxt: { fontSize: 13, fontWeight: '600' },
});
