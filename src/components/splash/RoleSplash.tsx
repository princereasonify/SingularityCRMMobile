import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Animated, Easing, useWindowDimensions, Platform,
} from 'react-native';
import Svg, {
  Defs, LinearGradient, RadialGradient, Stop, Rect, Circle,
  Text as SvgText,
} from 'react-native-svg';
import { SingularityLogo } from '../common/SingularityLogo';
import { UserRole } from '../../types';
import { isTabletDevice } from '../../utils/responsive';
import {
  ROLE_SPLASH, RING_ORDER, SPLASH_TIMELINE, SPARKS, hexA, RoleSplashTheme,
} from './roleSplashConfig';

/**
 * Role login splash — a React Native port of SingularitySplash.html.
 *
 * Plays three scenes and then hands off:
 *   0ms    "Welcome back" + the role's name in gradient metal
 *   2600ms the role's line, set as an italic pull-quote
 *   4700ms the brand lockup — rings, the five role chips, the real logo
 *   6600ms fades out and calls onComplete → mount the real app
 *
 * TWO DELIBERATE DEVIATIONS FROM THE HTML, both forced by the platform:
 *
 * 1. Fonts. The source loads Playfair Display + Cormorant Garamond from Google
 *    Fonts; neither .ttf is in this repo, and bundling them needs new assets, an
 *    Info.plist entry and a native rebuild. Rather than fall back to one generic
 *    serif, each is matched to the closest face iOS already ships:
 *      · Playfair Display is a high-contrast Didone display serif  → Didot
 *      · Cormorant Garamond is a delicate old-style with a fine italic → Cochin
 *    Android has neither, so it takes its own `serif`. Swap the two constants
 *    below if the real families are ever bundled.
 *
 * 2. The glint. CSS does it with `background-clip:text` over a moving gradient,
 *    which RN has no equivalent for without a mask library. Here the name is a
 *    real SVG <Text> filled by a <LinearGradient> whose stops are driven each
 *    frame — same visual, no extra dependency.
 */

/** Big display type — stands in for Playfair Display. */
const DISPLAY_SERIF = Platform.select({ ios: 'Didot', android: 'serif', default: 'serif' })!;
/** Body/quote serif — stands in for Cormorant Garamond; Cochin has a true italic. */
const TEXT_SERIF = Platform.select({ ios: 'Cochin', android: 'serif', default: 'serif' })!;

interface Props {
  role: UserRole;
  /** Fires once the splash has finished; mount the real app here. */
  onComplete: () => void;
}

