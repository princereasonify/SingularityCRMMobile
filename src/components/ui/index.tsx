/**
 * Redesign UI kit — themed building blocks for the SingularityCRM redesign
 * (SingularityCRM-DesignSpec.html). Every redesigned screen composes these so the
 * whole app shares one look and flips light/dark together. Additive: it does NOT
 * touch the legacy components/common primitives, so un-migrated screens keep working.
 */
import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, ViewStyle, TextStyle, StyleProp,
  TouchableOpacity, StatusBar, Platform, ScrollViewProps, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Menu } from 'lucide-react-native';
import { useAppTheme } from '../../theme/useAppTheme';
import { Fonts } from '../../theme';
import { rf } from '../../utils/responsive';

// ─── Screen ────────────────────────────────────────────────────────────────────
// Themed page background + top safe-area. Wrap every redesigned screen in this.
export const Screen = ({
  children, scroll, contentStyle, refreshing, onRefresh, edges = true,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  refreshing?: boolean;
  onRefresh?: () => void;
  edges?: boolean;
} & ScrollViewProps) => {
  const T = useAppTheme();
  const insets = useSafeAreaInsets();
  const body = scroll ? (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[{ padding: 16, paddingBottom: insets.bottom + 28 }, contentStyle]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={T.accent} /> : undefined}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1 }, contentStyle]}>{children}</View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: T.bg, paddingTop: edges ? insets.top : 0 }}>
      <StatusBar barStyle={T.isDark ? 'light-content' : 'dark-content'} />
      {body}
    </View>
  );
};

// ─── AppHeader ───────────────────────────────────────────────────────────────────
// Clean, flat header on the page background (not a heavy colored bar).
export const AppHeader = ({
  title, subtitle, onBack, onMenu, right,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  onMenu?: () => void;
  right?: React.ReactNode;
}) => {
  const T = useAppTheme();
  return (
    <View style={[styles.header, { borderBottomColor: T.line }]}>
      {(onBack || onMenu) && (
        <TouchableOpacity
          onPress={onBack || onMenu}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={[styles.headerBtn, { backgroundColor: T.card, borderColor: T.line }]}
        >
          {onBack ? <ArrowLeft size={20} color={T.text} /> : <Menu size={20} color={T.text} />}
        </TouchableOpacity>
      )}
      <View style={{ flex: 1 }}>
        <Text style={[styles.headerTitle, { color: T.text }]} numberOfLines={1}>{title}</Text>
        {!!subtitle && <Text style={[styles.headerSub, { color: T.sub }]} numberOfLines={1}>{subtitle}</Text>}
      </View>
      {right}
    </View>
  );
};

// ─── Card ────────────────────────────────────────────────────────────────────────
export const Card = ({
  children, style, onPress, padded = true,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  padded?: boolean;
}) => {
  const T = useAppTheme();
  const cardStyle = [
    styles.card,
    { backgroundColor: T.card, borderColor: T.line, padding: padded ? 16 : 0 },
    style,
  ];
  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={cardStyle}>
        {children}
      </TouchableOpacity>
    );
  }
  return <View style={cardStyle}>{children}</View>;
};

// ─── SectionLabel ──────────────────────────────────────────────────────────────────
export const SectionLabel = ({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) => {
  const T = useAppTheme();
  return <Text style={[styles.sectionLabel, { color: T.sub }, style]}>{children}</Text>;
};

// ─── StatTile ──────────────────────────────────────────────────────────────────────
// KPI/stat block used across dashboards and detail screens.
export const StatTile = ({
  label, value, sub, icon, tint, style,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon?: React.ReactNode;
  tint?: string;
  style?: StyleProp<ViewStyle>;
}) => {
  const T = useAppTheme();
  return (
    <Card style={[{ padding: 14 }, style]}>
      <View style={styles.statTop}>
        <Text style={[styles.statLabel, { color: T.sub }]} numberOfLines={1}>{label}</Text>
        {icon && (
          <View style={[styles.statIcon, { backgroundColor: (tint || T.accent) + '22' }]}>{icon}</View>
        )}
      </View>
      <Text style={[styles.statValue, { color: T.text }]} numberOfLines={1}>{value}</Text>
      {!!sub && <Text style={[styles.statSub, { color: T.sub }]} numberOfLines={1}>{sub}</Text>}
    </Card>
  );
};

// ─── Chip ──────────────────────────────────────────────────────────────────────────
export const Chip = ({
  label, color, active, onPress,
}: {
  label: string;
  color?: string;
  active?: boolean;
  onPress?: () => void;
}) => {
  const T = useAppTheme();
  const c = color || T.accent;
  const body = (
    <View
      style={[
        styles.chip,
        active
          ? { backgroundColor: c, borderColor: c }
          : { backgroundColor: T.card, borderColor: T.line },
      ]}
    >
      <Text style={[styles.chipTxt, { color: active ? '#fff' : T.sub }]}>{label}</Text>
    </View>
  );
  return onPress ? <TouchableOpacity activeOpacity={0.8} onPress={onPress}>{body}</TouchableOpacity> : body;
};

// ─── Badge ───────────────────────────────────────────────────────────────────────
export const Badge = ({ label, color }: { label: string; color?: string }) => {
  const T = useAppTheme();
  const c = color || T.accent;
  return (
    <View style={[styles.badge, { backgroundColor: c + '22' }]}>
      <Text style={[styles.badgeTxt, { color: c }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: {
    width: 40, height: 40, borderRadius: 12, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontFamily: Fonts.bold, fontSize: rf(20), letterSpacing: -0.4 },
  headerSub: { fontFamily: Fonts.regular, fontSize: rf(12.5), marginTop: 1 },

  card: {
    borderRadius: 18,
    borderWidth: 1,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10 },
      android: { elevation: 1 },
    }),
  },
  sectionLabel: {
    fontFamily: Fonts.bold, fontSize: rf(12), letterSpacing: 1, textTransform: 'uppercase',
    marginBottom: 10, marginTop: 4,
  },
  statTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statLabel: { fontFamily: Fonts.medium, fontSize: rf(12), flex: 1 },
  statIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontFamily: Fonts.bold, fontSize: rf(24), letterSpacing: -0.6, marginTop: 8 },
  statSub: { fontFamily: Fonts.regular, fontSize: rf(11.5), marginTop: 3 },

  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  chipTxt: { fontFamily: Fonts.medium, fontSize: rf(12.5) },

  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start' },
  badgeTxt: { fontFamily: Fonts.bold, fontSize: rf(11), letterSpacing: 0.2 },
});
