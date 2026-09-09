import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  StatusBar,
  Linking,
  Alert,
  Animated,
  Easing,
  Platform,
  AccessibilityInfo,
} from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  Rect,
  Circle,
  Line,
  Path,
  Text as SvgText,
} from 'react-native-svg';
import { SvgCss } from 'react-native-svg/css';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { ArrowLeft } from 'lucide-react-native';
import { rf, isTabletDevice } from '../../utils/responsive';
import { applyLoginOrientation } from '../../utils/orientation';
import { singularityLearnXml } from '../../assets/singularityLearnXml';

const REASONIFY_URL = 'https://reasonify.in/';
const STUDENT_IMG = require('../../assets/student-section-1.png');
// The one brand logo on this page: the "SINGULARITY Learn" lockup. The ratio is the
// TRIMMED viewBox (977.8 x 185.2) — the export's original 1080x291 canvas was ~19%
// dead space top and bottom, which would have reserved phantom height here.
const LOGO_RATIO = 185.2 / 977.8;
const BTN_H = 44;

// Palette taken verbatim from the Reasonify About Us section's theme so this screen
// matches that page (and the SalesCRM web /about-us) exactly. Deliberately NOT the
// app's Sunstone theme: the page keeps its own purple in light and dark alike.
const C = {
  primary: '#7B19D8',
  secondary: '#21786E',
  purpleDark: '#7c3aed',
  purpleStrong: '#a855f7',
  indigoDeep: '#1e1b4b',
  darkGrayLine: '#374151',
  grayTextTertiary: '#4b5563',
  gray: '#6B7280',
  white: '#FFFFFF',
  cardBg: '#f8f7ff',
  cardLine: 'rgba(167,139,250,0.16)',
  imageBg: '#f0eeff',
  blue: '#60a5fa',
  indigo: '#818cf8',
  purpleLight: '#c084fc',
  teal: '#22c4b4',
};

/**
 * Public "About Us" screen, reached from the Landing footer, the Sign-in screen and
 * the Sign-up screen — a port of the Reasonify About Us section: same layout, same
 * photo, same copy, same purple palette, with the Reasonify trademark at the foot.
 *
 * Phones render the source page's <960px behaviour (stacked and centred); tablets in
 * landscape render its two-column layout.
 */
