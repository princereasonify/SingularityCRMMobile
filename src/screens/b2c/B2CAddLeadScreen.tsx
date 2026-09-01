import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, AlertTriangle } from 'lucide-react-native';
import { ICON_STROKE } from '../../components/common/Icon';
import { Btn, Field, Input, Trigger, Dropdown, Checkbox } from '../../components/crud';
import { Screen, Card } from '../../components/ui';
import { b2cLeadService } from '../../api/b2c/b2cLeadService';
import { b2cUserService } from '../../api/b2c/b2cUserService';
import {
  B2C_LEAD_SOURCES, B2C_ENROLLMENT_TIMELINES, B2C_NATIONALITIES,
  CreateB2CLeadRequest, DuplicateCheckResult,
  B2CEnrollmentTimeline, B2CLeadSource, B2CNationality, B2CLookupOption,
  B2CReferralOptionDto,
} from '../../types/b2c';
import { useToast } from '../../context/ToastContext';
import { useAppTheme } from '../../theme/useAppTheme';
import { useResponsive, MIN_TAP, Responsive } from '../../hooks/useResponsive';

// Web parity: source enum names are shown spaced (GoogleAds → "Google Ads").
const sourceLabel = (s: string) => s.replace(/([A-Z])/g, ' $1').trim();

// The exact rule the API enforces on StudentPassword/ParentPassword (see
// CreateB2CLeadRequest's RegularExpression attribute and BulkPasswordRule). Checked here so a
// bad password is caught before a round trip, and so it can never differ from what the server
// will accept.
const PASSWORD_RE = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>?]).{8,16}$/;
const PASSWORD_HINT = '8-16 chars, 1 uppercase, 1 number, 1 special';

const emptyForm = {
  studentName: '', parentName: '', grade: '', board: '',
  mobileNumber: '', parentMobile: '', email: '', parentEmail: '', schoolName: '',
  nationality: 'Indian' as B2CNationality,
  // Reasonify's real lookup ids, held as strings because the dropdowns are string-valued.
  // The free-text `grade`/`board` above are kept in step with the picked option's NAME —
  // reports and filters read those, the registration call reads the ids.
  reasonifyBoardId: '', reasonifyLanguageId: '', reasonifyGradeId: '',
  studentPassword: '', parentPassword: '',
  area: '', city: '', state: '', pincode: '',
  enrollmentTimeline: 'Immediate' as B2CEnrollmentTimeline,
  source: 'Website' as B2CLeadSource,
  // What earns the student their Reasonify signup bonus. [Required] server-side — a create
  // without it is refused outright, so the lead is never made at all.
  referralCode: '',
  sourceReference: '', notes: '',
};

/**
 * Mirrors the web B2CCreateLead page: student + parent, the Reasonify Board → Medium →
 * Class cascade, both Reasonify passwords, address and enrollment/source. Create only —
 * editing lives in the lead detail screen's own modal, so there is a single edit path.
 * On blur it runs a server-side duplicate check: a HARD dup blocks submit, a SOFT dup warns
 * and needs an explicit override confirm. Enum option values carry backend names.
 */
