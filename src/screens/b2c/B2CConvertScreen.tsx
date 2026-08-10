import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Image, Linking, ActivityIndicator,
  TouchableOpacity, useWindowDimensions,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { pick, types } from '@react-native-documents/picker';
import {
  ArrowLeft, ArrowRight, Check, Camera, Upload, FileText, Plus, CreditCard,
  CheckCircle2, ExternalLink,
} from 'lucide-react-native';
import { ICON_STROKE } from '../../components/common/Icon';
import { Screen, Card } from '../../components/ui';
import {
  Btn, IconBtn, Input, Field, Trigger, Dropdown, StatusBadge, FilterChip,
} from '../../components/crud';
import { DateInput } from '../../components/common/DateInput';
import { b2cLeadService } from '../../api/b2c/b2cLeadService';
import { b2cEnrollmentService, PLAN_MODES, DOC_TYPES } from '../../api/b2c/b2cEnrollmentService';
import { useToast } from '../../context/ToastContext';
import { useAppTheme } from '../../theme/useAppTheme';
import { rf } from '../../utils/responsive';

const STEPS = ['Details', 'Documents', 'Payment'];
const GENDERS = ['Male', 'Female', 'Other'];

const toDateInput = (iso?: string) => (iso ? new Date(iso).toISOString().split('T')[0] : '');
const prettyDoc = (t?: string) => (t || '').replace(/([A-Z])/g, ' $1').trim();

type Doc = { id: number; docType: string; url?: string };

/**
 * B2CConvertScreen — mirrors the web B2CConvertRegistration flow, Agent role. Three
 * steps: (1) save student + parent details as an enrollment draft (saveDraft),
 * (2) upload profile photo + documents, (3) add subjects, pick a plan/amount, open
 * the HDFC payment page then poll verifyPayment until the student is confirmed
 * enrolled. Reached from the lead detail "Convert" action with { leadId }.
 */
