/**
 * BackgroundLocationDisclosure.tsx
 *
 * Google Play "Prominent Disclosure and Consent Requirement" compliance.
 *
 * Must be shown as a standalone, full-screen dialog BEFORE the app
 * requests ACCESS_BACKGROUND_LOCATION. It must:
 *   1. Clearly state background location is collected
 *   2. Explain why (travel tracking, allowance calculation, geofence check-ins)
 *   3. Explain how data is used
 *   4. Provide explicit Accept / Decline buttons
 *
 * Reference: https://support.google.com/googleplay/android-developer/answer/9799150
 */
import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Linking,
} from 'react-native';
import { MapPin, Navigation, Clock, Shield, AlertCircle } from 'lucide-react-native';
import { rf } from '../../utils/responsive';
import { useAppTheme } from '../../theme/useAppTheme';
import { withAlpha, SOFT_TINT } from '../../theme';

/**
 * Google Play requires this prominent disclosure before requesting background
 * location, so its COPY AND FLOW ARE COMPLIANCE-CRITICAL and must not change.
 * Only the skin was updated: every surface was hardcoded pre-Sunstone teal
 * (#0D9488 / #F0FDFA / #CCFBF1) on white, which ignored dark mode entirely —
 * an FO starting their day in dark mode got a white sheet with teal icons.
 */

interface Props {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export const BackgroundLocationDisclosure = ({ visible, onAccept, onDecline }: Props) => {
  const T = useAppTheme();
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onDecline}
    >
      <View style={[s.container, { backgroundColor: T.bg }]}>
        {/* Header */}
        <View style={[s.header, { backgroundColor: T.cardAlt, borderBottomColor: T.line }]}>
          <View style={[s.iconCircle, { backgroundColor: T.accentSoft }]}>
            <MapPin size={32} color={T.accent} />
          </View>
          <Text style={[s.title, { color: T.text }]}>Background Location Access</Text>
          <Text style={[s.subtitle, { color: T.sub }]}>SingularityCRM needs your location</Text>
        </View>

        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>

          {/* What we collect */}
          <View style={[s.section, { backgroundColor: T.card, borderColor: T.line }]}>
            <View style={s.sectionHeader}>
              <Navigation size={18} color={T.accent} />
              <Text style={[s.sectionTitle, { color: T.text }]}>What we collect</Text>
            </View>
            <Text style={[s.body, { color: T.sub }]}>
              This app collects your <Text style={[s.bold, { color: T.text }]}>precise GPS location continuously</Text> — including when the app is in the background or closed — while your work day tracking session is active.
            </Text>
          </View>

          {/* Why we need it */}
          <View style={[s.section, { backgroundColor: T.card, borderColor: T.line }]}>
            <View style={s.sectionHeader}>
              <Clock size={18} color={T.accent} />
              <Text style={[s.sectionTitle, { color: T.text }]}>Why we need background location</Text>
            </View>
            <View style={s.bulletList}>
              <BulletItem text="Calculate your daily travel distance and travel allowance accurately, even when you switch to other apps." />
              <BulletItem text="Automatically verify school visits using geofencing (detect when you enter/exit a school's location)." />
              <BulletItem text="Generate a route replay for your manager to review your daily field work." />
              <BulletItem text="Detect suspicious activity (e.g. stationary pings) to protect your allowance claims." />
            </View>
          </View>

          {/* How it is used */}
          <View style={[s.section, { backgroundColor: T.card, borderColor: T.line }]}>
            <View style={s.sectionHeader}>
              <Shield size={18} color={T.accent} />
              <Text style={[s.sectionTitle, { color: T.text }]}>How your data is used</Text>
            </View>
            <View style={s.bulletList}>
              <BulletItem text="Location data is only collected during active tracking sessions (Start Day → End Day)." />
              <BulletItem text="Data is securely transmitted to your company's SingularityCRM server." />
              <BulletItem text="It is used solely for work-related attendance, allowance, and field activity verification." />
              <BulletItem text="Your data is never sold to third parties." />
            </View>
          </View>

          {/* Important note */}
          <View style={[s.noteBox, { backgroundColor: withAlpha(T.warning, SOFT_TINT), borderColor: withAlpha(T.warning, 0.35) }]}>
            <AlertCircle size={16} color={T.warning} />
            <Text style={[s.noteText, { color: T.warning }]}>
              On the next screen, select <Text style={[s.bold, { color: T.text }]}>"Allow all the time"</Text> to enable background location. Without this, travel distance and geofence check-ins will not be recorded when the app is minimised.
            </Text>
          </View>

          {/* Privacy policy link */}
          <TouchableOpacity onPress={() => Linking.openURL('https://singularitycrm.com/privacy-policy')}>
            <Text style={[s.privacyLink, { color: T.accent }]}>View full Privacy Policy →</Text>
          </TouchableOpacity>

        </ScrollView>

        {/* Action buttons */}
        <View style={s.actions}>
          <TouchableOpacity style={[s.declineBtn, { borderColor: T.line }]} onPress={onDecline}>
            <Text style={[s.declineBtnText, { color: T.sub }]}>Decline — Don't track in background</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.acceptBtn, { backgroundColor: T.accent }]} onPress={onAccept}>
            <Text style={s.acceptBtnText}>Accept & Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const BulletItem = ({ text }: { text: string }) => {
  const T = useAppTheme();
  return (
    <View style={s.bulletRow}>
      <View style={[s.bullet, { backgroundColor: T.accent }]} />
      <Text style={[s.bulletText, { color: T.sub }]}>{text}</Text>
    </View>
  );
};

const s = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderBottomWidth: 1,
      },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
        alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: rf(22),
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: rf(15),
    textAlign: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    gap: 20,
    paddingBottom: 8,
  },
  section: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
      },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: rf(15),
    fontWeight: '700',
  },
  body: {
    fontSize: rf(14),
    lineHeight: 22,
  },
  bold: {
    fontWeight: '700',
  },
  bulletList: {
    gap: 8,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  bullet: {
    width: 7,
    height: 7,
    borderRadius: 4,
        marginTop: 7,
    flexShrink: 0,
  },
  bulletText: {
    flex: 1,
    fontSize: rf(14),
    lineHeight: 21,
  },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
        borderRadius: 12,
    padding: 14,
    borderWidth: 1,
      },
  noteText: {
    flex: 1,
    fontSize: rf(13),
    lineHeight: 20,
  },
  privacyLink: {
    fontSize: rf(13),
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 4,
  },
  actions: {
    padding: 20,
    paddingBottom: 36,
    gap: 12,
    borderTopWidth: 1,
    backgroundColor: '#FFF',
  },
  declineBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  declineBtnText: {
    fontSize: rf(14),
    fontWeight: '600',
  },
  acceptBtn: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  acceptBtnText: {
    fontSize: rf(16),
    fontWeight: '700',
    color: '#FFF',
  },
});
