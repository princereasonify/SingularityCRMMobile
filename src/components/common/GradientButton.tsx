import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  View,
  ViewStyle,
  LayoutChangeEvent,
} from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { GradientBackground } from './GradientBackground';
import { Sunstone } from '../../theme';
import { rf } from '../../utils/responsive';

interface Props {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  /** Override the Sunstone gradient (e.g. B2CGreen for the B2C login CTA). */
  gradient?: { from: string; to: string; deep: string };
}

/**
 * Sunstone-gradient CTA with a soft light "glint" that sweeps across it on a loop.
 * The gradient is react-native-svg (no extra native dep); the glint is a translucent
 * diagonal band translated left→right and clipped by the button's overflow:hidden.
 */
export const GradientButton = ({ label, onPress, loading, disabled, icon, style, gradient }: Props) => {
  const [w, setW] = useState(0);
  const sweep = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!w) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sweep, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.delay(1600),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [sweep, w]);

  const bandWidth = 90;
  const translateX = sweep.interpolate({
    inputRange: [0, 1],
    outputRange: [-bandWidth, w + bandWidth],
  });

  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={onPress}
      disabled={loading || disabled}
      onLayout={onLayout}
      style={[styles.btn, gradient && { shadowColor: gradient.from }, disabled && !loading && styles.disabled, style]}
    >
      <GradientBackground glow={false} gradient={gradient} style={StyleSheet.absoluteFillObject} />

      {/* Sweeping glint */}
      {w > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[styles.glint, { transform: [{ translateX }, { skewX: '-18deg' }] }]}
        >
          <Svg width={bandWidth} height="100%">
            <Defs>
              <LinearGradient id="glintGrad" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
                <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.45" />
                <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width={bandWidth} height="100%" fill="url(#glintGrad)" />
          </Svg>
        </Animated.View>
      )}

      {loading ? (
        <ActivityIndicator color="#FFF" />
      ) : (
        <View style={styles.row}>
          <Text style={styles.label}>{label}</Text>
          {icon}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  // Spec (SingularityCRM-Components.html → "Buttons & actions"):
  // Primary 44px · radius 13 · gradient · shadow 0 8 20 rgba(140,90,46,.28) · 13.5/700.
  btn: {
    height: 44,
    borderRadius: 13,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Sunstone.from,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 6,
  },
  disabled: { opacity: 0.5 },
  glint: { position: 'absolute', top: 0, bottom: 0, width: 90 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontWeight: '700', fontSize: rf(13.5), color: '#FFFFFF', letterSpacing: 0.2 },
});
