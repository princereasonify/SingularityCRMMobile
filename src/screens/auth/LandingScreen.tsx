import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  StatusBar,
  LayoutChangeEvent,
  Animated,
  Easing,
  AccessibilityInfo,
  DimensionValue,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  RadialGradient,
  Rect,
  Circle,
  Ellipse,
  Line,
  Path,
  Polyline,
  G,
  Text as SvgText,
} from 'react-native-svg';
import { LogIn, Building2, GraduationCap, ChevronRight } from 'lucide-react-native';
import { SingularityLogo } from '../../components/common/SingularityLogo';
import { Wordmark } from '../../theme';
import { rf, isTabletDevice } from '../../utils/responsive';
import { applyLoginOrientation } from '../../utils/orientation';

// ─── Palette (dark hero — mirrors the web Landing / Hero) ─────────────────────
const NAVY_TOP = '#0a1026';
const NAVY_MID = '#070b1a';
const NAVY_BOT = '#05070f';
const BLUE = '#7aa7ff';
const BLUE_SOFT = '#9dc0ff';
const CYAN = '#9ad7ff';
const GREEN = '#a8e6b8';
const WHITE = '#FFFFFF';
const PIN = '#cf6a44';        // terracotta teardrop
const ROUTE = '#35d6f0';      // static base route (cool cyan)
const ROUTE_PULSE = '#eafcff'; // bright travelling signal

// Animated SVG primitives (props like r / opacity / strokeDashoffset drive on the JS
// thread — fine at the calm durations used here; transforms/opacity on Views stay native).
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPolyline = Animated.createAnimatedComponent(Polyline);
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

// Deterministic seeded PRNG (mulberry32) — stable between renders so particle
// positions/timings never jump when the component re-renders.
const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * Respect the OS "Reduce Motion" setting. Returns true when motion should be
 * frozen; every animation below reads this and parks its value at a resting
 * frame instead of looping (the scene stays fully rendered, just still).
 */
const useReducedMotion = (): boolean => {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(v => {
      if (mounted) setReduce(!!v);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', v => setReduce(!!v));
    return () => {
      mounted = false;
      // RN >=0.65 returns a subscription with remove(); guard for older shapes.
      (sub as any)?.remove?.();
    };
  }, []);
  return reduce;
};

// ─── Drifting glow field ──────────────────────────────────────────────────────
type GlowCfg = {
  gid: string;
  color: string;
  op: number;
  r: number;
  left: DimensionValue;
  top: DimensionValue;
  dx: number;
  dy: number;
  dur: number;
  delay: number;
};

// 2–3 large soft radial glows, additively layered over the navy ground. Different
// durations + delays + travel vectors so they never visibly sync.
const GLOWS: GlowCfg[] = [
  { gid: 'glowIndigo', color: '#26306b', op: 0.30, r: 240, left: '-16%', top: '-14%', dx: 26, dy: 18, dur: 24000, delay: 0 },
  { gid: 'glowPeri', color: BLUE, op: 0.22, r: 200, left: '48%', top: '-8%', dx: -24, dy: 22, dur: 30000, delay: 1400 },
  { gid: 'glowSage', color: GREEN, op: 0.15, r: 170, left: '22%', top: '52%', dx: 20, dy: -16, dur: 20000, delay: 2600 },
];

const Glow = ({ cfg, reduce }: { cfg: GlowCfg; reduce: boolean }) => {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) {
      t.setValue(0.5); // resting mid-drift
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: cfg.dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration: cfg.dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    const timer = setTimeout(() => loop.start(), cfg.delay);
    return () => {
      clearTimeout(timer);
      loop.stop();
    };
  }, [reduce, t, cfg]);
  const translateX = t.interpolate({ inputRange: [0, 1], outputRange: [0, cfg.dx] });
  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [0, cfg.dy] });
  const D = cfg.r * 2;
  return (
    <Animated.View
      pointerEvents="none"
      style={{ position: 'absolute', left: cfg.left, top: cfg.top, width: D, height: D, transform: [{ translateX }, { translateY }] }}
    >
      <Svg width={D} height={D}>
        <Defs>
          <RadialGradient id={cfg.gid} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={cfg.color} stopOpacity={cfg.op} />
            <Stop offset="0.55" stopColor={cfg.color} stopOpacity={cfg.op * 0.4} />
            <Stop offset="1" stopColor={cfg.color} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx={cfg.r} cy={cfg.r} r={cfg.r} fill={`url(#${cfg.gid})`} />
      </Svg>
    </Animated.View>
  );
};

