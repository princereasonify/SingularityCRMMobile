import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Alert, TouchableOpacity,
  TextInput, Switch, Modal, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertTriangle, ExternalLink, X, ArrowLeft } from 'lucide-react-native';
import { contactsApi } from '../../api/contacts';
import { Contact, DuplicateMatch } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { GradientBackground } from '../../components/common/GradientBackground';
import { GradientButton } from '../../components/common/GradientButton';
import { Button } from '../../components/common/Button';
import { Card, Chip, SectionLabel } from '../../components/ui';
import { ROLE_COLORS } from '../../utils/constants';
import { Fonts } from '../../theme';
import { useAppTheme } from '../../theme/useAppTheme';
import { rf, isTabletDevice } from '../../utils/responsive';

const RELATIONSHIPS = ['New', 'Warm', 'Strong', 'Champion', 'Detractor'];

export const AddContactScreen = ({ navigation, route }: any) => {
  const existing: Contact | undefined = route.params?.contact;
  const schoolIdParam: number | undefined = route.params?.schoolId;
  const schoolNameParam: string | undefined = route.params?.schoolName;
  const { user } = useAuth();
  const COLOR = ROLE_COLORS[(user?.role || 'FO') as keyof typeof ROLE_COLORS];
  const isEdit = !!existing;

  const T = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const twoWide = isTabletDevice && width > height;

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

  const DUP_COLORS = { Definite: T.danger, Probable: T.warning, Possible: T.info } as Record<string, string>;

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
    <View style={[styles.root, { backgroundColor: T.bg }]}>
      {/* Sunstone hero header */}
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
            <Text style={styles.headerTitle} numberOfLines={1}>{isEdit ? 'Edit Contact' : 'Add Contact'}</Text>
            {!!schoolName && <Text style={styles.headerSub} numberOfLines={1}>🏫 {schoolName}</Text>}
          </View>
        </View>
      </GradientBackground>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.formWrap, twoWide && styles.formWrapWide]}>
          {!isEdit && duplicates.length > 0 && (
            <View style={[styles.dupBanner, { backgroundColor: T.warning + '22', borderColor: T.warning + '55' }]}>
              <AlertTriangle size={16} color={T.warning} />
              <Text style={[styles.dupBannerText, { color: T.warning }]}>
                {duplicates.length} possible duplicate{duplicates.length > 1 ? 's' : ''} found
              </Text>
            </View>
          )}

          <SectionCard label="Basic Information">
            <Field label="Full Name *" value={name} onChange={setName} placeholder="Contact's name" />
            <Field label="Designation" value={designation} onChange={setDesignation} placeholder="e.g. Principal" />
            <Field label="Department" value={department} onChange={setDepartment} placeholder="e.g. Administration" />
            <Field label="Profession" value={profession} onChange={setProfession} placeholder="Professional role" last />
          </SectionCard>

          <SectionCard label="Contact Information">
            <Field label="Phone" value={phone} onChange={setPhone} placeholder="+91 XXXXX XXXXX" keyboardType="phone-pad" />
            <Field label="Email" value={email} onChange={setEmail} placeholder="email@example.com" keyboardType="email-address" last />
          </SectionCard>

          <SectionCard label="Relationship">
            <Text style={[styles.fieldLabel, { color: T.sub }]}>Relationship Stage</Text>
            <View style={styles.chipRow}>
              {RELATIONSHIPS.map(r => (
                <Chip
                  key={r}
                  label={r}
                  active={relationship === r}
                  color={T.accent}
                  onPress={() => setRelationship(r as 'New' | 'Warm' | 'Strong' | 'Champion' | 'Detractor')}
                />
              ))}
            </View>
            <View style={[styles.toggleRow, { borderTopColor: T.line }]}>
              <Text style={[styles.toggleLabel, { color: T.text }]}>Decision Maker</Text>
              <Switch value={isDecisionMaker} onValueChange={setIsDecisionMaker} trackColor={{ true: T.accent }} />
            </View>
            <View style={[styles.toggleRow, { borderTopColor: T.line }]}>
              <Text style={[styles.toggleLabel, { color: T.text }]}>Influencer</Text>
              <Switch value={isInfluencer} onValueChange={setIsInfluencer} trackColor={{ true: T.accent }} />
            </View>
          </SectionCard>

          <SectionCard label="Notes">
            <Field
              label="Personality Notes"
              value={personalityNotes}
              onChange={setPersonalityNotes}
              placeholder="Behavioral or personality observations..."
              multiline
              last
            />
          </SectionCard>

          <GradientButton
            label={isEdit ? 'Update Contact' : 'Add Contact'}
            onPress={handleSubmit}
            loading={submitting}
            disabled={submitting}
            style={{ marginTop: 8 }}
          />
        </View>
      </ScrollView>

      {/* Duplicate Detection Modal */}
      <Modal visible={showDupModal} transparent animationType="slide" onRequestClose={() => setShowDupModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: T.card }]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <AlertTriangle size={18} color={T.warning} />
                <Text style={[styles.modalTitle, { color: T.text }]}>Possible Duplicate Found</Text>
              </View>
              <TouchableOpacity onPress={() => setShowDupModal(false)}>
                <X size={20} color={T.sub} />
              </TouchableOpacity>
            </View>
            {duplicates.map(d => (
              <View
                key={d.matchedEntityId}
                style={[styles.dupCard, { backgroundColor: T.cardAlt, borderLeftColor: DUP_COLORS[d.matchType] || T.dim }]}
              >
                <View style={styles.dupCardHeader}>
                  <Text style={[styles.dupName, { color: T.text }]}>{d.matchedEntityName}</Text>
                  <View style={[styles.matchBadge, { backgroundColor: (DUP_COLORS[d.matchType] || T.dim) + '22' }]}>
                    <Text style={[styles.matchBadgeText, { color: DUP_COLORS[d.matchType] || T.dim }]}>{d.matchType}</Text>
                  </View>
                </View>
                <Text style={[styles.dupReason, { color: T.sub }]}>{d.matchReason}</Text>
                <TouchableOpacity
                  onPress={() => { setShowDupModal(false); navigation.navigate('ContactDetail', { contactId: d.matchedEntityId }); }}
                  style={styles.viewExistingBtn}
                >
                  <ExternalLink size={13} color={T.accent} />
                  <Text style={[styles.viewExistingText, { color: T.accent }]}>View Existing</Text>
                </TouchableOpacity>
              </View>
            ))}
            <View style={styles.modalActions}>
              <Button title="Create Anyway" onPress={doSave} disabled={submitting} variant="secondary" color={T.accent} style={{ flex: 1 }} />
              <Button title="Cancel" onPress={() => setShowDupModal(false)} variant="primary" color={T.accent} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const Field = ({ label, value, onChange, placeholder, multiline, keyboardType, last }: any) => {
  const T = useAppTheme();
  return (
    <View style={[styles.fieldGroup, last && { marginBottom: 0 }]}>
      <Text style={[styles.fieldLabel, { color: T.sub }]}>{label}</Text>
      <TextInput
        style={[
          styles.input,
          { backgroundColor: T.fieldBg, borderColor: T.line, color: T.text },
          multiline && styles.inputMulti,
        ]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={T.dim}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        keyboardType={keyboardType || 'default'}
        autoCapitalize="none"
      />
    </View>
  );
};

const SectionCard = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <View>
    <SectionLabel>{label}</SectionLabel>
    <Card>{children}</Card>
  </View>
);

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

  scroll: { flex: 1 },
  content: { padding: 16 },
  formWrap: { gap: 16 },
  formWrapWide: { maxWidth: 720, width: '100%', alignSelf: 'center' },

  fieldGroup: { marginBottom: 14 },
  fieldLabel: { fontFamily: Fonts.medium, fontSize: rf(13), marginBottom: 6 },
  input: {
    borderWidth: 1, borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 11,
    fontFamily: Fonts.regular, fontSize: rf(14),
  },
  inputMulti: { height: 80, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1 },
  toggleLabel: { fontFamily: Fonts.medium, fontSize: rf(14) },
  dupBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, borderWidth: 1, padding: 12 },
  dupBannerText: { flex: 1, fontFamily: Fonts.medium, fontSize: rf(13) },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalTitle: { fontFamily: Fonts.bold, fontSize: rf(16) },
  dupCard: { borderLeftWidth: 4, borderRadius: 12, padding: 12, marginBottom: 10 },
  dupCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  dupName: { fontFamily: Fonts.bold, fontSize: rf(14), flex: 1 },
  matchBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 },
  matchBadgeText: { fontFamily: Fonts.bold, fontSize: rf(11) },
  dupReason: { fontFamily: Fonts.regular, fontSize: rf(12), marginBottom: 8 },
  viewExistingBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  viewExistingText: { fontFamily: Fonts.medium, fontSize: rf(13) },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
});
