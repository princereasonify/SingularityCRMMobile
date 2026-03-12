import React from 'react';
import { View, Text, ViewStyle } from 'react-native';
import { LeadStage } from '../../types';
import { CS, Colors } from '../../theme';
import { STAGE_LABELS } from '../../utils/constants';
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
  color = Colors.border,
  textColor,
  style,
  size = 'sm',
}: BadgeProps) => {
  const txt = textColor || color;
  return (
    <View
      style={[
        CS.badge,
        { backgroundColor: color + '22', borderColor: color + '44' },
        size === 'md' && CS.badgeMd,
        style,
      ]}
    >
      <Text style={{ color: txt, fontSize: rf(size === 'md' ? 12 : 11), fontWeight: '600' }}>
        {label}
      </Text>
    </View>
  );
};

export const StageBadge = ({ stage, style }: { stage: LeadStage; style?: ViewStyle }) => (
  <Badge
    label={STAGE_LABELS[stage]}
    color={Colors.stages[stage]}
    style={style}
  />
);

export const RoleBadge = ({ role, style }: { role: string; style?: ViewStyle }) => (
  <Badge
    label={role}
    color={(Colors.roles as Record<string, { primary: string }>)[role]?.primary ?? Colors.textMuted}
    style={style}
  />
);
