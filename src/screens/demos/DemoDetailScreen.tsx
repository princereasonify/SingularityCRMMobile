import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Alert, TouchableOpacity,
  TextInput, Linking, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Link, ThumbsUp, ThumbsDown, Minus, Play, ArrowLeft, XCircle } from 'lucide-react-native';
import { demosApi } from '../../api/demos';
import { DemoAssignment } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Card, Badge } from '../../components/ui';
import { ICON_STROKE } from '../../components/common/Icon';
import { IconBtn, Btn, FormModal, ConfirmModal } from '../../components/crud';
import { LoadingSpinner, EmptyState } from '../../components/common/LoadingSpinner';
import { formatDate } from '../../utils/formatting';
import { rf, isTabletDevice } from '../../utils/responsive';

import { useAppTheme } from '../../theme/useAppTheme';
import { withAlpha } from '../../theme';

const OUTCOMES = ['Successful', 'Partial', 'Unsuccessful', 'Rescheduled'];
const SENTIMENTS = ['Positive', 'Neutral', 'Negative'] as const;

type FeedbackForm = {
  outcome: string;
  feedbackSentiment: string;
  feedback: string;
  feedbackVideoUrl: string;
  feedbackAudioUrl: string;
  screenRecordingUrl: string;
};

const EMPTY_FEEDBACK: FeedbackForm = {
  outcome: 'Successful',
  feedbackSentiment: '',
  feedback: '',
  feedbackVideoUrl: '',
  feedbackAudioUrl: '',
  screenRecordingUrl: '',
};

/** Same target web opens on Start/Resume (DemoManagement.jsx). */
const DEMO_APP_URL = 'https://app.singularity-learn.com/';

