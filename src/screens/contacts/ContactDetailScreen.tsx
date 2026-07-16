import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, Linking,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Edit2, Phone, Mail, Building2, MessageCircle, History, ArrowLeft } from 'lucide-react-native';
import { contactsApi } from '../../api/contacts';
import { Contact } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { GradientBackground } from '../../components/common/GradientBackground';
import { Card, Badge } from '../../components/ui';
import { LoadingSpinner, EmptyState } from '../../components/common/LoadingSpinner';
import { formatRelativeDate } from '../../utils/formatting';
import { Fonts } from '../../theme';
import { useAppTheme } from '../../theme/useAppTheme';
import { rf, isTabletDevice } from '../../utils/responsive';

export const ContactDetailScreen = ({ navigation, route }: any) => {
  const { contactId } = route.params;
  const { user } = useAuth();
  const role = user?.role || 'FO';

  const T = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const twoWide = isTabletDevice && width > height;

  const RELATIONSHIP_COLORS: Record<string, string> = {
    New: T.dim, Warm: T.warning, Strong: T.success,
    Champion: T.info, Detractor: T.danger,
  };

  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    contactsApi.getById(contactId)
      .then(res => setContact(res.data))
      .catch(() => Alert.alert('Error', 'Failed to load contact'))
      .finally(() => setLoading(false));
  }, [contactId]);

  const Hero = ({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) => (
    <GradientBackground glow style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft size={20} color="#FFF" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
          {!!subtitle && <Text style={styles.headerSub} numberOfLines={1}>{subtitle}</Text>}
        </View>
        {right}
      </View>
    </GradientBackground>
  );

  if (loading) return <LoadingSpinner fullScreen color={T.accent} message="Loading..." />;
  if (!contact) return (
    <View style={[styles.root, { backgroundColor: T.bg }]}>
      <Hero title="Contact" />
      <EmptyState title="Contact not found" icon="👤" />
    </View>
  );

  const canEdit = role === 'FO' || role === 'ZH';

  const openWhatsApp = () => {
    if (!contact.phone) return;
    const phone = contact.phone.replace(/[^0-9]/g, '');
    const url = `whatsapp://send?phone=${phone}`;
    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Alert.alert('WhatsApp Not Installed', 'Please install WhatsApp to use this feature.');
      }
    });
  };

  return (
    <View style={[styles.root, { backgroundColor: T.bg }]}>
      <Hero
        title={contact.name}
        subtitle={contact.designation}
        right={
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={() => navigation.navigate('AuditHistory', { entityType: 'Contact', entityId: contact.id, title: contact.name })}
            >
              <History size={18} color="#FFF" />
            </TouchableOpacity>
            {canEdit && (
              <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.navigate('AddContact', { contact })}>
                <Edit2 size={18} color="#FFF" />
              </TouchableOpacity>
            )}
          </View>
        }
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.wrap, twoWide && styles.wrapWide]}>
          {/* Avatar + Name */}
          <Card style={styles.profileCard}>
            <View style={[styles.avatar, { backgroundColor: T.accentSoft }]}>
              <Text style={[styles.avatarText, { color: T.accent }]}>
                {contact.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={[styles.profileName, { color: T.text }]}>{contact.name}</Text>
            {contact.designation && <Text style={[styles.profileDes, { color: T.sub }]}>{contact.designation}</Text>}
            {contact.department && <Text style={[styles.profileDept, { color: T.dim }]}>{contact.department}</Text>}
            <View style={styles.badgeRow}>
              <Badge label={contact.relationship} color={RELATIONSHIP_COLORS[contact.relationship] || T.dim} />
              {contact.isDecisionMaker && <Badge label="Decision Maker" color={T.success} />}
              {contact.isInfluencer && <Badge label="Influencer" color={T.info} />}
            </View>
          </Card>

          {/* Contact Info */}
          <Card>
            <Text style={[styles.sectionTitle, { color: T.text }]}>Contact Details</Text>
            {contact.phone && (
              <>
                <TouchableOpacity style={[styles.actionRow, { borderBottomColor: T.line }]} onPress={() => Linking.openURL(`tel:${contact.phone}`)}>
                  <View style={[styles.iconBox, { backgroundColor: T.success + '22' }]}>
                    <Phone size={16} color={T.success} />
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={[styles.actionLabel, { color: T.dim }]}>Phone</Text>
                    <Text style={[styles.actionValue, { color: T.success }]}>{contact.phone}</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionRow, { borderBottomColor: T.line }]} onPress={openWhatsApp}>
                  <View style={[styles.iconBox, { backgroundColor: T.success + '22' }]}>
                    <MessageCircle size={16} color="#25D366" />
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={[styles.actionLabel, { color: T.dim }]}>WhatsApp</Text>
                    <Text style={[styles.actionValue, { color: '#25D366' }]}>Open in WhatsApp</Text>
                  </View>
                </TouchableOpacity>
              </>
            )}
            {contact.email && (
              <TouchableOpacity style={[styles.actionRow, { borderBottomColor: T.line }]} onPress={() => Linking.openURL(`mailto:${contact.email}`)}>
                <View style={[styles.iconBox, { backgroundColor: T.info + '22' }]}>
                  <Mail size={16} color={T.info} />
                </View>
                <View style={styles.actionContent}>
                  <Text style={[styles.actionLabel, { color: T.dim }]}>Email</Text>
                  <Text style={[styles.actionValue, { color: T.info }]}>{contact.email}</Text>
                </View>
              </TouchableOpacity>
            )}
            {contact.schoolName && (
              <TouchableOpacity
                style={[styles.actionRow, { borderBottomColor: T.line }]}
                onPress={() => contact.schoolId && navigation.navigate('SchoolDetail', { schoolId: contact.schoolId })}
              >
                <View style={[styles.iconBox, { backgroundColor: T.accent + '22' }]}>
                  <Building2 size={16} color={T.accent} />
                </View>
                <View style={styles.actionContent}>
                  <Text style={[styles.actionLabel, { color: T.dim }]}>School</Text>
                  <Text style={[styles.actionValue, { color: T.accent }]}>{contact.schoolName}</Text>
                </View>
              </TouchableOpacity>
            )}
          </Card>

          {/* Additional Info */}
          {(contact.profession || contact.personalityNotes || contact.lastContactedAt) && (
            <Card>
              <Text style={[styles.sectionTitle, { color: T.text }]}>Additional Info</Text>
              {contact.profession && (
                <View style={[styles.infoRow, { borderBottomColor: T.line }]}>
                  <Text style={[styles.infoLabel, { color: T.sub }]}>Profession</Text>
                  <Text style={[styles.infoValue, { color: T.text }]}>{contact.profession}</Text>
                </View>
              )}
              {contact.lastContactedAt && (
                <View style={[styles.infoRow, { borderBottomColor: T.line }]}>
                  <Text style={[styles.infoLabel, { color: T.sub }]}>Last Contacted</Text>
                  <Text style={[styles.infoValue, { color: T.text }]}>{formatRelativeDate(contact.lastContactedAt)}</Text>
                </View>
              )}
              {contact.personalityNotes && (
                <View style={styles.notesBox}>
                  <Text style={[styles.infoLabel, { color: T.sub }]}>Personality Notes</Text>
                  <Text style={[styles.notesText, { color: T.text }]}>{contact.personalityNotes}</Text>
                </View>
              )}
            </Card>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 18 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontFamily: Fonts.bold, fontSize: rf(20), color: '#FFF', letterSpacing: -0.3 },
  headerSub: { fontFamily: Fonts.regular, fontSize: rf(12.5), color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 8 },

  scroll: { flex: 1 },
  content: { padding: 16 },
  wrap: { gap: 12 },
  wrapWide: { maxWidth: 720, width: '100%', alignSelf: 'center' },

  profileCard: { alignItems: 'center', paddingVertical: 20 },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  avatarText: { fontFamily: Fonts.bold, fontSize: rf(28) },
  profileName: { fontFamily: Fonts.bold, fontSize: rf(20), marginBottom: 4 },
  profileDes: { fontFamily: Fonts.regular, fontSize: rf(14), marginBottom: 2 },
  profileDept: { fontFamily: Fonts.regular, fontSize: rf(13), marginBottom: 10 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 },
  sectionTitle: { fontFamily: Fonts.bold, fontSize: rf(14), marginBottom: 12 },
  actionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  iconBox: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  actionContent: { flex: 1 },
  actionLabel: { fontFamily: Fonts.regular, fontSize: rf(11), marginBottom: 2 },
  actionValue: { fontFamily: Fonts.medium, fontSize: rf(14) },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  infoLabel: { fontFamily: Fonts.regular, fontSize: rf(13) },
  infoValue: { fontFamily: Fonts.medium, fontSize: rf(13) },
  notesBox: { paddingTop: 8 },
  notesText: { fontFamily: Fonts.regular, fontSize: rf(13), marginTop: 4, lineHeight: 20 },
});
