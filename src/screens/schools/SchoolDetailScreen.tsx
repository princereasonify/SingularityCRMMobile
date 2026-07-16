import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, Linking, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Phone, CheckCircle, Clock, History, Pencil } from 'lucide-react-native';
import { schoolsApi } from '../../api/schools';
import { contactsApi } from '../../api/contacts';
import { School, Contact, SchoolVisitLog } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Screen, AppHeader, Card, Badge } from '../../components/ui';
import { LoadingSpinner, EmptyState } from '../../components/common/LoadingSpinner';
import { formatDate, formatRelativeDate } from '../../utils/formatting';
import { rf, isTabletDevice } from '../../utils/responsive';
import { Fonts } from '../../theme';
import { useAppTheme } from '../../theme/useAppTheme';

export const SchoolDetailScreen = ({ navigation, route }: any) => {
  const { schoolId } = route.params;
  const { user } = useAuth();
  const T = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const twoWide = isTabletDevice && width > height;

  const RELATIONSHIP_COLORS: Record<string, string> = {
    New: T.dim, Warm: T.warning, Strong: T.success,
    Champion: '#7C3AED', Detractor: T.danger,
  };
  const STATUS_COLORS: Record<string, string> = {
    Active: T.success, Inactive: T.dim, Blacklisted: T.danger,
  };

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

  if (loading) return <LoadingSpinner fullScreen color={T.accent} message="Loading..." />;
  if (!school) return (
    <Screen>
      <AppHeader title="School" onBack={() => navigation.goBack()} />
      <EmptyState title="School not found" icon="🏫" />
    </Screen>
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

  const headerRight = (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <TouchableOpacity
        onPress={() => navigation.navigate('AddSchool', { school })}
        style={[styles.hIcon, { backgroundColor: T.card, borderColor: T.line }]}
      >
        <Pencil size={18} color={T.accent} />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => navigation.navigate('AuditHistory', { entityType: 'School', entityId: school.id, title: school.name })}
        style={[styles.hIcon, { backgroundColor: T.card, borderColor: T.line }]}
      >
        <History size={18} color={T.accent} />
      </TouchableOpacity>
    </View>
  );

  return (
    <Screen>
      <AppHeader
        title={school.name}
        subtitle={`${school.city || ''}${school.state ? `, ${school.state}` : ''}`}
        onBack={() => navigation.goBack()}
        right={headerRight}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }, twoWide && styles.contentWide]}
        showsVerticalScrollIndicator={false}
      >
        {/* Stats Row */}
        <Card style={styles.statsRow}>
          {[
            { label: 'Students', value: school.studentCount ?? '—' },
            { label: 'Contacts', value: school.contactCount ?? contacts.length },
            { label: 'Leads', value: school.leadCount ?? '—' },
          ].map((s, i) => (
            <View
              key={s.label}
              style={[styles.statBox, i > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: T.line }]}
            >
              <Text style={[styles.statValue, { color: T.text }]}>{s.value}</Text>
              <Text style={[styles.statLabel, { color: T.sub }]}>{s.label}</Text>
            </View>
          ))}
        </Card>

        {/* Status + Category */}
        <View style={styles.badgeRow}>
          <Badge label={school.status} color={STATUS_COLORS[school.status] || T.dim} />
          {school.isPartnerOffice && <Badge label="Partner Office" color="#7C3AED" />}
          {school.lastVisitDate && (
            <Text style={[styles.lastVisit, { color: T.sub }]}>Last visited {formatRelativeDate(school.lastVisitDate)}</Text>
          )}
        </View>

        {/* Info Card */}
        <Card>
          <Text style={[styles.sectionTitle, { color: T.text }]}>School Information</Text>
          {infoRows.map((row, i) => (
            <View
              key={row.label}
              style={[styles.infoRow, i < infoRows.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.line }]}
            >
              <Text style={[styles.infoLabel, { color: T.sub }]}>{row.label}</Text>
              <Text style={[styles.infoValue, { color: T.text }]}>{row.value}</Text>
            </View>
          ))}
        </Card>

        {/* Principal */}
        {(school.principalName || school.principalPhone) && (
          <Card>
            <Text style={[styles.sectionTitle, { color: T.text }]}>Principal</Text>
            {school.principalName && (
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: T.sub }]}>Name</Text>
                <Text style={[styles.infoValue, { color: T.text }]}>{school.principalName}</Text>
              </View>
            )}
            {school.principalPhone && (
              <TouchableOpacity style={styles.phoneRow} onPress={() => Linking.openURL(`tel:${school.principalPhone}`)}>
                <Phone size={14} color={T.accent} />
                <Text style={[styles.phoneText, { color: T.accent }]}>{school.principalPhone}</Text>
              </TouchableOpacity>
            )}
          </Card>
        )}

        {/* Contacts */}
        <Card>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: T.text, marginBottom: 0 }]}>Contacts ({contacts.length})</Text>
            <TouchableOpacity onPress={() => navigation.navigate('AddContact', { schoolId: school.id, schoolName: school.name })}>
              <Text style={[styles.addLink, { color: T.accent }]}>+ Add</Text>
            </TouchableOpacity>
          </View>
          {contacts.length === 0 ? (
            <Text style={[styles.emptyText, { color: T.dim }]}>No contacts yet</Text>
          ) : (
            contacts.map((c, i) => (
              <TouchableOpacity
                key={c.id}
                style={[styles.contactRow, i < contacts.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.line }]}
                onPress={() => navigation.navigate('ContactDetail', { contactId: c.id })}
              >
                <View style={[styles.contactAvatar, { backgroundColor: T.accentSoft }]}>
                  <Text style={[styles.avatarText, { color: T.accent }]}>{c.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.contactInfo}>
                  <Text style={[styles.contactName, { color: T.text }]}>{c.name}</Text>
                  {c.designation && <Text style={[styles.contactDes, { color: T.sub }]}>{c.designation}</Text>}
                  {c.phone && <Text style={[styles.contactPhone, { color: T.dim }]}>{c.phone}</Text>}
                </View>
                <Badge
                  label={c.relationship}
                  color={RELATIONSHIP_COLORS[c.relationship] || T.dim}
                />
              </TouchableOpacity>
            ))
          )}
        </Card>

        {/* Visit History */}
        {visits.length > 0 && (
          <Card>
            <Text style={[styles.sectionTitle, { color: T.text }]}>Recent Visits</Text>
            {visits.slice(0, 5).map((v, i) => (
              <View
                key={v.id ?? i}
                style={[styles.visitRow, i < Math.min(visits.length, 5) - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.line }]}
              >
                <View style={styles.visitIcon}>
                  {v.isVerified
                    ? <CheckCircle size={16} color={T.success} />
                    : <Clock size={16} color={T.dim} />}
                </View>
                <View style={styles.visitInfo}>
                  <Text style={[styles.visitDate, { color: T.text }]}>{formatDate(v.enteredAt)}</Text>
                  {v.durationMinutes != null && (
                    <Text style={[styles.visitDuration, { color: T.sub }]}>{v.durationMinutes} min</Text>
                  )}
                </View>
                {v.hasVisitReport && <Badge label="Report" color={T.success} />}
              </View>
            ))}
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  contentWide: { maxWidth: 720, width: '100%', alignSelf: 'center' },
  hIcon: {
    width: 40, height: 40, borderRadius: 12, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  statsRow: { flexDirection: 'row', padding: 16 },
  statBox: { flex: 1, alignItems: 'center' },
  statValue: { fontFamily: Fonts.bold, fontSize: rf(20), letterSpacing: -0.4 },
  statLabel: { fontFamily: Fonts.medium, fontSize: rf(11), marginTop: 2 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  lastVisit: { fontFamily: Fonts.regular, fontSize: rf(12) },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontFamily: Fonts.bold, fontSize: rf(14), marginBottom: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, gap: 12 },
  infoLabel: { fontFamily: Fonts.regular, fontSize: rf(13) },
  infoValue: { fontFamily: Fonts.medium, fontSize: rf(13), flex: 1, textAlign: 'right' },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 8 },
  phoneText: { fontFamily: Fonts.bold, fontSize: rf(14) },
  addLink: { fontFamily: Fonts.bold, fontSize: rf(13) },
  emptyText: { fontFamily: Fonts.regular, fontSize: rf(13), textAlign: 'center', paddingVertical: 8 },
  contactRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  contactAvatar: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontFamily: Fonts.bold, fontSize: rf(14) },
  contactInfo: { flex: 1 },
  contactName: { fontFamily: Fonts.medium, fontSize: rf(14) },
  contactDes: { fontFamily: Fonts.regular, fontSize: rf(12), marginTop: 1 },
  contactPhone: { fontFamily: Fonts.regular, fontSize: rf(12), marginTop: 1 },
  visitRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
  visitIcon: { width: 24, alignItems: 'center' },
  visitInfo: { flex: 1 },
  visitDate: { fontFamily: Fonts.medium, fontSize: rf(13) },
  visitDuration: { fontFamily: Fonts.regular, fontSize: rf(12), marginTop: 1 },
});
