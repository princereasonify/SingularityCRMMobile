import React from 'react';
import { View, Text, ViewStyle } from 'react-native';
import { Card } from './Card';
import { ProgressBar } from './ProgressBar';
import { CS, Colors } from '../../theme';
import { rf } from '../../utils/responsive';

interface KPICardProps {
  title: string;
  value: string;
  subtitle?: string;
  progress?: number;
  progressColor?: string;
  icon?: React.ReactNode;
  iconBg?: string;
  style?: ViewStyle;
  valueColor?: string;
}

export const KPICard = ({
  title,
  value,
  subtitle,
  progress,
  progressColor,
  icon,
  iconBg = Colors.surfaceAlt,
  style,
  valueColor = Colors.textPrimary,
}: KPICardProps) => (
  <Card style={style}>
    <View style={CS.kpiHeader}>
      <Text style={[CS.kpiTitle, { fontSize: rf(12) }]} numberOfLines={1}>{title}</Text>
      {icon && (
        <View style={[CS.kpiIconWrap, { backgroundColor: iconBg }]}>{icon}</View>
      )}
    </View>
    <Text style={[CS.kpiValue, { color: valueColor, fontSize: rf(22) }]} numberOfLines={1}>
      {value}
    </Text>
    {subtitle && (
      <Text style={[CS.kpiSubtitle, { fontSize: rf(12) }]} numberOfLines={1}>{subtitle}</Text>
    )}
    {progress !== undefined && (
      <ProgressBar
        value={progress}
        height={5}
        showLabel
        color={progressColor}
        style={CS.kpiProgressBar}
      />
    )}
  </Card>
);
