import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Alert, PermissionsAndroid, Platform, Linking,
  ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import { Mic, Square, ShieldCheck, Sparkles, ChevronRight } from 'lucide-react-native';
import { AppHeader, Card, SectionLabel } from '../../components/ui';
import { Btn, Checkbox, Trigger, Dropdown, StatusBadge } from '../../components/crud';
import { MAX_RECORDING_BYTES } from '../../api/demos';
import { b2cRecordingService } from '../../api/b2c/b2cRecordingService';
import { b2cLeadService } from '../../api/b2c/b2cLeadService';
import { B2CLeadListDto, B2CCounselingFeedbackDto } from '../../types/b2c';
import { useAppTheme } from '../../theme/useAppTheme';
import { rf } from '../../utils/responsive';

type Phase = 'setup' | 'ready' | 'recording' | 'uploading' | 'analyzing' | 'done';

const fmtBytes = (b: number) => `${Math.round(b / (1024 * 1024))}MB`;
const mmss = (secs: number) =>
  `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(Math.floor(secs % 60)).padStart(2, '0')}`;

// The eight AI-coach dimensions, in the order the DTO declares them.
const DIMENSIONS: { key: keyof B2CCounselingFeedbackDto; label: string }[] = [
  { key: 'rapport', label: 'Rapport' },
  { key: 'needsDiscovery', label: 'Needs Discovery' },
  { key: 'productKnowledge', label: 'Product Knowledge' },
  { key: 'objectionHandling', label: 'Objection Handling' },
  { key: 'closing', label: 'Closing' },
  { key: 'clarity', label: 'Clarity' },
  { key: 'empathy', label: 'Empathy' },
  { key: 'followUp', label: 'Follow Up' },
];

const POLL_INTERVAL_MS = 4000;
const POLL_MAX_ATTEMPTS = 45; // ~3 min ceiling

/**
 * Counselor session recording + AI coaching (phase-2 native flow). Route
 * `B2CCounselorRecording` with optional `{ leadId }`. Confirm the lead + consent →
 * start a server-side recording → record audio locally → upload → poll status until
 * the analysis is ready → render the AI-coach feedback. Also lists past sessions.
 *
 * Audio recording copied from RecordDemoScreen / VisitReportScreen.
 */