export const RoleSplash = ({ role, onComplete }: Props) => {
  const r: RoleSplashTheme = ROLE_SPLASH[role] ?? ROLE_SPLASH.FO;
  const { width: W, height: H } = useWindowDimensions();
  const tablet = isTabletDevice;

  // 0 = name · 1 = quote · 2 = lockup
  const [scene, setScene] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;

  // Fired exactly once even if the component re-renders mid-timeline.
  const done = useRef(false);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setScene(1), SPLASH_TIMELINE.quoteAt));
    timers.push(setTimeout(() => setScene(2), SPLASH_TIMELINE.lockupAt));
    timers.push(setTimeout(() => {
      Animated.timing(fade, {
        toValue: 0,
        duration: SPLASH_TIMELINE.fadeMs,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start(() => {
        if (!done.current) { done.current = true; onComplete(); }
      });
    }, SPLASH_TIMELINE.doneAt));

    return () => {
      timers.forEach(clearTimeout);
      // Never strand the caller on unmount — the app must still get mounted.
      if (!done.current) { done.current = true; onComplete(); }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // NOTE: no `pointerEvents="none"` on the root. The real app is mounted and live
  // underneath, so allowing touches through would let the user hit buttons they
  // cannot see for the full 6.6s. The view unmounts right after onComplete, so it
  // never blocks input for longer than the animation itself.
  return (
    <Animated.View style={[styles.root, { opacity: fade }]}>
      <MeshBackground r={r} w={W} h={H} />
      <Sparks w={W} h={H} />
      <View style={styles.sceneHost}>
        {scene === 0 && <SceneName key="s0" r={r} tablet={tablet} maxW={W} />}
        {scene === 1 && <SceneQuote key="s1" r={r} tablet={tablet} />}
        {scene === 2 && <SceneLockup key="s2" r={r} tablet={tablet} />}
      </View>
    </Animated.View>
  );
};

/* ── Background ──────────────────────────────────────────────────────────────
   The source paints an angled multi-stop mesh then lays three scrims over it to
   push the midtones down so text stays legible. Same stops, same scrims.        */
const MeshBackground = ({ r, w, h }: { r: RoleSplashTheme; w: number; h: number }) => {
  const stops: [number, string][] = [
    [0, r.dark], [0.11, r.base], [0.2, r.bright], [0.32, r.base],
    [0.44, r.dark], [0.56, r.base], [0.68, r.bright], [0.8, r.base], [1, r.dark],
  ];
  return (
    <View style={StyleSheet.absoluteFill}>
      <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="mesh" x1="0" y1="0" x2={w} y2={h} gradientUnits="userSpaceOnUse">
            {stops.map(([o, c]) => <Stop key={o} offset={o} stopColor={c} />)}
          </LinearGradient>
          {/* scrim1 — vignette; scrim2 — centre pool; scrim3 — top/bottom bands */}
          <RadialGradient id="scrim1" cx="50%" cy="46%" rx="125%" ry="95%">
            <Stop offset="0" stopColor="#040302" stopOpacity={0.05} />
            <Stop offset="0.6" stopColor="#040302" stopOpacity={0.4} />
            <Stop offset="1" stopColor="#040302" stopOpacity={0.82} />
          </RadialGradient>
          <RadialGradient id="scrim2" cx="50%" cy="56%" rx="58%" ry="40%">
            <Stop offset="0" stopColor="#000" stopOpacity={0.5} />
            <Stop offset="0.72" stopColor="#000" stopOpacity={0} />
          </RadialGradient>
          <LinearGradient id="scrim3" x1="0" y1="0" x2="0" y2={h} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#000" stopOpacity={0.3} />
            <Stop offset="0.26" stopColor="#000" stopOpacity={0} />
            <Stop offset="0.64" stopColor="#000" stopOpacity={0} />
            <Stop offset="1" stopColor="#000" stopOpacity={0.5} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={w} height={h} fill="url(#mesh)" />
        <Rect x={0} y={0} width={w} height={h} fill="url(#scrim1)" />
        <Rect x={0} y={0} width={w} height={h} fill="url(#scrim2)" />
        <Rect x={0} y={0} width={w} height={h} fill="url(#scrim3)" />
      </Svg>
    </View>
  );
};

/** Drifting twinkles. Native-driven, so they cost nothing on the JS thread. */
const Sparks = ({ w, h }: { w: number; h: number }) => (
  <View style={StyleSheet.absoluteFill} pointerEvents="none">
    {SPARKS.map(([xp, yp, size, twDur, delay, driftDur], i) => (
      <Spark key={i} x={(xp / 100) * w} y={(yp / 100) * h} size={size}
        twDur={twDur} delay={delay} driftDur={driftDur} />
    ))}
  </View>
);

const Spark = ({ x, y, size, twDur, delay, driftDur }: {
  x: number; y: number; size: number; twDur: number; delay: number; driftDur: number;
}) => {
  const tw = useRef(new Animated.Value(0)).current;
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const t = Animated.loop(Animated.sequence([
      Animated.timing(tw, { toValue: 1, duration: twDur * 500, delay: delay * 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(tw, { toValue: 0, duration: twDur * 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    const d = Animated.loop(Animated.timing(drift, {
      toValue: 1, duration: driftDur * 1000, easing: Easing.linear, useNativeDriver: true,
    }));
    t.start(); d.start();
    return () => { t.stop(); d.stop(); };
  }, [tw, drift, twDur, delay, driftDur]);

  return (
    <Animated.View
      style={{
        position: 'absolute', left: x, top: y, width: size, height: size,
        borderRadius: size / 2, backgroundColor: '#FFF',
        opacity: tw.interpolate({ inputRange: [0, 1], outputRange: [0, 0.95] }),
        transform: [
          { scale: tw.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) },
          { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [6, -24] }) },
        ],
      }}
    />
  );
};

/** Shared entrance: scale 1.04 → 1 with a fade, the source's `sceneIn`. */
const useSceneIn = () => {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 700, easing: Easing.bezier(0.2, 0.8, 0.2, 1), useNativeDriver: true }).start();
  }, [v]);
  return {
    opacity: v,
    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1.04, 1] }) }],
  };
};

