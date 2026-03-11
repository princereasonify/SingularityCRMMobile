import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { getProgressColor } from '../../utils/constants';
import { rf } from '../../utils/responsive';

interface ProgressBarProps {
  value: number; // 0–100
  height?: number;
  showLabel?: boolean;
  color?: string;
  style?: ViewStyle;
  trackColor?: string;
}

export const ProgressBar = ({
  value,
  height = 6,
  showLabel = false,
  color,
  style,
  trackColor = '#F3F4F6',
}: ProgressBarProps) => {
  const pct = Math.min(Math.max(value, 0), 100);
  const barColor = color || getProgressColor(pct);

  return (
    <View style={[styles.container, style]}>
      <View style={[styles.track, { height, backgroundColor: trackColor }]}>
        <View
          style={[
            styles.fill,
            { width: `${pct}%`, backgroundColor: barColor, height },
          ]}
        />
      </View>
      {showLabel && (
        <Text style={[styles.label, { color: barColor }]}>{Math.round(pct)}%</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  track: {
    flex: 1,
    borderRadius: 100,
    overflow: 'hidden',
  },
  fill: {
    borderRadius: 100,
  },
  label: {
    fontSize: rf(12),
    fontWeight: '600',
    minWidth: 36,
    textAlign: 'right',
  },
});
