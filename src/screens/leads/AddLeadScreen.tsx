import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Alert, TouchableOpacity, TextInput, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react-native';
import { leadsApi } from '../../api/leads';
import { UserDto } from '../../types';
import { useAuth } from '../../context/AuthContext';
// Free text 400s the create: CreateLeadRequest.CloseDate is a C# DateTime?.
import { DateInput } from '../../components/common/DateInput';
import { NumField } from '../../components/common/NumField';
import { ICON_STROKE } from '../../components/common/Icon';
import { IconBtn, Btn, Field, Input, Trigger, Dropdown } from '../../components/crud';
import { Card } from '../../components/ui';
import {
  BOARDS, SCHOOL_TYPES, LEAD_SOURCES, editableStages, isClosedStage, stageLabel,
} from '../../utils/constants';
import { getErrorMessage } from '../../utils/errorMessage';
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
/** Edit only, and only when the lead is linked to a School row (lead.schoolInfo). */
const RECORD_SECTION: Section = { title: '🏫 School Record', key: 'record' };

// Web parity (AddLead.jsx / LeadDetail.jsx EditLeadModal).
const PHONE_RE = /^[+\d][\d\s-]{6,}$/;
const EMAIL_RE = /^\S+@\S+\.\S+$/;

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
  const [openDd, setOpenDd] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [foList, setFoList] = useState<UserDto[]>([]);

  const [form, setForm] = useState({
    school: '', board: 'CBSE', type: 'Private', students: '',
    city: '', state: '',
    contactName: '', contactDesignation: '', contactPhone: '', contactEmail: '',
    source: 'Field Visit', value: '', closeDate: '',
    notes: '',
    // "Add Lead" from a list filtered to one user arrives with { foId } — preselect them
    // (web: /leads/new?foId=…).
    foId: (route?.params?.foId ? String(route.params.foId) : '') as string | number,
    // Edit only — carried through to submitLead's expectedUpdatedAt so a concurrent
    // edit elsewhere gets caught as a 409 instead of silently overwritten.
    updatedAt: '' as string | undefined,
    // Edit only (web EditLeadModal): stage, loss reason and the linked School record.
    stage: '',
    lossReason: '',
    schoolAddress: '', schoolPincode: '', schoolPhone: '', schoolEmail: '', schoolWebsite: '',
    principalName: '', principalPhone: '', staffCount: '',
  });
  // Edit only — the lead as loaded: its current stage (drives the stage options and the
  // loss-reason requirement) and its linked school (drives the School Record section and
  // expectedSchoolUpdatedAt).
  const [loaded, setLoaded] = useState<{ stage: string; schoolInfo: any | null } | null>(null);
  const hasLinkedSchool = !!loaded?.schoolInfo;
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Edit mode: pull the authoritative record and prefill. The list row is not
  // enough — LeadListDto omits state/students/closeDate/notes/contact.
  useEffect(() => {
    if (!editLeadId) return;
    leadsApi.getLead(editLeadId)
      .then(r => {
        const l: any = r.data;
        if (!l) return;
        const si = l.schoolInfo || {};
        setLoaded({ stage: l.stage || 'NewLead', schoolInfo: l.schoolInfo ?? null });
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
          updatedAt: l.updatedAt,
          stage: l.stage || 'NewLead',
          lossReason: l.lossReason ?? '',
          schoolAddress: si.address ?? '',
          schoolPincode: si.pincode ?? '',
          schoolPhone: si.phone ?? '',
          schoolEmail: si.email ?? '',
          schoolWebsite: si.website ?? '',
          principalName: si.principalName ?? '',
          principalPhone: si.principalPhone ?? '',
          staffCount: si.staffCount != null ? String(si.staffCount) : '',
        });
      })
      .catch(() => Alert.alert('Error', 'Could not load this lead.'));
  }, [editLeadId]);

  useEffect(() => {
    // The FO picker is create-only — UpdateLeadRequest has no FoId (reassign is its own action).
    if (role !== 'FO' && !isEdit) {
      leadsApi.getAssignableFOs().then((r) => setFoList(Array.isArray(r.data) ? r.data : (r.data as any)?.items ?? [])).catch(() => Alert.alert('Error', 'Failed to load Field Officers.'));
    }
  }, [role, isEdit]);

  const set = (key: string, val: any) => {
    setForm((f) => ({ ...f, [key]: val }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: '' }));
  };

  // Section key → which form fields live inside it (for auto-expand on error)
  const SECTION_FIELDS: Record<string, string[]> = {
    school: ['school', 'board', 'type', 'students'],
    location: ['city', 'state'],
    contact: ['contactName', 'contactPhone', 'contactEmail'],
    deal: ['value', 'closeDate', 'lossReason'],
    extra: ['notes'],
    record: ['schoolPincode', 'schoolPhone', 'schoolEmail', 'principalPhone', 'staffCount'],
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.school.trim()) e.school = 'School name is required';
    const email = form.contactEmail.trim();
    if (email && !EMAIL_RE.test(email)) e.contactEmail = 'Contact email is invalid';
    if (!isEdit) {
      // Create — web AddLead.jsx: city + phone required, contact name optional.
      if (!form.city.trim()) e.city = 'City is required';
      const phone = form.contactPhone.trim();
      if (!phone) e.contactPhone = 'Phone is required';
      else if (!PHONE_RE.test(phone)) e.contactPhone = 'Contact phone looks invalid. Enter at least 7 digits.';
      if (role !== 'FO' && !form.foId) e.foId = 'Please select a Field Officer';
    } else {
      // Edit — web EditLeadModal's checks.
      if (loaded?.stage === 'Lost' && !form.lossReason.trim()) e.lossReason = 'Loss reason is required for a lost lead';
      if (form.contactPhone.trim().length > 30) e.contactPhone = 'Contact phone is too long (max 30)';
      if (hasLinkedSchool) {
        const sEmail = form.schoolEmail.trim();
        if (sEmail && !EMAIL_RE.test(sEmail)) e.schoolEmail = 'School email is invalid';
        if (form.schoolPincode.trim().length > 10) e.schoolPincode = 'Pincode must be 10 characters or fewer';
        if (form.schoolPhone.trim().length > 30) e.schoolPhone = 'School phone is too long (max 30)';
        if (form.principalPhone.trim().length > 30) e.principalPhone = 'Principal phone is too long (max 30)';
      }
      if (form.value !== '' && Number(form.value) < 0) e.value = 'Value cannot be negative';
      if (form.students !== '' && Number(form.students) < 0) e.students = 'Students cannot be negative';
    }
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
    // Edit never runs the duplicate check — the lead being edited would match itself.
    if (isEdit) { await submitLead(); return; }
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
      if (isEdit) {
        // Web parity (LeadDetail.jsx EditLeadModal): an emptied box is sent as "" so the
        // server clears it — null means "leave as is". No foId/source: UpdateLeadRequest
        // has neither.
        const text = (v?: string) => (v ?? '').trim();
        const schoolText = (v?: string) => (hasLinkedSchool ? text(v) : null);
        const editPayload = {
          school: form.school.trim(),
          board: form.board ?? '',
          city: text(form.city),
          state: text(form.state),
          students: form.students !== '' ? Number(form.students) : null,
          type: form.type ?? '',
          stage: form.stage,
          value: form.value !== '' ? Number(form.value) : 0,
          closeDate: form.closeDate || null,
          clearCloseDate: !form.closeDate,
          // The version this form was opened on — the server refuses (409) if someone saved since.
          expectedUpdatedAt: form.updatedAt,
          // Same guard for the linked School row the schoolXxx fields write onto.
          expectedSchoolUpdatedAt: hasLinkedSchool ? loaded?.schoolInfo?.updatedAt : null,
          notes: form.notes ?? '',
          lossReason: loaded?.stage === 'Lost' ? (form.lossReason.trim() || null) : null,
          contactName: text(form.contactName),
          contactDesignation: text(form.contactDesignation),
          contactPhone: text(form.contactPhone),
          contactEmail: text(form.contactEmail),
          schoolAddress: schoolText(form.schoolAddress),
          schoolPincode: schoolText(form.schoolPincode),
          schoolPhone: schoolText(form.schoolPhone),
          schoolEmail: schoolText(form.schoolEmail),
          schoolWebsite: schoolText(form.schoolWebsite),
          principalName: schoolText(form.principalName),
          principalPhone: schoolText(form.principalPhone),
          staffCount: hasLinkedSchool && form.staffCount !== '' ? Number(form.staffCount) : null,
        };
        await leadsApi.updateLead(editLeadId!, editPayload as any);
        Alert.alert('Success', 'Lead updated successfully!', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
        return;
      }
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
      await leadsApi.createLead(payload as any);
      Alert.alert('Success', 'Lead created successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', getErrorMessage(err, isEdit ? 'Failed to update lead' : 'Failed to create lead'));
    } finally {
      setLoading(false);
    }
  };

  const toggle = (key: string) => setCollapsed((c) => ({ ...c, [key]: !c[key] }));

  /**
   * Every select on this screen is a Trigger + inline Dropdown that opens below
   * it. These were `SelectPicker`, which is a centred Modal — not a control this
   * design system has. One `openDd` key means opening one closes the others.
   */
  const renderSelect = (
    key: string,
    label: string,
    options: { label: string; value: string }[],
    value: string,
    onChange: (v: string) => void,
    placeholder: string,
    containerStyle?: any,
  ) => (
    <Field label={label} style={containerStyle}>
      <Trigger
        label={options.find((o) => o.value === value)?.label ?? placeholder}
        open={openDd === key}
        onPress={() => setOpenDd(openDd === key ? null : key)}
      />
      {openDd === key && (
        <Dropdown
          style={styles.ddFull}
          maxHeight={240}
          value={value}
          options={options}
          onSelect={(v) => { onChange(v); setOpenDd(null); }}
        />
      )}
    </Field>
  );

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
          {role !== 'FO' && !isEdit && (
          <Card style={styles.sectionCard}>
            <Text style={[styles.sectionTitle, { color: T.text }]}>👤 Assign to FO</Text>
            {renderSelect(
              'foId',
              'Select Field Officer *',
              foList.map((fo) => ({ label: fo.name, value: String(fo.id) })),
              String(form.foId ?? ''),
              (v) => set('foId', v),
              foList.length === 0 ? 'No field officers available' : 'Select a field officer',
            )}
            {errors.foId ? <Text style={[styles.fieldError, { color: T.danger }]}>{errors.foId}</Text> : null}
          </Card>
        )}

        {(hasLinkedSchool ? [...SECTIONS, RECORD_SECTION] : SECTIONS).map((sec) => (
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
                    <Input label="School Name *" value={form.school} onChangeText={(v) => set('school', v)} error={errors.school} placeholder="e.g. DPS Andheri" />
                    <View style={[styles.row, twoWide && styles.rowTablet]}>
                      {renderSelect('board', 'Board *', BOARDS.map((b) => ({ label: b, value: b })), form.board, (v) => set('board', v), 'Select board', styles.half)}
                      {renderSelect('type', 'Type *', SCHOOL_TYPES.map((t) => ({ label: t, value: t })), form.type, (v) => set('type', v), 'Select type', styles.half)}
                    </View>
                    <Field label="Number of Students">
                      <NumField value={form.students} onChangeText={(v) => set('students', v)} placeholder="e.g. 1200" label="Number of Students" allowDecimal={false} error={errors.students} />
                    </Field>
                  </>
                )}
                {sec.key === 'location' && (
                  <View style={[styles.row, twoWide && styles.rowTablet]}>
                    <Input label="City *" value={form.city} onChangeText={(v) => set('city', v)} error={errors.city} placeholder="e.g. Mumbai" containerStyle={styles.half} />
                    <Input label="State" value={form.state} onChangeText={(v) => set('state', v)} placeholder="e.g. Maharashtra" containerStyle={styles.half} />
                  </View>
                )}
                {sec.key === 'contact' && (
                  <>
                    <Input label="Contact Name" value={form.contactName} onChangeText={(v) => set('contactName', v)} error={errors.contactName} placeholder="e.g. Mrs. Sharma" />
                    <Input label="Designation" value={form.contactDesignation} onChangeText={(v) => set('contactDesignation', v)} placeholder="e.g. Principal" />
                    <Input label={isEdit ? 'Phone' : 'Phone *'} value={form.contactPhone} onChangeText={(v) => set('contactPhone', v)} error={errors.contactPhone} keyboardType="phone-pad" placeholder="+91 98765 43210" />
                    <Input label="Email" value={form.contactEmail} onChangeText={(v) => set('contactEmail', v)} error={errors.contactEmail} keyboardType="email-address" autoCapitalize="none" placeholder="contact@school.edu" />
                  </>
                )}
                {sec.key === 'deal' && (
                  <>
                    {isEdit && !!loaded && (() => {
                      // Won comes from an approved deal and Lost from Mark Lost, so neither is
                      // offered; a closed lead keeps its stage (a manager can still move
                      // Won → Implementation Started). Same rules as LeadService.UpdateLeadAsync.
                      const stageOptions = editableStages(loaded.stage, role);
                      return (
                        <View>
                          {stageOptions.length < 2 ? (
                            <Field label="Stage">
                              <Trigger label={stageLabel(form.stage)} onPress={() => {}} />
                            </Field>
                          ) : renderSelect(
                            'stage', 'Stage',
                            stageOptions.map((st) => ({ label: stageLabel(st), value: st })),
                            form.stage, (v) => set('stage', v), 'Select stage',
                          )}
                          {!isClosedStage(loaded.stage) && (
                            <Text style={[styles.hint, { color: T.dim }]}>Won is set by an approved deal; Lost by Mark Lost.</Text>
                          )}
                        </View>
                      );
                    })()}
                    <Field label="Estimated Value (₹)">
                      <NumField value={form.value} onChangeText={(v) => set('value', v)} placeholder="e.g. 500000" label="Estimated Value (₹)" error={errors.value} />
                    </Field>
                    <DateInput label="Expected Close Date" value={form.closeDate} onChange={(v) => set('closeDate', v)} accentColor={T.accent} />
                    {isEdit && loaded?.stage === 'Lost' && (
                      <Input label="Loss Reason *" value={form.lossReason} onChangeText={(v) => set('lossReason', v)} error={errors.lossReason} maxLength={500} placeholder="Why was this lead lost?" />
                    )}
                    {/* Source is set at creation — UpdateLeadRequest has no Source, so an edit could not change it. */}
                    {!isEdit && renderSelect('source', 'Lead Source', LEAD_SOURCES.map((s) => ({ label: s, value: s })), form.source, (v) => set('source', v), 'Select source')}
                  </>
                )}
                {sec.key === 'record' && (
                  <>
                    <Text style={[styles.hint, styles.hintTop, { color: T.accent }]}>Linked School #{loaded?.schoolInfo?.schoolId}</Text>
                    <Field label="Address">
                      <View style={[styles.textarea, { backgroundColor: T.card, borderColor: T.line }]}>
                        <TextInput
                          value={form.schoolAddress}
                          onChangeText={(v) => set('schoolAddress', v)}
                          placeholder="Street, area, landmark..."
                          placeholderTextColor={T.dim}
                          multiline
                          maxLength={500}
                          style={[styles.textareaTxt, { color: T.text }]}
                        />
                      </View>
                    </Field>
                    <View style={[styles.row, twoWide && styles.rowTablet]}>
                      <Input label="Pincode" value={form.schoolPincode} onChangeText={(v) => set('schoolPincode', v)} error={errors.schoolPincode} maxLength={10} keyboardType="number-pad" placeholder="e.g. 400001" containerStyle={styles.half} />
                      <Input label="Website" value={form.schoolWebsite} onChangeText={(v) => set('schoolWebsite', v)} maxLength={300} autoCapitalize="none" placeholder="https://..." containerStyle={styles.half} />
                    </View>
                    <View style={[styles.row, twoWide && styles.rowTablet]}>
                      <Input label="School Phone" value={form.schoolPhone} onChangeText={(v) => set('schoolPhone', v)} error={errors.schoolPhone} maxLength={30} keyboardType="phone-pad" placeholder="Office phone" containerStyle={styles.half} />
                      <Input label="School Email" value={form.schoolEmail} onChangeText={(v) => set('schoolEmail', v)} error={errors.schoolEmail} maxLength={150} keyboardType="email-address" autoCapitalize="none" placeholder="office@school.com" containerStyle={styles.half} />
                    </View>
                    <View style={[styles.row, twoWide && styles.rowTablet]}>
                      <Input label="Principal Name" value={form.principalName} onChangeText={(v) => set('principalName', v)} maxLength={150} placeholder="Principal's full name" containerStyle={styles.half} />
                      <Input label="Principal Phone" value={form.principalPhone} onChangeText={(v) => set('principalPhone', v)} error={errors.principalPhone} maxLength={30} keyboardType="phone-pad" placeholder="Principal's phone" containerStyle={styles.half} />
                    </View>
                    <Field label="Staff Count">
                      <NumField value={form.staffCount} onChangeText={(v) => set('staffCount', v)} placeholder="0" label="Staff Count" allowDecimal={false} />
                    </Field>
                  </>
                )}
                {sec.key === 'extra' && (
                  /* Kit Input hard-codes height 46 — a multiline field needs Field + TextInput. */
                  <Field label="Notes">
                    <View style={[styles.textarea, { backgroundColor: T.card, borderColor: T.line }]}>
                      <TextInput
                        value={form.notes}
                        onChangeText={(v) => set('notes', v)}
                        placeholder="Additional context..."
                        placeholderTextColor={T.dim}
                        multiline
                        numberOfLines={4}
                        style={[styles.textareaTxt, { color: T.text }]}
                      />
                    </View>
                  </Field>
                )}
              </>
            )}
          </Card>
        ))}

        <View style={styles.footerActions}>
          <Btn label="Cancel" variant="secondary" onPress={() => navigation.goBack()} style={styles.actionBtn} />
          <Btn label={isEdit ? 'Update Lead' : 'Create Lead'} onPress={handleSubmit} loading={loading} style={styles.actionBtn} />
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
  contentTablet: { padding: 24, maxWidth: 900, alignSelf: 'center', width: '100%' },
  ddFull: { width: '100%' },
  sectionCard: { padding: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontWeight: '700', fontSize: rf(15) },
  row: { flexDirection: 'row', gap: 10 },
  rowTablet: { gap: 16 },
  half: { flex: 1 },
  footerActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  actionBtn: { flex: 1 },
  fieldError: { fontWeight: '400', fontSize: rf(12), marginTop: 4 },
  hint: { fontWeight: '500', fontSize: rf(11.5), marginTop: 6 },
  hintTop: { marginTop: 0, marginBottom: 8 },
  textarea: { minHeight: 80, borderRadius: 13, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 10 },
  textareaTxt: { fontSize: rf(14), fontWeight: '500', padding: 0, textAlignVertical: 'top', minHeight: 60 },
});