export const B2CConvertScreen = ({ route, navigation }: any) => {
  const leadId: number = route.params?.leadId;
  const toast = useToast();
  const T = useAppTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 720;                       // iPad landscape → 2-up form fields
  const colW = (wide ? '48.5%' : '100%') as any;

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [enrollment, setEnrollment] = useState<any>(null); // has .id once saved
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [openDd, setOpenDd] = useState<string | null>(null);

  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', mobile: '', gender: '', dateOfBirth: '',
    grade: '', board: '', medium: '', schoolName: '',
    parentName: '', parentEmail: '', parentMobile: '',
  });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  // Documents
  const [profilePic, setProfilePic] = useState('');
  const [docs, setDocs] = useState<Doc[]>([]);
  const [docType, setDocType] = useState('Aadhaar');
  const [uploading, setUploading] = useState(false);

  // Payment
  const [subjects, setSubjects] = useState<string[]>([]);
  const [subjectInput, setSubjectInput] = useState('');
  const [plan, setPlan] = useState('OneTime');
  const [durationMonths, setDurationMonths] = useState('');
  const [amount, setAmount] = useState('');
  const [orderId, setOrderId] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<any>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Load lead + any existing draft, prefill ────────────────────────────────
  const load = useCallback(() => {
    setError('');
    Promise.all([
      b2cLeadService.getLead(leadId),
      b2cEnrollmentService.getByLead(leadId).catch(() => ({ data: null })),
    ]).then(([leadRes, enrRes]: any) => {
      const lead = leadRes?.data;
      const enr = enrRes?.data;
      if (enr) {
        setEnrollment(enr);
        setForm({
          firstName: enr.firstName || '', lastName: enr.lastName || '', email: enr.email || '',
          mobile: enr.mobile || '', gender: enr.gender || '', dateOfBirth: toDateInput(enr.dateOfBirth),
          grade: enr.grade || '', board: enr.board || '', medium: enr.medium || '', schoolName: enr.schoolName || '',
          parentName: enr.parentName || '', parentEmail: enr.parentEmail || '', parentMobile: enr.parentMobile || '',
        });
        setProfilePic(enr.profilePicUrl || '');
        setDocs(enr.documents || []);
        setSubjects(enr.subjects || []);
        if (enr.paymentMode) setPlan(enr.paymentMode);
        if (enr.amount) setAmount(String(enr.amount));
        if (enr.paymentStatus === 'Paid') {
          setResult({ paid: true, reasonifySyncStatus: enr.reasonifySyncStatus, reasonifyStudentId: enr.reasonifyStudentId });
        }
      } else if (lead) {
        const [fn, ...rest] = (lead.studentName || '').trim().split(' ');
        setForm(f => ({
          ...f,
          firstName: fn || '', lastName: rest.join(' '),
          email: lead.email || '', mobile: lead.mobileNumber || '',
          gender: lead.gender || '', dateOfBirth: toDateInput(lead.dateOfBirth),
          grade: lead.grade || '', schoolName: lead.schoolName || '',
          parentName: lead.parentName || '', parentEmail: lead.parentEmail || '', parentMobile: lead.parentMobile || '',
        }));
      }
    }).catch(() => setError('Could not load this lead.'))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, [leadId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  // ─── Step 1 — save details ──────────────────────────────────────────────────
  const saveDetails = async () => {
    if (!form.firstName.trim()) return;
    setSaving(true); setError('');
    try {
      const res = await b2cEnrollmentService.saveDraft({
        leadId: Number(leadId),
        firstName: form.firstName, lastName: form.lastName || undefined,
        email: form.email || undefined, mobile: form.mobile || undefined,
        gender: form.gender || undefined, dateOfBirth: form.dateOfBirth || undefined,
        grade: form.grade || undefined, board: form.board || undefined, medium: form.medium || undefined,
        schoolName: form.schoolName || undefined,
        parentName: form.parentName || undefined, parentEmail: form.parentEmail || undefined, parentMobile: form.parentMobile || undefined,
        subjects,
      });
      setEnrollment(res.data);
      toast.success('Enrollment saved');
      setStep(2);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not save details');
      toast.error(err?.response?.data?.message || 'Could not save details');
    } finally { setSaving(false); }
  };

  // ─── Step 2 — uploads ───────────────────────────────────────────────────────
  const handlePic = async () => {
    if (!enrollment?.id) return;
    const res = await launchImageLibrary({ mediaType: 'photo', quality: 0.7, selectionLimit: 1 });
    const asset = res.assets?.[0];
    if (!asset?.uri) return;
    setUploading(true); setError('');
    try {
      const up = await b2cEnrollmentService.uploadProfilePic(enrollment.id, {
        uri: asset.uri, name: asset.fileName || `photo-${Date.now()}.jpg`, type: asset.type || 'image/jpeg',
      });
      setProfilePic(up.data?.url || asset.uri);
    } catch { setError('Photo upload failed'); }
    finally { setUploading(false); }
  };

  const handleDoc = async () => {
    if (!enrollment?.id) return;
    let file: any;
    try {
      [file] = await pick({ type: [types.images, types.pdf] });
    } catch { return; } // user cancelled
    if (!file?.uri) return;
    setUploading(true); setError('');
    try {
      const up = await b2cEnrollmentService.uploadDocument(enrollment.id, docType, {
        uri: file.uri, name: file.name || `doc-${Date.now()}`, type: file.type || 'application/octet-stream',
      });
      setDocs(d => [{ id: Date.now(), docType, url: up.data?.url }, ...d]);
    } catch { setError('Document upload failed'); }
    finally { setUploading(false); }
  };

  // ─── Step 3 — subjects + payment ────────────────────────────────────────────
  const addSubject = () => {
    const sbj = subjectInput.trim();
    if (sbj && !subjects.includes(sbj)) setSubjects(a => [...a, sbj]);
    setSubjectInput('');
  };

  const runVerify = useCallback(async (oid: string, silent = false) => {
    if (!silent) setVerifying(true);
    try {
      const res = await b2cEnrollmentService.verifyPayment(oid);
      const r = res.data;
      if (r?.paid) {
        if (pollRef.current) clearInterval(pollRef.current);
        setResult(r);
        toast.success('Payment recorded');
      }
    } catch { /* keep polling */ }
    finally { if (!silent) setVerifying(false); }
  }, []);

  const startPayment = async () => {
    if (!(Number(amount) > 0)) { setError('Enter a valid amount'); return; }
    setPaying(true); setError('');
    try {
      const res = await b2cEnrollmentService.initiatePayment({
        enrollmentId: enrollment.id,
        amount: Number(amount),
        paymentMode: plan,
        durationMonths: durationMonths ? Number(durationMonths) : undefined,
        subjects,
      });
      const order = res.data;
      if (!order?.paymentUrl) { setError('Could not start payment. Try again.'); return; }
      Linking.openURL(order.paymentUrl);
      setOrderId(order.orderId);
      pollRef.current = setInterval(() => runVerify(order.orderId, true), 5000);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Payment could not be started');
    } finally { setPaying(false); }
  };

  const goToLead = () => navigation.navigate('B2CLeadDetail', { leadId });

  const renderSelect = (
    key: string, label: string,
    options: { label: string; value: string }[],
    value: string, onChange: (v: string) => void, placeholder: string,
    fieldWidth: any = '100%',
  ) => (
    <Field label={label} style={{ width: fieldWidth, zIndex: openDd === key ? 40 : 1 }}>
      <Trigger
        label={options.find(o => o.value === value)?.label ?? placeholder}
        open={openDd === key}
        onPress={() => setOpenDd(openDd === key ? null : key)}
      />
      {openDd === key && (
        <Dropdown style={{ width: '100%' }} maxHeight={240} value={value} options={options} onSelect={v => { onChange(v); setOpenDd(null); }} />
      )}
    </Field>
  );

  const Header = ({ onBack }: { onBack: () => void }) => (
    <View style={s.header}>
      <IconBtn kind="view" label="Back" onPress={onBack}>
        <ArrowLeft size={18} color={T.accent} strokeWidth={ICON_STROKE} />
      </IconBtn>
      <View style={s.titleBlock}>
        <Text style={[s.h1, { color: T.text }]} numberOfLines={1}>Enroll student</Text>
        <Text style={[s.h2, { color: T.sub }]} numberOfLines={1}>Complete registration, then take payment</Text>
      </View>
    </View>
  );

  // ─── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Screen>
        <View style={{ padding: 16 }}><Header onBack={() => navigation.goBack()} /></View>
        <ActivityIndicator color={T.accent} style={{ marginTop: 60 }} />
      </Screen>
    );
  }

  // ─── Success ────────────────────────────────────────────────────────────────
  if (result?.paid) {
    const synced = result.reasonifySyncStatus === 'Synced';
    const failed = result.reasonifySyncStatus === 'Failed';
    return (
      <Screen scroll>
        <Header onBack={goToLead} />
        <Card style={{ alignItems: 'center', gap: 6 }}>
          <View style={[s.successIcon, { backgroundColor: T.success + '22' }]}>
            <CheckCircle2 size={34} color={T.success} strokeWidth={2.2} />
          </View>
          <Text style={[s.successTitle, { color: T.text }]}>Payment received 🎉</Text>
          <Text style={[s.successSub, { color: T.sub }]}>
            {`${form.firstName} ${form.lastName}`.trim()} is now enrolled.
          </Text>
          <View style={[s.summaryBox, { backgroundColor: T.bg, borderColor: T.line }]}>
            <View style={s.rowBetween}>
              <Text style={[s.summaryK, { color: T.sub }]}>Payment</Text>
              <StatusBadge label="Paid" color={T.success} />
            </View>
            <View style={[s.rowBetween, { marginTop: 10 }]}>
              <Text style={[s.summaryK, { color: T.sub }]}>Reasonify account</Text>
              <StatusBadge
                label={synced ? `Created #${result.reasonifyStudentId}` : failed ? 'Failed' : 'Queued'}
                color={synced ? T.success : failed ? T.danger : T.warning}
              />
            </View>
          </View>
          {!synced && (
            <Text style={[s.hint, { color: T.dim, textAlign: 'center' }]}>
              {failed
                ? 'The student is paid & converted here; the Reasonify account will be retried.'
                : 'The student is paid & converted here; the Reasonify account is queued (sync key not configured yet).'}
            </Text>
          )}
          <Btn label="Back to lead" onPress={goToLead} style={{ alignSelf: 'stretch', marginTop: 6 }} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen scroll refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <Header onBack={() => navigation.goBack()} />

      {/* Stepper */}
      <View style={s.stepper}>
        {STEPS.map((label, i) => {
          const n = i + 1;
          const active = step === n;
          const done = step > n;
          const circleBg = done ? T.success : active ? T.accent : T.line;
          return (
            <React.Fragment key={label}>
              <View style={s.stepItem}>
                <View style={[s.stepCircle, { backgroundColor: circleBg }]}>
                  {done ? <Check size={14} color="#FFF" strokeWidth={3} />
                    : <Text style={[s.stepNum, { color: active ? '#FFF' : T.sub }]}>{n}</Text>}
                </View>
                <Text style={[s.stepLabel, { color: active || done ? T.text : T.sub }]} numberOfLines={1}>{label}</Text>
              </View>
              {i < STEPS.length - 1 && <View style={[s.stepLine, { backgroundColor: done ? T.success : T.line }]} />}
            </React.Fragment>
          );
        })}
      </View>

      {!!error && (
        <View style={[s.errorBanner, { backgroundColor: T.danger + '1A', borderColor: T.danger }]}>
          <Text style={[s.errorTxt, { color: T.danger }]}>{error}</Text>
        </View>
      )}

      {/* ─── STEP 1 — Details ─── */}
      {step === 1 && (
        <>
          <Card style={s.card}>
            <Text style={[s.sectionTitle, { color: T.accent }]}>Student</Text>
            <View style={s.grid}>
              <Input label="First Name *" value={form.firstName} onChangeText={v => set('firstName', v)} placeholder="Required" containerStyle={{ width: colW }} />
              <Input label="Last Name" value={form.lastName} onChangeText={v => set('lastName', v)} containerStyle={{ width: colW }} />
              <Input label="Email" value={form.email} onChangeText={v => set('email', v)} keyboardType="email-address" autoCapitalize="none" placeholder="email@example.com" containerStyle={{ width: colW }} />
              <Input label="Mobile" value={form.mobile} onChangeText={v => set('mobile', v)} keyboardType="phone-pad" placeholder="10-digit mobile" containerStyle={{ width: colW }} />
              {renderSelect('gender', 'Gender', GENDERS.map(g => ({ label: g, value: g })), form.gender, v => set('gender', v), 'Select gender', colW)}
              <View style={{ width: colW }}>
                <DateInput label="Date of Birth" value={form.dateOfBirth} onChange={v => set('dateOfBirth', v)} accentColor={T.accent} maxDate={toDateInput(new Date().toISOString())} />
              </View>
              <Input label="Standard / Grade" value={form.grade} onChangeText={v => set('grade', v)} placeholder="e.g. 9" containerStyle={{ width: colW }} />
              <Input label="Board" value={form.board} onChangeText={v => set('board', v)} placeholder="CBSE / ICSE / State" containerStyle={{ width: colW }} />
              <Input label="Medium" value={form.medium} onChangeText={v => set('medium', v)} placeholder="English / Hindi…" containerStyle={{ width: colW }} />
              <Input label="School" value={form.schoolName} onChangeText={v => set('schoolName', v)} placeholder="School name" containerStyle={{ width: '100%' }} />
            </View>
          </Card>

          <Card style={s.card}>
            <Text style={[s.sectionTitle, { color: T.accent }]}>Parent</Text>
            <View style={s.grid}>
              <Input label="Parent Name" value={form.parentName} onChangeText={v => set('parentName', v)} containerStyle={{ width: colW }} />
              <Input label="Parent Email" value={form.parentEmail} onChangeText={v => set('parentEmail', v)} keyboardType="email-address" autoCapitalize="none" containerStyle={{ width: colW }} />
              <Input label="Parent Mobile" value={form.parentMobile} onChangeText={v => set('parentMobile', v)} keyboardType="phone-pad" containerStyle={{ width: colW }} />
            </View>
          </Card>

          <Btn
            label={saving ? 'Saving…' : 'Save & Continue'}
            onPress={saveDetails}
            loading={saving}
            disabled={saving || !form.firstName.trim()}
            icon={<ArrowRight size={16} color="#FFF" strokeWidth={2.4} />}
          />
        </>
      )}

      {/* ─── STEP 2 — Documents ─── */}
      {step === 2 && (
        <>
          <Card style={s.card}>
            <Text style={[s.sectionTitle, { color: T.accent }]}>Student photo (optional)</Text>
            <View style={s.photoRow}>
              {profilePic ? (
                <Image source={{ uri: profilePic }} style={[s.photo, { borderColor: T.line }]} />
              ) : (
                <View style={[s.photo, s.photoEmpty, { borderColor: T.line, backgroundColor: T.bg }]}>
                  <Camera size={22} color={T.dim} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Btn
                  label={profilePic ? 'Replace photo' : 'Upload photo'}
                  variant={profilePic ? 'secondary' : 'soft'}
                  onPress={handlePic}
                  loading={uploading}
                  icon={<Camera size={14} color={profilePic ? T.text : T.accent} strokeWidth={2.2} />}
                />
              </View>
            </View>
          </Card>

          <Card style={s.card}>
            <Text style={[s.sectionTitle, { color: T.accent }]}>Documents (optional)</Text>
            {renderSelect('docType', 'Type', DOC_TYPES.map(t => ({ label: prettyDoc(t), value: t })), docType, setDocType, 'Select type')}
            <Btn
              label={uploading ? 'Uploading…' : 'Upload document'}
              onPress={handleDoc}
              loading={uploading}
              icon={<Upload size={14} color="#FFF" strokeWidth={2.2} />}
            />
            {docs.map(d => (
              <View key={d.id} style={[s.docRow, { borderColor: T.line }]}>
                <FileText size={15} color={T.accent} strokeWidth={2.2} />
                <Text style={[s.docTxt, { color: T.text }]} numberOfLines={1}>{prettyDoc(d.docType)}</Text>
                {!!d.url && (
                  <TouchableOpacity onPress={() => Linking.openURL(d.url!)} hitSlop={8}>
                    <Text style={[s.docView, { color: T.accent }]}>View</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </Card>

          <View style={s.navRow}>
            <Btn label="Back" variant="secondary" onPress={() => setStep(1)} style={{ flex: 1 }} />
            <Btn
              label="Continue"
              onPress={() => setStep(3)}
              icon={<ArrowRight size={16} color="#FFF" strokeWidth={2.4} />}
              style={{ flex: 1 }}
            />
          </View>
        </>
      )}

      {/* ─── STEP 3 — Payment ─── */}
      {step === 3 && (
        <>
          <Card style={s.card}>
            <Text style={[s.sectionTitle, { color: T.accent }]}>Subjects</Text>
            <View style={s.subjectRow}>
              <Input
                containerStyle={{ flex: 1 }}
                value={subjectInput}
                onChangeText={setSubjectInput}
                onSubmitEditing={addSubject}
                returnKeyType="done"
                placeholder="Add a subject"
              />
              <Btn label="Add" variant="secondary" onPress={addSubject} icon={<Plus size={15} color={T.text} strokeWidth={2.4} />} />
            </View>
            {subjects.length > 0 && (
              <View style={s.chipWrap}>
                {subjects.map(sbj => (
                  <FilterChip key={sbj} label={sbj} onRemove={() => setSubjects(a => a.filter(x => x !== sbj))} />
                ))}
              </View>
            )}
          </Card>

          <Card style={s.card}>
            <Text style={[s.sectionTitle, { color: T.accent }]}>Plan & amount</Text>
            <View style={s.grid}>
              {renderSelect('plan', 'Plan / Duration *', PLAN_MODES, plan, setPlan, 'Select plan', colW)}
              <Input
                label="Duration (months)"
                value={durationMonths}
                onChangeText={v => setDurationMonths(v.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                placeholder="Optional"
                containerStyle={{ width: colW }}
              />
              <Input
                label="Amount (₹) *"
                value={amount}
                onChangeText={v => setAmount(v.replace(/[^0-9.]/g, ''))}
                keyboardType="decimal-pad"
                placeholder="0"
                containerStyle={{ width: colW }}
              />
            </View>
          </Card>

          {!orderId ? (
            <View style={s.navRow}>
              <Btn label="Back" variant="secondary" onPress={() => setStep(2)} style={{ flex: 1 }} />
              <Btn
                label={paying ? 'Opening…' : `Pay ₹${Number(amount || 0).toLocaleString('en-IN')}`}
                variant="success"
                onPress={startPayment}
                loading={paying}
                disabled={paying || !(Number(amount) > 0)}
                icon={<CreditCard size={15} color="#FFF" strokeWidth={2.2} />}
                style={{ flex: 1.4 }}
              />
            </View>
          ) : (
            <Card style={s.card}>
              <View style={[s.infoBanner, { backgroundColor: T.info + '18', borderColor: T.info }]}>
                <ExternalLink size={15} color={T.info} strokeWidth={2.2} />
                <Text style={[s.infoTxt, { color: T.info }]}>
                  The HDFC payment page opened in your browser. Complete the payment there — we'll confirm automatically.
                </Text>
              </View>
              <View style={s.waitRow}>
                <ActivityIndicator color={T.accent} size="small" />
                <Text style={[s.hint, { color: T.sub }]}>Waiting for payment confirmation…</Text>
              </View>
              <Btn
                label={verifying ? 'Checking…' : "I've paid — check now"}
                variant="secondary"
                onPress={() => runVerify(orderId, false)}
                loading={verifying}
              />
            </Card>
          )}
        </>
      )}
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

  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hint: { fontSize: rf(12), fontWeight: '500', lineHeight: 17 },

  // stepper
  stepper: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, gap: 6, marginBottom: 14 },
  stepItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepCircle: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  stepNum: { fontSize: rf(12), fontWeight: '800' },
  stepLabel: { fontSize: rf(13), fontWeight: '600' },
  stepLine: { flex: 1, height: 1.5, marginHorizontal: 4 },

  errorBanner: { borderWidth: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 12 },
  errorTxt: { fontSize: rf(12.5), fontWeight: '600' },

  // photo
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  photo: { width: 74, height: 74, borderRadius: 37, borderWidth: 1 },
  photoEmpty: { alignItems: 'center', justifyContent: 'center' },

  // documents
  docRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 14 },
  docTxt: { flex: 1, fontSize: rf(13.5), fontWeight: '600' },
  docView: { fontSize: rf(12.5), fontWeight: '700' },

  // subjects
  subjectRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  navRow: { flexDirection: 'row', gap: 10, marginTop: 4 },

  // payment waiting
  infoBanner: { flexDirection: 'row', gap: 10, borderWidth: 1, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 14 },
  infoTxt: { flex: 1, fontSize: rf(12.5), fontWeight: '500', lineHeight: 18 },
  waitRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },

  // success
  successIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  successTitle: { fontSize: rf(19), fontWeight: '800', letterSpacing: -0.4 },
  successSub: { fontSize: rf(13.5), fontWeight: '500', textAlign: 'center' },
  summaryBox: { alignSelf: 'stretch', borderWidth: 1, borderRadius: 12, padding: 14, marginTop: 12 },
  summaryK: { fontSize: rf(12.5), fontWeight: '600' },
});
