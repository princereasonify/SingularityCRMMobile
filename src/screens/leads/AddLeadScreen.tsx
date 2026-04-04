import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Alert, TouchableOpacity, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react-native';
import { leadsApi } from '../../api/leads';
import { UserDto } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { SelectPicker } from '../../components/common/SelectPicker';
import { Card } from '../../components/common/Card';
import { ROLE_COLORS, BOARDS, SCHOOL_TYPES, LEAD_SOURCES } from '../../utils/constants';
import { rf } from '../../utils/responsive';

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

export const AddLeadScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const role = user?.role || 'FO';
  const COLOR = ROLE_COLORS[role];
  const { width } = useWindowDimensions();
  const tablet = width >= 768;

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

  useEffect(() => {
    if (role !== 'FO') {
      leadsApi.getAssignableFOs().then((r) => setFoList(Array.isArray(r.data) ? r.data : (r.data as any)?.items ?? [])).catch(() => {});
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
      await leadsApi.createLead({
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
      });
      Alert.alert('Success', 'Lead created successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to create lead');
    } finally {
      setLoading(false);
    }
  };

  const toggle = (key: string) => setCollapsed((c) => ({ ...c, [key]: !c[key] }));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={[styles.header, { backgroundColor: COLOR.primary }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={22} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add New Lead</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, tablet && styles.contentTablet]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* FO Assignment (managers) */}
        {role !== 'FO' && foList.length > 0 && (
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>👤 Assign to FO</Text>
            <SelectPicker
              label="Select Field Officer *"
              options={foList.map((fo) => ({ label: fo.name, value: fo.id }))}
              value={form.foId}
              onChange={(v) => set('foId', v)}
              accentColor={COLOR.primary}
            />
            {errors.foId ? <Text style={styles.fieldError}>{errors.foId}</Text> : null}
          </Card>
        )}

        {SECTIONS.map((sec) => (
          <Card key={sec.key} style={styles.sectionCard}>
            <TouchableOpacity style={styles.sectionHeader} onPress={() => toggle(sec.key)}>
              <Text style={styles.sectionTitle}>{sec.title}</Text>
              {collapsed[sec.key] ? (
                <ChevronDown size={18} color="#6B7280" />
              ) : (
                <ChevronUp size={18} color="#6B7280" />
              )}
            </TouchableOpacity>

            {!collapsed[sec.key] && (
              <>
                {sec.key === 'school' && (
                  <>
                    <Input label="School Name *" value={form.school} onChangeText={(v) => set('school', v)} error={errors.school} accentColor={COLOR.primary} placeholder="e.g. DPS Andheri" />
                    <View style={[styles.row, tablet && styles.rowTablet]}>
                      <SelectPicker label="Board *" options={BOARDS.map((b) => ({ label: b, value: b }))} value={form.board} onChange={(v) => set('board', v)} accentColor={COLOR.primary} containerStyle={styles.half} />
                      <SelectPicker label="Type *" options={SCHOOL_TYPES.map((t) => ({ label: t, value: t }))} value={form.type} onChange={(v) => set('type', v)} accentColor={COLOR.primary} containerStyle={styles.half} />
                    </View>
                    <Input label="Number of Students" value={form.students} onChangeText={(v) => set('students', v)} keyboardType="numeric" placeholder="e.g. 1200" accentColor={COLOR.primary} />
                  </>
                )}
                {sec.key === 'location' && (
                  <View style={[styles.row, tablet && styles.rowTablet]}>
                    <Input label="City *" value={form.city} onChangeText={(v) => set('city', v)} error={errors.city} placeholder="e.g. Mumbai" accentColor={COLOR.primary} containerStyle={styles.half} />
                    <Input label="State" value={form.state} onChangeText={(v) => set('state', v)} placeholder="e.g. Maharashtra" accentColor={COLOR.primary} containerStyle={styles.half} />
                  </View>
                )}
                {sec.key === 'contact' && (
                  <>
                    <Input label="Contact Name *" value={form.contactName} onChangeText={(v) => set('contactName', v)} error={errors.contactName} placeholder="e.g. Mrs. Sharma" accentColor={COLOR.primary} />
                    <Input label="Designation" value={form.contactDesignation} onChangeText={(v) => set('contactDesignation', v)} placeholder="e.g. Principal" accentColor={COLOR.primary} />
                    <Input label="Phone *" value={form.contactPhone} onChangeText={(v) => set('contactPhone', v)} error={errors.contactPhone} keyboardType="phone-pad" placeholder="+91 98765 43210" accentColor={COLOR.primary} />
                    <Input label="Email" value={form.contactEmail} onChangeText={(v) => set('contactEmail', v)} keyboardType="email-address" autoCapitalize="none" placeholder="contact@school.edu" accentColor={COLOR.primary} />
                  </>
                )}
                {sec.key === 'deal' && (
                  <>
                    <Input label="Estimated Value (₹)" value={form.value} onChangeText={(v) => set('value', v)} keyboardType="numeric" placeholder="e.g. 500000" accentColor={COLOR.primary} />
                    <Input label="Expected Close Date" value={form.closeDate} onChangeText={(v) => set('closeDate', v)} placeholder="YYYY-MM-DD" accentColor={COLOR.primary} />
                    <SelectPicker label="Lead Source" options={LEAD_SOURCES.map((s) => ({ label: s, value: s }))} value={form.source} onChange={(v) => set('source', v)} accentColor={COLOR.primary} />
                  </>
                )}
                {sec.key === 'extra' && (
                  <Input label="Notes" value={form.notes} onChangeText={(v) => set('notes', v)} multiline numberOfLines={4} placeholder="Additional context..." accentColor={COLOR.primary} style={{ textAlignVertical: 'top', minHeight: 80 }} />
                )}
              </>
            )}
          </Card>
        ))}

        <View style={[styles.footerActions, tablet && styles.footerActionsTablet]}>
          <Button title="Cancel" onPress={() => navigation.goBack()} variant="secondary" color="#6B7280" style={styles.cancelBtn} />
          <Button title="Create Lead" onPress={handleSubmit} loading={loading} color={COLOR.primary} style={styles.submitBtn} />
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, gap: 10 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: rf(20), fontWeight: '700', color: '#FFF' },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 12 },
  contentTablet: { padding: 24, maxWidth: 720, alignSelf: 'center', width: '100%' },
  sectionCard: { padding: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: rf(15), fontWeight: '700', color: '#111827' },
  row: { flexDirection: 'row', gap: 10 },
  rowTablet: { gap: 16 },
  half: { flex: 1 },
  footerActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  footerActionsTablet: { justifyContent: 'flex-end' },
  cancelBtn: { flex: 1 },
  submitBtn: { flex: 2 },
  fieldError: { fontSize: rf(12), color: '#DC2626', marginTop: 4 },
});
