import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Card } from './Card';
import { ProgressBar } from './ProgressBar';
import { rf, wp } from '../../utils/responsive';

interface KPICardProps {
  title: string;
  value: string;
  subtitle?: string;
  progress?: number; // 0–100
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
  iconBg = '#F3F4F6',
  style,
  valueColor = '#111827',
}: KPICardProps) => (
  <Card style={style}>
    <View style={styles.header}>
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      {icon && (
        <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>{icon}</View>
      )}
    </View>
    <Text style={[styles.value, { color: valueColor }]} numberOfLines={1}>{value}</Text>
    {subtitle && <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>}
    {progress !== undefined && (
      <ProgressBar
        value={progress}
        height={5}
        showLabel
        color={progressColor}
        style={styles.progressBar}
      />
    )}
  </Card>
);

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: rf(12),
    color: '#6B7280',
    fontWeight: '500',
    flex: 1,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: rf(22),
    fontWeight: '700',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: rf(12),
    color: '#9CA3AF',
    marginBottom: 8,
  },
  progressBar: {
    marginTop: 8,
  },
});
