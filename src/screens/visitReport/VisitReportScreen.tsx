import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Alert, TextInput, TouchableOpacity,
  ActivityIndicator, PermissionsAndroid, Platform, Linking, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { launchCamera, launchImageLibrary, Asset } from 'react-native-image-picker';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import {
  Camera, Video as VideoIcon, Mic, Square, X,
  ThumbsUp, ThumbsDown, Minus, AlertTriangle,
} from 'lucide-react-native';
import { visitReportApi } from '../../api/visitReport';
import { AppHeader } from '../../components/ui';
import { Btn, Trigger, Dropdown } from '../../components/crud';

// Values MUST match the backend enums exactly — the server Enum.TryParse's them and
// silently defaults to the first value on any mismatch, which is why free text was lost.
const PURPOSE_OPTIONS = [
  { label: 'Visit', value: 'Visit' }, { label: 'Meeting', value: 'Meeting' },
  { label: 'Demo', value: 'Demo' }, { label: 'Follow Up', value: 'FollowUp' },
  { label: 'Collection', value: 'Collection' }, { label: 'Survey', value: 'Survey' },
  { label: 'Audit', value: 'Audit' }, { label: 'Other', value: 'Other' },
];
const NEXT_ACTION_OPTIONS = [
  { label: 'Follow Up', value: 'FollowUp' }, { label: 'Demo', value: 'Demo' },
  { label: 'Proposal', value: 'Proposal' }, { label: 'Contract', value: 'Contract' },
  { label: 'Escalate', value: 'Escalate' }, { label: 'None', value: 'None' },
];

import { useAppTheme } from '../../theme/useAppTheme';
import { rf, isTabletDevice } from '../../utils/responsive';

/**
 * Media rules below are copied verbatim from VisitReportsController.UploadMedia
 * (VisitReportsController.cs:65-101):
 *
 *   "photo" => new[] { "image/jpeg", "image/png", "image/webp", "image/jpg" },
 *   "video" => new[] { "video/mp4", "video/quicktime", "video/webm", "video/3gpp" },
 *   "audio" => new[] { "audio/mpeg", "audio/wav", "audio/ogg", "audio/mp4", "audio/webm", "audio/aac" },
 *
 *   if (!allowedTypes.Contains(file.ContentType.ToLower())) return BadRequest(...)
 *   var maxSize = mediaType?.ToLower() == "video" ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
 *
 * Sending a MIME outside these lists is a 400, so we validate before uploading and
 * surface the failure instead of silently dropping the attachment.
 */
type MediaKind = 'photo' | 'video' | 'audio';

const ALLOWED_MIMES: Record<MediaKind, string[]> = {
  photo: ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'],
  video: ['video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp'],
  audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/webm', 'audio/aac'],
};

const MAX_BYTES: Record<MediaKind, number> = {
  photo: 10 * 1024 * 1024,
  video: 50 * 1024 * 1024,
  audio: 10 * 1024 * 1024,
};

const EXT_MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', '3gp': 'video/3gpp',
  m4a: 'audio/mp4', mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', aac: 'audio/aac',
};

const extOf = (name?: string | null) =>
  (name?.split('?')[0].split('.').pop() ?? '').toLowerCase();

/** Returns a MIME the controller will accept, or null if this file can't be sent. */
const resolveMime = (kind: MediaKind, asset: Asset): string | null => {
  const allowed = ALLOWED_MIMES[kind];
  const reported = asset.type?.toLowerCase();
  if (reported && allowed.includes(reported)) return reported;
  const byExt = EXT_MIME[extOf(asset.fileName || asset.uri)];
  if (byExt && allowed.includes(byExt)) return byExt;
  return null;
};

const fmtMb = (bytes: number) => `${Math.round(bytes / (1024 * 1024))}MB`;

interface Attachment {
  key: string;
  kind: MediaKind;
  name: string;
  uploading: boolean;
  pct: number;
  url?: string;
  error?: string;
}