// ─── Particle scatter (seeded twinkle) ────────────────────────────────────────
type Particle = {
  id: number;
  left: DimensionValue;
  top: DimensionValue;
  size: number;
  color: string;
  min: number;
  max: number;
  dur: number;
  delay: number;
};

const buildParticles = (): Particle[] => {
  const rnd = mulberry32(0x9e3779b9);
  const N = 22;
  return Array.from({ length: N }, (_, i) => {
    const size = 1.5 + rnd() * 2.5;
    const max = 0.55 + rnd() * 0.3; // .55–.85
    return {
      id: i,
      left: `${(rnd() * 100).toFixed(2)}%` as DimensionValue,
      top: `${(rnd() * 100).toFixed(2)}%` as DimensionValue,
      size,
      color: i % 5 === 0 ? GREEN : '#cfe0ff',
      min: 0.15,
      max,
      dur: 3000 + rnd() * 5000, // 3–8s
      delay: rnd() * 4000,
    };
  });
};

const ParticleDot = ({ p, reduce }: { p: Particle; reduce: boolean }) => {
  const v = useRef(new Animated.Value(p.min)).current;
  useEffect(() => {
    if (reduce) {
      v.setValue((p.min + p.max) / 2); // resting mid-brightness
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: p.max, duration: p.dur / 2, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(v, { toValue: p.min, duration: p.dur / 2, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    const timer = setTimeout(() => loop.start(), p.delay);
    return () => {
      clearTimeout(timer);
      loop.stop();
    };
  }, [reduce, v, p]);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: p.left,
        top: p.top,
        width: p.size,
        height: p.size,
        borderRadius: 999,
        backgroundColor: p.color,
        opacity: v,
        shadowColor: p.color,
        shadowOpacity: 0.9,
        shadowRadius: 3,
        shadowOffset: { width: 0, height: 0 },
      }}
    />
  );
};

const ParticleField = ({ reduce }: { reduce: boolean }) => {
  const particles = useMemo(buildParticles, []);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map(p => (
        <ParticleDot key={p.id} p={p} reduce={reduce} />
      ))}
    </View>
  );
};

/**
 * Dark navy ground + faint rings (static SVG) with the drifting glow field and the
 * seeded particle scatter layered above it. Sits behind all hero content.
 */
const HeroBackground = ({ reduce }: { reduce: boolean }) => {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.w || height !== size.h) setSize({ w: width, h: height });
  };
  return (
    <View style={StyleSheet.absoluteFill} onLayout={onLayout} pointerEvents="none">
      {size.w > 0 && size.h > 0 && (
        <Svg style={StyleSheet.absoluteFill} width={size.w} height={size.h}>
          <Defs>
            <LinearGradient id="navy" x1="0" y1="0" x2="0" y2={size.h} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={NAVY_TOP} />
              <Stop offset="0.55" stopColor={NAVY_MID} />
              <Stop offset="1" stopColor={NAVY_BOT} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width={size.w} height={size.h} fill="url(#navy)" />
          {/* Faint outlined rings, top-right */}
          <Circle cx={size.w * 0.86} cy={size.h * 0.14} r={size.w * 0.28} stroke="rgba(122,167,255,0.10)" strokeWidth={1} fill="none" />
          <Circle cx={size.w * 0.86} cy={size.h * 0.14} r={size.w * 0.44} stroke="rgba(122,167,255,0.06)" strokeWidth={1} fill="none" />
        </Svg>
      )}
      {GLOWS.map(cfg => (
        <Glow key={cfg.gid} cfg={cfg} reduce={reduce} />
      ))}
      <ParticleField reduce={reduce} />
    </View>
  );
};

// ─── Floating hook (shared by the glass cards) ────────────────────────────────
const useFloat = (
  { duration, delay, travel }: { duration: number; delay: number; travel: number },
  reduce: boolean,
) => {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) {
      t.setValue(0); // resting frame — no lift
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    const timer = setTimeout(() => loop.start(), delay);
    return () => {
      clearTimeout(timer);
      loop.stop();
    };
  }, [reduce, t, duration, delay]);
  return t.interpolate({ inputRange: [0, 1], outputRange: [0, -travel] });
};

/**
 * Polished-glass sheen: a top white highlight fading out by 30% plus a faint bottom
 * vignette, drawn as an absolutely-positioned SVG over a card. `uid` keeps gradient
 * ids unique across the several cards on screen.
 */