export const B2CAddLeadScreen = () => {
  const navigation = useNavigation<any>();
  const toast = useToast();
  const T = useAppTheme();
  const r = useResponsive();
  const s = useMemo(() => makeStyles(r), [r]);
  // Exact point widths, not percentages: in a wrapping row with a `gap`, N × (100/N)% always
  // overflows by the gaps and the last card silently drops onto its own line.
  // tablet → 2-up form fields, measured inside the Card (padding 16 a side).
  const cardInnerW = Math.min(r.width, r.maxContentWidth) - r.gutter * 2 - 32;
  const colW: number | '100%' = r.isTablet ? Math.floor((cardInnerW - r.gap) / 2) : '100%';

  const [openDd, setOpenDd] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState(emptyForm);

  // Referral codes this user may credit. The server decides what the list holds — an agent or
  // counselor gets exactly their own, a B2CAdmin gets every active one — so the form never has
  // to know the rule, only render what came back.
  const [referralOptions, setReferralOptions] = useState<B2CReferralOptionDto[]>([]);

  // Reasonify Board → Medium → Grade lookups. The student's Reasonify login is provisioned
  // from this same submit and needs a numeric GradeId, so these are real ids, not free text.
  // Grades are scoped to a (board, medium) pair, so they refetch whenever either changes.
  const [boards, setBoards] = useState<B2CLookupOption[]>([]);
  const [languages, setLanguages] = useState<B2CLookupOption[]>([]);
  const [grades, setGrades] = useState<B2CLookupOption[]>([]);
  const [loadingGrades, setLoadingGrades] = useState(false);

  // Duplicate check (create only).
  const [dupResult, setDupResult] = useState<DuplicateCheckResult | null>(null);
  const [dupChecking, setDupChecking] = useState(false);
  const [overrideDuplicate, setOverrideDuplicate] = useState(false);
  // The email rides along in the query but must not RE-RUN the check: re-running clears the
  // "create anyway" tick, so typing the email address would silently undo a decision the
  // user had already made about a soft duplicate.
  const emailRef = useRef(form.email);
  emailRef.current = form.email;

  useEffect(() => {
    b2cUserService.getReferralOptions()
      .then(res => {
        const options = res.data ?? [];
        setReferralOptions(options);
        // Exactly one option means it is this person's own code — prefill it and leave nothing
        // to choose. That is the agent/counselor case by construction.
        if (options.length === 1) setForm(f => ({ ...f, referralCode: options[0].referralCode }));
      })
      .catch(() => setReferralOptions([]));
    b2cLeadService.getReasonifyBoards().then(res => setBoards(res.data ?? [])).catch(() => setBoards([]));
    b2cLeadService.getReasonifyLanguages().then(res => setLanguages(res.data ?? [])).catch(() => setLanguages([]));
  }, []);

  useEffect(() => {
    if (!form.reasonifyBoardId || !form.reasonifyLanguageId) { setGrades([]); return; }
    setLoadingGrades(true);
    b2cLeadService.getReasonifyGrades(Number(form.reasonifyBoardId), Number(form.reasonifyLanguageId))
      .then(res => setGrades(res.data ?? []))
      .catch(() => setGrades([]))
      .finally(() => setLoadingGrades(false));
  }, [form.reasonifyBoardId, form.reasonifyLanguageId]);

  const set = (key: string, val: any) => {
    setForm(f => ({ ...f, [key]: val }));
    if (errors[key]) setErrors(e => ({ ...e, [key]: '' }));
    // A duplicate now requires BOTH the full name and the mobile number to match, so
    // either field changing invalidates the last check.
    if (key === 'mobileNumber' || key === 'studentName') { setDupResult(null); setOverrideDuplicate(false); }
  };

  // Board/Medium changing invalidates whatever Class was picked under the old pair —
  // Reasonify scopes grades to a specific (boardId, languageId), so a stale gradeId is wrong.
  const setBoardId = (id: string) => setForm(f => ({
    ...f, reasonifyBoardId: id, reasonifyGradeId: '', grade: '',
    board: boards.find(b => String(b.id) === id)?.name ?? '',
  }));
  const setLanguageId = (id: string) => setForm(f => ({
    ...f, reasonifyLanguageId: id, reasonifyGradeId: '', grade: '',
  }));
  const setGradeId = (id: string) => setForm(f => ({
    ...f, reasonifyGradeId: id,
    grade: grades.find(g => String(g.id) === id)?.name ?? '',
  }));

  /**
   * Driven off the value with a debounce, not onBlur: `Input` routes single-line fields to the
   * app's own keyboard (KeyField), which never mounts a TextInput and so never fires a blur —
   * a blur-driven check would simply never run, and a hard duplicate would only surface as a
   * server rejection after the whole form had been filled in.
   */
  useEffect(() => {
    const mobile = form.mobileNumber.trim();
    const studentName = form.studentName.trim();
    if (mobile.replace(/\D/g, '').length < 10 || !studentName) { setDupResult(null); return; }
    let live = true;
    setDupChecking(true);
    const t = setTimeout(() => {
      b2cLeadService.checkDuplicate(mobile, studentName, emailRef.current.trim() || undefined)
        .then(res => { if (live) { setDupResult(res.data ?? null); setOverrideDuplicate(false); } })
        .catch(() => { if (live) setDupResult(null); })
        .finally(() => { if (live) setDupChecking(false); });
    }, 500);
    return () => { live = false; clearTimeout(t); setDupChecking(false); };
  }, [form.mobileNumber, form.studentName]);

  const isHardDup = !!dupResult?.isHardDuplicate;
  const isSoftDup = !isHardDup && !!dupResult?.isSoftDuplicate;
  const submitBlocked = isHardDup || (isSoftDup && !overrideDuplicate);

  // Reasonify creates two separate accounts from this one form, so it rejects a shared
  // address outright (ProvisionReasonifyAccountAsync). Flagged live rather than at submit.
  const emailClash = !!form.email.trim() && !!form.parentEmail.trim()
    && form.email.trim().toLowerCase() === form.parentEmail.trim().toLowerCase();

  /**
   * Create has to satisfy the full [Required] set on CreateB2CLeadRequest — the parent's
   * details and both passwords included, because the same call provisions the student AND
   * parent Reasonify logins.
   */
  const validate = () => {
    const e: Record<string, string> = {};
    const req = (key: string, value: string, message: string) => {
      if (!value.trim()) e[key] = message;
    };

    req('studentName', form.studentName, 'Student name is required');
    req('mobileNumber', form.mobileNumber, 'Mobile number is required');
    req('city', form.city, 'City is required');
    req('state', form.state, 'State is required');

    req('email', form.email, 'Student email is required');
    req('parentName', form.parentName, 'Parent name is required');
    req('parentMobile', form.parentMobile, 'Parent mobile is required');
    req('parentEmail', form.parentEmail, 'Parent email is required');
    req('schoolName', form.schoolName, 'School is required');
    req('pincode', form.pincode, 'Pincode is required');
    req('reasonifyBoardId', form.reasonifyBoardId, 'Board is required');
    req('reasonifyLanguageId', form.reasonifyLanguageId, 'Medium is required');
    req('reasonifyGradeId', form.reasonifyGradeId, 'Class is required');
    req('studentPassword', form.studentPassword, 'Student password is required');
    req('parentPassword', form.parentPassword, 'Parent password is required');
    req('referralCode', form.referralCode, 'Select the referral code to credit for this student.');

    if (!e.studentPassword && !PASSWORD_RE.test(form.studentPassword)) e.studentPassword = PASSWORD_HINT;
    if (!e.parentPassword && !PASSWORD_RE.test(form.parentPassword)) e.parentPassword = PASSWORD_HINT;
    if (!e.parentEmail && emailClash) e.parentEmail = 'Must differ from the student email';
    // An NRI student's postal code is not a six-digit Indian PIN, so the strict rule only
    // applies to the nationality it is actually true for.
    if (!e.pincode && form.nationality === 'Indian' && !/^\d{6}$/.test(form.pincode.trim())) {
      e.pincode = 'Enter a 6-digit pincode';
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (submitBlocked || !validate()) return;
    setLoading(true);
    try {
      const payload: CreateB2CLeadRequest = {
        studentName: form.studentName.trim(),
        parentName: form.parentName.trim(),
        mobileNumber: form.mobileNumber.trim(),
        parentMobile: form.parentMobile.trim(),
        email: form.email.trim(),
        parentEmail: form.parentEmail.trim(),
        grade: form.grade.trim() || null,
        board: form.board.trim() || null,
        schoolName: form.schoolName.trim(),
        nationality: form.nationality,
        reasonifyBoardId: Number(form.reasonifyBoardId),
        reasonifyLanguageId: Number(form.reasonifyLanguageId),
        reasonifyGradeId: Number(form.reasonifyGradeId),
        studentPassword: form.studentPassword,
        parentPassword: form.parentPassword,
        area: form.area.trim() || null,
        city: form.city.trim(),
        state: form.state.trim(),
        pincode: form.pincode.trim(),
        enrollmentTimeline: form.enrollmentTimeline,
        source: form.source,
        referralCode: form.referralCode,
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
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create lead');
    } finally {
      setLoading(false);
    }
  };

  const renderSelect = (
    key: string, label: string,
    options: { label: string; value: string }[],
    value: string, onChange: (v: string) => void, placeholder: string,
    opts?: { disabled?: boolean; error?: string },
  ) => opts?.disabled ? (
    <Field label={label} style={{ width: colW as any }}>
      <Trigger label={placeholder} open={false} onPress={() => {}} />
    </Field>
  ) : (
    <Field label={label} style={{ width: colW as any }}>
      <Trigger label={options.find(o => o.value === value)?.label ?? placeholder} open={openDd === key} onPress={() => setOpenDd(openDd === key ? null : key)} />
      {openDd === key && (
          <Dropdown style={{ width: '100%' }} maxHeight={r.height * 0.35} value={value} options={options} onSelect={v => { onChange(v); setOpenDd(null); }} />
      )}
      {!!opts?.error && <Text style={[s.fieldErr, { color: T.danger }]}>{opts.error}</Text>}
    </Field>
  );

  return (
    <Screen scroll contentStyle={s.page}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity
          accessibilityLabel="Back"
          accessibilityRole="button"
          activeOpacity={0.7}
          onPress={() => navigation.goBack()}
          style={[s.backBtn, { backgroundColor: T.accentSoft }]}
        >
          <ArrowLeft size={20} color={T.accent} strokeWidth={ICON_STROKE} />
        </TouchableOpacity>
        <View style={s.titleBlock}>
          <Text style={[s.h1, { color: T.text }]} numberOfLines={1}>Add New Lead</Text>
          <Text style={[s.h2, { color: T.sub }]} numberOfLines={2}>Capture the student&apos;s details</Text>
        </View>
      </View>

      {/* Student & Parent */}
      <Card style={s.card}>
        <Text style={[s.sectionTitle, { color: T.accent }]}>Student & Parent</Text>
        {/* Student block, then parent block. The parent gets their own Reasonify login from
           this same submit, so their name, mobile and email are as required as the student's. */}
        <View style={s.grid}>
          <Input label="Student Name *" value={form.studentName} onChangeText={v => set('studentName', v)} error={errors.studentName} placeholder="First Middle Last" containerStyle={{ width: colW as any }} />
          <Input label="Mobile (student) *" value={form.mobileNumber} onChangeText={v => set('mobileNumber', v)} error={errors.mobileNumber} keyboardType="phone-pad" placeholder="10-digit mobile" containerStyle={{ width: colW as any }} />
          <Input label="Email (student) *" value={form.email} onChangeText={v => set('email', v)} error={errors.email} keyboardType="email-address" autoCapitalize="none" placeholder="student@example.com" containerStyle={{ width: colW as any }} />
          <Input label="Parent Name *" value={form.parentName} onChangeText={v => set('parentName', v)} error={errors.parentName} placeholder="Parent / guardian name" containerStyle={{ width: colW as any }} />
          <Input label="Mobile (parent) *" value={form.parentMobile} onChangeText={v => set('parentMobile', v)} error={errors.parentMobile} keyboardType="phone-pad" placeholder="10-digit mobile" containerStyle={{ width: colW as any }} />
          <Input label="Email (parent) *" value={form.parentEmail} onChangeText={v => set('parentEmail', v)} error={errors.parentEmail || (emailClash ? 'Must differ from the student email' : undefined)} keyboardType="email-address" autoCapitalize="none" placeholder="parent@example.com" containerStyle={{ width: colW as any }} />
          {renderSelect('nationality', 'Nationality *', B2C_NATIONALITIES.map(n => ({ label: n, value: n })), form.nationality, v => set('nationality', v), 'Select nationality')}
          <Input label="School *" value={form.schoolName} onChangeText={v => set('schoolName', v)} error={errors.schoolName} placeholder="School name" containerStyle={{ width: colW as any }} />
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

      {/* Academic — Reasonify's own Board → Medium → Class lists. These are what the student's
         Reasonify login is registered against (it needs a numeric GradeId, not a label), so
         they are real ids rather than free text. Class stays locked until board + medium are
         chosen, because Reasonify scopes its grade list to that pair. */}
      <Card style={s.card}>
        <Text style={[s.sectionTitle, { color: T.accent }]}>Academic</Text>
        <View style={s.grid}>
          {renderSelect('board', 'Board *', boards.map(b => ({ label: b.name, value: String(b.id) })),
            form.reasonifyBoardId, setBoardId, 'Select board', { error: errors.reasonifyBoardId })}
          {renderSelect('medium', 'Medium *', languages.map(l => ({ label: l.name, value: String(l.id) })),
            form.reasonifyLanguageId, setLanguageId, 'Select medium', { error: errors.reasonifyLanguageId })}
          {renderSelect('class', 'Class / Grade *', grades.map(g => ({ label: g.name, value: String(g.id) })),
            form.reasonifyGradeId, setGradeId,
            !form.reasonifyBoardId || !form.reasonifyLanguageId
              ? 'Select board & medium first'
              : loadingGrades ? 'Loading…' : 'Select class',
            {
              disabled: !form.reasonifyBoardId || !form.reasonifyLanguageId || loadingGrades,
              error: errors.reasonifyGradeId,
            })}
        </View>
      </Card>

      {/* Reasonify Login — created alongside the lead so an agent can log in as the student
         on a house visit. Set once, at creation; the detail screen reads them back. */}
      <Card style={s.card}>
        <Text style={[s.sectionTitle, { color: T.accent }]}>Reasonify Login</Text>
        <Text style={[s.sectionHint, { color: T.dim }]}>
          Both accounts are created with the lead. {PASSWORD_HINT}.
        </Text>
        <View style={s.grid}>
          <Input label="Student Password *" value={form.studentPassword} onChangeText={v => set('studentPassword', v)} error={errors.studentPassword} secureTextEntry autoCapitalize="none" placeholder={PASSWORD_HINT} containerStyle={{ width: colW as any }} />
          <Input label="Parent Password *" value={form.parentPassword} onChangeText={v => set('parentPassword', v)} error={errors.parentPassword} secureTextEntry autoCapitalize="none" placeholder={PASSWORD_HINT} containerStyle={{ width: colW as any }} />
        </View>
      </Card>

      {/* Address */}
      <Card style={s.card}>
        <Text style={[s.sectionTitle, { color: T.accent }]}>Address</Text>
        <View style={s.grid}>
          <Input label="Area / Locality" value={form.area} onChangeText={v => set('area', v)} placeholder="e.g. Satellite" containerStyle={{ width: colW as any }} />
          <Input label="City *" value={form.city} onChangeText={v => set('city', v)} error={errors.city} placeholder="City" containerStyle={{ width: colW as any }} />
          <Input label="State *" value={form.state} onChangeText={v => set('state', v)} error={errors.state} placeholder="State" containerStyle={{ width: colW as any }} />
          <Input label="Pincode *" value={form.pincode} onChangeText={v => set('pincode', v)} error={errors.pincode} keyboardType="number-pad" maxLength={10} placeholder={form.nationality === 'Indian' ? 'e.g. 380015' : 'Postal code'} containerStyle={{ width: colW as any }} />
        </View>
      </Card>

      {/* Enrollment & Source */}
      <Card style={s.card}>
        <Text style={[s.sectionTitle, { color: T.accent }]}>Enrollment & Source</Text>
        <View style={s.grid}>
          {renderSelect('timeline', 'Enrollment Timeline *', B2C_ENROLLMENT_TIMELINES.map(t => ({ label: t.label, value: t.value })), form.enrollmentTimeline, v => set('enrollmentTimeline', v), 'Select timeline')}
          {renderSelect('source', 'Lead Source *', B2C_LEAD_SOURCES.map(x => ({ label: sourceLabel(x), value: x })), form.source, v => set('source', v), 'Select source')}
          {/* What earns the student their 500-coin Reasonify signup bonus. An agent or
             counselor sees their own code, fixed — they may only credit themselves. An admin
             picks whose it is, because assigning that credit is their call. */}
          {referralOptions.length === 1 ? (
            <Field label="Referral Code *" style={{ width: colW as any }}>
              <View style={[s.readOnly, { backgroundColor: T.cardAlt, borderColor: T.line }]}>
                <Text style={[s.readOnlyTxt, { color: T.text }]} numberOfLines={1}>{form.referralCode}</Text>
              </View>
              <Text style={[s.sectionHint, { color: T.dim, marginTop: 0 }]}>Your code — credited with this student.</Text>
            </Field>
          ) : (
            renderSelect(
              'referral', 'Referral Code *',
              referralOptions.map(o => ({
                label: `${o.referralCode} — ${o.name} (${o.role}${o.isManager ? ', Manager' : ''})`,
                value: o.referralCode,
              })),
              form.referralCode, v => set('referralCode', v),
              referralOptions.length === 0 ? 'No active agents or counselors' : 'Select referral code',
              { error: errors.referralCode },
            )
          )}
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
        <Btn label="Create Lead" onPress={submit} loading={loading} disabled={submitBlocked || emailClash || !form.referralCode} style={{ flex: 1 }} />
      </View>
    </Screen>
  );
};

/** Built from the live window metrics: a module-level StyleSheet is evaluated once at import,
 *  so every size would stay frozen at the orientation the app launched in. */
const makeStyles = (r: Responsive) => StyleSheet.create({
  // No paddingBottom: Screen's own `insets.bottom + 28` must survive the override.
  page: { padding: r.gutter, width: '100%', maxWidth: r.maxContentWidth, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: r.rs(16) },
  backBtn: { width: MIN_TAP, height: MIN_TAP, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  titleBlock: { flex: 1, minWidth: 0, gap: 2 },
  h1: { fontWeight: '800', fontSize: r.rf(20), letterSpacing: -0.4 },
  h2: { fontWeight: '500', fontSize: r.rf(12.5) },
  card: { gap: 14, marginBottom: 12 },
  sectionTitle: { fontWeight: '700', fontSize: r.rf(12), letterSpacing: 1, textTransform: 'uppercase' },
  sectionHint: { fontSize: r.rf(11.5), fontWeight: '500', marginTop: -6 },
  fieldErr: { fontSize: r.rf(11), fontWeight: '600', marginTop: 4 },
  readOnly: { height: 46, borderRadius: 13, borderWidth: 1.5, justifyContent: 'center', paddingHorizontal: 14 },
  readOnlyTxt: { fontSize: r.rf(13.5), fontWeight: '700', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: r.gap },
  footerActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  textarea: { minHeight: 88, borderRadius: 13, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 10 },
  textareaTxt: { fontSize: r.rf(14), fontWeight: '500', padding: 0, textAlignVertical: 'top', minHeight: 64 },
  dupChecking: { fontSize: r.rf(11.5), fontWeight: '500' },
  dupBanner: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', borderWidth: 1, borderRadius: 13, padding: 12 },
  dupTitle: { fontSize: r.rf(13), fontWeight: '700' },
  dupMsg: { fontSize: r.rf(12), fontWeight: '500', lineHeight: 17 },
});
