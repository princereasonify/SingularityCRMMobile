import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TextInputProps,
  ViewStyle,
  TouchableOpacity,
} from 'react-native';
import { rf } from '../../utils/responsive';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
  accentColor?: string;
  rightIcon?: React.ReactNode;
  onRightIconPress?: () => void;
}

export const Input = ({
  label,
  error,
  containerStyle,
  accentColor = '#0d9488',
  rightIcon,
  onRightIconPress,
  ...rest
}: InputProps) => {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.inputWrapper,
          focused && { borderColor: accentColor, borderWidth: 1.5 },
          error && { borderColor: '#EF4444' },
        ]}
      >
        <TextInput
          style={[styles.input, !!rightIcon && { paddingRight: 40 }]}
          placeholderTextColor="#9CA3AF"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...rest}
        />
        {rightIcon && (
          <TouchableOpacity style={styles.rightIcon} onPress={onRightIconPress}>
            {rightIcon}
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: rf(13),
    fontWeight: '500',
    color: '#374151',
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: rf(14),
    color: '#111827',
  },
  rightIcon: {
    position: 'absolute',
    right: 12,
    padding: 4,
  },
  error: {
    fontSize: rf(12),
    color: '#EF4444',
    marginTop: 4,
  },
});
