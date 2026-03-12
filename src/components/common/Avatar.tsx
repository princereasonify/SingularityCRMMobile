import React from 'react';
import { View, Text } from 'react-native';
import { CS, Colors } from '../../theme';

interface AvatarProps {
  initials: string;
  color?: string;
  size?: number;
}

export const Avatar = ({ initials, color = Colors.roles.FO.primary, size = 40 }: AvatarProps) => (
  <View
    style={[
      CS.avatarBase,
      {
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color + '22',
        borderColor: color + '44',
      },
    ]}
  >
    <Text style={{ color, fontSize: size * 0.38, fontWeight: '700' }}>{initials}</Text>
  </View>
);
