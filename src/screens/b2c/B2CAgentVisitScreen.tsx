import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Image, Alert, PermissionsAndroid, Platform, Linking,
  ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { launchCamera, Asset } from 'react-native-image-picker';
import Geolocation from '@react-native-community/geolocation';
import { MapPin, Camera, ShieldCheck, CheckCircle2, RefreshCw } from 'lucide-react-native';
import { AppHeader, Card, SectionLabel } from '../../components/ui';
import { Btn, Input, StatusBadge, Trigger, Dropdown } from '../../components/crud';
import { b2cActivityService } from '../../api/b2c/b2cActivityService';
import { b2cLeadService } from '../../api/b2c/b2cLeadService';
import { B2CLeadDetailDto, B2CLeadListDto } from '../../types/b2c';
import { useToast } from '../../context/ToastContext';
import { useAppTheme } from '../../theme/useAppTheme';
import { rf } from '../../utils/responsive';

type Coords = { lat: number; lng: number; accuracy?: number };
type Selfie = { uri: string; name: string; type: string };

/**
 * Agent geo-verified visit capture (phase-2 native flow). Route `B2CAgentVisit`
 * receives `{ leadId }`. The agent must capture GPS + a live selfie, then verify a
 * one-time code sent to the student before the visit can be submitted. On submit we
 * create the Visit activity (lat/lng/notes) to obtain its id, then attach the selfie.
 *
 * GPS / selfie / permission handling copied from VisitReportScreen + HomeLocationScreen.
 */
