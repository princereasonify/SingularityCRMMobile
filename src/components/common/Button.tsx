import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { CS, Colors } from '../../theme';
import { rf } from '../../utils/responsive';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  color?: string;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  size?: 'sm' | 'md' | 'lg';
}

export const Button = ({
  title,
  onPress,
  variant = 'primary',
  color = Colors.roles.FO.primary,
  loading = false,
  disabled = false,
  style,
  textStyle,
  size = 'md',
}: ButtonProps) => {
  const getStyle = () => {
    switch (variant) {
      case 'secondary': return { bg: 'transparent',    border: color,           text: color };
      case 'danger':    return { bg: Colors.danger,    border: Colors.danger,   text: Colors.textInverse };
      case 'ghost':     return { bg: 'transparent',    border: 'transparent',   text: color };
      default:          return { bg: color,            border: color,           text: Colors.textInverse };
    }
  };

  const s = getStyle();
  const sizeMap = {
    sm: { py: 8,  px: 14, fontSize: rf(13) },
    md: { py: 12, px: 20, fontSize: rf(14) },
    lg: { py: 15, px: 24, fontSize: rf(15) },
  };
  const sz = sizeMap[size];

  return (
    <TouchableOpacity
      style={[
        CS.buttonBase,
        {
          backgroundColor: s.bg,
          borderColor: s.border,
          paddingVertical: sz.py,
          paddingHorizontal: sz.px,
          opacity: disabled || loading ? 0.6 : 1,
        },
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={s.text} size="small" />
      ) : (
        <Text style={[{ color: s.text, fontSize: sz.fontSize, fontWeight: '600' }, textStyle]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
};
