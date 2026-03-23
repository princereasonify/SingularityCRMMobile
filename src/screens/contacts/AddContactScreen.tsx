import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Alert, TouchableOpacity,
  TextInput, Switch, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlertTriangle, ExternalLink, X } from 'lucide-react-native';
import { contactsApi } from '../../api/contacts';
import { Contact, DuplicateMatch } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { Button } from '../../components/common/Button';
import { ROLE_COLORS } from '../../utils/constants';
import { rf } from '../../utils/responsive';

const RELATIONSHIPS = ['New', 'Warm', 'Strong', 'Champion', 'Detractor'];

export const AddContactScreen = ({ navigation, route }: any) => {
  const existing: Contact | undefined = route.params?.contact;
  const schoolIdParam: number | undefined = route.params?.schoolId;
  const schoolNameParam: string | undefined = route.params?.schoolName;
  const { user } = useAuth();
  const COLOR = ROLE_COLORS[(user?.role || 'FO') as keyof typeof ROLE_COLORS];
  const isEdit = !!existing;

  const [name, setName] = useState(existing?.name ?? '');
  const [designation, setDesignation] = useState(existing?.designation ?? '');
  const [department, setDepartment] = useState(existing?.department ?? '');
  const [phone, setPhone] = useState(existing?.phone ?? '');
  const [email, setEmail] = useState(existing?.email ?? '');
  const [profession, setProfession] = useState(existing?.profession ?? '');
  const [personalityNotes, setPersonalityNotes] = useState(existing?.personalityNotes ?? '');
  const [relationship, setRelationship] = useState<'New' | 'Warm' | 'Strong' | 'Champion' | 'Detractor'>(existing?.relationship ?? 'New');
  const [isDecisionMaker, setIsDecisionMaker] = useState(existing?.isDecisionMaker ?? false);
  const [isInfluencer, setIsInfluencer] = useState(existing?.isInfluencer ?? false);
  const [submitting, setSubmitting] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const [showDupModal, setShowDupModal] = useState(false);
  const dupCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const schoolId = existing?.schoolId ?? schoolIdParam;
  const schoolName = existing?.schoolName ?? schoolNameParam;

  const DUP_COLORS = { Definite: '#DC2626', Probable: '#F59E0B', Possible: '#2563EB' } as Record<string, string>;

  // Debounced duplicate check on name + phone change
  useEffect(() => {
    if (isEdit || (!name.trim() && !phone.trim())) { setDuplicates([]); return; }
    if (dupCheckTimer.current) clearTimeout(dupCheckTimer.current);
    dupCheckTimer.current = setTimeout(async () => {
      try {
        const res = await contactsApi.checkDuplicates(name.trim() || undefined, phone.trim() || undefined, schoolId);
        setDuplicates((res.data as any) ?? []);
      } catch { setDuplicates([]); }
    }, 600);
    return () => { if (dupCheckTimer.current) clearTimeout(dupCheckTimer.current); };
  }, [name, phone, schoolId, isEdit]);

  const doSave = async () => {
    setSubmitting(true);
    try {
      const data = {
        name: name.trim(),
        designation: designation || undefined,
        department: department || undefined,
        phone: phone || undefined,
        email: email || undefined,
        schoolId,
        profession: profession || undefined,
        personalityNotes: personalityNotes || undefined,
        relationship,
        isDecisionMaker,
        isInfluencer,
      };
      if (isEdit) {
        await contactsApi.update(existing!.id, data);
      } else {
        await contactsApi.create(data);
      }
      Alert.alert('Success', isEdit ? 'Contact updated' : 'Contact added');
      navigation.goBack();
    } catch {
      Alert.alert('Error', 'Failed to save contact. Please try again.');
    } finally {
      setSubmitting(false);
      setShowDupModal(false);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) { Alert.alert('Validation', 'Contact name is required'); return; }
    if (!isEdit && duplicates.length > 0) {
      setShowDupModal(true);
      return;
    }
    await doSave();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title={isEdit ? 'Edit Contact' : 'Add Contact'}
        color={COLOR.primary}
        onBack={() => navigation.goBack()}
      />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {schoolName && (
          <View style={[styles.schoolBanner, { backgroundColor: COLOR.light }]}>
            <Text style={[styles.schoolBannerText, { color: COLOR.primary }]}>🏫 {schoolName}</Text>
          </View>
        )}
        {!isEdit && duplicates.length > 0 && (
          <View style={styles.dupBanner}>
            <AlertTriangle size={16} color="#92400E" />
            <Text style={styles.dupBannerText}>
              {duplicates.length} possible duplicate{duplicates.length > 1 ? 's' : ''} found
            </Text>
          </View>
        )}

        <SectionCard label="Basic Information">
          <Field label="Full Name *" value={name} onChange={setName} placeholder="Contact's name" />
          <Field label="Designation" value={designation} onChange={setDesignation} placeholder="e.g. Principal" />
          <Field label="Department" value={department} onChange={setDepartment} placeholder="e.g. Administration" />
          <Field label="Profession" value={profession} onChange={setProfession} placeholder="Professional role" />
        </SectionCard>

        <SectionCard label="Contact Information">
          <Field label="Phone" value={phone} onChange={setPhone} placeholder="+91 XXXXX XXXXX" keyboardType="phone-pad" />
          <Field label="Email" value={email} onChange={setEmail} placeholder="email@example.com" keyboardType="email-address" />
        </SectionCard>

        <SectionCard label="Relationship">
          <Text style={styles.fieldLabel}>Relationship Stage</Text>
          <View style={styles.chipRow}>
            {RELATIONSHIPS.map(r => (
              <TouchableOpacity
                key={r}
                style={[styles.chip, relationship === r && { backgroundColor: COLOR.primary }]}
                onPress={() => setRelationship(r as 'New' | 'Warm' | 'Strong' | 'Champion' | 'Detractor')}
              >
                <Text style={[styles.chipText, relationship === r && { color: '#FFF' }]}>{r}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Decision Maker</Text>
            <Switch value={isDecisionMaker} onValueChange={setIsDecisionMaker} trackColor={{ true: COLOR.primary }} />
          </View>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Influencer</Text>
            <Switch value={isInfluencer} onValueChange={setIsInfluencer} trackColor={{ true: COLOR.primary }} />
          </View>
        </SectionCard>

        <SectionCard label="Notes">
          <Field
            label="Personality Notes"
            value={personalityNotes}
            onChange={setPersonalityNotes}
            placeholder="Behavioral or personality observations..."
            multiline
          />
        </SectionCard>

        <Button
          title={submitting ? 'Saving...' : isEdit ? 'Update Contact' : 'Add Contact'}
          onPress={handleSubmit}
          variant="primary"
          disabled={submitting}
          style={{ marginTop: 8 }}
        />
      </ScrollView>

      {/* Duplicate Detection Modal */}
      <Modal visible={showDupModal} transparent animationType="slide" onRequestClose={() => setShowDupModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <AlertTriangle size={18} color="#F59E0B" />
                <Text style={styles.modalTitle}>Possible Duplicate Found</Text>
              </View>
              <TouchableOpacity onPress={() => setShowDupModal(false)}>
                <X size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>
            {duplicates.map(d => (
              <View key={d.matchedEntityId} style={[styles.dupCard, { borderLeftColor: DUP_COLORS[d.matchType] || '#9CA3AF' }]}>
                <View style={styles.dupCardHeader}>
                  <Text style={styles.dupName}>{d.matchedEntityName}</Text>
                  <View style={[styles.matchBadge, { backgroundColor: (DUP_COLORS[d.matchType] || '#9CA3AF') + '20' }]}>
                    <Text style={[styles.matchBadgeText, { color: DUP_COLORS[d.matchType] || '#9CA3AF' }]}>{d.matchType}</Text>
                  </View>
                </View>
                <Text style={styles.dupReason}>{d.matchReason}</Text>
                <TouchableOpacity
                  onPress={() => { setShowDupModal(false); navigation.navigate('ContactDetail', { contactId: d.matchedEntityId }); }}
                  style={styles.viewExistingBtn}
                >
                  <ExternalLink size={13} color={COLOR.primary} />
                  <Text style={[styles.viewExistingText, { color: COLOR.primary }]}>View Existing</Text>
                </TouchableOpacity>
              </View>
            ))}
            <View style={styles.modalActions}>
              <Button title="Create Anyway" onPress={doSave} disabled={submitting} variant="secondary" style={{ flex: 1 }} />
              <Button title="Cancel" onPress={() => setShowDupModal(false)} variant="primary" style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const Field = ({ label, value, onChange, placeholder, multiline, keyboardType }: any) => (
  <View style={styles.fieldGroup}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      style={[styles.input, multiline && styles.inputMulti]}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor="#9CA3AF"
      multiline={multiline}
      numberOfLines={multiline ? 3 : 1}
      keyboardType={keyboardType || 'default'}
      autoCapitalize="none"
    />
  </View>
);

const SectionCard = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <View style={styles.card}>
    <Text style={styles.cardTitle}>{label}</Text>
    {children}
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  schoolBanner: { borderRadius: 12, padding: 12 },
  schoolBannerText: { fontSize: rf(14), fontWeight: '600' },
  card: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  cardTitle: { fontSize: rf(13), fontWeight: '700', color: '#6B7280', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldGroup: { marginBottom: 14 },
  fieldLabel: { fontSize: rf(13), fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: rf(14), color: '#111827', backgroundColor: '#FAFAFA',
  },
  inputMulti: { height: 80, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100,
    backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB',
  },
  chipText: { fontSize: rf(13), color: '#374151', fontWeight: '500' },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  toggleLabel: { fontSize: rf(14), color: '#374151', fontWeight: '500' },
  dupBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF3C7', borderRadius: 10, padding: 12 },
  dupBannerText: { flex: 1, fontSize: rf(13), color: '#92400E', fontWeight: '500' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalTitle: { fontSize: rf(16), fontWeight: '700', color: '#111827' },
  dupCard: { borderLeftWidth: 4, backgroundColor: '#FAFAFA', borderRadius: 10, padding: 12, marginBottom: 10 },
  dupCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  dupName: { fontSize: rf(14), fontWeight: '700', color: '#111827', flex: 1 },
  matchBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 },
  matchBadgeText: { fontSize: rf(11), fontWeight: '700' },
  dupReason: { fontSize: rf(12), color: '#6B7280', marginBottom: 8 },
  viewExistingBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  viewExistingText: { fontSize: rf(13), fontWeight: '600' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
});
