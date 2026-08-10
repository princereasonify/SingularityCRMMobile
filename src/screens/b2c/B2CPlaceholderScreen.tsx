import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Hammer } from 'lucide-react-native';
import { useAppTheme } from '../../theme/useAppTheme';
import { rf } from '../../utils/responsive';

/**
 * Phase-2 placeholder. The Agent "Visit" and Counselor "Recording" native flows
 * (geo-verified visit capture, session recording + AI coaching) ship in phase 2;
 * this keeps the routes mountable so navigation compiles today. A `title`/`subtitle`
 * route param lets one component serve both entries.
 */
export const B2CPlaceholderScreen = ({ route }: any) => {
  const T = useAppTheme();
  const title: string = route?.params?.title || route?.name || 'Coming soon';
  const subtitle: string =
    route?.params?.subtitle || 'This experience is on the way — check back after the next update.';

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: T.bg }]} edges={['bottom']}>
      <View style={s.center}>
        <View style={[s.iconWrap, { backgroundColor: T.accentSoft }]}>
          <Hammer size={30} color={T.accent} strokeWidth={1.9} />
        </View>
        <Text style={[s.title, { color: T.text }]}>{title}</Text>
        <Text style={[s.sub, { color: T.sub }]}>{subtitle}</Text>
      </View>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  iconWrap: { width: 72, height: 72, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: rf(18), fontWeight: '800', letterSpacing: -0.3, textAlign: 'center' },
  sub: { fontSize: rf(13), fontWeight: '500', textAlign: 'center', lineHeight: 20, maxWidth: 320 },
});