const KIND_LABEL: Record<MediaKind, string> = { photo: 'Photo', video: 'Video', audio: 'Audio' };

// Enum FeedbackSentiment { Positive, Negative, Neutral } (SalesCRM.Core/Enums/FeedbackSentiment.cs)
// — the same three literals web sends from its SENTIMENTS array (LiveTracking.jsx:832-836).
const SENTIMENTS = ['Positive', 'Negative', 'Neutral'] as const;
type Sentiment = (typeof SENTIMENTS)[number];

export const VisitReportScreen = ({ navigation, route }: any) => {
  const { schoolVisitLogId, schoolName, activityId, schoolId } = route.params ?? {};
  const T = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const twoWide = isTabletDevice && width > height;

  const [purpose, setPurpose] = useState('');
  const [outcome, setOutcome] = useState('');
  const [remarks, setRemarks] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [nextActionDate, setNextActionDate] = useState('');
  const [nextActionNotes, setNextActionNotes] = useState('');
  const [openDd, setOpenDd] = useState<'purpose' | 'nextAction' | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [sentiment, setSentiment] = useState<Sentiment | ''>('');
  const [feedbackText, setFeedbackText] = useState('');
  const [personName, setPersonName] = useState('');
  const [personDesignation, setPersonDesignation] = useState('');

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const audioPath = useRef<string | null>(null);

  useEffect(() => () => {
    AudioRecorderPlayer.removeRecordBackListener();
    AudioRecorderPlayer.stopRecorder().catch(() => {});
  }, []);

  const patch = useCallback((key: string, next: Partial<Attachment>) => {
    setAttachments(prev => prev.map(a => (a.key === key ? { ...a, ...next } : a)));
  }, []);

  const removeAttachment = useCallback((key: string) => {
    setAttachments(prev => prev.filter(a => a.key !== key));
  }, []);

  // ─── Upload ────────────────────────────────────────────────────────────────
  const upload = useCallback(
    async (kind: MediaKind, file: { uri: string; name: string; type: string }) => {
      const key = `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setAttachments(prev => [
        ...prev,
        { key, kind, name: file.name, uploading: true, pct: 0 },
      ]);
      try {
        const res = await visitReportApi.uploadMedia(file, kind, pct => patch(key, { pct }));
        const url = res.data?.url;
        if (!url) throw new Error('Upload response did not include a url.');
        patch(key, { uploading: false, pct: 100, url });
      } catch (err: any) {
        patch(key, {
          uploading: false,
          error: err?.response?.data?.message || err?.message || 'Upload failed.',
        });
      }
    },
    [patch],
  );

  const acceptAsset = useCallback(
    (kind: MediaKind, asset: Asset | undefined) => {
      if (!asset?.uri) return;
      const mime = resolveMime(kind, asset);
      if (!mime) {
        Alert.alert(
          `Unsupported ${kind} format`,
          `The server accepts only: ${ALLOWED_MIMES[kind].join(', ')}.\n` +
            `This file is ${asset.type || extOf(asset.fileName || asset.uri) || 'of an unknown type'}. Please pick another one.`,
        );
        return;
      }
      if ((asset.fileSize ?? 0) > MAX_BYTES[kind]) {
        Alert.alert(
          'File too large',
          `${KIND_LABEL[kind]} files must be under ${fmtMb(MAX_BYTES[kind])}.`,
        );
        return;
      }
      const name = asset.fileName || `visit-${kind}-${Date.now()}.${extOf(asset.uri) || 'jpg'}`;
      upload(kind, { uri: asset.uri, name, type: mime });
    },
    [upload],
  );

  // ─── Android permissions ───────────────────────────────────────────────────
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

  const askCamera = () =>
    askAndroid(
      PermissionsAndroid.PERMISSIONS.CAMERA,
      'Camera Permission Required',
      'The app needs camera access to attach visit media.',
    );

  // Android 13 (API 33) split the single storage permission into per-media grants.
  const askLibrary = (kind: 'photo' | 'video') =>
    askAndroid(
      Number(Platform.Version) >= 33
        ? kind === 'video'
          ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO
          : PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
        : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
      'Media Permission Required',
      'The app needs access to your library to attach visit media.',
    );

  const handlePickerResult = (kind: MediaKind) => (res: any) => {
    if (res.didCancel) return;
    if (res.errorCode === 'permission') {
      Alert.alert('Permission Required', 'Please enable access in your device Settings.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ]);
      return;
    }
    if (res.errorCode) {
      Alert.alert('Error', res.errorMessage ?? 'Could not open the picker.');
      return;
    }
    acceptAsset(kind, res.assets?.[0]);
  };

  const addPhoto = () => {
    Alert.alert('Add Photo', 'Choose source', [
      {
        text: 'Camera',
        onPress: async () => {
          if (!(await askCamera())) return;
          // quality < 1 makes iOS re-encode to JPEG, keeping us inside the allowlist.
          launchCamera(
            { mediaType: 'photo', quality: 0.8, saveToPhotos: false, includeBase64: false },
            handlePickerResult('photo'),
          );
        },
      },
      {
        text: 'Photo Library',
        onPress: async () => {
          if (!(await askLibrary('photo'))) return;
          launchImageLibrary(
            { mediaType: 'photo', quality: 0.8, includeBase64: false },
            handlePickerResult('photo'),
          );
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const addVideo = () => {
    Alert.alert('Add Video', 'Choose source', [
      {
        text: 'Record',
        onPress: async () => {
          if (!(await askCamera())) return;
          launchCamera(
            { mediaType: 'video', videoQuality: 'medium', durationLimit: 180, saveToPhotos: false },
            handlePickerResult('video'),
          );
        },
      },
      {
        text: 'Video Library',
        onPress: async () => {
          if (!(await askLibrary('video'))) return;
          launchImageLibrary({ mediaType: 'video' }, handlePickerResult('video'));
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // ─── Audio recording (same pattern as RecordDemoScreen) ────────────────────
  const startAudio = async () => {
    const ok = await askAndroid(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      'Microphone Permission Required',
      'The app needs microphone access to record an audio note.',
    );
    if (!ok) return;
    try {
      AudioRecorderPlayer.setSubscriptionDuration(0.5);
      const uri = await AudioRecorderPlayer.startRecorder();
      audioPath.current = uri;
      setElapsed(0);
      setRecording(true);
      AudioRecorderPlayer.addRecordBackListener(e => {
        setElapsed(Math.floor((e.currentPosition ?? 0) / 1000));
      });
    } catch {
      Alert.alert('Error', 'Could not start recording. Please try again.');
    }
  };

  const stopAudio = async () => {
    try {
      const uri = await AudioRecorderPlayer.stopRecorder();
      AudioRecorderPlayer.removeRecordBackListener();
      setRecording(false);
      setElapsed(0);
      const path = uri || audioPath.current;
      if (!path) return;
      upload('audio', {
        uri: path,
        name: `visit-audio-${Date.now()}.m4a`,
        type: 'audio/mp4', // .m4a — present in the controller's audio allowlist
      });
    } catch {
      setRecording(false);
      Alert.alert('Error', 'Could not save the recording. Please try again.');
    }
  };

  // ─── Submit ────────────────────────────────────────────────────────────────
  const uploadsPending = attachments.some(a => a.uploading);

  const urlsOf = (kind: MediaKind) =>
    attachments.filter(a => a.kind === kind && !!a.url).map(a => a.url as string);

  const handleSubmit = async () => {
    if (!purpose.trim()) { Alert.alert('Validation', 'Purpose of visit is required'); return; }
    if (!outcome.trim()) { Alert.alert('Validation', 'Visit outcome is required'); return; }
    if (!sentiment) { Alert.alert('Validation', 'Please select feedback sentiment'); return; }
    if (!nextAction.trim()) { Alert.alert('Validation', 'Next action is required'); return; }
    if (recording) { Alert.alert('Recording in progress', 'Stop the audio recording first.'); return; }
    if (uploadsPending) { Alert.alert('Uploads in progress', 'Please wait for attachments to finish uploading.'); return; }

    const photos = urlsOf('photo');
    const videos = urlsOf('video');
    const audio = urlsOf('audio');

    setSubmitting(true);
    try {
      await visitReportApi.create({
        schoolVisitLogId,
        activityId,
        // Without this, a report filed from a school row (no visit log yet) saved
        // with SchoolId null and could not be traced back to the school.
        schoolId,
        purpose: purpose.trim(),
        outcome: outcome.trim(),
        remarks: remarks || undefined,
        nextAction: nextAction.trim(),
        nextActionDate: nextActionDate || undefined,
        nextActionNotes: nextActionNotes || undefined,
        feedbackSentiment: sentiment,
        feedbackText: feedbackText || undefined,
        feedbackPersonName: personName || undefined,
        feedbackPersonDesignation: personDesignation || undefined,
        // "JSON array of URLs" per VisitReport.cs:19-21 — matches web's JSON.stringify.
        photos: photos.length ? JSON.stringify(photos) : undefined,
        videos: videos.length ? JSON.stringify(videos) : undefined,
        audioNotes: audio.length ? JSON.stringify(audio) : undefined,
      });
      Alert.alert('Success', 'Visit report submitted successfully');
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to submit report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const sentimentFace = (s: Sentiment) =>
    s === 'Positive' ? T.success : s === 'Negative' ? T.danger : T.sub;

  const mmss = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;

  return (
    <View style={[styles.root, { backgroundColor: T.bg, paddingTop: insets.top }]}>
      <AppHeader
        title="Visit Report"
        subtitle={schoolName}
        onBack={() => navigation.goBack()}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.formWrap, twoWide && styles.formWrapTablet]}>
          <View style={[styles.infoBanner, { backgroundColor: T.accentSoft }]}>
            <Text style={[styles.infoBannerText, { color: T.accent }]}>
              📍 Fill this report for your visit to {schoolName || 'the school'}
            </Text>
          </View>

          <SectionCard label="Visit Details">
            {/* Purpose is an ENUM on the backend — a picker, not free text, or the
                typed value is silently coerced to "Visit" and lost. */}
            <View style={[styles.fieldGroup, { zIndex: 30 }]}>
              <Text style={[styles.fieldLabel, { color: T.text }]}>Purpose of Visit *</Text>
              <Trigger
                label={PURPOSE_OPTIONS.find(o => o.value === purpose)?.label || 'Select a purpose…'}
                open={openDd === 'purpose'}
                onPress={() => setOpenDd(openDd === 'purpose' ? null : 'purpose')}
              />
              {openDd === 'purpose' && (
                <Dropdown
                  value={purpose}
                  options={PURPOSE_OPTIONS}
                  onSelect={(v) => { setPurpose(v); setOpenDd(null); }}
                />
              )}
            </View>
            <Field
              label="Visit Outcome *"
              value={outcome}
              onChange={setOutcome}
              placeholder="What was the result of this visit?"
              multiline
            />
            <Field
              label="Additional Remarks"
              value={remarks}
              onChange={setRemarks}
              placeholder="Any additional observations or notes..."
              multiline
            />
          </SectionCard>

          <SectionCard label="School Feedback">
            <Text style={[styles.fieldLabel, { color: T.text }]}>Sentiment *</Text>
            <View style={styles.sentimentRow}>
              {SENTIMENTS.map(s => {
                const on = sentiment === s;
                const face = sentimentFace(s);
                const Icon = s === 'Positive' ? ThumbsUp : s === 'Negative' ? ThumbsDown : Minus;
                return (
                  <TouchableOpacity
                    key={s}
                    onPress={() => setSentiment(s)}
                    activeOpacity={0.85}
                    style={[
                      styles.sentimentChip,
                      {
                        borderColor: on ? face : T.line,
                        backgroundColor: on ? T.accentSoft : T.fieldBg,
                      },
                    ]}
                  >
                    <Icon size={rf(15)} color={on ? face : T.sub} />
                    <Text style={[styles.sentimentTxt, { color: on ? face : T.sub }]}>{s}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Field
              label="Person Name"
              value={personName}
              onChange={setPersonName}
              placeholder="e.g. Mr. Rajendra Patel"
            />
            <Field
              label="Designation"
              value={personDesignation}
              onChange={setPersonDesignation}
              placeholder="e.g. Principal"
            />
            <Field
              label="Feedback"
              value={feedbackText}
              onChange={setFeedbackText}
              placeholder="What did the school authority say..."
              multiline
            />
          </SectionCard>

          <SectionCard label="Attachments">
            <View style={styles.attachRow}>
              <AttachButton icon={<Camera size={rf(15)} color={T.accent} />} label="Photo" onPress={addPhoto} />
              <AttachButton icon={<VideoIcon size={rf(15)} color={T.accent} />} label="Video" onPress={addVideo} />
              {recording ? (
                <AttachButton
                  icon={<Square size={rf(13)} color={T.danger} />}
                  label={`Stop ${mmss}`}
                  tone="danger"
                  onPress={stopAudio}
                />
              ) : (
                <AttachButton icon={<Mic size={rf(15)} color={T.accent} />} label="Audio" onPress={startAudio} />
              )}
            </View>

            {attachments.length === 0 ? (
              <Text style={[styles.attachEmpty, { color: T.dim }]}>
                No attachments yet. Photos and audio are capped at 10MB, video at 50MB.
              </Text>
            ) : (
              <View style={styles.attachList}>
                {attachments.map(a => (
                  <View
                    key={a.key}
                    style={[
                      styles.attachItem,
                      { backgroundColor: T.fieldBg, borderColor: a.error ? T.danger : T.line },
                    ]}
                  >
                    {a.error ? (
                      <AlertTriangle size={rf(15)} color={T.danger} />
                    ) : a.uploading ? (
                      <ActivityIndicator size="small" color={T.accent} />
                    ) : a.kind === 'photo' ? (
                      <Camera size={rf(15)} color={T.accent} />
                    ) : a.kind === 'video' ? (
                      <VideoIcon size={rf(15)} color={T.accent} />
                    ) : (
                      <Mic size={rf(15)} color={T.accent} />
                    )}

                    <View style={styles.attachMeta}>
                      <Text numberOfLines={1} style={[styles.attachName, { color: T.text }]}>
                        {KIND_LABEL[a.kind]} · {a.name}
                      </Text>
                      <Text numberOfLines={2} style={[styles.attachStatus, { color: a.error ? T.danger : T.sub }]}>
                        {a.error
                          ? a.error
                          : a.uploading
                            ? `Uploading… ${a.pct}%`
                            : 'Uploaded'}
                      </Text>
                    </View>

                    <TouchableOpacity
                      onPress={() => removeAttachment(a.key)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <X size={rf(15)} color={T.sub} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </SectionCard>

          <SectionCard label="Next Action">
            {/* Next Action is an ENUM too — same picker treatment. */}
            <View style={[styles.fieldGroup, { zIndex: 30 }]}>
              <Text style={[styles.fieldLabel, { color: T.text }]}>Next Action *</Text>
              <Trigger
                label={NEXT_ACTION_OPTIONS.find(o => o.value === nextAction)?.label || 'Select next action…'}
                open={openDd === 'nextAction'}
                onPress={() => setOpenDd(openDd === 'nextAction' ? null : 'nextAction')}
              />
              {openDd === 'nextAction' && (
                <Dropdown
                  value={nextAction}
                  options={NEXT_ACTION_OPTIONS}
                  onSelect={(v) => { setNextAction(v); setOpenDd(null); }}
                />
              )}
            </View>
            <Field
              label="Follow-up Date (YYYY-MM-DD)"
              value={nextActionDate}
              onChange={setNextActionDate}
              placeholder="2024-12-25"
            />
            <Field
              label="Follow-up Notes"
              value={nextActionNotes}
              onChange={setNextActionNotes}
              placeholder="Notes for the next action..."
              multiline
            />
          </SectionCard>

          {/* Cancel (secondary) then primary — the order used on every form. */}
          <View style={styles.actionRow}>
            <Btn
              label="Cancel"
              variant="secondary"
              onPress={() => navigation.goBack()}
              style={styles.actionBtn}
            />
            <Btn
              label={uploadsPending ? 'Uploading…' : 'Submit Visit Report'}
              onPress={handleSubmit}
              loading={submitting}
              disabled={submitting || uploadsPending || recording}
              style={styles.actionBtn}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const AttachButton = ({ icon, label, onPress, tone }: {
  icon: React.ReactNode; label: string; onPress: () => void; tone?: 'danger';
}) => {
  const T = useAppTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[
        styles.attachBtn,
        { backgroundColor: T.fieldBg, borderColor: tone === 'danger' ? T.danger : T.line },
      ]}
    >
      {icon}
      <Text style={[styles.attachBtnTxt, { color: tone === 'danger' ? T.danger : T.text }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const Field = ({ label, value, onChange, placeholder, multiline }: any) => {
  const T = useAppTheme();
  return (
    <View style={styles.fieldGroup}>
      <Text style={[styles.fieldLabel, { color: T.text }]}>{label}</Text>
      <TextInput
        style={[
          styles.input,
          multiline && styles.inputMulti,
          { backgroundColor: T.fieldBg, borderColor: T.line, color: T.text },
        ]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={T.dim}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
      />
    </View>
  );
};

const SectionCard = ({ label, children }: { label: string; children: React.ReactNode }) => {
  const T = useAppTheme();
  return (
    <View style={[styles.card, { backgroundColor: T.card, borderColor: T.line }]}>
      <Text style={[styles.cardTitle, { color: T.sub }]}>{label}</Text>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 16 },
  formWrap: { gap: 16 },
  formWrapTablet: { alignSelf: 'center', width: '100%', maxWidth: 900 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  actionBtn: { flex: 1 },
  infoBanner: { borderRadius: 14, padding: 12 },
  infoBannerText: { fontWeight: '600', fontSize: rf(14), lineHeight: 20 },
  card: {
    borderRadius: 18, borderWidth: 1, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05, shadowRadius: 10, elevation: 1,
  },
  cardTitle: { fontWeight: '700', fontSize: rf(13), marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldGroup: { marginBottom: 14 },
  fieldLabel: { fontWeight: '600', fontSize: rf(13), marginBottom: 6 },
  input: {
    borderWidth: 1, borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 10,
    fontWeight: '400', fontSize: rf(14),
  },
  inputMulti: { minHeight: 80, textAlignVertical: 'top' },

  sentimentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  sentimentChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 9,
  },
  sentimentTxt: { fontWeight: '700', fontSize: rf(13) },

  attachRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  attachBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 9,
  },
  attachBtnTxt: { fontWeight: '600', fontSize: rf(13) },
  attachEmpty: { fontWeight: '400', fontSize: rf(12), marginTop: 10, lineHeight: 17 },
  attachList: { gap: 8, marginTop: 12 },
  attachItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  attachMeta: { flex: 1, flexShrink: 1 },
  attachName: { fontWeight: '600', fontSize: rf(13) },
  attachStatus: { fontWeight: '400', fontSize: rf(11), marginTop: 2, lineHeight: 15 },
});