export const DemoDetailScreen = ({ navigation, route }: any) => {
  const { demoId } = route.params;
  const { user } = useAuth();
  const T = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const wide = isTabletDevice && width > height;
  const role = user?.role || 'FO';

  // Managers (ZH/RH/SH/SCA) can approve, start, complete, cancel
  const isManager = ['ZH', 'RH', 'SH', 'SCA'].includes(role);

  const STATUS_COLOR: Record<string, string> = {
    Requested: T.warning, Approved: T.info, Scheduled: T.accent,
    InProgress: T.warning, Completed: T.success, Cancelled: T.dim, Rescheduled: T.info,
  };
  const MODE_COLOR: Record<string, string> = {
    Online: T.info, Offline: T.success, Hybrid: T.accent,
  };

  const [demo, setDemo] = useState<DemoAssignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [feedbackForm, setFeedbackForm] = useState<FeedbackForm>(EMPTY_FEEDBACK);
  const [updating, setUpdating] = useState(false);

  const load = () => {
    setLoading(true);
    demosApi.getById(demoId)
      .then(res => setDemo(res.data))
      .catch(() => Alert.alert('Error', 'Failed to load demo'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [demoId]);

  const handleStatusUpdate = async (status: string) => {
    setUpdating(true);
    try {
      await demosApi.update(demoId, { status: status as DemoAssignment['status'] });
      load();
    } catch { Alert.alert('Error', `Failed to set status to ${status}`); }
    finally { setUpdating(false); }
  };

  const handleCompleteDemo = async () => {
    if (!feedbackForm.feedbackSentiment) {
      Alert.alert('Validation', 'Please select a feedback sentiment');
      return;
    }
    setUpdating(true);
    try {
      await demosApi.update(demoId, {
        status: 'Completed',
        outcome: feedbackForm.outcome as any,
        feedback: feedbackForm.feedback || undefined,
        feedbackSentiment: feedbackForm.feedbackSentiment as any,
        feedbackVideoUrl: feedbackForm.feedbackVideoUrl || undefined,
        feedbackAudioUrl: feedbackForm.feedbackAudioUrl || undefined,
        screenRecordingUrl: feedbackForm.screenRecordingUrl || undefined,
      });
      setShowCompleteModal(false);
      setFeedbackForm(EMPTY_FEEDBACK);
      load();
    } catch { Alert.alert('Error', 'Failed to complete demo'); }
    finally { setUpdating(false); }
  };

  const openCompleteModal = () => {
    setFeedbackForm(EMPTY_FEEDBACK);
    setShowCompleteModal(true);
  };

  const setF = (key: keyof FeedbackForm) => (val: string) =>
    setFeedbackForm(p => ({ ...p, [key]: val }));

  /* House pattern: plain themed title block on T.bg — no gradient hero. */
  const Hero = ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <View style={styles.headerRow}>
        <IconBtn kind="view" label="Back" onPress={() => navigation.goBack()}>
          <ArrowLeft size={18} color={T.accent} strokeWidth={ICON_STROKE} />
        </IconBtn>
        <View style={styles.titleBlock}>
          <Text style={[styles.h1, { color: T.text }]} numberOfLines={1}>{title}</Text>
          {!!subtitle && <Text style={[styles.h2, { color: T.sub }]} numberOfLines={1}>{subtitle}</Text>}
        </View>
      </View>
    </View>
  );

  if (loading) return <LoadingSpinner fullScreen color={T.accent} message="Loading..." />;
  if (!demo) return (
    <View style={[styles.root, { backgroundColor: T.bg }]}>
      <Hero title="Demo" />
      <EmptyState title="Demo not found" icon="🖥️" />
    </View>
  );

  // Status-only, exactly as web gates it (DemoManagement.jsx). The `isManager &&`
  // that used to be here was invented: DemoService authorizes the assigned FO
  // (`UserRole.FO => d.AssignedToId == userId`), so an FO opening their own demo
  // was shown no Approve/Start/Complete/Cancel buttons at all. The server remains
  // the authority — it 403s anyone who genuinely isn't allowed.
  const canAct = demo.status !== 'Completed' && demo.status !== 'Cancelled';
  const outcomeColor = (o?: string) =>
    o === 'Successful' ? T.success : o === 'Unsuccessful' ? T.danger : T.warning;

  return (
    <View style={[styles.root, { backgroundColor: T.bg }]}>
      <Hero title={demo.schoolName} subtitle="Demo Details" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, wide && styles.contentWide, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Status row */}
        <View style={styles.statusRow}>
          <Badge label={demo.status} color={STATUS_COLOR[demo.status] || T.dim} />
          <Badge label={demo.demoMode} color={MODE_COLOR[demo.demoMode] || T.sub} />
          {/* 'Has Recording' badge removed: DemoAssignmentDto has no HasRecording
              property and ToDto never sets one, so it was always falsy. */}
        </View>

        {/* Info Card */}
        <Card>
          <Text style={[styles.sectionTitle, { color: T.text }]}>Demo Details</Text>
          {[
            { label: 'School', value: demo.schoolName, icon: '🏫' },
            { label: 'Assigned To', value: demo.assignedToName, icon: '👨‍💼' },
            { label: 'Requested By', value: demo.requestedByName, icon: '👤' },
            { label: 'Date', value: formatDate(demo.scheduledDate), icon: '📅' },
            { label: 'Time', value: `${demo.scheduledStartTime} – ${demo.scheduledEndTime}`, icon: '⏰' },
          ].map(row => (
            <View key={row.label} style={[styles.infoRow, { borderBottomColor: T.line }]}>
              <Text style={[styles.infoLabel, { color: T.sub }]}>{row.icon} {row.label}</Text>
              <Text style={[styles.infoValue, { color: T.text }]} numberOfLines={1}>{row.value}</Text>
            </View>
          ))}
          {demo.meetingLink ? (
            <TouchableOpacity style={styles.linkRow} onPress={() => Linking.openURL(demo.meetingLink!)}>
              <Link size={14} color={T.accent} />
              <Text style={[styles.linkText, { color: T.accent }]}>Join Meeting</Text>
            </TouchableOpacity>
          ) : null}
        </Card>

        {/* Notes */}
        {demo.notes ? (
          <Card>
            <Text style={[styles.sectionTitle, { color: T.text }]}>Notes</Text>
            <Text style={[styles.notesText, { color: T.sub }]}>{demo.notes}</Text>
          </Card>
        ) : null}

        {/* Outcome / Feedback (completed demos) */}
        {demo.status === 'Completed' && (demo.outcome || demo.feedback || demo.feedbackSentiment) ? (
          <Card>
            <Text style={[styles.sectionTitle, { color: T.text }]}>Feedback</Text>
            <View style={styles.feedbackRow}>
              {demo.outcome ? (
                <Badge label={demo.outcome} color={outcomeColor(demo.outcome)} />
              ) : null}
              {demo.feedbackSentiment ? (
                (() => {
                  const sc = demo.feedbackSentiment === 'Positive' ? T.success
                    : demo.feedbackSentiment === 'Negative' ? T.danger : T.sub;
                  return (
                    <View style={[styles.sentimentBadge, { backgroundColor: withAlpha(sc, 0.09) }]}>
                      {demo.feedbackSentiment === 'Positive' && <ThumbsUp size={12} color={sc} />}
                      {demo.feedbackSentiment === 'Negative' && <ThumbsDown size={12} color={sc} />}
                      {demo.feedbackSentiment === 'Neutral' && <Minus size={12} color={sc} />}
                      <Text style={[styles.sentimentText, { color: sc }]}>{demo.feedbackSentiment}</Text>
                    </View>
                  );
                })()
              ) : null}
            </View>
            {demo.feedback ? <Text style={[styles.notesText, { color: T.sub, marginTop: 8 }]}>{demo.feedback}</Text> : null}
            {(demo.feedbackVideoUrl || demo.feedbackAudioUrl || demo.screenRecordingUrl) ? (
              <View style={styles.mediaRow}>
                {demo.feedbackVideoUrl ? (
                  <TouchableOpacity onPress={() => Linking.openURL(demo.feedbackVideoUrl!)}>
                    <Text style={[styles.mediaLink, { color: T.accent }]}>▶ Video</Text>
                  </TouchableOpacity>
                ) : null}
                {demo.feedbackAudioUrl ? (
                  <TouchableOpacity onPress={() => Linking.openURL(demo.feedbackAudioUrl!)}>
                    <Text style={[styles.mediaLink, { color: T.accent }]}>🎙 Audio</Text>
                  </TouchableOpacity>
                ) : null}
                {demo.screenRecordingUrl ? (
                  <TouchableOpacity onPress={() => Linking.openURL(demo.screenRecordingUrl!)}>
                    <Text style={[styles.mediaLink, { color: T.accent }]}>🖥 Recording</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
          </Card>
        ) : null}

        {/* Action Buttons — Managers only */}
        {canAct ? (
          <Card>
            <Text style={[styles.sectionTitle, { color: T.text }]}>Actions</Text>
            <View style={styles.actionsGrid}>
              {demo.status === 'Requested' ? (
                <Btn
                  label="Approve & Schedule"
                  disabled={updating}
                  onPress={() => handleStatusUpdate('Scheduled')}
                  style={styles.primaryAction}
                />
              ) : null}
              {(demo.status === 'Scheduled' || demo.status === 'Approved') ? (<>
                <Btn
                  label="Start Demo"
                  variant="secondary"
                  icon={<Play size={14} color={T.accent} />}
                  disabled={updating}
                  onPress={() => { handleStatusUpdate('InProgress'); Linking.openURL(DEMO_APP_URL).catch(() => {}); }}
                  style={styles.primaryAction}
                />
                <Btn
                  label="Mark Completed"
                  disabled={updating}
                  onPress={openCompleteModal}
                  style={styles.primaryAction}
                />
              </>) : null}
              {demo.status === 'InProgress' ? (<>
                <Btn
                  label="Resume Demo"
                  variant="secondary"
                  icon={<Play size={14} color={T.accent} />}
                  disabled={updating}
                  onPress={() => Linking.openURL(DEMO_APP_URL).catch(() => {})}
                  style={styles.primaryAction}
                />
                <Btn
                  label="Mark Completed"
                  disabled={updating}
                  onPress={openCompleteModal}
                  style={styles.primaryAction}
                />
              </>) : null}
              {/* Destructive → ConfirmModal (danger), not a native Alert. */}
              <Btn
                label="Cancel Demo"
                variant="dangerGhost"
                disabled={updating}
                onPress={() => setShowCancelConfirm(true)}
                style={styles.primaryAction}
              />
            </View>
          </Card>
        ) : null}
      </ScrollView>

      {/* Complete Demo — kit FormModal (edit flow), wide so the outcome and
          sentiment rows are not cramped on an iPad. */}
      <FormModal
        visible={showCompleteModal}
        title="Complete Demo"
        wide
        onClose={() => setShowCompleteModal(false)}
        footer={
          <View style={styles.modalBtns}>
            <Btn label="Cancel" variant="secondary" onPress={() => setShowCompleteModal(false)} style={styles.modalBtn} />
            <Btn label="Complete Demo" onPress={handleCompleteDemo} loading={updating} disabled={updating} style={styles.modalBtn} />
          </View>
        }
      >
        <ScrollView
          style={styles.modalScroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
              <Text style={[styles.modalSub, { color: T.sub }]}>Provide feedback after demo completion</Text>

              {/* Outcome */}
              <Text style={[styles.fieldLabel, { color: T.sub }]}>Outcome *</Text>
              <View style={styles.chipRow}>
                {OUTCOMES.map(o => {
                  const active = feedbackForm.outcome === o;
                  return (
                    <TouchableOpacity
                      key={o}
                      style={[
                        styles.chip,
                        { backgroundColor: T.cardAlt, borderColor: T.line },
                        active && { backgroundColor: T.accent, borderColor: T.accent },
                      ]}
                      onPress={() => setF('outcome')(o)}
                    >
                      <Text style={[styles.chipText, { color: active ? '#FFF' : T.sub }]}>{o}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Sentiment */}
              <Text style={[styles.fieldLabel, { color: T.sub, marginTop: 14 }]}>Feedback Sentiment *</Text>
              <View style={styles.sentimentRow}>
                {SENTIMENTS.map(s => {
                  const active = feedbackForm.feedbackSentiment === s;
                  const sentColor = s === 'Positive' ? T.success : s === 'Negative' ? T.danger : T.sub;
                  return (
                    <TouchableOpacity
                      key={s}
                      style={[
                        styles.sentBtn,
                        { borderColor: T.line, backgroundColor: T.cardAlt },
                        active && { borderColor: sentColor, backgroundColor: withAlpha(sentColor, 0.08) },
                      ]}
                      onPress={() => setF('feedbackSentiment')(s)}
                    >
                      {s === 'Positive' && <ThumbsUp size={16} color={active ? sentColor : T.dim} />}
                      {s === 'Negative' && <ThumbsDown size={16} color={active ? sentColor : T.dim} />}
                      {s === 'Neutral' && <Minus size={16} color={active ? sentColor : T.dim} />}
                      <Text style={[styles.sentBtnText, { color: active ? sentColor : T.dim }]}>{s}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Feedback Notes */}
              <Text style={[styles.fieldLabel, { color: T.sub, marginTop: 14 }]}>Feedback Notes</Text>
              <TextInput
                style={[styles.textarea, { backgroundColor: T.fieldBg, borderColor: T.line, color: T.text }]}
                value={feedbackForm.feedback}
                onChangeText={setF('feedback')}
                placeholder="How did the demo go? School's response..."
                placeholderTextColor={T.dim}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              {/* Video / Audio / Screen-recording URL inputs removed for web parity:
                  media is captured by the Record Demo flow and persisted to GCP
                  automatically, so hand-pasted links are no longer collected here.
                  The DTO still accepts the fields; nothing sends them now. */}

        </ScrollView>
      </FormModal>

      {/* Cancelling a demo is destructive → ConfirmModal, danger tone. */}
      <ConfirmModal
        visible={showCancelConfirm}
        tone="danger"
        title="Cancel Demo"
        message="Are you sure you want to cancel this demo? This cannot be undone."
        icon={<XCircle size={22} color={T.danger} strokeWidth={2} />}
        confirmLabel="Yes, Cancel"
        onConfirm={() => { setShowCancelConfirm(false); handleStatusUpdate('Cancelled'); }}
        onCancel={() => setShowCancelConfirm(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 14, paddingBottom: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titleBlock: { flex: 1, minWidth: 0, gap: 2 },
  h1: { fontWeight: '800', fontSize: rf(19), letterSpacing: -0.4 },
  h2: { fontWeight: '500', fontSize: rf(12.5) },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 12 },
  contentWide: { maxWidth: 720, width: '100%', alignSelf: 'center' },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sectionTitle: { fontWeight: '700', fontSize: rf(14), marginBottom: 12 },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  infoLabel: { fontWeight: '400', fontSize: rf(13) },
  infoValue: { fontWeight: '600', fontSize: rf(13), flex: 1, textAlign: 'right' },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 10 },
  linkText: { fontWeight: '700', fontSize: rf(14) },
  notesText: { fontWeight: '400', fontSize: rf(14), lineHeight: 22 },
  feedbackRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4, alignItems: 'center' },
  sentimentBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100,
  },
  sentimentText: { fontWeight: '700', fontSize: rf(12) },
  mediaRow: { flexDirection: 'row', gap: 12, marginTop: 8, flexWrap: 'wrap' },
  mediaLink: { fontWeight: '700', fontSize: rf(13) },
  actionsGrid: { gap: 10 },
  primaryAction: { width: '100%', height: 50 },
  // Modal
  modalSub: { fontWeight: '400', fontSize: rf(13), marginBottom: 16 },
  fieldLabel: { fontWeight: '600', fontSize: rf(13), marginBottom: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, borderWidth: 1,
  },
  chipText: { fontWeight: '600', fontSize: rf(13) },
  sentimentRow: { flexDirection: 'row', gap: 8 },
  sentBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 12, borderWidth: 1,
  },
  sentBtnText: { fontWeight: '600', fontSize: rf(13) },
  textarea: {
    borderWidth: 1, borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 10, fontWeight: '400', fontSize: rf(14),
    height: 90, textAlignVertical: 'top',
  },
  input: {
    borderWidth: 1, borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 10,
    fontWeight: '400', fontSize: rf(14),
  },
  modalBtns: { flexDirection: 'row', gap: 10, flex: 1 },
  modalBtn: { flex: 1 },
  modalScroll: { maxHeight: 420 },
});