/* ── Scene 1 — welcome + role name ────────────────────────────────────────── */
const SceneName = ({ r, tablet, maxW }: { r: RoleSplashTheme; tablet: boolean; maxW: number }) => {
  const scene = useSceneIn();
  const rise = useRef(new Animated.Value(0)).current;
  const [glint, setGlint] = useState(1.5);

  // Source: 50px, ×0.78 when the name is long. Scaled up on tablet.
  const base = tablet ? 72 : 44;
  const size = r.name.length > 12 ? Math.round(base * 0.78) : base;
  const boxW = Math.min(maxW - 32, r.name.length * size * 0.72 + 40);
  const boxH = size * 1.5;

  useEffect(() => {
    Animated.timing(rise, { toValue: 1, duration: 800, delay: 400, easing: Easing.bezier(0.2, 0.8, 0.2, 1), useNativeDriver: true }).start();
    // Drives the gradient sweep. `glint` is the gradient's centre in [-0.6, 1.5];
    // it can't be native-driven because SVG gradient stops are JS-side props.
    let raf = 0; const start = Date.now();
    const tick = () => {
      const t = ((Date.now() - start) % 3200) / 3200;
      setGlint(1.5 - t * 2.1);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [rise]);

  const c = Math.max(0, Math.min(1, glint));
  return (
    <Animated.View style={[styles.scene, scene]}>
      <Text style={[styles.welcome, { color: r.bright, fontSize: tablet ? 14 : 12 }]}>WELCOME BACK</Text>
      <Animated.View
        style={{
          marginTop: 22,
          opacity: rise,
          transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) }],
        }}
      >
        <Svg width={boxW} height={boxH}>
          <Defs>
            <LinearGradient id="glint" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={r.ink} />
              <Stop offset={Math.max(0, c - 0.1)} stopColor={r.ink} />
              <Stop offset={c} stopColor="#FFFFFF" />
              <Stop offset={Math.min(1, c + 0.1)} stopColor={r.ink} />
              <Stop offset="1" stopColor={r.ink} />
            </LinearGradient>
          </Defs>
          <SvgText
            x={boxW / 2}
            y={boxH * 0.72}
            fontSize={size}
            fontWeight="800"
            fontFamily={DISPLAY_SERIF}
            letterSpacing={size * 0.05}
            textAnchor="middle"
            fill="url(#glint)"
          >
            {r.name.toUpperCase()}
          </SvgText>
        </Svg>
      </Animated.View>
    </Animated.View>
  );
};

/* ── Scene 2 — the role's line ────────────────────────────────────────────── */
const SceneQuote = ({ r, tablet }: { r: RoleSplashTheme; tablet: boolean }) => {
  const scene = useSceneIn();
  const rise = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(rise, { toValue: 1, duration: 900, delay: 200, easing: Easing.bezier(0.2, 0.8, 0.2, 1), useNativeDriver: true }).start();
  }, [rise]);

  return (
    <Animated.View style={[styles.scene, scene]}>
      <Animated.Text
        style={[
          styles.quote,
          {
            fontFamily: TEXT_SERIF,
            fontSize: tablet ? 44 : 28,
            color: '#EFE6D6',
            opacity: rise,
            transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) }],
          },
        ]}
      >
        {`“${r.quote}”`}
      </Animated.Text>
      <Ornament color={r.bright} width={tablet ? 90 : 70} delay={700} />
    </Animated.View>
  );
};

/** Hairline · diamond · hairline. */
const Ornament = ({ color, width, delay, gap = 12, dot = 9, style }: {
  color: string; width: number; delay: number; gap?: number; dot?: number; style?: any;
}) => {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 1100, delay, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();
  }, [v, delay]);
  return (
    <Animated.View style={[{ flexDirection: 'row', alignItems: 'center', gap, opacity: v }, style]}>
      <Svg width={width} height={1}>
        <Defs>
          <LinearGradient id="ornL" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={color} stopOpacity={0} />
            <Stop offset="1" stopColor={color} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={1} fill="url(#ornL)" />
      </Svg>
      <View style={{ width: dot, height: dot, borderWidth: 1, borderColor: color, transform: [{ rotate: '45deg' }] }} />
      <Svg width={width} height={1}>
        <Defs>
          <LinearGradient id="ornR" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={color} stopOpacity={1} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={1} fill="url(#ornR)" />
      </Svg>
    </Animated.View>
  );
};


/**
 * The sweeping highlight over the brand mark.
 *
 * Source CSS clips a moving `linear-gradient(105deg, …)` to the logo's alpha via
 * `-webkit-mask` + `mix-blend-mode:screen`. RN has neither without a mask library,
 * so the sweep is clipped to a circle inscribed in the logo box: the mark is a
 * disc (with a streak that runs past it), and the disc is where the shine reads.
 * Same 3.4s cadence and 0.6s delay as the original `glint`.
 */
const LogoShine = ({ size }: { size: number }) => {
  const x = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(x, {
        toValue: 1,
        duration: 3400,
        delay: 600,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [x]);

  const bandW = size * 1.6;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute', left: 0, top: 0, width: size, height: size,
        borderRadius: size / 2, overflow: 'hidden',
      }}
    >
      <Animated.View
        style={{
          position: 'absolute', top: -size * 0.25, width: bandW, height: size * 1.5,
          transform: [
            // Travels fully off one edge to the other, so there is no visible pop.
            { translateX: x.interpolate({ inputRange: [0, 1], outputRange: [-bandW, size + bandW * 0.2] }) },
            { rotate: '15deg' },
          ],
        }}
      >
        <Svg width={bandW} height={size * 1.5}>
          <Defs>
            <LinearGradient id="shine" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
              <Stop offset="0.42" stopColor="#FFFFFF" stopOpacity={0} />
              <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0.92} />
              <Stop offset="0.58" stopColor="#FFFFFF" stopOpacity={0} />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={bandW} height={size * 1.5} fill="url(#shine)" />
        </Svg>
      </Animated.View>
    </View>
  );
};