export const AboutUsScreen = ({ navigation }: any) => {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const twoPane = isTabletDevice && width > height;
  const circle = twoPane ? 340 : 280;
  const [btnW, setBtnW] = useState(0);
  // Header lockup: sits beside the Back chip, so it takes the width left over
  // after that control and the gutters — clamped so it never crowds or shrinks away.
  const logoW = twoPane ? 200 : Math.max(120, Math.min(165, width - 44 - 100 - 14));

  useFocusEffect(
    useCallback(() => {
      applyLoginOrientation();
    }, []),
  );

  // ─── Motion (respects Reduce Motion) ────────────────────────────────────────
  const reduceMotion = useRef(false);
  const spin = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;
    const loops: Animated.CompositeAnimation[] = [];

    const start = () => {
      if (cancelled) return;

      Animated.timing(enter, {
        toValue: 1,
        duration: 600,
        delay: 80,
        useNativeDriver: true,
      }).start();

      if (reduceMotion.current) return;

      // 8s ring rotation + 4s orb float, matching the source page's keyframes.
      const ring = Animated.loop(
        Animated.timing(spin, {
          toValue: 1,
          duration: 8000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
      const bob = Animated.loop(
        Animated.sequence([
          Animated.timing(float, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(float, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
      );
      loops.push(ring, bob);
      ring.start();
      bob.start();
    };

    AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => {
        reduceMotion.current = !!on;
        start();
      })
      .catch(() => start());

    return () => {
      cancelled = true;
      loops.forEach((l) => l.stop());
    };
  }, [enter, spin, float]);

  const ringSpin = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const orbY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -12] });
  const fadeUp = {
    opacity: enter,
    transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) }],
  };

  // Opens reasonify.in in the device browser.
  //
  // Deliberately NOT guarded by Linking.canOpenURL: from Android 11 (this app targets
  // SDK 36) package-visibility filtering makes canOpenURL return false for https URLs
  // unless the manifest declares a matching <queries> intent, so the guard would
  // reject the link on every modern Android device even with a browser installed.
  // openURL itself is not filtered — it either launches the browser or throws.
  const openReasonify = async () => {
    try {
      await Linking.openURL(REASONIFY_URL);
    } catch {
      Alert.alert('Cannot open link', 'Please visit reasonify.in in your browser.');
    }
  };

  // ─── Circular photo with the spinning ring and the two orbs ─────────────────
  const imageBlock = (
    <Animated.View style={[{ width: circle, height: circle }, fadeUp]}>
      {/* Ring — a gradient-stroked circle rotating in place (RN has no conic-gradient) */}
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          { margin: -6, transform: [{ rotate: ringSpin }] },
        ]}
      >
        <Svg width={circle + 12} height={circle + 12}>
          <Defs>
            <LinearGradient id="aboutRing" x1="0" y1="0" x2={circle + 12} y2={circle + 12} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor="#a78bfa" stopOpacity="1" />
              <Stop offset="0.3" stopColor="#c4b5fd" stopOpacity="0.55" />
              <Stop offset="0.55" stopColor="#7c3aed" stopOpacity="0.28" />
              <Stop offset="0.8" stopColor="#d8b4fe" stopOpacity="0.9" />
              <Stop offset="1" stopColor="#a78bfa" stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Circle
            cx={(circle + 12) / 2}
            cy={(circle + 12) / 2}
            r={(circle + 12) / 2 - 3}
            stroke="url(#aboutRing)"
            strokeWidth={6}
            fill="none"
          />
        </Svg>
      </Animated.View>

      {/* Photo */}
      <View
        style={[
          styles.photoWrap,
          { width: circle, height: circle, borderRadius: circle / 2, backgroundColor: C.imageBg },
        ]}
      >
        <Image source={STUDENT_IMG} style={styles.photo} resizeMode="cover" />
      </View>

      {/* Orbs */}
      <Animated.View
        style={[styles.orb, { top: circle * 0.16, right: -16, transform: [{ translateY: orbY }] }]}
      >
        <Svg width={40} height={40}>
          <Defs>
            <LinearGradient id="aboutOrbBlue" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={C.blue} />
              <Stop offset="1" stopColor={C.indigo} />
            </LinearGradient>
          </Defs>
          <Circle cx={20} cy={20} r={20} fill="url(#aboutOrbBlue)" opacity={0.8} />
        </Svg>
      </Animated.View>

      <Animated.View
        style={[styles.orb, { bottom: circle * 0.18, left: -12, transform: [{ translateY: orbY }] }]}
      >
        <Svg width={52} height={52}>
          <Defs>
            <LinearGradient id="aboutOrbViolet" x1="0" y1="0" x2="52" y2="52" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={C.purpleLight} />
              <Stop offset="1" stopColor={C.purpleStrong} />
            </LinearGradient>
          </Defs>
          <Circle cx={26} cy={26} r={26} fill="url(#aboutOrbViolet)" opacity={0.78} />
        </Svg>
      </Animated.View>
    </Animated.View>
  );

  // ─── Copy column ────────────────────────────────────────────────────────────
  const contentBlock = (
    <Animated.View style={[twoPane ? styles.contentColWide : styles.contentColStacked, fadeUp]}>
      <Text style={[styles.mainTitle, twoPane && styles.textLeft]}>Singularity Learn</Text>

      <Text style={[styles.subTitle, twoPane && styles.textLeft]}>
        AI-Powered Teaching Aid by{' '}
        <Text style={styles.link} onPress={openReasonify}>
          Reasonify Technology Pvt. Ltd.
        </Text>
      </Text>

      <Text style={[styles.tagline, twoPane && styles.textLeft]}>EXPANDING BEYOND OBVIOUS</Text>

      <View style={[styles.accent, twoPane && styles.selfStart]}>
        <Svg width={46} height={3}>
          <Defs>
            <LinearGradient id="aboutAccent" x1="0" y1="0" x2="46" y2="0" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={C.primary} />
              <Stop offset="1" stopColor={C.purpleStrong} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="46" height="3" rx="1.5" fill="url(#aboutAccent)" />
        </Svg>
      </View>

      <Text style={[styles.body, twoPane && styles.textLeft]}>
        <Text style={styles.bodyStrong}>SINGULARITY</Text>, is redefining K-12 education through
        adaptive learning systems that respond to individual learning patterns — integrating
        seamlessly into real-world workflows.
      </Text>

      <TouchableOpacity
        onPress={openReasonify}
        activeOpacity={0.85}
        onLayout={(e) => setBtnW(e.nativeEvent.layout.width)}
        style={[styles.discover, twoPane && styles.selfStart]}
        accessibilityRole="link"
        accessibilityLabel="Discover Singularity at reasonify.in"
      >
        {btnW > 0 && (
          <Svg style={StyleSheet.absoluteFill} width={btnW} height={BTN_H}>
            <Defs>
              <LinearGradient id="aboutBtn" x1="0" y1="0" x2={btnW} y2={BTN_H} gradientUnits="userSpaceOnUse">
                <Stop offset="0" stopColor={C.primary} />
                <Stop offset="1" stopColor={C.purpleDark} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width={btnW} height={BTN_H} rx={BTN_H / 2} fill="url(#aboutBtn)" />
          </Svg>
        )}
        <Text style={styles.discoverText}>Discover Singularity →</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.white} />

      {/* Background blobs */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg style={StyleSheet.absoluteFill} width={width} height={height}>
          <Defs>
            <RadialGradient id="blobTR" cx="0.4" cy="0.4" r="0.5">
              <Stop offset="0" stopColor="#c084fc" stopOpacity="0.4" />
              <Stop offset="0.45" stopColor="#a78bfa" stopOpacity="0.22" />
              <Stop offset="1" stopColor="#d8b4fe" stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id="blobBL" cx="0.6" cy="0.6" r="0.5">
              <Stop offset="0" stopColor="#a78bfa" stopOpacity="0.3" />
              <Stop offset="0.5" stopColor="#c4b5fd" stopOpacity="0.14" />
              <Stop offset="1" stopColor="#c4b5fd" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx={width + 40} cy={40} r={260} fill="url(#blobTR)" />
          <Circle cx={-40} cy={height * 0.62} r={190} fill="url(#blobBL)" />
        </Svg>
      </View>

      {/* Header: back to the CRM, with the page's single brand logo beside it */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          style={styles.backChip}
          onPress={() => navigation.goBack()}
          activeOpacity={0.85}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={16} color={C.primary} strokeWidth={2.6} />
          <Text style={styles.backChipText}>Back</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={openReasonify}
          activeOpacity={0.75}
          accessibilityRole="link"
          accessibilityLabel="Singularity Learn — open reasonify.in"
        >
          <SvgCss xml={singularityLearnXml} width={logoW} height={logoW * LOGO_RATIO} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: 18, paddingBottom: insets.bottom + 28 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* "About Us" — drawn as SVG text so the fill can be the purple gradient */}
        <AboutUsTitle size={twoPane ? rf(40) : rf(32)} />

        {twoPane ? (
          <View style={styles.twoCol}>
            <View>{imageBlock}</View>
            {contentBlock}
          </View>
        ) : (
          <>
            <View style={styles.imageCentered}>{imageBlock}</View>
            {contentBlock}
          </>
        )}

        {/* Mission / Vision */}
        <View style={[styles.cards, twoPane && styles.cardsRow]}>
          <PillarCard
            gradId="aboutMission"
            from={C.primary}
            to={C.purpleStrong}
            icon={<MissionIcon />}
            title="Mission"
            body="Our mission is to empower educators and learners through AI-powered education, personalized learning, and intelligent EdTech solutions that transform traditional teaching into interactive, data-driven, and adaptive learning experiences."
            bullets={[
              'Leverage AI, ML, and learning analytics to enhance engagement and enable scalable digital education.',
              'Build smart classrooms and future-ready ecosystems bridging technology and education.',
            ]}
            wide={twoPane}
          />
          <PillarCard
            gradId="aboutVision"
            from={C.secondary}
            to={C.teal}
            icon={<VisionIcon />}
            title="Vision"
            body="Our vision is to redefine the future of education through AI-driven learning platforms, concept-based education, and self-paced digital learning, enabling every student to achieve their full potential in a technology-first world."
            bullets={[
              'Cultivate critical thinking, creativity, collaboration, and communication through immersive learning.',
              'A globally connected EdTech ecosystem — making high-quality education accessible and impactful for all.',
            ]}
            wide={twoPane}
          />
        </View>

        {/* Trademark */}
        <View style={styles.legal}>
          <Text style={styles.legalText}>
            <Text style={styles.legalStrong}>Singularity™</Text> and{' '}
            <Text style={styles.legalStrong}>SingularityCRM™</Text> are trademarks of{' '}
            <Text style={styles.link} onPress={openReasonify}>
              Reasonify Technology Pvt. Ltd.
            </Text>
          </Text>
          <Text style={[styles.legalText, styles.legalSecondLine]}>
            © {new Date().getFullYear()} Reasonify Technology Pvt. Ltd. · All rights reserved.
          </Text>
        </View>
      </ScrollView>


    </View>
  );
};

