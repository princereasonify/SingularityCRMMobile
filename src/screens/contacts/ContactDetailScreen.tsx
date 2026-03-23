import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Edit2, Phone, Mail, Building2 } from 'lucide-react-native';
import { contactsApi } from '../../api/contacts';
import { Contact } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { LoadingSpinner, EmptyState } from '../../components/common/LoadingSpinner';
import { ROLE_COLORS } from '../../utils/constants';
import { formatRelativeDate } from '../../utils/formatting';
import { rf } from '../../utils/responsive';

const RELATIONSHIP_COLORS: Record<string, string> = {
  New: '#9CA3AF', Warm: '#F59E0B', Strong: '#16A34A',
  Champion: '#7C3AED', Detractor: '#DC2626',
};

export const ContactDetailScreen = ({ navigation, route }: any) => {
  const { contactId } = route.params;
  const { user } = useAuth();
  const role = user?.role || 'FO';
  const COLOR = ROLE_COLORS[role as keyof typeof ROLE_COLORS];

  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    contactsApi.getById(contactId)
      .then(res => setContact(res.data))
      .catch(() => Alert.alert('Error', 'Failed to load contact'))
      .finally(() => setLoading(false));
  }, [contactId]);

  if (loading) return <LoadingSpinner fullScreen color={COLOR.primary} message="Loading..." />;
  if (!contact) return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Contact" color={COLOR.primary} onBack={() => navigation.goBack()} />
      <EmptyState title="Contact not found" icon="👤" />
    </SafeAreaView>
  );

  const canEdit = role === 'FO' || role === 'ZH';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title={contact.name}
        subtitle={contact.designation}
        color={COLOR.primary}
        onBack={() => navigation.goBack()}
        rightAction={canEdit ? (
          <TouchableOpacity onPress={() => navigation.navigate('AddContact', { contact })}>
            <Edit2 size={20} color="#FFF" />
          </TouchableOpacity>
        ) : undefined}
      />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Avatar + Name */}
        <View style={styles.profileCard}>
          <View style={[styles.avatar, { backgroundColor: COLOR.light }]}>
            <Text style={[styles.avatarText, { color: COLOR.primary }]}>
              {contact.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.profileName}>{contact.name}</Text>
          {contact.designation && <Text style={styles.profileDes}>{contact.designation}</Text>}
          {contact.department && <Text style={styles.profileDept}>{contact.department}</Text>}
          <View style={styles.badgeRow}>
            <Badge label={contact.relationship} color={RELATIONSHIP_COLORS[contact.relationship] || '#9CA3AF'} />
            {contact.isDecisionMaker && <Badge label="Decision Maker" color="#16A34A" />}
            {contact.isInfluencer && <Badge label="Influencer" color="#2563EB" />}
          </View>
        </View>

        {/* Contact Info */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Details</Text>
          {contact.phone && (
            <TouchableOpacity style={styles.actionRow} onPress={() => Linking.openURL(`tel:${contact.phone}`)}>
              <View style={[styles.iconBox, { backgroundColor: '#F0FDF4' }]}>
                <Phone size={16} color="#16A34A" />
              </View>
              <View style={styles.actionContent}>
                <Text style={styles.actionLabel}>Phone</Text>
                <Text style={[styles.actionValue, { color: '#16A34A' }]}>{contact.phone}</Text>
              </View>
            </TouchableOpacity>
          )}
          {contact.email && (
            <TouchableOpacity style={styles.actionRow} onPress={() => Linking.openURL(`mailto:${contact.email}`)}>
              <View style={[styles.iconBox, { backgroundColor: '#EFF6FF' }]}>
                <Mail size={16} color="#2563EB" />
              </View>
              <View style={styles.actionContent}>
                <Text style={styles.actionLabel}>Email</Text>
                <Text style={[styles.actionValue, { color: '#2563EB' }]}>{contact.email}</Text>
              </View>
            </TouchableOpacity>
          )}
          {contact.schoolName && (
            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => contact.schoolId && navigation.navigate('SchoolDetail', { schoolId: contact.schoolId })}
            >
              <View style={[styles.iconBox, { backgroundColor: '#FFF7ED' }]}>
                <Building2 size={16} color="#EA580C" />
              </View>
              <View style={styles.actionContent}>
                <Text style={styles.actionLabel}>School</Text>
                <Text style={[styles.actionValue, { color: '#EA580C' }]}>{contact.schoolName}</Text>
              </View>
            </TouchableOpacity>
          )}
        </Card>

        {/* Additional Info */}
        {(contact.profession || contact.personalityNotes || contact.lastContactedAt) && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Additional Info</Text>
            {contact.profession && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Profession</Text>
                <Text style={styles.infoValue}>{contact.profession}</Text>
              </View>
            )}
            {contact.lastContactedAt && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Last Contacted</Text>
                <Text style={styles.infoValue}>{formatRelativeDate(contact.lastContactedAt)}</Text>
              </View>
            )}
            {contact.personalityNotes && (
              <View style={styles.notesBox}>
                <Text style={styles.infoLabel}>Personality Notes</Text>
                <Text style={styles.notesText}>{contact.personalityNotes}</Text>
              </View>
            )}
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  profileCard: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 20,
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  avatarText: { fontSize: rf(28), fontWeight: '700' },
  profileName: { fontSize: rf(20), fontWeight: '700', color: '#111827', marginBottom: 4 },
  profileDes: { fontSize: rf(14), color: '#6B7280', marginBottom: 2 },
  profileDept: { fontSize: rf(13), color: '#9CA3AF', marginBottom: 10 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 },
  section: {},
  sectionTitle: { fontSize: rf(14), fontWeight: '700', color: '#111827', marginBottom: 12 },
  actionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  iconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  actionContent: { flex: 1 },
  actionLabel: { fontSize: rf(11), color: '#9CA3AF', marginBottom: 2 },
  actionValue: { fontSize: rf(14), fontWeight: '600' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  infoLabel: { fontSize: rf(13), color: '#6B7280' },
  infoValue: { fontSize: rf(13), color: '#111827', fontWeight: '500' },
  notesBox: { paddingTop: 8 },
  notesText: { fontSize: rf(13), color: '#374151', marginTop: 4, lineHeight: 20 },
});