export const B2CCounselorRecordingScreen = ({ route, navigation }: any) => {
  const paramLeadId: number | undefined = route.params?.leadId;
  const T = useAppTheme();
  const insets = useSafeAreaInsets();

  const [leads, setLeads] = useState<B2CLeadListDto[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(paramLeadId ?? null);
  const [leadPickerOpen, setLeadPickerOpen] = useState(false);
  const [consent, setConsent] = useState(false);

  const [phase, setPhase] = useState<Phase>('setup');
  const [recordingId, setRecordingId] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);

  const [elapsed, setElapsed] = useState(0);
  const audioPath = useRef<string | null>(null);

  const [uploadPct, setUploadPct] = useState(0);
  const [feedback, setFeedback] = useState<B2CCounselingFeedbackDto | null>(null);

  const [sessions, setSessions] = useState<B2CCounselingFeedbackDto[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPoll = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  // ─── Cleanup on unmount ──────────────────────────────────────────────────—
  useEffect(() => () => {
    stopPoll();
    AudioRecorderPlayer.removeRecordBackListener();
    AudioRecorderPlayer.stopRecorder().catch(() => {});
  }, [stopPoll]);

  // ─── Load assigned leads + past sessions ────────────────────────────────—
  const loadSessions = useCallback(() => {
    setLoadingSessions(true);
    b2cRecordingService.getMySessions(10)
      .then(res => setSessions(res.data ?? []))
      .catch(() => {})
      .finally(() => setLoadingSessions(false));
  }, []);

  useEffect(() => {
    // Only need the picker when no lead was passed in.
    if (paramLeadId == null) {
      b2cLeadService.getLeads({ pageSize: 100 })
        .then(res => setLeads(res.data?.items ?? []))
        .catch(() => {});
    }
    loadSessions();
  }, [paramLeadId, loadSessions]);

  const selectedLead = leads.find(l => l.id === selectedLeadId);
  const leadLabel = selectedLead?.studentName
    || (selectedLeadId != null ? `Lead #${selectedLeadId}` : 'Select a student…');

  // ─── Start session ─────────────────────────────────────────────────────—
  const handleStartSession = useCallback(async () => {
    if (selectedLeadId == null) { Alert.alert('Validation', 'Choose the student first.'); return; }
    if (!consent) { Alert.alert('Consent required', 'Confirm the student has consented to recording.'); return; }
    setStarting(true);
    try {
      const res = await b2cRecordingService.startRecording({ leadId: selectedLeadId, consentGiven: true });
      const id = res.data?.recordingId;
      if (!id) throw new Error('No recording id returned.');
      setRecordingId(id);
      setPhase('ready');
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || err?.message || 'Could not start the session.');
    } finally {
      setStarting(false);
    }
  }, [selectedLeadId, consent]);

  // ─── Record ──────────────────────────────────────────────────────────────
  const ensureMic = async () => {
    if (Platform.OS !== 'android') return true;
    try {
      const perm = PermissionsAndroid.PERMISSIONS.RECORD_AUDIO;
      if (await PermissionsAndroid.check(perm)) return true;
      const result = await PermissionsAndroid.request(perm, {
        title: 'Microphone Permission Required',
        message: 'The app needs microphone access to record the counseling session.',
        buttonPositive: 'Allow', buttonNegative: 'Deny',
      });
      if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
        Alert.alert('Microphone', 'Access is blocked. Please enable it in Settings.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]);
        return false;
      }
      return result === PermissionsAndroid.RESULTS.GRANTED;
    } catch {
      return false;
    }
  };

  const startRecording = useCallback(async () => {
    if (!(await ensureMic())) { Alert.alert('Permission', 'Microphone access is required to record.'); return; }
    try {
      AudioRecorderPlayer.setSubscriptionDuration(0.5);
      const uri = await AudioRecorderPlayer.startRecorder();
      audioPath.current = uri;
      setElapsed(0);
      setPhase('recording');
      AudioRecorderPlayer.addRecordBackListener(e => {
        setElapsed(Math.floor((e.currentPosition ?? 0) / 1000));
      });
    } catch {
      Alert.alert('Error', 'Could not start recording. Please try again.');
    }
  }, []);

  // ─── Poll analysis status → feedback ───────────────────────────────────—
  const beginPolling = useCallback((id: number) => {
    stopPoll();
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts += 1;
      try {
        const st = await b2cRecordingService.getStatus(id);
        if (st.data?.hasFeedback) {
          stopPoll();
          const fb = await b2cRecordingService.getFeedback(id);
          setFeedback(fb.data);
          setPhase('done');
          loadSessions();
        } else if (attempts >= POLL_MAX_ATTEMPTS) {
          stopPoll();
          setPhase('done');
          Alert.alert('Still analyzing', 'The AI coach is taking longer than usual. Check "My sessions" shortly.');
        }
      } catch {
        if (attempts >= POLL_MAX_ATTEMPTS) { stopPoll(); setPhase('done'); }
      }
    }, POLL_INTERVAL_MS);
  }, [stopPoll, loadSessions]);

  const stopRecording = useCallback(async () => {
    if (recordingId == null) return;
    let path: string | null = null;
    try {
      const uri = await AudioRecorderPlayer.stopRecorder();
      AudioRecorderPlayer.removeRecordBackListener();
      path = uri || audioPath.current;
    } catch {
      Alert.alert('Error', 'Could not save the recording. Please try again.');
      setPhase('ready');
      return;
    }
    if (!path) { setPhase('ready'); return; }

    setPhase('uploading');
    setUploadPct(0);
    try {
      const res = await b2cRecordingService.uploadAudio(
        recordingId,
        { uri: path, name: `session-${recordingId}-${Date.now()}.m4a`, type: 'audio/mp4' },
        setUploadPct,
      );
      // Upload may already return the finished feedback; otherwise poll for it.
      const fb = res.data;
      if (fb && (fb.generatedAt || fb.overallScore > 0)) {
        setFeedback(fb);
        setPhase('done');
        loadSessions();
      } else {
        setPhase('analyzing');
        beginPolling(recordingId);
      }
    } catch (err: any) {
      setPhase('ready');
      Alert.alert('Upload failed', err?.response?.data?.message || err?.message || 'Could not upload the recording.');
    }
  }, [recordingId, beginPolling, loadSessions]);

  const openSession = useCallback(async (id: number) => {
    try {
      const fb = await b2cRecordingService.getFeedback(id);
      setFeedback(fb.data);
      setPhase('done');
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Could not load that session.');
    }
  }, []);

  const scoreColor = (score: number) =>
    score >= 75 ? T.success : score >= 50 ? T.warning : T.danger;

  // ─── Render ────────────────────────────────────────────────────────────—
  return (
    <View style={[s.root, { backgroundColor: T.bg, paddingTop: insets.top }]}>
      <AppHeader
        title="Record Session"
        subtitle={selectedLead?.studentName || feedback?.leadStudentName}
        onBack={() => navigation.goBack()}
      />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 30 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Setup */}
        {phase === 'setup' && (
          <Card style={[s.cardGap, { zIndex: 20 }]}>
            <SectionLabel>New Session</SectionLabel>
            {paramLeadId == null ? (
              <View style={{ zIndex: 30 }}>
                <Text style={[s.label, { color: T.text }]}>Student</Text>
                <Trigger
                  label={leadLabel}
                  open={leadPickerOpen}
                  onPress={() => setLeadPickerOpen(o => !o)}
                />
                {leadPickerOpen && (
                  <Dropdown
                    style={{ width: '100%' }}
                    maxHeight={260}
                    value={selectedLeadId != null ? String(selectedLeadId) : undefined}
                    options={leads.map(l => ({ label: `${l.studentName} · ${l.stage}`, value: String(l.id) }))}
                    onSelect={(v) => { setSelectedLeadId(Number(v)); setLeadPickerOpen(false); }}
                  />
                )}
              </View>
            ) : (
              <Text style={[s.value, { color: T.text }]}>{leadLabel}</Text>
            )}

            <Checkbox
              on={consent}
              onToggle={() => setConsent(c => !c)}
              label="The student has consented to this session being recorded."
            />
            <Btn
              label="Start session"
              onPress={handleStartSession}
              loading={starting}
              disabled={selectedLeadId == null || !consent}
              icon={<ShieldCheck size={14} color="#FFF" strokeWidth={2.2} />}
            />
          </Card>
        )}

        {/* Recording controls */}
        {(phase === 'ready' || phase === 'recording') && (
          <Card style={s.cardGap}>
            <View style={s.rowBetween}>
              <SectionLabel>Recording</SectionLabel>
              {phase === 'recording' && <StatusBadge label="● REC" color={T.danger} />}
            </View>
            <Text style={[s.timer, { color: phase === 'recording' ? T.danger : T.text }]}>{mmss(elapsed)}</Text>
            {phase === 'ready' ? (
              <Btn
                label="Start recording"
                onPress={startRecording}
                icon={<Mic size={16} color="#FFF" strokeWidth={2.2} />}
              />
            ) : (
              <Btn
                label="Stop & analyze"
                variant="danger"
                onPress={stopRecording}
                icon={<Square size={14} color="#FFF" strokeWidth={2.4} />}
              />
            )}
            <Text style={[s.hint, { color: T.dim }]}>
              Audio is capped at {fmtBytes(MAX_RECORDING_BYTES)}. Keep the phone near the conversation.
            </Text>
          </Card>
        )}

        {/* Uploading / analyzing */}
        {(phase === 'uploading' || phase === 'analyzing') && (
          <Card style={[s.cardGap, { alignItems: 'center' }]}>
            <ActivityIndicator color={T.accent} size="large" />
            <Text style={[s.value, { color: T.text }]}>
              {phase === 'uploading' ? `Uploading… ${uploadPct}%` : 'AI coach is analyzing the session…'}
            </Text>
            <Text style={[s.hint, { color: T.dim, textAlign: 'center' }]}>
              {phase === 'uploading'
                ? 'Please keep the app open until the upload finishes.'
                : 'This can take a minute. The feedback appears here when it is ready.'}
            </Text>
          </Card>
        )}

        {/* Feedback */}
        {phase === 'done' && feedback && (
          <>
            <Card style={[s.cardGap, { alignItems: 'center' }]}>
              <SectionLabel>Overall Score</SectionLabel>
              <Text style={[s.bigScore, { color: scoreColor(feedback.overallScore) }]}>
                {feedback.overallScore}
                <Text style={[s.bigScoreMax, { color: T.dim }]}> / 100</Text>
              </Text>
              <Text style={[s.hint, { color: T.sub }]}>
                {feedback.leadStudentName} · {mmss(feedback.durationSeconds)}
              </Text>
            </Card>

            <Card style={s.cardGap}>
              <SectionLabel>Dimensions</SectionLabel>
              {DIMENSIONS.map(d => {
                const dim = feedback[d.key] as { score: number; comment: string } | undefined;
                if (!dim) return null;
                return (
                  <View key={String(d.key)} style={s.dimRow}>
                    <View style={s.rowBetween}>
                      <Text style={[s.dimLabel, { color: T.text }]}>{d.label}</Text>
                      <Text style={[s.dimScore, { color: scoreColor(dim.score) }]}>{dim.score}</Text>
                    </View>
                    <View style={[s.bar, { backgroundColor: T.cardAlt }]}>
                      <View style={[s.barFill, { width: `${Math.max(0, Math.min(100, dim.score))}%`, backgroundColor: scoreColor(dim.score) }]} />
                    </View>
                    {!!dim.comment && <Text style={[s.dimComment, { color: T.sub }]}>{dim.comment}</Text>}
                  </View>
                );
              })}
            </Card>

            {feedback.strengths.length > 0 && (
              <Card style={s.cardGap}>
                <SectionLabel>Strengths</SectionLabel>
                {feedback.strengths.map((x, i) => (
                  <Text key={i} style={[s.bullet, { color: T.text }]}>• {x}</Text>
                ))}
              </Card>
            )}

            {feedback.improvementAreas.length > 0 && (
              <Card style={s.cardGap}>
                <SectionLabel>Areas to Improve</SectionLabel>
                {feedback.improvementAreas.map((x, i) => (
                  <Text key={i} style={[s.bullet, { color: T.text }]}>• {x}</Text>
                ))}
              </Card>
            )}

            {feedback.suggestedPhrases.length > 0 && (
              <Card style={s.cardGap}>
                <SectionLabel>Suggested Phrases</SectionLabel>
                {feedback.suggestedPhrases.map((x, i) => (
                  <Text key={i} style={[s.bullet, { color: T.sub }]}>“{x}”</Text>
                ))}
              </Card>
            )}

            <Btn
              label="Record another session"
              variant="secondary"
              onPress={() => {
                setFeedback(null); setRecordingId(null); setConsent(false);
                setElapsed(0); setUploadPct(0);
                if (paramLeadId == null) setSelectedLeadId(null);
                setPhase('setup');
              }}
              icon={<Sparkles size={14} color={T.text} strokeWidth={2.2} />}
            />
          </>
        )}

        {/* My sessions */}
        <Card style={s.cardGap}>
          <SectionLabel>My Sessions</SectionLabel>
          {loadingSessions ? (
            <ActivityIndicator color={T.accent} />
          ) : sessions.length === 0 ? (
            <Text style={{ color: T.dim, fontSize: rf(12.5) }}>No recorded sessions yet.</Text>
          ) : (
            sessions.map(sess => (
              <TouchableOpacity
                key={sess.recordingId}
                style={[s.sessRow, { borderColor: T.line }]}
                activeOpacity={0.75}
                onPress={() => openSession(sess.recordingId)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[s.sessName, { color: T.text }]} numberOfLines={1}>{sess.leadStudentName}</Text>
                  <Text style={[s.sessMeta, { color: T.dim }]}>
                    {new Date(sess.sessionDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} · {mmss(sess.durationSeconds)} · {sess.status}
                  </Text>
                </View>
                <StatusBadge label={String(sess.overallScore)} color={scoreColor(sess.overallScore)} />
                <ChevronRight size={16} color={T.dim} strokeWidth={2.2} />
              </TouchableOpacity>
            ))
          )}
        </Card>
      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 16, gap: 12 },
  cardGap: { gap: 10 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: rf(12.5), fontWeight: '600', marginBottom: 6 },
  value: { fontSize: rf(14.5), fontWeight: '700' },
  hint: { fontSize: rf(11.5), fontWeight: '500', lineHeight: 16 },
  timer: { fontSize: rf(40), fontWeight: '800', letterSpacing: -1, textAlign: 'center', fontVariant: ['tabular-nums'] },
  bigScore: { fontSize: rf(48), fontWeight: '900', letterSpacing: -2 },
  bigScoreMax: { fontSize: rf(16), fontWeight: '700' },
  dimRow: { gap: 5, paddingVertical: 4 },
  dimLabel: { fontSize: rf(13), fontWeight: '700' },
  dimScore: { fontSize: rf(13), fontWeight: '800' },
  bar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  dimComment: { fontSize: rf(11.5), fontWeight: '500', lineHeight: 16 },
  bullet: { fontSize: rf(13), fontWeight: '500', lineHeight: 19 },
  sessRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 11, borderTopWidth: StyleSheet.hairlineWidth,
  },
  sessName: { fontSize: rf(13.5), fontWeight: '700' },
  sessMeta: { fontSize: rf(11), fontWeight: '500', marginTop: 2 },
});
