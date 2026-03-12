import React from 'react';
import { View, Pressable, ViewStyle } from 'react-native';
import { CS } from '../../theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  padding?: number;
}

export const Card = ({ children, style, onPress, padding = 16 }: CardProps) => {
  if (onPress) {
    return (
      <Pressable
        style={({ pressed }) => [CS.card, { padding }, pressed && CS.cardPressed, style]}
        onPress={onPress}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[CS.card, { padding }, style]}>{children}</View>;
};