/* ─── "About Us" gradient headline ──────────────────────────────────────────── */
const AboutUsTitle = ({ size }: { size: number }) => {
  const text = 'About Us';
  const w = Math.ceil(size * (text.length * 0.58 + 0.8));
  const h = Math.ceil(size * 1.34);
  return (
    <View style={styles.titleWrap}>
      <Svg width={w} height={h}>
        <Defs>
          <LinearGradient id="aboutTitle" x1="0" y1="0" x2={w} y2={h} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={C.primary} />
            <Stop offset="0.6" stopColor={C.purpleDark} />
            <Stop offset="1" stopColor={C.purpleStrong} />
          </LinearGradient>
        </Defs>
        <SvgText
          x={w / 2}
          y={size}
          textAnchor="middle"
          fill="url(#aboutTitle)"
          fontSize={size}
          fontWeight="800"
        >
          {text}
        </SvgText>
      </Svg>
    </View>
  );
};

/* ─── Mission / Vision card ─────────────────────────────────────────────────── */
const TILE = 52;
const PillarCard = ({
  gradId,
  from,
  to,
  icon,
  title,
  body,
  bullets,
  wide,
}: {
  gradId: string;
  from: string;
  to: string;
  icon: React.ReactNode;
  title: string;
  body: string;
  bullets: string[];
  wide: boolean;
}) => (
  <View style={[styles.card, wide && styles.cardHalf]}>
    <View style={styles.cardHead}>
      <View style={styles.cardTile}>
        <Svg style={StyleSheet.absoluteFill} width={TILE} height={TILE}>
          <Defs>
            <LinearGradient id={gradId} x1="0" y1="0" x2={TILE} y2={TILE} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={from} />
              <Stop offset="1" stopColor={to} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width={TILE} height={TILE} rx={14} fill={`url(#${gradId})`} />
        </Svg>
        {icon}
      </View>

      <View>
        <Text style={styles.cardTitle}>{title}</Text>
        <View style={[styles.cardRule, { backgroundColor: to }]} />
      </View>
    </View>

    <Text style={styles.cardBody}>{body}</Text>

    {bullets.map((b) => (
      <View key={b} style={styles.bulletRow}>
        <Text style={styles.bulletDot}>•</Text>
        <Text style={styles.bulletText}>{b}</Text>
      </View>
    ))}
  </View>
);