const CardSheen = ({ uid }: { uid: string }) => (
  <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
    <Defs>
      <LinearGradient id={`sheen-${uid}`} x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.08" />
        <Stop offset="0.3" stopColor="#FFFFFF" stopOpacity="0" />
      </LinearGradient>
      <LinearGradient id={`vig-${uid}`} x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0.72" stopColor="#000000" stopOpacity="0" />
        <Stop offset="1" stopColor="#000000" stopOpacity="0.14" />
      </LinearGradient>
    </Defs>
    <Rect x="0" y="0" width="100%" height="100%" fill={`url(#sheen-${uid})`} />
    <Rect x="0" y="0" width="100%" height="100%" fill={`url(#vig-${uid})`} />
  </Svg>
);

// ─── Territory map ────────────────────────────────────────────────────────────
// Pins in the map's viewBox (300×220) coordinate space; `y` is the teardrop TIP.
const MAP_PINS: { x: number; y: number; label: string; anchor: 'start' | 'middle' | 'end' }[] = [
  { x: 58, y: 158, label: 'Mumbai', anchor: 'end' },
  { x: 104, y: 176, label: 'Pune', anchor: 'middle' },
  { x: 92, y: 108, label: 'Nashik', anchor: 'end' },
  { x: 168, y: 122, label: 'Aurangabad', anchor: 'start' },
  { x: 246, y: 84, label: 'Nagpur', anchor: 'start' },
];
// Total route length through the pins (viewBox units) — drives the dash cycle.
const ROUTE_LEN = 283;

const PinMarker = ({ p, index, reduce }: { p: (typeof MAP_PINS)[number]; index: number; reduce: boolean }) => {
  const ring = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) {
      ring.setValue(0); // resting — a static faint ring
      return;
    }
    const loop = Animated.loop(
      Animated.timing(ring, { toValue: 1, duration: 2400, easing: Easing.out(Easing.quad), useNativeDriver: false }),
    );
    const timer = setTimeout(() => loop.start(), index * 480); // stagger → ripple across map
    return () => {
      clearTimeout(timer);
      loop.stop();
    };
  }, [reduce, ring, index]);

  const bulbY = p.y - 9;
  const r = ring.interpolate({ inputRange: [0, 1], outputRange: [3, 12] });
  const o = ring.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });
  const teardrop = `M ${p.x} ${p.y} C ${p.x - 5} ${p.y - 8} ${p.x - 5.5} ${p.y - 15} ${p.x} ${p.y - 15} C ${p.x + 5.5} ${p.y - 15} ${p.x + 5} ${p.y - 8} ${p.x} ${p.y} Z`;

  return (
    <G>
      {/* Ground shadow */}
      <Ellipse cx={p.x} cy={p.y + 2} rx={5} ry={1.8} fill="rgba(0,0,0,0.30)" />
      {/* Expanding-and-fading pulse ring */}
      <AnimatedCircle cx={p.x} cy={bulbY} r={r} fill="none" stroke={PIN} strokeWidth={1.2} opacity={o} />
      {/* Terracotta teardrop + white dot */}
      <Path d={teardrop} fill={PIN} stroke="rgba(0,0,0,0.18)" strokeWidth={0.5} />
      <Circle cx={p.x} cy={bulbY} r={2} fill="#FFFFFF" />
      <SvgText
        x={p.anchor === 'end' ? p.x - 9 : p.anchor === 'start' ? p.x + 9 : p.x}
        y={p.y + 12}
        fill="rgba(255,255,255,0.72)"
        fontSize={9}
        fontWeight="600"
        textAnchor={p.anchor}
      >
        {p.label}
      </SvgText>
    </G>
  );
};

/**
 * Decorative "field territory map" card — NOT a real map. Stylized slate region with
 * a graticule, a base cyan route with a travelling bright pulse, and terracotta pins
 * that ripple. Gently floats with a hair of parallax opposite the background glows.
 */
