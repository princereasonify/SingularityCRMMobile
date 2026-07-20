import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, Linking, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Phone, CheckCircle, Clock, Pencil, Mail, Trash2, UserRound } from 'lucide-react-native';
import { schoolsApi } from '../../api/schools';
import { contactsApi } from '../../api/contacts';
import { School, Contact, SchoolVisitLog } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Screen, AppHeader, Card, Badge } from '../../components/ui';
import {
  Btn, IconBtn, Input, Checkbox, FormModal, ConfirmModal, StatusBadge, Avatar,
} from '../../components/crud';
import { LoadingSpinner, EmptyState } from '../../components/common/LoadingSpinner';
import { formatDate, formatRelativeDate } from '../../utils/formatting';
import { rf, isTabletDevice } from '../../utils/responsive';

import { useAppTheme } from '../../theme/useAppTheme';

export const SchoolDetailScreen = ({ navigation, route }: any) => {
  const { schoolId } = route.params;
  const { user } = useAuth();
  const T = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const twoWide = isTabletDevice && width > height;

  // RELATIONSHIP_COLORS removed with the relationship badge: ContactListDto (the
  // shape GET /schools/{id}/contacts actually returns) has no `relationship`
  // field, so that badge rendered blank. Web shows the Decision Maker flag here.
  const STATUS_COLORS: Record<string, string> = {
    Active: T.success, Inactive: T.dim, Blacklisted: T.danger,
  };

  const [school, setSchool] = useState<School | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [visits, setVisits] = useState<SchoolVisitLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Contacts CRUD — mirrors web's SchoolDetail "Contacts" tab. Web gates Add
  // behind `isAdmin`, but `const isAdmin = true` there, so it is effectively
  // ungated; only delete carries a real gate, and it matches the server's
  // (SchoolsController.DeleteContact Forbid()s anyone outside this set).
  const canDeleteContact = ['SCA', 'SH', 'RH', 'ZH'].includes(user?.role ?? '');

  const emptyForm = { name: '', designation: '', phone: '', email: '', isDecisionMaker: false };
  const [contactForm, setContactForm] = useState(emptyForm);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [contactModal, setContactModal] = useState(false);
  const [savingContact, setSavingContact] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);

  const fetchContacts = async () => {
    try {
      const contactsRes = await contactsApi.getBySchool(schoolId);
      const cd = contactsRes.data as any;
      setContacts(Array.isArray(cd) ? cd : cd?.contacts ?? []);
    } catch {
      setContacts([]);
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        const schoolRes = await schoolsApi.getById(schoolId);
        const sd = schoolRes.data as any;
        // Handle both direct object and nested { data: {...} } or { school: {...} }
        setSchool(sd?.school ?? sd ?? null);

        await fetchContacts();

        // Visit history: GET /schools/{id}/visit-history is not a route any
        // controller serves, so this only ever 404'd into an empty list. Dropped
        // rather than left spamming a request per open; restore with a real endpoint.
        setVisits([]);
      } catch {
        Alert.alert('Error', 'Failed to load school details');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [schoolId]);

  const openAddContact = () => {
    setEditingContact(null);
    setContactForm(emptyForm);
    setContactModal(true);
  };

  const openEditContact = (c: Contact) => {
    setEditingContact(c);
    setContactForm({
      name: c.name ?? '',
      designation: c.designation ?? '',
      phone: c.phone ?? '',
      email: c.email ?? '',
      isDecisionMaker: !!c.isDecisionMaker,
    });
    setContactModal(true);
  };

  const saveContact = async () => {
    if (!contactForm.name.trim()) {
      Alert.alert('Contact name is required');
      return;
    }
    setSavingContact(true);
    try {
      if (editingContact) {
        await contactsApi.update(editingContact.id, contactForm);
      } else {
        await contactsApi.addToSchool(schoolId, contactForm);
      }
      setContactModal(false);
      setEditingContact(null);
      setContactForm(emptyForm);
      await fetchContacts();
    } catch {
      Alert.alert('Error', `Failed to ${editingContact ? 'update' : 'add'} contact`);
    } finally {
      setSavingContact(false);
    }
  };

  const confirmDeleteContact = async () => {
    if (!deleteTarget) return;
    try {
      await contactsApi.remove(deleteTarget.id);
      setDeleteTarget(null);
      await fetchContacts();
    } catch {
      setDeleteTarget(null);
      Alert.alert('Error', 'Failed to delete contact');
    }
  };

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
    { label: 'Address', value: (school as any).address },
    { label: 'City', value: school.city },
    { label: 'State', value: school.state },
    { label: 'Pincode', value: school.pincode },
    // SchoolDto returns `Phone` and `Email` (SalesCRM.Core/DTOs/Schools/SchoolDtos.cs);
    // web's SchoolDetail info grid shows both — mobile was dropping them.
    { label: 'Phone', value: (school as any).phone },
    { label: 'Email', value: (school as any).email },
    { label: 'Geofence Radius', value: (school as any).geofenceRadiusMetres ? `${(school as any).geofenceRadiusMetres}m` : undefined },
  ].filter(r => r.value);

  const headerRight = (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <TouchableOpacity
        onPress={() => navigation.navigate('AddSchool', { school })}
        style={[styles.hIcon, { backgroundColor: T.card, borderColor: T.line }]}
      >
        <Pencil size={18} color={T.accent} />
      </TouchableOpacity>
      {/* Change History removed: GET /audit has no controller in the backend, so
          this only ever opened a permanently-empty screen. Web has no audit UI
          either. Restore alongside a real AuditController. */}
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
          {/* SchoolDto has no `Status` — only `IsActive` — so the old badge rendered
              `undefined`. Derived from the field the DTO actually sends. */}
          <Badge
            label={(school as any).isActive === false ? 'Inactive' : 'Active'}
            color={(school as any).isActive === false ? T.dim : T.success}
          />
          {school.isPartnerOffice && <Badge label="Partner Office" color={T.info} />}
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
            <TouchableOpacity onPress={openAddContact}>
              <Text style={[styles.addLink, { color: T.accent }]}>+ Add</Text>
            </TouchableOpacity>
          </View>
          {contacts.length === 0 ? (
            <View style={styles.contactsEmpty}>
              <UserRound size={28} color={T.dim} />
              <Text style={[styles.emptyText, { color: T.dim }]}>No contacts yet</Text>
            </View>
          ) : (
            contacts.map((c, i) => (
              <View
                key={c.id}
                style={[styles.contactRow, i < contacts.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.line }]}
              >
                <Avatar initials={(c.name || '?').charAt(0).toUpperCase()} />
                <View style={styles.contactInfo}>
                  <Text numberOfLines={1} style={[styles.contactName, { color: T.text }]}>{c.name}</Text>
                  <Text numberOfLines={1} style={[styles.contactDes, { color: T.sub }]}>
                    {c.designation || 'No designation'}
                  </Text>
                  {!!c.phone && (
                    <TouchableOpacity style={styles.contactMeta} onPress={() => Linking.openURL(`tel:${c.phone}`)}>
                      <Phone size={11} color={T.accent} />
                      <Text numberOfLines={1} style={[styles.contactMetaTxt, { color: T.accent }]}>{c.phone}</Text>
                    </TouchableOpacity>
                  )}
                  {!!c.email && (
                    <View style={styles.contactMeta}>
                      <Mail size={11} color={T.dim} />
                      <Text numberOfLines={1} style={[styles.contactMetaTxt, { color: T.dim }]}>{c.email}</Text>
                    </View>
                  )}
                  {!!c.isDecisionMaker && (
                    <View style={styles.dmBadge}>
                      <StatusBadge label="Decision Maker" color={T.warning} />
                    </View>
                  )}
                </View>
                <View style={styles.contactActions}>
                  <IconBtn kind="edit" label="Edit contact" onPress={() => openEditContact(c)}>
                    <Pencil size={15} color={T.sub} />
                  </IconBtn>
                  {canDeleteContact && (
                    <IconBtn kind="del" label="Delete contact" onPress={() => setDeleteTarget(c)}>
                      <Trash2 size={15} color={T.danger} />
                    </IconBtn>
                  )}
                </View>
              </View>
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

      <FormModal
        visible={contactModal}
        title={editingContact ? 'Edit Contact' : 'New Contact'}
        onClose={() => setContactModal(false)}
        footer={
          <View style={styles.modalFooter}>
            <Btn label="Cancel" variant="secondary" onPress={() => setContactModal(false)} style={{ flex: 1 }} />
            <Btn
              label={editingContact ? 'Save' : 'Add'}
              onPress={saveContact}
              loading={savingContact}
              style={{ flex: 1 }}
            />
          </View>
        }
      >
        <Input
          label="Name *"
          value={contactForm.name}
          onChangeText={v => setContactForm(f => ({ ...f, name: v }))}
          placeholder="Contact name"
        />
        <Input
          label="Designation"
          value={contactForm.designation}
          onChangeText={v => setContactForm(f => ({ ...f, designation: v }))}
          placeholder="e.g. Principal"
        />
        <Input
          label="Phone"
          value={contactForm.phone}
          onChangeText={v => setContactForm(f => ({ ...f, phone: v }))}
          placeholder="Phone"
          keyboardType="phone-pad"
        />
        <Input
          label="Email"
          value={contactForm.email}
          onChangeText={v => setContactForm(f => ({ ...f, email: v }))}
          placeholder="Email"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Checkbox
          on={contactForm.isDecisionMaker}
          onToggle={() => setContactForm(f => ({ ...f, isDecisionMaker: !f.isDecisionMaker }))}
          label="Decision Maker"
        />
      </FormModal>

      <ConfirmModal
        visible={!!deleteTarget}
        title="Delete contact?"
        message={`${deleteTarget?.name ?? 'This contact'} will be removed from ${school.name}.`}
        icon={<Trash2 size={20} color={T.danger} />}
        confirmLabel="Delete"
        onConfirm={confirmDeleteContact}
        onCancel={() => setDeleteTarget(null)}
      />
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
  statValue: { fontWeight: '700', fontSize: rf(20), letterSpacing: -0.4 },
  statLabel: { fontWeight: '600', fontSize: rf(11), marginTop: 2 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  lastVisit: { fontWeight: '400', fontSize: rf(12) },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontWeight: '700', fontSize: rf(14), marginBottom: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, gap: 12 },
  infoLabel: { fontWeight: '400', fontSize: rf(13) },
  infoValue: { fontWeight: '600', fontSize: rf(13), flex: 1, textAlign: 'right' },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 8 },
  phoneText: { fontWeight: '700', fontSize: rf(14) },
  addLink: { fontWeight: '700', fontSize: rf(13) },
  emptyText: { fontWeight: '400', fontSize: rf(13), textAlign: 'center', paddingVertical: 8 },
  contactsEmpty: { alignItems: 'center', paddingVertical: 16, gap: 4 },
  contactRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  // RN defaults flexShrink to 0, so this column would otherwise lay out at full
  // width and paint over the action buttons on a narrow phone.
  contactInfo: { flex: 1, flexShrink: 1, minWidth: 0 },
  contactName: { fontWeight: '600', fontSize: rf(14) },
  contactDes: { fontWeight: '400', fontSize: rf(12), marginTop: 1 },
  contactMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  contactMetaTxt: { fontWeight: '400', fontSize: rf(12), flexShrink: 1, minWidth: 0 },
  dmBadge: { flexDirection: 'row', alignSelf: 'flex-start', marginTop: 4 },
  contactActions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  modalFooter: { flexDirection: 'row', gap: 10 },
  visitRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
  visitIcon: { width: 24, alignItems: 'center' },
  visitInfo: { flex: 1 },
  visitDate: { fontWeight: '600', fontSize: rf(13) },
  visitDuration: { fontWeight: '400', fontSize: rf(12), marginTop: 1 },
});
