import React from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { CS, Colors } from '../../theme';
import { rf } from '../../utils/responsive';

interface LoadingSpinnerProps {
  color?: string;
  message?: string;
  fullScreen?: boolean;
}

export const LoadingSpinner = ({
  color = Colors.roles.FO.primary,
  message,
  fullScreen = false,
}: LoadingSpinnerProps) => (
  <View style={[CS.loadingContainer, fullScreen && CS.loadingFullScreen]}>
    <ActivityIndicator size="large" color={color} />
    {message && (
      <Text style={[CS.loadingMessage, { color, fontSize: rf(14) }]}>{message}</Text>
    )}
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
  <View style={CS.emptyState}>
    {icon && <Text style={[CS.emptyStateIcon]}>{icon}</Text>}
    <Text style={[CS.emptyStateTitle, { fontSize: rf(16) }]}>{title}</Text>
    {subtitle && (
      <Text style={[CS.emptyStateSubtitle, { fontSize: rf(13) }]}>{subtitle}</Text>
    )}
  </View>
);
