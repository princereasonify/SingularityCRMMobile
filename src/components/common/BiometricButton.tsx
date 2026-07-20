import React from 'react';
import { Text, StyleSheet, TouchableOpacity, ActivityIndicator, View } from 'react-native';
import { ScanFace, FingerprintPattern } from 'lucide-react-native';
import { AuthTheme } from '../../theme';
import { rf } from '../../utils/responsive';
import type { BiometricType } from '../../services/biometricService';

interface Props {
  theme: AuthTheme;
  label: string;              // "Face ID" | "Touch ID" | "Fingerprint" | "Biometrics"
  biometryType: BiometricType;
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
}

/** Themed "Sign in with Face ID / Touch ID" button, matching the Sunstone login. */
export const BiometricButton = ({ theme: T, label, biometryType, loading, disabled, onPress }: Props) => {
  const Icon = biometryType === 'FaceID' || biometryType === 'Face' ? ScanFace : FingerprintPattern;

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.btn,
        { backgroundColor: T.card, borderColor: T.accentText },
        (disabled || loading) && { opacity: 0.6 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={T.accentText} />
      ) : (
        <View style={styles.row}>
          <Icon size={20} color={T.accentText} strokeWidth={2} />
          <Text style={[styles.txt, { color: T.accentText }]}>Sign in with {label}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  btn: {
    // spec "Buttons & actions" → Secondary: 44px · radius 13 · 1.5px border · 13.5/700
    height: 44,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  txt: { fontWeight: '700', fontSize: rf(13.5) },
});
