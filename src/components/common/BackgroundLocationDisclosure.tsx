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

interface Props {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export const BackgroundLocationDisclosure = ({ visible, onAccept, onDecline }: Props) => {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onDecline}
    >
      <View style={s.container}>
        {/* Header */}
        <View style={s.header}>
          <View style={s.iconCircle}>
            <MapPin size={32} color="#0D9488" />
          </View>
          <Text style={s.title}>Background Location Access</Text>
          <Text style={s.subtitle}>SingularityCRM needs your location</Text>
        </View>

        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>

          {/* What we collect */}
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Navigation size={18} color="#0D9488" />
              <Text style={s.sectionTitle}>What we collect</Text>
            </View>
            <Text style={s.body}>
              This app collects your <Text style={s.bold}>precise GPS location continuously</Text> — including when the app is in the background or closed — while your work day tracking session is active.
            </Text>
          </View>

          {/* Why we need it */}
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Clock size={18} color="#0D9488" />
              <Text style={s.sectionTitle}>Why we need background location</Text>
            </View>
            <View style={s.bulletList}>
              <BulletItem text="Calculate your daily travel distance and travel allowance accurately, even when you switch to other apps." />
              <BulletItem text="Automatically verify school visits using geofencing (detect when you enter/exit a school's location)." />
              <BulletItem text="Generate a route replay for your manager to review your daily field work." />
              <BulletItem text="Detect suspicious activity (e.g. stationary pings) to protect your allowance claims." />
            </View>
          </View>

          {/* How it is used */}
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Shield size={18} color="#0D9488" />
              <Text style={s.sectionTitle}>How your data is used</Text>
            </View>
            <View style={s.bulletList}>
              <BulletItem text="Location data is only collected during active tracking sessions (Start Day → End Day)." />
              <BulletItem text="Data is securely transmitted to your company's SingularityCRM server." />
              <BulletItem text="It is used solely for work-related attendance, allowance, and field activity verification." />
              <BulletItem text="Your data is never sold to third parties." />
            </View>
          </View>

          {/* Important note */}
          <View style={s.noteBox}>
            <AlertCircle size={16} color="#D97706" />
            <Text style={s.noteText}>
              On the next screen, select <Text style={s.bold}>"Allow all the time"</Text> to enable background location. Without this, travel distance and geofence check-ins will not be recorded when the app is minimised.
            </Text>
          </View>

          {/* Privacy policy link */}
          <TouchableOpacity onPress={() => Linking.openURL('https://singularitycrm.com/privacy-policy')}>
            <Text style={s.privacyLink}>View full Privacy Policy →</Text>
          </TouchableOpacity>

        </ScrollView>

        {/* Action buttons */}
        <View style={s.actions}>
          <TouchableOpacity style={s.declineBtn} onPress={onDecline}>
            <Text style={s.declineBtnText}>Decline — Don't track in background</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.acceptBtn} onPress={onAccept}>
            <Text style={s.acceptBtnText}>Accept & Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const BulletItem = ({ text }: { text: string }) => (
  <View style={s.bulletRow}>
    <View style={s.bullet} />
    <Text style={s.bulletText}>{text}</Text>
  </View>
);

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  header: {
    backgroundColor: '#F0FDFA',
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#CCFBF1',
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: rf(22),
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: rf(15),
    color: '#6B7280',
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
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
    color: '#111827',
  },
  body: {
    fontSize: rf(14),
    color: '#374151',
    lineHeight: 22,
  },
  bold: {
    fontWeight: '700',
    color: '#111827',
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
    backgroundColor: '#0D9488',
    marginTop: 7,
    flexShrink: 0,
  },
  bulletText: {
    flex: 1,
    fontSize: rf(14),
    color: '#374151',
    lineHeight: 21,
  },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  noteText: {
    flex: 1,
    fontSize: rf(13),
    color: '#92400E',
    lineHeight: 20,
  },
  privacyLink: {
    fontSize: rf(13),
    color: '#0D9488',
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 4,
  },
  actions: {
    padding: 20,
    paddingBottom: 36,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    backgroundColor: '#FFF',
  },
  declineBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    alignItems: 'center',
  },
  declineBtnText: {
    fontSize: rf(14),
    fontWeight: '600',
    color: '#6B7280',
  },
  acceptBtn: {
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#0D9488',
    alignItems: 'center',
  },
  acceptBtnText: {
    fontSize: rf(16),
    fontWeight: '700',
    color: '#FFF',
  },
});