export const B2CAgentVisitScreen = ({ route, navigation }: any) => {
  const paramLeadId: number | undefined = route.params?.leadId;
  const T = useAppTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();

  // When launched from the "My Leads" detail a leadId is passed; when opened from the
  // drawer "Visit" entry there is none, so the agent picks from their assigned leads.
  const [leadId, setLeadId] = useState<number | null>(paramLeadId ?? null);
  const [leadOptions, setLeadOptions] = useState<B2CLeadListDto[]>([]);
  const [leadPickerOpen, setLeadPickerOpen] = useState(false);

  const [lead, setLead] = useState<B2CLeadDetailDto | null>(null);
  const [loadingLead, setLoadingLead] = useState(paramLeadId != null);

  const [coords, setCoords] = useState<Coords | null>(null);
  const [locating, setLocating] = useState(false);

  const [selfie, setSelfie] = useState<Selfie | null>(null);

  // Student ID captured during the visit: an ID-card photo, or manual school/board/standard.
  const [studentIdPhoto, setStudentIdPhoto] = useState<Selfie | null>(null);
  const [studentManual, setStudentManual] = useState({ schoolName: '', board: '', standard: '' });

  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ─── Load the assigned-lead picker when no lead was passed in ───────────────
  useEffect(() => {
    if (paramLeadId != null) return;
    b2cLeadService.getLeads({ pageSize: 100 })
      .then(res => setLeadOptions(res.data?.items ?? []))
      .catch(() => {});
  }, [paramLeadId]);

  // ─── Load the selected lead's detail ────────────────────────────────────────
  useEffect(() => {
    if (leadId == null) { setLead(null); setLoadingLead(false); return; }
    setLoadingLead(true);
    b2cLeadService.getLead(leadId)
      .then(res => setLead(res.data))
      .catch(() => toast.error('Could not load this lead.'))
      .finally(() => setLoadingLead(false));
  }, [leadId]);

  // Changing the target lead invalidates any code already sent/verified.
  const changeLead = useCallback((id: number) => {
    setLeadId(id);
    setLeadPickerOpen(false);
    setOtpSent(false);
    setOtpVerified(false);
    setOtp('');
  }, []);

  // ─── Android permissions (same pattern as VisitReportScreen) ───────────────
  const askAndroid = async (permission: any, title: string, message: string) => {
    if (Platform.OS !== 'android') return true;
    try {
      if (await PermissionsAndroid.check(permission)) return true;
      const result = await PermissionsAndroid.request(permission, {
        title, message, buttonPositive: 'Allow', buttonNegative: 'Deny',
      });
      if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
        Alert.alert(title, 'Access is blocked. Please enable it in Settings.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]);
        return false;
      }
      if (result !== PermissionsAndroid.RESULTS.GRANTED) {
        Alert.alert('Permission Denied', message);
        return false;
      }
      return true;
    } catch {
      Alert.alert('Error', 'Could not request permission.');
      return false;
    }
  };

  // ─── Capture location ──────────────────────────────────────────────────────
  const captureLocation = useCallback(async () => {
    const ok = await askAndroid(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      'Location Permission Required',
      'The app needs your location to geo-verify this visit.',
    );
    if (!ok) return;
    setLocating(true);
    Geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setCoords({ lat: latitude, lng: longitude, accuracy });
        setLocating(false);
      },
      (error) => {
        setLocating(false);
        Alert.alert('Location error', error?.message || 'Could not get your location.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }, []);

  // ─── Take selfie ─────────────────────────────────────────────────────────—
  const takeSelfie = useCallback(async () => {
    const ok = await askAndroid(
      PermissionsAndroid.PERMISSIONS.CAMERA,
      'Camera Permission Required',
      'The app needs camera access to capture your visit selfie.',
    );
    if (!ok) return;
    launchCamera(
      // quality < 1 makes iOS re-encode to JPEG; front camera for a visit selfie.
      { mediaType: 'photo', quality: 0.7, cameraType: 'front', saveToPhotos: false, includeBase64: false },
      (res) => {
        if (res.didCancel) return;
        if (res.errorCode) {
          Alert.alert('Camera', res.errorMessage ?? 'Could not open the camera.');
          return;
        }
        const asset: Asset | undefined = res.assets?.[0];
        if (!asset?.uri) return;
        setSelfie({
          uri: asset.uri,
          name: asset.fileName || `visit-selfie-${Date.now()}.jpg`,
          type: asset.type || 'image/jpeg',
        });
      },
    );
  }, []);

  // ─── Capture the student's ID card (rear camera) ────────────────────────────
  const takeStudentId = useCallback(async () => {
    const ok = await askAndroid(
      PermissionsAndroid.PERMISSIONS.CAMERA,
      'Camera Permission Required',
      'The app needs camera access to capture the student ID card.',
    );
    if (!ok) return;
    launchCamera(
      { mediaType: 'photo', quality: 0.7, cameraType: 'back', saveToPhotos: false, includeBase64: false },
      (res) => {
        if (res.didCancel) return;
        if (res.errorCode) {
          Alert.alert('Camera', res.errorMessage ?? 'Could not open the camera.');
          return;
        }
        const asset: Asset | undefined = res.assets?.[0];
        if (!asset?.uri) return;
        setStudentIdPhoto({
          uri: asset.uri,
          name: asset.fileName || `student-id-${Date.now()}.jpg`,
          type: asset.type || 'image/jpeg',
        });
      },
    );
  }, []);

  // ─── OTP ────────────────────────────────────────────────────────────────—
  const handleSendOtp = useCallback(async () => {
    if (!leadId) return;
    setSendingOtp(true);
    try {
      const res = await b2cActivityService.sendOtp({ leadId });
      if (res.data?.success === false) {
        toast.error(res.data.message || 'Could not send the OTP.');
        return;
      }
      setOtpSent(true);
      setOtpVerified(false);
      setOtp('');
      toast.success(res.data?.message || 'OTP sent');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to send OTP.');
    } finally {
      setSendingOtp(false);
    }
  }, [leadId]);

  const handleVerifyOtp = useCallback(async () => {
    if (!leadId) return;
    if (otp.trim().length !== 6) {
      Alert.alert('Validation', 'Enter the 6-digit code.');
      return;
    }
    setVerifyingOtp(true);
    try {
      const res = await b2cActivityService.verifyOtp({ leadId, otp: otp.trim() });
      if (res.data?.success) {
        setOtpVerified(true);
        toast.success('Visit verified');
      } else {
        setOtpVerified(false);
        toast.error(
          res.data?.message ||
            (res.data?.attemptsRemaining != null
              ? `Incorrect code. ${res.data.attemptsRemaining} attempts remaining.`
              : 'Incorrect code.'),
        );
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to verify OTP.');
    } finally {
      setVerifyingOtp(false);
    }
  }, [leadId, otp]);

  // ─── Submit ────────────────────────────────────────────────────────────────
  const canSubmit = !!coords && !!selfie && otpVerified && !submitting;

  const handleSubmit = useCallback(async () => {
    if (!leadId || !coords || !selfie || !otpVerified) return;
    setSubmitting(true);
    try {
      const res = await b2cActivityService.createActivity({
        leadId,
        type: 'Visit',
        notes: notes.trim() || undefined,
        latitude: coords.lat,
        longitude: coords.lng,
        authMethod: 'OTP',
        completedAt: new Date().toISOString(),
        // Manual student-ID entry (when no ID card is photographed).
        studentIdSchoolName: studentManual.schoolName.trim() || undefined,
        studentIdBoard: studentManual.board.trim() || undefined,
        studentIdStandard: studentManual.standard.trim() || undefined,
      });
      const activityId = res.data?.id;
      if (!activityId) throw new Error('The visit was created but no id was returned.');
      await b2cActivityService.uploadSelfie(activityId, selfie);
      // Attach the student ID-card image when captured (optional).
      if (studentIdPhoto) {
        try { await b2cActivityService.uploadStudentId(activityId, studentIdPhoto); }
        catch { /* ID image optional; visit already submitted */ }
      }
      toast.success('Visit submitted');
      navigation.goBack();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to submit the visit.');
    } finally {
      setSubmitting(false);
    }
  }, [leadId, coords, selfie, otpVerified, notes, navigation, studentManual, studentIdPhoto, toast]);

  return (
    <View style={[s.root, { backgroundColor: T.bg, paddingTop: insets.top }]}>
      <AppHeader title="Log Visit" subtitle={lead?.studentName} onBack={() => navigation.goBack()} />

      <View style={[s.content, { paddingBottom: insets.bottom + 20 }]}>
        {/* Lead */}
        <Card style={[s.cardGap, { zIndex: 20 }]}>
          <SectionLabel>Student</SectionLabel>
          {paramLeadId == null && (
            <View style={{ zIndex: 30 }}>
              <Trigger
                label={lead?.studentName || (leadId != null ? `Lead #${leadId}` : 'Select a student…')}
                open={leadPickerOpen}
                onPress={() => setLeadPickerOpen(o => !o)}
              />
              {leadPickerOpen && (
                <Dropdown
                  style={{ width: '100%' }}
                  maxHeight={260}
                  value={leadId != null ? String(leadId) : undefined}
                  options={leadOptions.map(l => ({ label: `${l.studentName} · ${l.stage}`, value: String(l.id) }))}
                  onSelect={(v) => changeLead(Number(v))}
                />
              )}
            </View>
          )}
          {loadingLead ? (
            <ActivityIndicator color={T.accent} />
          ) : lead ? (
            <>
              <Text style={[s.leadName, { color: T.text }]}>{lead.studentName}</Text>
              <Text style={[s.leadMeta, { color: T.sub }]}>
                {[lead.mobileNumber, lead.city].filter(Boolean).join(' · ')}
              </Text>
            </>
          ) : paramLeadId != null ? (
            <Text style={{ color: T.dim }}>Lead {leadId ?? '—'}</Text>
          ) : null}
        </Card>

        {/* Location */}
        <Card style={s.cardGap}>
          <View style={s.rowBetween}>
            <SectionLabel>Location</SectionLabel>
            {!!coords && <StatusBadge label="Captured" color={T.success} />}
          </View>
          {coords ? (
            <Text style={[s.value, { color: T.text }]}>
              {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
              {coords.accuracy ? `  (±${Math.round(coords.accuracy)}m)` : ''}
            </Text>
          ) : (
            <Text style={[s.hint, { color: T.dim }]}>Capture your GPS position at the student's location.</Text>
          )}
          <Btn
            label={coords ? 'Recapture location' : 'Capture location'}
            variant={coords ? 'secondary' : 'soft'}
            onPress={captureLocation}
            loading={locating}
            icon={coords
              ? <RefreshCw size={14} color={T.text} strokeWidth={2.2} />
              : <MapPin size={14} color={T.accent} strokeWidth={2.2} />}
          />
        </Card>

        {/* Selfie */}
        <Card style={s.cardGap}>
          <View style={s.rowBetween}>
            <SectionLabel>Selfie</SectionLabel>
            {!!selfie && <StatusBadge label="Taken" color={T.success} />}
          </View>
          <View style={s.selfieRow}>
            {selfie ? (
              <Image source={{ uri: selfie.uri }} style={[s.thumb, { borderColor: T.line }]} />
            ) : (
              <View style={[s.thumb, s.thumbEmpty, { borderColor: T.line, backgroundColor: T.fieldBg }]}>
                <Camera size={22} color={T.dim} />
              </View>
            )}
            <View style={s.selfieBtn}>
              <Btn
                label={selfie ? 'Retake selfie' : 'Take selfie'}
                variant={selfie ? 'secondary' : 'soft'}
                onPress={takeSelfie}
                icon={<Camera size={14} color={selfie ? T.text : T.accent} strokeWidth={2.2} />}
              />
            </View>
          </View>
        </Card>

        {/* Student ID — capture the ID card, or enter school/board/standard manually */}
        <Card style={s.cardGap}>
          <View style={s.rowBetween}>
            <SectionLabel>Student ID</SectionLabel>
            {(!!studentIdPhoto || !!studentManual.schoolName) && <StatusBadge label="Added" color={T.success} />}
          </View>
          <View style={s.selfieRow}>
            {studentIdPhoto ? (
              <Image source={{ uri: studentIdPhoto.uri }} style={[s.thumb, { borderColor: T.line }]} />
            ) : (
              <View style={[s.thumb, s.thumbEmpty, { borderColor: T.line, backgroundColor: T.fieldBg }]}>
                <Camera size={22} color={T.dim} />
              </View>
            )}
            <View style={s.selfieBtn}>
              <Btn
                label={studentIdPhoto ? 'Retake ID card' : 'Capture ID card'}
                variant={studentIdPhoto ? 'secondary' : 'soft'}
                onPress={takeStudentId}
                icon={<Camera size={14} color={studentIdPhoto ? T.text : T.accent} strokeWidth={2.2} />}
              />
            </View>
          </View>
          {!studentIdPhoto && (
            <View style={{ gap: 8, marginTop: 4 }}>
              <Text style={[s.manualHint, { color: T.dim }]}>No ID card? Enter details:</Text>
              <Input label="School name" value={studentManual.schoolName} onChangeText={v => setStudentManual(f => ({ ...f, schoolName: v }))} placeholder="e.g. Delhi Public School" />
              <View style={s.manualRow}>
                <View style={{ flex: 1 }}><Input label="Board" value={studentManual.board} onChangeText={v => setStudentManual(f => ({ ...f, board: v }))} placeholder="CBSE" /></View>
                <View style={{ flex: 1 }}><Input label="Standard" value={studentManual.standard} onChangeText={v => setStudentManual(f => ({ ...f, standard: v }))} placeholder="9th" /></View>
              </View>
            </View>
          )}
        </Card>

        {/* OTP */}
        <Card style={s.cardGap}>
          <View style={s.rowBetween}>
            <SectionLabel>OTP Verification</SectionLabel>
            {otpVerified && <StatusBadge label="Verified" color={T.success} />}
          </View>
          {!otpSent ? (
            <>
              <Text style={[s.hint, { color: T.dim }]}>Send a one-time code to the student to confirm the visit.</Text>
              <Btn
                label="Send OTP"
                variant="soft"
                onPress={handleSendOtp}
                loading={sendingOtp}
                icon={<ShieldCheck size={14} color={T.accent} strokeWidth={2.2} />}
              />
            </>
          ) : (
            <>
              <Input
                label="6-digit code"
                value={otp}
                onChangeText={(v) => { setOtp(v.replace(/[^0-9]/g, '').slice(0, 6)); setOtpVerified(false); }}
                keyboardType="number-pad"
                placeholder="••••••"
                maxLength={6}
                editable={!otpVerified}
              />
              <View style={s.otpActions}>
                <Btn
                  label="Resend"
                  variant="secondary"
                  small
                  onPress={handleSendOtp}
                  loading={sendingOtp}
                  style={{ flex: 1 }}
                />
                <Btn
                  label={otpVerified ? 'Verified' : 'Verify'}
                  small
                  onPress={handleVerifyOtp}
                  loading={verifyingOtp}
                  disabled={otpVerified || otp.length !== 6}
                  icon={otpVerified ? <CheckCircle2 size={13} color="#FFF" strokeWidth={2.4} /> : undefined}
                  style={{ flex: 1 }}
                />
              </View>
            </>
          )}
        </Card>

        {/* Notes */}
        <Card style={s.cardGap}>
          <Input
            label="Notes (optional)"
            value={notes}
            onChangeText={setNotes}
            placeholder="Anything worth recording about this visit"
            multiline
          />
        </Card>

        <Btn
          label={submitting ? 'Submitting…' : 'Submit visit'}
          onPress={handleSubmit}
          loading={submitting}
          disabled={!canSubmit}
        />
        {!canSubmit && !submitting && (
          <Text style={[s.hint, { color: T.dim, textAlign: 'center' }]}>
            Capture location, take a selfie and verify the OTP to submit.
          </Text>
        )}
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1, padding: 16, gap: 12 },
  cardGap: { gap: 10 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  leadName: { fontSize: rf(16), fontWeight: '800', letterSpacing: -0.3 },
  leadMeta: { fontSize: rf(12.5), fontWeight: '500' },
  value: { fontSize: rf(13.5), fontWeight: '700' },
  hint: { fontSize: rf(12), fontWeight: '500', lineHeight: 17 },
  selfieRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  manualHint: { fontSize: rf(11.5), fontWeight: '600' },
  manualRow: { flexDirection: 'row', gap: 10 },
  thumb: { width: 74, height: 74, borderRadius: 14, borderWidth: 1 },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  selfieBtn: { flex: 1 },
  otpActions: { flexDirection: 'row', gap: 10 },
});
