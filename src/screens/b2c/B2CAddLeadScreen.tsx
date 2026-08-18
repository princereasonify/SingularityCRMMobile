import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, useWindowDimensions } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ArrowLeft, AlertTriangle } from 'lucide-react-native';
import { ICON_STROKE } from '../../components/common/Icon';
import { IconBtn, Btn, Field, Input, Trigger, Dropdown, Checkbox } from '../../components/crud';
import { Screen, Card } from '../../components/ui';
import { b2cLeadService } from '../../api/b2c/b2cLeadService';
import {
  B2C_LEAD_SOURCES, B2C_ENROLLMENT_TIMELINES, B2C_LEAD_PRIORITIES,
  CreateB2CLeadRequest, UpdateB2CLeadRequest, DuplicateCheckResult,
  B2CEnrollmentTimeline, B2CLeadSource, B2CLeadPriority,
} from '../../types/b2c';
import { useToast } from '../../context/ToastContext';
import { useAppTheme } from '../../theme/useAppTheme';
import { rf } from '../../utils/responsive';

// Web parity: source enum names are shown spaced (GoogleAds → "Google Ads").
const sourceLabel = (s: string) => s.replace(/([A-Z])/g, ' $1').trim();

const emptyForm = {
  studentName: '', parentName: '', grade: '', board: '',
  mobileNumber: '', email: '', schoolName: '',
  area: '', city: '', state: '', pincode: '',
  enrollmentTimeline: 'Immediate' as B2CEnrollmentTimeline,
  source: 'Website' as B2CLeadSource,
  priority: 'Warm' as B2CLeadPriority,
  sourceReference: '', notes: '',
};

/**
 * Mirrors the web B2CCreateLead page (student/parent, grade, school, address,
 * enrollment timeline & source) and doubles as Add + Edit — the navigator registers
 * this under both `B2CAddLead` and `B2CEditLead`. Edit mode pulls the authoritative
 * record and PATCHes via updateLead; add mode POSTs createLead. On mobile blur (create
 * only) it runs a server-side duplicate check: a HARD dup blocks submit, a SOFT dup
 * warns and needs an explicit override confirm. Enum option values carry backend names.
 */
