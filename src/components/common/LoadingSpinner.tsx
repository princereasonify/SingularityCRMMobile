import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { rf } from '../../utils/responsive';

interface LoadingSpinnerProps {
  color?: string;
  message?: string;
  fullScreen?: boolean;
}

export const LoadingSpinner = ({
  color = '#0d9488',
  message,
  fullScreen = false,
}: LoadingSpinnerProps) => (
  <View style={[styles.container, fullScreen && styles.fullScreen]}>
    <ActivityIndicator size="large" color={color} />
    {message && <Text style={[styles.message, { color }]}>{message}</Text>}
  </View>
);

export const EmptyState = ({
  title,
  subtitle,
  icon,
}: {
  title: string;
  subtitle?: string;
  icon?: string;
}) => (
  <View style={styles.empty}>
    {icon && <Text style={styles.icon}>{icon}</Text>}
    <Text style={styles.emptyTitle}>{title}</Text>
    {subtitle && <Text style={styles.emptySubtitle}>{subtitle}</Text>}
  </View>
);

const styles = StyleSheet.create({
  container: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullScreen: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  message: {
    marginTop: 12,
    fontSize: rf(14),
    fontWeight: '500',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  icon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: rf(16),
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: rf(13),
    color: '#9CA3AF',
    marginTop: 6,
    textAlign: 'center',
  },
});
