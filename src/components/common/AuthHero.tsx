import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Platform, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GradientBackground } from './GradientBackground';
import { ShimmerWord } from './ShimmerText';
import { SingularityLogo } from './SingularityLogo';
import { Wordmark } from '../../theme';

const SERIF = Platform.select({ ios: 'Georgia', default: 'serif' });

interface Props {
  /** compact = stacked phone header; false = tall split-panel (tablet landscape). */
  compact: boolean;
}

/**
 * The Sunstone brand panel shared by Login and Signup: logo + "SingularityCRM"
 * wordmark (CRM in bold black), the "One pitch away from onboard." quote with the
 * shimmering ink accent word, and the tagline. Stays gold in light and dark themes.
 */
export const AuthHero = ({ compact }: Props) => {
  const insets = useSafeAreaInsets();

  // Brand lockup: the mark leads, the wordmark reads at the mark's own height and
  // never larger than it. No animation on the mark.
  const logoSize = compact ? 64 : 92;
  const wordSize = Math.round(logoSize * 0.34);


  const quoteSize = compact ? 36 : 54;
  const quoteLh = quoteSize * (compact ? 1.14 : 1.12);
  const subSize = compact ? 15 : 17;

  const heroIn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(heroIn, { toValue: 1, duration: 700, delay: 150, useNativeDriver: true }).start();
  }, [heroIn]);

  const heroAnim = {
    opacity: heroIn,
    transform: [{ translateY: heroIn.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) }],
  };

  return (
    <GradientBackground
      glow
      style={[
        styles.hero,
        compact
          ? { paddingTop: insets.top + 26, paddingBottom: 34, paddingHorizontal: 26 }
          : { paddingTop: insets.top + 48, paddingBottom: 56, paddingHorizontal: 48, flex: 1 },
      ]}
    >
      {/* Brand lockup: the mark is 3× the old size with a sweeping shimmer, the
          wordmark is half the mark's height, vertically centred, sitting right
          against it (only a hair of gap). */}
      <View style={styles.brandRow}>
        <SingularityLogo size={logoSize} />
        <Text style={[styles.wordmark, { fontSize: wordSize }]}>
          Singularity<Text style={styles.wordmarkAccent}>CRM</Text>
        </Text>
      </View>

      {!compact && <View style={{ flex: 1 }} />}

      <Animated.View style={[compact ? styles.bodyCompact : styles.body, heroAnim]}>
        <Text
          style={[
            styles.quote,
            { fontSize: quoteSize, lineHeight: quoteLh, letterSpacing: compact ? -1.3 : -2 },
          ]}
        >
          One pitch away{'\n'}from{' '}
          <ShimmerWord
            text="onboard"
            style={{
              fontFamily: SERIF,
              fontStyle: 'italic',
              fontWeight: '600',
              fontSize: quoteSize,
              letterSpacing: -0.5,
            }}
          />
          <Text style={[styles.quote, { fontSize: quoteSize }]}>.</Text>
        </Text>
        <Text style={[styles.tagline, { fontSize: subSize, marginTop: compact ? 12 : 16, lineHeight: subSize * 1.5 }]}>
          Plan your day, visit schools,{'\n'}close deals — all in one place.
        </Text>
      </Animated.View>
    </GradientBackground>
  );
};

const styles = StyleSheet.create({
  hero: { justifyContent: 'flex-start' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 0 },
  wordmark: { fontFamily: Wordmark.bold, color: '#FFFFFF', letterSpacing: -0.6, marginLeft: -2 },
  wordmarkAccent: { color: '#0E0B08' }, // CRM — bold black
  body: {},
  bodyCompact: { marginTop: 28 },
  quote: { fontWeight: '700', color: '#FFFFFF' },
  tagline: { fontWeight: '400', color: 'rgba(255,255,255,0.78)' },
});