/* ── Scene 3 — the lockup ─────────────────────────────────────────────────── */
const SceneLockup = ({ r, tablet }: { r: RoleSplashTheme; tablet: boolean }) => {
  const scene = useSceneIn();
  const pop = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const word = useRef(new Animated.Value(0)).current;

  // Source: 300 box · 270 ring · 206 logo · R=126. Scaled as one unit.
  const k = tablet ? 1.22 : 0.86;
  const BOX = Math.round(300 * k);
  const RING = Math.round(270 * k);
  const LOGO = Math.round(206 * k);
  const R = Math.round(126 * k);
  const C = BOX / 2;

  useEffect(() => {
    Animated.timing(pop, { toValue: 1, duration: 700, delay: 300, easing: Easing.bezier(0.2, 0.8, 0.2, 1), useNativeDriver: true }).start();
    Animated.timing(word, { toValue: 1, duration: 1000, delay: 800, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();
    const s = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 34000, easing: Easing.linear, useNativeDriver: true }));
    s.start();
    return () => s.stop();
  }, [pop, spin, word]);

  const labels = useMemo(() => RING_ORDER.map((key, i) => {
    const a = ((-90 + i * 72) * Math.PI) / 180;
    const active = key === r.key;
    return {
      key,
      short: ROLE_SPLASH[key].short,
      left: C + R * Math.cos(a),
      top: C + R * Math.sin(a),
      active,
    };
  }), [r.key, C, R]);

  return (
    <Animated.View style={[styles.scene, scene]}>
      <View style={{ width: BOX, height: BOX }}>
        {/* soft ring */}
        <View style={[styles.ringAbs, {
          width: RING, height: RING, borderRadius: RING / 2,
          left: (BOX - RING) / 2, top: (BOX - RING) / 2,
          borderWidth: 1, borderColor: hexA(r.bright, 0.18),
        }]} />
        {/* dashed ring — SVG, because RN cannot dash a rounded border */}
        <Animated.View
          style={[styles.ringAbs, {
            width: RING, height: RING, left: (BOX - RING) / 2, top: (BOX - RING) / 2,
            transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
          }]}
        >
          <Svg width={RING} height={RING}>
            <Circle
              cx={RING / 2} cy={RING / 2} r={RING / 2 - 1}
              stroke={hexA(r.bright, 0.3)} strokeWidth={1} fill="none"
              strokeDasharray="6 8"
            />
          </Svg>
        </Animated.View>

        {labels.map(l => (
          <Text
            key={l.key}
            style={{
              position: 'absolute',
              left: l.left - 26, top: l.top - 14, width: 52,
              textAlign: 'center',
              fontFamily: TEXT_SERIF, fontWeight: '600', letterSpacing: 1,
              fontSize: l.active ? 20 * (tablet ? 1.15 : 1) : 15 * (tablet ? 1.15 : 1),
              color: l.active ? r.bright : 'rgba(255,255,255,0.42)',
              textShadowColor: l.active ? r.base : 'transparent',
              textShadowRadius: l.active ? 14 : 0,
            }}
          >
            {l.short}
          </Text>
        ))}

        {/* The real brand mark (SingularityOnly.svg) */}
        <Animated.View
          style={{
            position: 'absolute',
            left: (BOX - LOGO) / 2, top: (BOX - LOGO) / 2,
            width: LOGO, height: LOGO,
            opacity: pop,
            transform: [{ scale: pop.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.6, 1.06, 1] }) }],
          }}
        >
          <SingularityLogo size={LOGO} />
          <LogoShine size={LOGO} />
        </Animated.View>
      </View>

      <Animated.View style={{ alignItems: 'center', gap: 12, marginTop: 24, opacity: word }}>
        <Text style={{
          fontFamily: TEXT_SERIF, fontSize: tablet ? 28 : 22,
          letterSpacing: tablet ? 4.5 : 3.5, color: '#F4ECE0',
        }}>
          SINGULARITY
        </Text>
        <Ornament color={r.bright} width={50} delay={900} gap={10} dot={7} style={{ marginTop: 0 }} />
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: '#0b0808', zIndex: 999 },
  sceneHost: { ...StyleSheet.absoluteFillObject },
  scene: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24,
  },
  welcome: { letterSpacing: 5, fontWeight: '500', opacity: 0.9 },
  quote: {
    fontStyle: 'italic', fontWeight: '600', textAlign: 'center',
    lineHeight: undefined, maxWidth: '86%',
  },
  ringAbs: { position: 'absolute' },
});
