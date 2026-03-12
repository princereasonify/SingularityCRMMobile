import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TextInputProps,
  ViewStyle,
  TouchableOpacity,
} from 'react-native';
import { CS, Colors } from '../../theme';
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
  accentColor = Colors.inputBorderFocus,
  rightIcon,
  onRightIconPress,
  ...rest
}: InputProps) => {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[CS.inputContainer, containerStyle]}>
      {label && <Text style={[CS.inputLabel, { fontSize: rf(13) }]}>{label}</Text>}
      <View
        style={[
          CS.inputWrapper,
          focused && { borderColor: accentColor, borderWidth: 1.5 },
          error  && { borderColor: Colors.danger },
        ]}
      >
        <TextInput
          style={[CS.inputField, { fontSize: rf(14) }, !!rightIcon && { paddingRight: 40 }]}
          placeholderTextColor={Colors.placeholder}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...rest}
        />
        {rightIcon && (
          <TouchableOpacity style={CS.inputRightIcon} onPress={onRightIconPress}>
            {rightIcon}
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={[CS.inputErrorText, { fontSize: rf(12) }]}>{error}</Text>}
    </View>
  );
};