const TerritoryMapCard = ({ style, reduce, uid }: { style?: any; reduce: boolean; uid: string }) => {
  const translateY = useFloat({ duration: 11000, delay: 300, travel: 14 }, reduce);

  // Parallax drift (opposite the glows) — small and slow.
  const px = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) {
      px.setValue(0.5);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(px, { toValue: 1, duration: 22000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(px, { toValue: 0, duration: 22000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduce, px]);
  const translateX = px.interpolate({ inputRange: [0, 1], outputRange: [5, -5] });

  // Route pulse — animate dash offset so a bright signal travels the polyline.
  const dash = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) {
      dash.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(dash, { toValue: 1, duration: 3000, easing: Easing.linear, useNativeDriver: false }),
    );
    loop.start();
    return () => loop.stop();
  }, [reduce, dash]);
  const dashOffset = dash.interpolate({ inputRange: [0, 1], outputRange: [0, -(ROUTE_LEN + 14)] });

  const routePts = MAP_PINS.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <Animated.View style={[styles.mapCard, style, { transform: [{ translateY }, { translateX }] }]}>
      <View style={styles.cardGlass} pointerEvents="none" />
      <CardSheen uid={uid} />
      <View style={styles.mapCanvas}>
        <Svg width="100%" height="100%" viewBox="0 0 300 220" preserveAspectRatio="xMidYMid meet">
          <Defs>
            <LinearGradient id="land" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#1b2440" stopOpacity="0.55" />
              <Stop offset="1" stopColor="#141c33" stopOpacity="0.55" />
            </LinearGradient>
          </Defs>

          {/* Graticule */}
          {[40, 80, 120, 160, 200, 260].map(x => (
            <Line key={`v${x}`} x1={x} y1={10} x2={x} y2={210} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
          ))}
          {[40, 80, 120, 160, 200].map(y => (
            <Line key={`h${y}`} x1={20} y1={y} x2={288} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
          ))}

          {/* Stylized region — slate land fill + hairline border */}
          <Path
            d="M40,120 C40,70 95,55 140,60 C185,64 205,80 250,70 C285,63 292,110 275,140 C258,170 210,175 170,178 C120,182 70,185 52,160 C38,140 40,135 40,120 Z"
            fill="url(#land)"
            stroke="rgba(122,167,255,0.28)"
            strokeWidth={1.2}
          />

          {/* Base route (static cyan) */}
          <Polyline points={routePts} fill="none" stroke={ROUTE} strokeWidth={1.6} strokeOpacity={0.5} strokeLinecap="round" strokeLinejoin="round" />
          {/* Travelling signal */}
          <AnimatedPolyline
            points={routePts}
            fill="none"
            stroke={ROUTE_PULSE}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="14 283"
            strokeDashoffset={dashOffset as unknown as number}
          />

          {/* Pins */}
          {MAP_PINS.map((p, i) => (
            <PinMarker key={p.label} p={p} index={i} reduce={reduce} />
          ))}
        </Svg>
      </View>
    </Animated.View>
  );
};

// ─── Workspace selection card ─────────────────────────────────────────────────
interface CardProps {
  accent: string;
  chevronColor: string;
  tileBg: string;
  tileBorder: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  onPress: () => void;
  style?: any;
  uid: string;
  reduce: boolean;
  float: { duration: number; delay: number; travel: number };
}

const SelectCard = ({
  accent,
  chevronColor,
  tileBg,
  tileBorder,
  icon,
  title,
  desc,
  onPress,
  style,
  uid,
  reduce,
  float,
}: CardProps) => {
  const translateY = useFloat(float, reduce);
  return (
    <AnimatedTouchable
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.card, style, { transform: [{ translateY }] }]}
    >
      {/* Glass fill + polished sheen */}
      <View style={styles.cardGlass} pointerEvents="none" />
      <CardSheen uid={uid} />
      <View style={styles.cardTopRow}>
        <View style={[styles.cardTile, { backgroundColor: tileBg, borderColor: tileBorder }]}>{icon}</View>
        <ChevronRight size={20} color={chevronColor} strokeWidth={2.4} />
      </View>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardDesc}>{desc}</Text>
      <View style={styles.cardLoginRow}>
        <Text style={[styles.cardLogin, { color: chevronColor }]}>Log in </Text>
        <Text style={[styles.cardLogin, { color: chevronColor }]}>→</Text>
      </View>
    </AnimatedTouchable>
  );
};

