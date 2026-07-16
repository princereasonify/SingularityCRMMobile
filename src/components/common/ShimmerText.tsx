import React, { useEffect, useRef } from 'react';
import { Animated, TextStyle } from 'react-native';

interface Props {
  text: string;
  style?: TextStyle | TextStyle[];
  /** Resting colour — the word spends most of its cycle here. */
  baseColor?: string;
  /** Peak colour of the glint sweep. */
  highlightColor?: string;
}

/**
 * A nested text word that keeps its (dark ink) base colour and periodically
 * catches a warm sunstone "glint" — a smooth shimmer that rises briefly and
 * settles back, rather than a constant colour pulse.
 *
 * Rendered as a nested text node so it flows inline with the surrounding <Text>
 * and stays perfectly on the baseline:
 *   <Text>from <ShimmerWord text="onboard" />.</Text>
 * Colour animation can't use the native driver, so useNativeDriver is false.
 */
export const ShimmerWord = ({
  text,
  style,
  baseColor = 'rgba(20,15,10,0.86)',
  highlightColor = '#B4772A',
}: Props) => {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(900),
        Animated.timing(t, { toValue: 1, duration: 650, useNativeDriver: false }),
        Animated.timing(t, { toValue: 0, duration: 900, useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [t]);

  const color = t.interpolate({
    inputRange: [0, 1],
    outputRange: [baseColor, highlightColor],
  });

  return <Animated.Text style={[style, { color }]}>{text}</Animated.Text>;
};
