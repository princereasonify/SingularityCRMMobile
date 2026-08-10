import React, { useState } from 'react';
import { StyleSheet, View, ViewStyle, LayoutChangeEvent } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, RadialGradient, Rect } from 'react-native-svg';
import { Sunstone } from '../../theme';

interface Props {
  style?: ViewStyle | ViewStyle[];
  children?: React.ReactNode;
  /** Show the soft radial glow in the lower-right, matching the mockup hero panel. */
  glow?: boolean;
  /**
   * Override the diagonal gradient stops. Defaults to the Sunstone brand gold; the
   * B2C login passes the green `B2CGreen` triple so its hero/CTA render green.
   */
  gradient?: { from: string; to: string; deep: string };
}

/**
 * Sunstone diagonal gradient fill that covers its parent exactly.
 *
 * The size is measured via onLayout and passed to the SVG as explicit pixels rather
 * than "100%". Percentage sizing does not reliably resolve inside a flex-grown
 * container, which previously left the bottom of the hero panel unpainted (the
 * tagline spilled onto the page background). Explicit dimensions guarantee a full fill.
 */
export const GradientBackground = ({ style, children, glow = true, gradient }: Props) => {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const G = gradient ?? Sunstone;

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.w || height !== size.h) setSize({ w: width, h: height });
  };

  return (
    <View style={[styles.root, style]} onLayout={onLayout}>
      {size.w > 0 && size.h > 0 && (
        <Svg style={StyleSheet.absoluteFill} width={size.w} height={size.h}>
          <Defs>
            <LinearGradient id="sunstone" x1="0" y1="0" x2={size.w} y2={size.h} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={G.deep} />
              <Stop offset="0.55" stopColor={G.from} />
              <Stop offset="1" stopColor={G.to} />
            </LinearGradient>
            <RadialGradient
              id="glow"
              cx={size.w * 0.85}
              cy={size.h * 0.9}
              r={Math.max(size.w, size.h) * 0.6}
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0" stopColor={G.to} stopOpacity="0.45" />
              <Stop offset="0.7" stopColor={G.to} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width={size.w} height={size.h} fill="url(#sunstone)" />
          {glow && <Rect x="0" y="0" width={size.w} height={size.h} fill="url(#glow)" />}
        </Svg>
      )}
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { overflow: 'hidden' },
});
