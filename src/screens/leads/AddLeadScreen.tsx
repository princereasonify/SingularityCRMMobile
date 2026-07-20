import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Alert, TouchableOpacity, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react-native';
import { leadsApi } from '../../api/leads';
import { UserDto } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { SelectPicker } from '../../components/common/SelectPicker';
// Free text 400s the create: CreateLeadRequest.CloseDate is a C# DateTime?.
import { DateInput } from '../../components/common/DateInput';
import { GradientButton } from '../../components/common/GradientButton';
import { ICON_STROKE } from '../../components/common/Icon';
import { IconBtn } from '../../components/crud';
import { Card } from '../../components/ui';
import { BOARDS, SCHOOL_TYPES, LEAD_SOURCES } from '../../utils/constants';
import { rf, isTabletDevice } from '../../utils/responsive';

import { useAppTheme } from '../../theme/useAppTheme';

interface Section {
  title: string;
  key: string;
}
const SECTIONS: Section[] = [
  { title: '📋 School Info', key: 'school' },
  { title: '📍 Location', key: 'location' },
  { title: '👤 Contact', key: 'contact' },
  { title: '💰 Deal Estimate', key: 'deal' },
  { title: '📝 Additional', key: 'extra' },
];

/**
 * Doubles as Add and Edit. The navigator registers this component under BOTH
 * `AddLead` and `EditLead`; before this, the edit route ignored `route.params`
 * entirely and submitted `createLead`, so tapping "Edit Lead" silently created a
 * SECOND lead instead of updating the first.
 */
