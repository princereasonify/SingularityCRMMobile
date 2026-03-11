import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { LeadStage } from '../../types';
import { STAGE_COLORS, STAGE_LABELS } from '../../utils/constants';
import { rf } from '../../utils/responsive';

interface BadgeProps {
  label: string;
  color?: string;
  textColor?: string;
  style?: ViewStyle;
  size?: 'sm' | 'md';
}

export const Badge = ({
  label,
  color = '#E5E7EB',
  textColor,
  style,
  size = 'sm',
}: BadgeProps) => {
  const isLight = isLightColor(color);
  const txt = textColor || (isLight ? '#1F2937' : '#FFFFFF');
  return (
    <View style={[styles.badge, { backgroundColor: color + '22', borderColor: color + '44' }, size === 'md' && styles.md, style]}>
      <Text style={[styles.text, { color }, size === 'md' && styles.textMd]}>{label}</Text>
    </View>
  );
};

export const StageBadge = ({ stage, style }: { stage: LeadStage; style?: ViewStyle }) => (
  <Badge
    label={STAGE_LABELS[stage]}
    color={STAGE_COLORS[stage]}
    style={style}
  />
);

export const RoleBadge = ({ role, style }: { role: string; style?: ViewStyle }) => {
  const colors: Record<string, string> = {
    FO: '#0d9488',
    ZH: '#7c3aed',
    RH: '#ea580c',
    SH: '#2563eb',
  };
  return <Badge label={role} color={colors[role] || '#6B7280'} style={style} />;
};

function isLightColor(hex: string): boolean {
  const c = hex.replace('#', '');
  const r = parseInt(c.substr(0, 2), 16);
  const g = parseInt(c.substr(2, 2), 16);
  const b = parseInt(c.substr(4, 2), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 155;
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  md: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  text: {
    fontSize: rf(11),
    fontWeight: '600',
  },
  textMd: {
    fontSize: rf(12),
  },
});
