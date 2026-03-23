import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Alert, TouchableOpacity,
  TextInput, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { contactsApi } from '../../api/contacts';
import { Contact } from '../../types';
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

  const schoolId = existing?.schoolId ?? schoolIdParam;
  const schoolName = existing?.schoolName ?? schoolNameParam;

  const handleSubmit = async () => {
    if (!name.trim()) { Alert.alert('Validation', 'Contact name is required'); return; }
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
    }
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
});
