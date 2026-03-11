import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { rf } from '../../utils/responsive';

interface AvatarProps {
  initials: string;
  color?: string;
  size?: number;
}

export const Avatar = ({ initials, color = '#0d9488', size = 40 }: AvatarProps) => {
  const fontSize = size * 0.38;
  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color + '22',
          borderColor: color + '44',
        },
      ]}
    >
      <Text style={[styles.text, { color, fontSize }]}>{initials}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  text: {
    fontWeight: '700',
  },
});