export const LandingScreen = ({ navigation }: any) => {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();

  const isLandscape = width > height;
  const twoPane = isTabletDevice && isLandscape;

  useFocusEffect(
    useCallback(() => {
      applyLoginOrientation();
    }, []),
  );

  // Size the headline to the viewport so it never overflows into the brand/cards on
  // shorter tablets; the scroll container below handles anything that still doesn't fit.
  const headlineSize = twoPane ? Math.max(34, Math.min(48, Math.round(height * 0.07))) : rf(33);
  const headlineLh = headlineSize * 1.08;

  const goB2B = () => navigation.navigate('Login', { family: 'b2b' });
  const goB2C = () => navigation.navigate('Login', { family: 'b2c' });

  // ─── Content blocks ─────────────────────────────────────────────────────────
  const brand = (
    <View style={styles.brandRow}>
      <SingularityLogo size={twoPane ? 56 : 46} />
      <View style={styles.brandText}>
        <Text style={[styles.wordmark, { fontSize: twoPane ? 22 : 19 }]}>
          Singularity<Text style={styles.wordmarkAccent}>CRM</Text>
        </Text>
        <Text style={styles.kicker}>SALES CRM</Text>
      </View>
    </View>
  );

  const heroText = (
    <View>
      <View style={styles.eyebrowRow}>
        <View style={styles.eyebrowBar} />
        <Text style={styles.eyebrow}>WELCOME TO SINGULARITYCRM</Text>
      </View>
      <Text style={[styles.headline, { fontSize: headlineSize, lineHeight: headlineLh }]}>
        One platform.{'\n'}Every conversation
      </Text>
      {/* Last line rendered as SVG gradient text so it reads as one headline. */}
      <GradientHeadlineLine text="moving forward." fontSize={headlineSize} />
      <Text style={[styles.subtext, twoPane && { maxWidth: 460 }]}>
        Purpose-built for edtech sales — from institutional deals with schools to one-on-one
        student counseling.
      </Text>
    </View>
  );

  const sectionHeader = (
    <View style={styles.sectionRow}>
      <LogIn size={18} color={WHITE} strokeWidth={2.2} />
      <Text style={styles.sectionTitle}>Log in to your workspace</Text>
      <View style={styles.pickPill}>
        <Text style={styles.pickPillText}>PICK ONE</Text>
      </View>
    </View>
  );

  const b2bCard = (
    <SelectCard
      uid="b2b"
      reduce={reduce}
      float={{ duration: 9000, delay: 0, travel: 14 }}
      accent={BLUE}
      chevronColor={BLUE_SOFT}
      tileBg="rgba(122,167,255,0.16)"
      tileBorder="rgba(122,167,255,0.32)"
      icon={<Building2 size={22} color={BLUE} strokeWidth={2} />}
      title="B2B Sales CRM"
      desc="Field officers, zone & regional heads driving institutional deals."
      onPress={goB2B}
      style={twoPane && styles.cardFlex}
    />
  );

  const b2cCard = (
    <SelectCard
      uid="b2c"
      reduce={reduce}
      float={{ duration: 10500, delay: 650, travel: 14 }}
      accent={GREEN}
      chevronColor={GREEN}
      tileBg="rgba(168,230,184,0.16)"
      tileBorder="rgba(168,230,184,0.32)"
      icon={<GraduationCap size={22} color={GREEN} strokeWidth={2} />}
      title="B2C Sales CRM"
      desc="Counselors & agents guiding students toward enrolment."
      onPress={goB2C}
      style={twoPane && styles.cardFlex}
    />
  );

  const footer = <Text style={styles.footer}>© SingularityCRM · Edtech sales, unified</Text>;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <HeroBackground reduce={reduce} />

      {twoPane ? (
        // ── Tablet landscape (1b): fixed (no-scroll) — hero + cards left (~55%), map right.
        // Content is sized to the viewport so it fills the screen without overflow or scroll. ──
        <View
          style={[
            styles.splitRow,
            { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 20, paddingHorizontal: 48 },
          ]}
        >
          <View style={styles.splitLeft}>
            {brand}
            <View style={styles.splitLeftBody}>
              {heroText}
              <View style={styles.splitSection}>{sectionHeader}</View>
              <View style={styles.cardsRow}>
                {b2bCard}
                {b2cCard}
              </View>
            </View>
            {footer}
          </View>
          <View style={styles.splitRight}>
            <TerritoryMapCard uid="map" reduce={reduce} style={styles.mapCardLandscape} />
          </View>
        </View>
      ) : (
        // ── Phone portrait (1a): single vertical column, map above the section, cards stacked ──
        <ScrollView
          contentContainerStyle={[
            styles.stackScroll,
            { paddingTop: insets.top + 22, paddingBottom: insets.bottom + 24 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {brand}
          <View style={styles.stackBody}>{heroText}</View>
          <TerritoryMapCard uid="map" reduce={reduce} style={styles.mapCardPortrait} />
          <View style={styles.stackSection}>{sectionHeader}</View>
          <View style={styles.cardsCol}>
            {b2bCard}
            {b2cCard}
          </View>
          {footer}
        </ScrollView>
      )}
    </View>
  );
};

/**
 * The last headline line rendered as SVG gradient text (#7aa7ff → #9ad7ff @45% →
 * #a8e6b8), so it reads as one headline flush under "Every conversation". No
 * fontFamily → the system font + fontWeight 700, matching the RN headline above
 * (Poppins is not bundled in this app).
 */
const GradientHeadlineLine = ({ text, fontSize }: { text: string; fontSize: number }) => {
  const w = Math.ceil(fontSize * (text.length * 0.56 + 0.6));
  const h = Math.ceil(fontSize * 1.02);
  return (
    <Svg width={w} height={h}>
      <Defs>
        <LinearGradient id="mf" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#7aa7ff" />
          <Stop offset="0.45" stopColor="#9ad7ff" />
          <Stop offset="1" stopColor="#a8e6b8" />
        </LinearGradient>
      </Defs>
      <SvgText x={0} y={fontSize * 0.8} fill="url(#mf)" fontSize={fontSize} fontWeight="700">
        {text}
      </SvgText>
    </Svg>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: NAVY_BOT },

  // Layout — stacked (phone)
  stackScroll: { flexGrow: 1, paddingHorizontal: 24 },
  stackBody: { marginTop: 30, marginBottom: 24 },
  stackSection: { marginBottom: 2 },

  // Layout — split (tablet landscape). Fixed, no scroll: brand anchors top, footer bottom,
  // hero centered between. The headline is sized to the viewport so it always fits.
  splitRow: { flex: 1, flexDirection: 'row', gap: 40 },
  splitLeft: { width: '55%', justifyContent: 'space-between' },
  splitLeftBody: { flex: 1, justifyContent: 'center' },
  splitSection: { marginTop: 26, marginBottom: 4 },
  splitRight: { flex: 1, justifyContent: 'center' },

  // Territory map card
  mapCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 16,
    overflow: 'hidden',
  },
  mapCardPortrait: { height: 240, marginBottom: 24 },
  mapCardLandscape: { width: '100%', height: 320 },
  mapCanvas: { flex: 1, minHeight: 150 },

  // Brand lockup
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandText: { justifyContent: 'center' },
  wordmark: { fontFamily: Wordmark.bold, color: WHITE, letterSpacing: -0.6 },
  wordmarkAccent: { color: CYAN },
  kicker: {
    color: 'rgba(255,255,255,0.42)',
    fontSize: rf(10),
    fontWeight: '700',
    letterSpacing: 2.5,
    marginTop: 1,
  },

  // Eyebrow
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  eyebrowBar: { width: 26, height: 3, borderRadius: 2, backgroundColor: BLUE },
  eyebrow: {
    color: 'rgba(255,255,255,0.66)',
    fontSize: rf(11),
    fontWeight: '700',
    letterSpacing: 1.6,
  },

  // Headline
  headline: { color: WHITE, fontWeight: '700', letterSpacing: -1 },

  subtext: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: rf(14),
    lineHeight: rf(21),
    marginTop: 20,
  },

  // Section header
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  sectionTitle: { color: WHITE, fontSize: rf(15), fontWeight: '600', flexShrink: 1 },
  pickPill: {
    marginLeft: 'auto',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  pickPillText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: rf(9.5),
    fontWeight: '700',
    letterSpacing: 1,
  },

  // Cards
  cardsCol: { flexDirection: 'column', gap: 10 },
  cardsRow: { flexDirection: 'row', gap: 14 },
  cardFlex: { flex: 1 },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.045)',
    padding: 18,
    overflow: 'hidden',
  },
  cardGlass: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTile: {
    width: 46,
    height: 46,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { color: WHITE, fontSize: rf(17), fontWeight: '700', marginTop: 16 },
  cardDesc: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: rf(13),
    lineHeight: rf(19),
    marginTop: 6,
  },
  cardLoginRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  cardLogin: { fontSize: rf(13.5), fontWeight: '700' },

  // Footer
  footer: {
    color: 'rgba(255,255,255,0.32)',
    fontSize: rf(11),
    marginTop: 22,
  },
});