/* ─── Icons (same paths as the source page) ─────────────────────────────────── */
const MissionIcon = () => (
  <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="9" stroke={C.white} strokeWidth="2" />
    <Circle cx="12" cy="12" r="5.5" stroke={C.white} strokeWidth="1.8" />
    <Circle cx="12" cy="12" r="2" fill={C.white} />
    <Line x1="12" y1="3" x2="12" y2="1" stroke={C.white} strokeWidth="2" strokeLinecap="round" />
    <Line x1="12" y1="23" x2="12" y2="21" stroke={C.white} strokeWidth="2" strokeLinecap="round" />
    <Line x1="3" y1="12" x2="1" y2="12" stroke={C.white} strokeWidth="2" strokeLinecap="round" />
    <Line x1="23" y1="12" x2="21" y2="12" stroke={C.white} strokeWidth="2" strokeLinecap="round" />
  </Svg>
);

const VisionIcon = () => (
  <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 5C7 5 3 9.5 3 12C3 14.5 7 19 12 19C17 19 21 14.5 21 12C21 9.5 17 5 12 5Z"
      stroke={C.white}
      strokeWidth="2"
      strokeLinejoin="round"
    />
    <Circle cx="12" cy="12" r="3.5" stroke={C.white} strokeWidth="2" />
    <Circle cx="12" cy="12" r="1.2" fill={C.white} />
    <Path d="M12 2V4M12 20V22M2 12H4M20 12H22" stroke={C.white} strokeWidth="1.8" strokeLinecap="round" />
  </Svg>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.white },
  scroll: { paddingHorizontal: 22, flexGrow: 1 },
  selfStart: { alignSelf: 'flex-start' },

  // Back control
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 18,
    paddingBottom: 4,
  },
  backChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 36,
    paddingLeft: 11,
    paddingRight: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.22)',
    backgroundColor: C.white,
    ...Platform.select({
      ios: {
        shadowColor: '#7c3aed',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.16,
        shadowRadius: 10,
      },
      android: { elevation: 4 },
    }),
  },
  backChipText: { color: C.primary, fontSize: rf(13.5), fontWeight: '800' },

  titleWrap: { alignSelf: 'center', marginBottom: 26 },

  // Two-column (tablet landscape)
  twoCol: { flexDirection: 'row', alignItems: 'flex-start', gap: 40 },

  // Image
  imageCentered: { alignItems: 'center' },
  photoWrap: { overflow: 'hidden' },
  photo: { width: '100%', height: '100%' },
  orb: { position: 'absolute', zIndex: 4 },

  // Content
  contentColStacked: { alignItems: 'center', width: '100%', marginTop: 26, gap: 12 },
  contentColWide: { flex: 1, minWidth: 0, gap: 12 },
  textLeft: { textAlign: 'left' },

  mainTitle: {
    fontSize: rf(28),
    fontWeight: '800',
    color: C.indigoDeep,
    lineHeight: rf(34),
    textAlign: 'center',
  },
  subTitle: {
    fontSize: rf(14.5),
    fontWeight: '500',
    color: C.darkGrayLine,
    lineHeight: rf(23),
    textAlign: 'center',
  },
  link: { color: C.primary, fontWeight: '700' },
  tagline: { fontSize: rf(12.5), color: C.gray, textAlign: 'center' },
  accent: { alignSelf: 'center' },
  body: {
    fontSize: rf(13.5),
    lineHeight: rf(24),
    color: C.grayTextTertiary,
    textAlign: 'center',
  },
  bodyStrong: { color: C.primary, fontWeight: '700' },

  discover: {
    alignSelf: 'center',
    height: BTN_H,
    minWidth: 210,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    marginTop: 6,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#7c3aed',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
      },
      android: { elevation: 6 },
    }),
  },
  discoverText: { color: C.white, fontSize: rf(14.5), fontWeight: '700' },

  // Mission / Vision
  cards: { marginTop: 32, gap: 18 },
  cardsRow: { flexDirection: 'row' },
  card: {
    backgroundColor: C.cardBg,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.cardLine,
    padding: 20,
    gap: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#7c3aed',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 18,
      },
      android: { elevation: 2 },
    }),
  },
  cardHalf: { flex: 1 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  cardTile: {
    width: TILE,
    height: TILE,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cardTitle: { fontSize: rf(17), fontWeight: '700', color: C.indigoDeep },
  cardRule: { width: 32, height: 2.5, borderRadius: 2, marginTop: 6 },
  cardBody: { fontSize: rf(13), lineHeight: rf(23), color: C.grayTextTertiary },
  bulletRow: { flexDirection: 'row', gap: 8, paddingLeft: 2 },
  bulletDot: { fontSize: rf(12.5), lineHeight: rf(21), color: C.gray },
  bulletText: { flex: 1, fontSize: rf(12.5), lineHeight: rf(21), color: C.gray },

  // Trademark
  legal: {
    marginTop: 30,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(167,139,250,0.22)',
  },
  legalText: {
    fontSize: rf(11.5),
    lineHeight: rf(19),
    color: C.gray,
    textAlign: 'center',
  },
  legalSecondLine: { marginTop: 6 },
  legalStrong: { color: C.indigoDeep, fontWeight: '700' },
});