export const AddLeadScreen = ({ navigation, route }: any) => {
  const editLeadId: number | undefined = route?.params?.leadId;
  const isEdit = !!editLeadId;
  const { user } = useAuth();
  const T = useAppTheme();
  const insets = useSafeAreaInsets();
  const role = user?.role || 'FO';
  const { width, height } = useWindowDimensions();
  const twoWide = isTabletDevice && width > height;

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [foList, setFoList] = useState<UserDto[]>([]);

  const [form, setForm] = useState({
    school: '', board: 'CBSE', type: 'Private', students: '',
    city: '', state: '',
    contactName: '', contactDesignation: '', contactPhone: '', contactEmail: '',
    source: 'Field Visit', value: '', closeDate: '',
    notes: '',
    foId: '' as string | number,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Edit mode: pull the authoritative record and prefill. The list row is not
  // enough — LeadListDto omits state/students/closeDate/notes/contact.
  useEffect(() => {
    if (!editLeadId) return;
    leadsApi.getLead(editLeadId)
      .then(r => {
        const l: any = r.data;
        if (!l) return;
        setForm({
          school: l.school ?? '', board: l.board ?? 'CBSE', type: l.type ?? 'Private',
          students: l.students != null ? String(l.students) : '',
          city: l.city ?? '', state: l.state ?? '',
          contactName: l.contact?.name ?? l.contactName ?? '',
          contactDesignation: l.contact?.designation ?? '',
          contactPhone: l.contact?.phone ?? '',
          contactEmail: l.contact?.email ?? '',
          source: l.source ?? 'Field Visit',
          value: l.value != null ? String(l.value) : '',
          closeDate: (l.closeDate ?? '').toString().split('T')[0],
          notes: l.notes ?? '',
          foId: l.foId ?? '',
        });
      })
      .catch(() => Alert.alert('Error', 'Could not load this lead.'));
  }, [editLeadId]);

  useEffect(() => {
    if (role !== 'FO') {
      leadsApi.getAssignableFOs().then((r) => setFoList(Array.isArray(r.data) ? r.data : (r.data as any)?.items ?? [])).catch(() => Alert.alert('Error', 'Failed to load Field Officers.'));
    }
  }, [role]);

  const set = (key: string, val: any) => {
    setForm((f) => ({ ...f, [key]: val }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: '' }));
  };

  // Section key → which form fields live inside it (for auto-expand on error)
  const SECTION_FIELDS: Record<string, string[]> = {
    school: ['school', 'board', 'type'],
    location: ['city', 'state'],
    contact: ['contactName', 'contactPhone', 'contactEmail'],
    deal: ['value', 'closeDate'],
    extra: ['notes'],
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.school.trim()) e.school = 'School name is required';
    if (!form.city.trim()) e.city = 'City is required';
    if (!form.contactName.trim()) e.contactName = 'Contact name is required';
    if (!form.contactPhone.trim()) e.contactPhone = 'Phone is required';
    if (role !== 'FO' && !form.foId) e.foId = 'Please select a Field Officer';
    setErrors(e);

    // Auto-expand any section that contains an error field
    if (Object.keys(e).length > 0) {
      setCollapsed((prev) => {
        const next = { ...prev };
        Object.entries(SECTION_FIELDS).forEach(([sKey, fields]) => {
          if (fields.some((f) => e[f])) next[sKey] = false;
        });
        return next;
      });
    }

    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      // Check duplicate — wrap in its own try/catch so a backend error never
      // blocks submission (web's AddLead.jsx does not call checkDuplicate at all)
      let isDuplicate = false;
      try {
        const res = await leadsApi.checkDuplicate(form.school.trim(), form.city.trim());
        isDuplicate = res.data === true;
      } catch {
        // endpoint unavailable — skip duplicate check, proceed with create
      }

      if (isDuplicate) {
        Alert.alert(
          'Duplicate Lead',
          `A lead for ${form.school} in ${form.city} already exists.`,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => setLoading(false) },
            { text: 'Create Anyway', onPress: () => submitLead() },
          ],
        );
        return;
      }
      await submitLead();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to create lead');
      setLoading(false);
    }
  };

  const submitLead = async () => {
    try {
      // Match web payload format exactly:
      // - numbers: 0 when empty (not undefined)
      // - text: empty string when empty (not undefined)
      // - dates/ids: null when empty (not undefined)
      const payload = {
        school: form.school.trim(),
        board: form.board,
        type: form.type,
        students: form.students ? parseInt(form.students, 10) : 0,
        city: form.city.trim(),
        state: form.state.trim(),
        contactName: form.contactName.trim(),
        contactDesignation: form.contactDesignation.trim(),
        contactPhone: form.contactPhone.trim(),
        contactEmail: form.contactEmail.trim(),
        source: form.source,
        value: form.value ? parseFloat(form.value) : 0,
        closeDate: (form.closeDate || null) as any,
        notes: form.notes.trim(),
        foId: (role !== 'FO' && form.foId ? Number(form.foId) : null) as any,
      };
      if (isEdit) await leadsApi.updateLead(editLeadId!, payload as any);
      else await leadsApi.createLead(payload as any);
      Alert.alert('Success', isEdit ? 'Lead updated successfully!' : 'Lead created successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || (isEdit ? 'Failed to update lead' : 'Failed to create lead'));
    } finally {
      setLoading(false);
    }
  };

  const toggle = (key: string) => setCollapsed((c) => ({ ...c, [key]: !c[key] }));

  return (
    <View style={[styles.safe, { backgroundColor: T.bg }]}>
      {/* House pattern: plain themed title block on T.bg — no gradient hero. */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <IconBtn kind="view" label="Back" onPress={() => navigation.goBack()}>
          <ArrowLeft size={18} color={T.accent} strokeWidth={ICON_STROKE} />
        </IconBtn>
        <View style={styles.titleBlock}>
          <Text style={[styles.h1, { color: T.text }]} numberOfLines={1}>{isEdit ? 'Edit Lead' : 'Add New Lead'}</Text>
          <Text style={[styles.h2, { color: T.sub }]} numberOfLines={1}>{isEdit ? 'Update this lead' : 'Create a new school lead'}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, twoWide && styles.contentTablet, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* FO Assignment (managers) */}
        {/* Render for every manager, even if the FO list failed to load — validate()
            hard-requires foId for non-FO, so hiding it made the form unsubmittable. */}
          {role !== 'FO' && (
          <Card style={styles.sectionCard}>
            <Text style={[styles.sectionTitle, { color: T.text }]}>👤 Assign to FO</Text>
            <SelectPicker
              label="Select Field Officer *"
              options={foList.map((fo) => ({ label: fo.name, value: fo.id }))}
              value={form.foId}
              onChange={(v) => set('foId', v)}
              accentColor={T.accent}
            />
            {errors.foId ? <Text style={[styles.fieldError, { color: T.danger }]}>{errors.foId}</Text> : null}
          </Card>
        )}

        {SECTIONS.map((sec) => (
          <Card key={sec.key} style={styles.sectionCard}>
            <TouchableOpacity style={styles.sectionHeader} onPress={() => toggle(sec.key)}>
              <Text style={[styles.sectionTitle, { color: T.text }]}>{sec.title}</Text>
              {collapsed[sec.key] ? (
                <ChevronDown size={18} color={T.sub} />
              ) : (
                <ChevronUp size={18} color={T.sub} />
              )}
            </TouchableOpacity>

            {!collapsed[sec.key] && (
              <>
                {sec.key === 'school' && (
                  <>
                    <Input label="School Name *" value={form.school} onChangeText={(v) => set('school', v)} error={errors.school} accentColor={T.accent} placeholder="e.g. DPS Andheri" />
                    <View style={[styles.row, twoWide && styles.rowTablet]}>
                      <SelectPicker label="Board *" options={BOARDS.map((b) => ({ label: b, value: b }))} value={form.board} onChange={(v) => set('board', v)} accentColor={T.accent} containerStyle={styles.half} />
                      <SelectPicker label="Type *" options={SCHOOL_TYPES.map((t) => ({ label: t, value: t }))} value={form.type} onChange={(v) => set('type', v)} accentColor={T.accent} containerStyle={styles.half} />
                    </View>
                    <Input label="Number of Students" value={form.students} onChangeText={(v) => set('students', v)} keyboardType="numeric" placeholder="e.g. 1200" accentColor={T.accent} />
                  </>
                )}
                {sec.key === 'location' && (
                  <View style={[styles.row, twoWide && styles.rowTablet]}>
                    <Input label="City *" value={form.city} onChangeText={(v) => set('city', v)} error={errors.city} placeholder="e.g. Mumbai" accentColor={T.accent} containerStyle={styles.half} />
                    <Input label="State" value={form.state} onChangeText={(v) => set('state', v)} placeholder="e.g. Maharashtra" accentColor={T.accent} containerStyle={styles.half} />
                  </View>
                )}
                {sec.key === 'contact' && (
                  <>
                    <Input label="Contact Name *" value={form.contactName} onChangeText={(v) => set('contactName', v)} error={errors.contactName} placeholder="e.g. Mrs. Sharma" accentColor={T.accent} />
                    <Input label="Designation" value={form.contactDesignation} onChangeText={(v) => set('contactDesignation', v)} placeholder="e.g. Principal" accentColor={T.accent} />
                    <Input label="Phone *" value={form.contactPhone} onChangeText={(v) => set('contactPhone', v)} error={errors.contactPhone} keyboardType="phone-pad" placeholder="+91 98765 43210" accentColor={T.accent} />
                    <Input label="Email" value={form.contactEmail} onChangeText={(v) => set('contactEmail', v)} keyboardType="email-address" autoCapitalize="none" placeholder="contact@school.edu" accentColor={T.accent} />
                  </>
                )}
                {sec.key === 'deal' && (
                  <>
                    <Input label="Estimated Value (₹)" value={form.value} onChangeText={(v) => set('value', v)} keyboardType="numeric" placeholder="e.g. 500000" accentColor={T.accent} />
                    <DateInput label="Expected Close Date" value={form.closeDate} onChange={(v) => set('closeDate', v)} accentColor={T.accent} />
                    <SelectPicker label="Lead Source" options={LEAD_SOURCES.map((s) => ({ label: s, value: s }))} value={form.source} onChange={(v) => set('source', v)} accentColor={T.accent} />
                  </>
                )}
                {sec.key === 'extra' && (
                  <Input label="Notes" value={form.notes} onChangeText={(v) => set('notes', v)} multiline numberOfLines={4} placeholder="Additional context..." accentColor={T.accent} style={{ textAlignVertical: 'top', minHeight: 80 }} />
                )}
              </>
            )}
          </Card>
        ))}

        <View style={[styles.footerActions, twoWide && styles.footerActionsTablet]}>
          <Button title="Cancel" onPress={() => navigation.goBack()} variant="secondary" color={T.sub} style={styles.cancelBtn} />
          <GradientButton label="Create Lead" onPress={handleSubmit} loading={loading} style={styles.submitBtn} />
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 12, gap: 10 },
  titleBlock: { flex: 1, minWidth: 0, gap: 2 },
  h1: { fontWeight: '800', fontSize: rf(19), letterSpacing: -0.4 },
  h2: { fontWeight: '500', fontSize: rf(12.5) },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 12 },
  contentTablet: { padding: 24, maxWidth: 720, alignSelf: 'center', width: '100%' },
  sectionCard: { padding: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontWeight: '700', fontSize: rf(15) },
  row: { flexDirection: 'row', gap: 10 },
  rowTablet: { gap: 16 },
  half: { flex: 1 },
  footerActions: { flexDirection: 'row', gap: 12, marginTop: 8, alignItems: 'center' },
  footerActionsTablet: { justifyContent: 'flex-end' },
  cancelBtn: { flex: 1 },
  submitBtn: { flex: 2 },
  fieldError: { fontWeight: '400', fontSize: rf(12), marginTop: 4 },
});
