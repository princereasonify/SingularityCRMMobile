import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, Phone, CheckCircle, Clock, History, Pencil } from 'lucide-react-native';
import { schoolsApi } from '../../api/schools';
import { contactsApi } from '../../api/contacts';
import { School, Contact, SchoolVisitLog } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { LoadingSpinner, EmptyState } from '../../components/common/LoadingSpinner';
import { ROLE_COLORS } from '../../utils/constants';
import { formatDate, formatRelativeDate } from '../../utils/formatting';
import { rf } from '../../utils/responsive';

const RELATIONSHIP_COLORS: Record<string, string> = {
  New: '#9CA3AF', Warm: '#F59E0B', Strong: '#16A34A',
  Champion: '#7C3AED', Detractor: '#DC2626',
};

const STATUS_COLORS: Record<string, string> = {
  Active: '#16A34A', Inactive: '#9CA3AF', Blacklisted: '#DC2626',
};

export const SchoolDetailScreen = ({ navigation, route }: any) => {
  const { schoolId } = route.params;
  const { user } = useAuth();
  const role = user?.role || 'FO';
  const COLOR = ROLE_COLORS[role as keyof typeof ROLE_COLORS];

  const [school, setSchool] = useState<School | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [visits, setVisits] = useState<SchoolVisitLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const schoolRes = await schoolsApi.getById(schoolId);
        const sd = schoolRes.data as any;
        // Handle both direct object and nested { data: {...} } or { school: {...} }
        setSchool(sd?.school ?? sd ?? null);

        // Fetch contacts — try both endpoint patterns
        try {
          const contactsRes = await contactsApi.getBySchool(schoolId);
          const cd = contactsRes.data as any;
          setContacts(cd?.contacts ?? (Array.isArray(cd) ? cd : []));
        } catch {
          setContacts([]);
        }

        // Fetch visit history
        try {
          const visitsRes = await schoolsApi.getVisitHistory(schoolId);
          const vd = visitsRes.data as any;
          setVisits(vd?.visits ?? (Array.isArray(vd) ? vd : []));
        } catch {
          setVisits([]);
        }
      } catch {
        Alert.alert('Error', 'Failed to load school details');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [schoolId]);

  if (loading) return <LoadingSpinner fullScreen color={COLOR.primary} message="Loading..." />;
  if (!school) return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="School" color={COLOR.primary} onBack={() => navigation.goBack()} />
      <EmptyState title="School not found" icon="🏫" />
    </SafeAreaView>
  );

  const infoRows = [
    { label: 'Board', value: school.board },
    { label: 'Type', value: school.type },
    { label: 'Category', value: school.category },
    { label: 'Address', value: school.fullAddress },
    { label: 'City', value: school.city },
    { label: 'State', value: school.state },
    { label: 'Pincode', value: school.pincode },
    { label: 'Geofence Radius', value: school.geofenceRadiusMeters ? `${school.geofenceRadiusMeters}m` : undefined },
  ].filter(r => r.value);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title={school.name}
        subtitle={`${school.city || ''}${school.state ? `, ${school.state}` : ''}`}
        color={COLOR.primary}
        onBack={() => navigation.goBack()}
        rightAction={
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity onPress={() => navigation.navigate('AddSchool', { school })}>
              <Pencil size={20} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('AuditHistory', { entityType: 'School', entityId: school.id, title: school.name })}>
              <History size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
        }
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Stats Row */}
        <View style={styles.statsRow}>
          {[
            { label: 'Students', value: school.studentCount ?? '—' },
            { label: 'Contacts', value: school.contactCount ?? contacts.length },
            { label: 'Leads', value: school.leadCount ?? '—' },
          ].map(s => (
            <View key={s.label} style={styles.statBox}>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Status + Category */}
        <View style={styles.badgeRow}>
          <Badge label={school.status} color={STATUS_COLORS[school.status] || '#9CA3AF'} />
          {school.isPartnerOffice && <Badge label="Partner Office" color="#7C3AED" />}
          {school.lastVisitDate && (
            <Text style={styles.lastVisit}>Last visited {formatRelativeDate(school.lastVisitDate)}</Text>
          )}
        </View>

        {/* Info Card */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>School Information</Text>
          {infoRows.map(row => (
            <View key={row.label} style={styles.infoRow}>
              <Text style={styles.infoLabel}>{row.label}</Text>
              <Text style={styles.infoValue}>{row.value}</Text>
            </View>
          ))}
        </Card>

        {/* Principal */}
        {(school.principalName || school.principalPhone) && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Principal</Text>
            {school.principalName && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Name</Text>
                <Text style={styles.infoValue}>{school.principalName}</Text>
              </View>
            )}
            {school.principalPhone && (
              <TouchableOpacity style={styles.phoneRow} onPress={() => Linking.openURL(`tel:${school.principalPhone}`)}>
                <Phone size={14} color={COLOR.primary} />
                <Text style={[styles.phoneText, { color: COLOR.primary }]}>{school.principalPhone}</Text>
              </TouchableOpacity>
            )}
          </Card>
        )}

        {/* Contacts */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Contacts ({contacts.length})</Text>
            <TouchableOpacity onPress={() => navigation.navigate('AddContact', { schoolId: school.id, schoolName: school.name })}>
              <Text style={[styles.addLink, { color: COLOR.primary }]}>+ Add</Text>
            </TouchableOpacity>
          </View>
          {contacts.length === 0 ? (
            <Text style={styles.emptyText}>No contacts yet</Text>
          ) : (
            contacts.map(c => (
              <TouchableOpacity
                key={c.id}
                style={styles.contactRow}
                onPress={() => navigation.navigate('ContactDetail', { contactId: c.id })}
              >
                <View style={styles.contactAvatar}>
                  <Text style={styles.avatarText}>{c.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.contactInfo}>
                  <Text style={styles.contactName}>{c.name}</Text>
                  {c.designation && <Text style={styles.contactDes}>{c.designation}</Text>}
                  {c.phone && <Text style={styles.contactPhone}>{c.phone}</Text>}
                </View>
                <Badge
                  label={c.relationship}
                  color={RELATIONSHIP_COLORS[c.relationship] || '#9CA3AF'}
                />
              </TouchableOpacity>
            ))
          )}
        </Card>

        {/* Visit History */}
        {visits.length > 0 && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Visits</Text>
            {visits.slice(0, 5).map((v, i) => (
              <View key={v.id ?? i} style={styles.visitRow}>
                <View style={styles.visitIcon}>
                  {v.isVerified
                    ? <CheckCircle size={16} color="#16A34A" />
                    : <Clock size={16} color="#9CA3AF" />}
                </View>
                <View style={styles.visitInfo}>
                  <Text style={styles.visitDate}>{formatDate(v.enteredAt)}</Text>
                  {v.durationMinutes != null && (
                    <Text style={styles.visitDuration}>{v.durationMinutes} min</Text>
                  )}
                </View>
                {v.hasVisitReport && <Badge label="Report" color="#16A34A" />}
              </View>
            ))}
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
  statsRow: {
    flexDirection: 'row', backgroundColor: '#FFF',
    borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  statBox: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: rf(20), fontWeight: '700', color: '#111827' },
  statLabel: { fontSize: rf(11), color: '#9CA3AF', marginTop: 2 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  lastVisit: { fontSize: rf(12), color: '#9CA3AF' },
  section: { gap: 0 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: rf(14), fontWeight: '700', color: '#111827', marginBottom: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  infoLabel: { fontSize: rf(13), color: '#6B7280' },
  infoValue: { fontSize: rf(13), color: '#111827', fontWeight: '500', flex: 1, textAlign: 'right' },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 8 },
  phoneText: { fontSize: rf(14), fontWeight: '600' },
  addLink: { fontSize: rf(13), fontWeight: '700' },
  emptyText: { fontSize: rf(13), color: '#9CA3AF', textAlign: 'center', paddingVertical: 8 },
  contactRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', gap: 12 },
  contactAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#E0E7FF', alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: rf(14), fontWeight: '700', color: '#4338CA' },
  contactInfo: { flex: 1 },
  contactName: { fontSize: rf(14), fontWeight: '600', color: '#111827' },
  contactDes: { fontSize: rf(12), color: '#6B7280' },
  contactPhone: { fontSize: rf(12), color: '#9CA3AF' },
  visitRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  visitIcon: { width: 24, alignItems: 'center' },
  visitInfo: { flex: 1 },
  visitDate: { fontSize: rf(13), fontWeight: '600', color: '#111827' },
  visitDuration: { fontSize: rf(12), color: '#6B7280' },
});