export const B2CAddLeadScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const editLeadId: number | undefined = route?.params?.leadId;
  const isEdit = !!editLeadId;
  const toast = useToast();
  const T = useAppTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 720;                 // iPad landscape → 2-up form fields
  const colW = wide ? '48.5%' : '100%';

  const [openDd, setOpenDd] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState(emptyForm);

  // Duplicate check (create only).
  const [dupResult, setDupResult] = useState<DuplicateCheckResult | null>(null);
  const [dupChecking, setDupChecking] = useState(false);
  const [overrideDuplicate, setOverrideDuplicate] = useState(false);

  const loadLead = useCallback(() => {
    if (!editLeadId) return;
    b2cLeadService.getLead(editLeadId)
      .then(r => {
        const l: any = r.data;
        if (!l) return;
        setForm({
          studentName: l.studentName ?? '',
          parentName: l.parentName ?? '',
          grade: l.grade ?? '',
          board: l.board ?? '',
          mobileNumber: l.mobileNumber ?? '',
          email: l.email ?? '',
          schoolName: l.schoolName ?? '',
          area: l.area ?? '',
          city: l.city ?? '',
          state: l.state ?? '',
          pincode: l.pincode ?? '',
          enrollmentTimeline: (l.enrollmentTimeline as B2CEnrollmentTimeline) || 'Immediate',
          source: (l.source as B2CLeadSource) || 'Website',
          priority: (l.priority as B2CLeadPriority) || 'Warm',
          sourceReference: l.sourceReference ?? '',
          notes: l.notes ?? '',
        });
      })
      .catch(() => toast.error('Could not load this lead.'))
      .finally(() => setRefreshing(false));
  }, [editLeadId, toast]);

  useEffect(() => { loadLead(); }, [loadLead]);

  const set = (key: string, val: any) => {
    setForm(f => ({ ...f, [key]: val }));
    if (errors[key]) setErrors(e => ({ ...e, [key]: '' }));
    // A duplicate now requires BOTH the full name and the mobile number to match, so
    // either field changing invalidates the last check.
    if (key === 'mobileNumber' || key === 'studentName') { setDupResult(null); setOverrideDuplicate(false); }
  };

  const checkForDuplicate = async () => {
    if (isEdit) return;
    const mobile = form.mobileNumber.trim();
    const studentName = form.studentName.trim();
    if (mobile.length < 10 || !studentName) { setDupResult(null); return; }
    setDupChecking(true);
    try {
      const res = await b2cLeadService.checkDuplicate(mobile, studentName, form.email.trim() || undefined);
      setDupResult(res.data ?? null);
      setOverrideDuplicate(false);
    } catch {
      setDupResult(null);
    } finally {
      setDupChecking(false);
    }
  };

  const isHardDup = !isEdit && !!dupResult?.isHardDuplicate;
  const isSoftDup = !isEdit && !isHardDup && !!dupResult?.isSoftDuplicate;
  const submitBlocked = isHardDup || (isSoftDup && !overrideDuplicate);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.studentName.trim()) e.studentName = 'Student name is required';
    if (!form.mobileNumber.trim()) e.mobileNumber = 'Mobile number is required';
    if (!form.city.trim()) e.city = 'City is required';
    if (!form.state.trim()) e.state = 'State is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (submitBlocked || !validate()) return;
    setLoading(true);
    try {
      if (isEdit) {
        const payload: UpdateB2CLeadRequest = {
          studentName: form.studentName.trim(),
          parentName: form.parentName.trim() || null,
          mobileNumber: form.mobileNumber.trim(),
          priority: form.priority,
          email: form.email.trim() || null,
          grade: form.grade.trim() || null,
          board: form.board.trim() || null,
          schoolName: form.schoolName.trim() || null,
          area: form.area.trim() || null,
          city: form.city.trim(),
          state: form.state.trim(),
          pincode: form.pincode.trim() || null,
          enrollmentTimeline: form.enrollmentTimeline,
          source: form.source,
          sourceReference: form.sourceReference.trim() || null,
          notes: form.notes.trim() || null,
        };
        await b2cLeadService.updateLead(editLeadId!, payload);
        toast.success('Lead updated');
        navigation.goBack();
      } else {
        const payload: CreateB2CLeadRequest = {
          studentName: form.studentName.trim(),
          parentName: form.parentName.trim() || null,
          mobileNumber: form.mobileNumber.trim(),
          email: form.email.trim() || null,
          grade: form.grade.trim() || null,
          board: form.board.trim() || null,
          schoolName: form.schoolName.trim() || null,
          area: form.area.trim() || null,
          city: form.city.trim(),
          state: form.state.trim(),
          pincode: form.pincode.trim() || null,
          enrollmentTimeline: form.enrollmentTimeline,
          source: form.source,
          sourceReference: form.sourceReference.trim() || null,
          notes: form.notes.trim() || null,
          overrideDuplicate,
        };
        const res = await b2cLeadService.createLead(payload);
        const newId = res.data?.lead?.id;
        toast.success('Lead created');
        newId
          ? navigation.replace('B2CLeadDetail', { leadId: newId })
          : navigation.goBack();
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || (isEdit ? 'Failed to update lead' : 'Failed to create lead'));
    } finally {
      setLoading(false);
    }
  };

  const renderSelect = (
    key: string, label: string,
    options: { label: string; value: string }[],
    value: string, onChange: (v: string) => void, placeholder: string,
  ) => (
    <Field label={label} style={{ width: colW as any }}>
      <Trigger label={options.find(o => o.value === value)?.label ?? placeholder} open={openDd === key} onPress={() => setOpenDd(openDd === key ? null : key)} />
      {openDd === key && (
        <Dropdown style={{ width: '100%' }} maxHeight={260} value={value} options={options} onSelect={v => { onChange(v); setOpenDd(null); }} />
      )}
    </Field>
  );

  return (
    <Screen scroll refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadLead(); }}>
      {/* Header */}
      <View style={s.header}>
        <IconBtn kind="view" label="Back" onPress={() => navigation.goBack()}>
          <ArrowLeft size={18} color={T.accent} strokeWidth={ICON_STROKE} />
        </IconBtn>
        <View style={s.titleBlock}>
          <Text style={[s.h1, { color: T.text }]} numberOfLines={1}>{isEdit ? 'Edit Lead' : 'Add New Lead'}</Text>
          <Text style={[s.h2, { color: T.sub }]} numberOfLines={1}>{isEdit ? 'Update this lead' : "Capture the student's details"}</Text>
        </View>
      </View>

      {/* Student & Parent */}
      <Card style={s.card}>
        <Text style={[s.sectionTitle, { color: T.accent }]}>Student & Parent</Text>
        <View style={s.grid}>
          <Input label="Student Name *" value={form.studentName} onChangeText={v => set('studentName', v)} onBlur={checkForDuplicate} error={errors.studentName} placeholder="First Middle Last" containerStyle={{ width: colW as any }} />
          <Input label="Parent Name" value={form.parentName} onChangeText={v => set('parentName', v)} placeholder="Parent / guardian name" containerStyle={{ width: colW as any }} />
          <Input label="Standard / Class" value={form.grade} onChangeText={v => set('grade', v)} placeholder="e.g. 9" containerStyle={{ width: colW as any }} />
          <Input label="Board" value={form.board} onChangeText={v => set('board', v)} placeholder="CBSE / ICSE / State" containerStyle={{ width: colW as any }} />
          <Input label="Mobile *" value={form.mobileNumber} onChangeText={v => set('mobileNumber', v)} onBlur={checkForDuplicate} error={errors.mobileNumber} keyboardType="phone-pad" placeholder="10-digit mobile" containerStyle={{ width: colW as any }} />
          <Input label="Email" value={form.email} onChangeText={v => set('email', v)} keyboardType="email-address" autoCapitalize="none" placeholder="email@example.com" containerStyle={{ width: colW as any }} />
          <Input label="School" value={form.schoolName} onChangeText={v => set('schoolName', v)} placeholder="School name" containerStyle={{ width: colW as any }} />
        </View>

        {dupChecking && <Text style={[s.dupChecking, { color: T.dim }]}>Checking for duplicates…</Text>}

        {(isHardDup || isSoftDup) && (
          <View style={[s.dupBanner, { backgroundColor: (isHardDup ? T.danger : T.warning) + '1A', borderColor: (isHardDup ? T.danger : T.warning) }]}>
            <AlertTriangle size={18} color={isHardDup ? T.danger : T.warning} strokeWidth={ICON_STROKE} />
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={[s.dupTitle, { color: isHardDup ? T.danger : T.warning }]}>
                {isHardDup ? 'Duplicate Lead' : 'Possible Duplicate'}
              </Text>
              <Text style={[s.dupMsg, { color: T.sub }]}>
                {dupResult?.message
                  || (isHardDup
                    ? 'A lead with this name and mobile already exists — you cannot create another.'
                    : 'A lead with this mobile may already exist. Submitting will create anyway.')}
                {dupResult?.existingStudentName ? `\nExisting: ${dupResult.existingStudentName}${dupResult.existingStage ? ` · ${dupResult.existingStage}` : ''}${dupResult.existingAgentName ? ` · ${dupResult.existingAgentName}` : ''}` : ''}
              </Text>
              {isSoftDup && (
                <Checkbox on={overrideDuplicate} onToggle={() => setOverrideDuplicate(v => !v)} label="Create anyway (confirm not a duplicate)" />
              )}
            </View>
          </View>
        )}
      </Card>

      {/* Address */}
      <Card style={s.card}>
        <Text style={[s.sectionTitle, { color: T.accent }]}>Address</Text>
        <View style={s.grid}>
          <Input label="Area / Locality" value={form.area} onChangeText={v => set('area', v)} placeholder="e.g. Satellite" containerStyle={{ width: colW as any }} />
          <Input label="City *" value={form.city} onChangeText={v => set('city', v)} error={errors.city} placeholder="City" containerStyle={{ width: colW as any }} />
          <Input label="State *" value={form.state} onChangeText={v => set('state', v)} error={errors.state} placeholder="State" containerStyle={{ width: colW as any }} />
          <Input label="Pincode" value={form.pincode} onChangeText={v => set('pincode', v)} keyboardType="number-pad" placeholder="Pincode" containerStyle={{ width: colW as any }} />
        </View>
      </Card>

      {/* Enrollment & Source */}
      <Card style={s.card}>
        <Text style={[s.sectionTitle, { color: T.accent }]}>Enrollment & Source</Text>
        <View style={s.grid}>
          {renderSelect('timeline', 'Enrollment Timeline *', B2C_ENROLLMENT_TIMELINES.map(t => ({ label: t.label, value: t.value })), form.enrollmentTimeline, v => set('enrollmentTimeline', v), 'Select timeline')}
          {renderSelect('source', 'Lead Source *', B2C_LEAD_SOURCES.map(x => ({ label: sourceLabel(x), value: x })), form.source, v => set('source', v), 'Select source')}
          {isEdit && renderSelect('priority', 'Priority', B2C_LEAD_PRIORITIES.map(x => ({ label: x, value: x })), form.priority, v => set('priority', v), 'Select priority')}
          <Input label="Source Reference" value={form.sourceReference} onChangeText={v => set('sourceReference', v)} placeholder="Referral name, campaign, etc." containerStyle={{ width: colW as any }} />
        </View>
        <Field label="Notes">
          <View style={[s.textarea, { backgroundColor: T.card, borderColor: T.line }]}>
            <TextInput value={form.notes} onChangeText={v => set('notes', v)} placeholder="Any additional notes…" placeholderTextColor={T.dim} multiline numberOfLines={4} style={[s.textareaTxt, { color: T.text }]} />
          </View>
        </Field>
      </Card>

      <View style={s.footerActions}>
        <Btn label="Cancel" variant="secondary" onPress={() => navigation.goBack()} style={{ flex: 1 }} />
        <Btn label={isEdit ? 'Update Lead' : 'Create Lead'} onPress={submit} loading={loading} disabled={submitBlocked} style={{ flex: 1 }} />
      </View>
    </Screen>
  );
};

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  titleBlock: { flex: 1, minWidth: 0, gap: 2 },
  h1: { fontWeight: '800', fontSize: rf(20), letterSpacing: -0.4 },
  h2: { fontWeight: '500', fontSize: rf(12.5) },
  card: { gap: 14, marginBottom: 12 },
  sectionTitle: { fontWeight: '700', fontSize: rf(12), letterSpacing: 1, textTransform: 'uppercase' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  footerActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  textarea: { minHeight: 88, borderRadius: 13, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 10 },
  textareaTxt: { fontSize: rf(14), fontWeight: '500', padding: 0, textAlignVertical: 'top', minHeight: 64 },
  dupChecking: { fontSize: rf(11.5), fontWeight: '500' },
  dupBanner: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', borderWidth: 1, borderRadius: 13, padding: 12 },
  dupTitle: { fontSize: rf(13), fontWeight: '700' },
  dupMsg: { fontSize: rf(12), fontWeight: '500', lineHeight: 17 },
});
