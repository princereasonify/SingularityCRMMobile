import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Alert, TouchableOpacity,
  TextInput, Modal, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, ThumbsUp, ThumbsDown, Minus, Play } from 'lucide-react-native';
import { demosApi } from '../../api/demos';
import { DemoAssignment } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { Button } from '../../components/common/Button';
import { LoadingSpinner, EmptyState } from '../../components/common/LoadingSpinner';
import { ROLE_COLORS } from '../../utils/constants';
import { formatDate } from '../../utils/formatting';
import { rf } from '../../utils/responsive';

const STATUS_COLORS: Record<string, string> = {
  Requested: '#F59E0B', Approved: '#2563EB', Scheduled: '#0D9488',
  InProgress: '#EA580C', Completed: '#16A34A', Cancelled: '#9CA3AF', Rescheduled: '#7C3AED',
};
const MODE_COLORS: Record<string, string> = {
  Online: '#2563EB', Offline: '#16A34A', Hybrid: '#7C3AED',
};
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

export const DemoDetailScreen = ({ navigation, route }: any) => {
  const { demoId } = route.params;
  const { user } = useAuth();
  const role = user?.role || 'FO';
  const COLOR = ROLE_COLORS[role as keyof typeof ROLE_COLORS];

  // Managers (ZH/RH/SH/SCA) can approve, start, complete, cancel
  const isManager = ['ZH', 'RH', 'SH', 'SCA'].includes(role);

  const [demo, setDemo] = useState<DemoAssignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
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

  if (loading) return <LoadingSpinner fullScreen color={COLOR.primary} message="Loading..." />;
  if (!demo) return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Demo" color={COLOR.primary} onBack={() => navigation.goBack()} />
      <EmptyState title="Demo not found" icon="🖥️" />
    </SafeAreaView>
  );

  const canAct = isManager && demo.status !== 'Completed' && demo.status !== 'Cancelled';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title={demo.schoolName} subtitle="Demo Details" color={COLOR.primary} onBack={() => navigation.goBack()} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Status row */}
        <View style={styles.statusRow}>
          <Badge label={demo.status} color={STATUS_COLORS[demo.status] || '#9CA3AF'} />
          <Badge label={demo.demoMode} color={MODE_COLORS[demo.demoMode] || '#6B7280'} />
          {demo.hasRecording && <Badge label="Has Recording" color="#7C3AED" />}
        </View>

        {/* Info Card */}
        <Card>
          <Text style={styles.sectionTitle}>Demo Details</Text>
          {[
            { label: 'School', value: demo.schoolName, icon: '🏫' },
            { label: 'Assigned To', value: demo.assignedToName, icon: '👨‍💼' },
            { label: 'Requested By', value: demo.requestedByName, icon: '👤' },
            { label: 'Date', value: formatDate(demo.scheduledDate), icon: '📅' },
            { label: 'Time', value: `${demo.scheduledStartTime} – ${demo.scheduledEndTime}`, icon: '⏰' },
          ].map(row => (
            <View key={row.label} style={styles.infoRow}>
              <Text style={styles.infoLabel}>{row.icon} {row.label}</Text>
              <Text style={styles.infoValue} numberOfLines={1}>{row.value}</Text>
            </View>
          ))}
          {demo.meetingLink ? (
            <TouchableOpacity style={styles.linkRow} onPress={() => Linking.openURL(demo.meetingLink!)}>
              <Link size={14} color={COLOR.primary} />
              <Text style={[styles.linkText, { color: COLOR.primary }]}>Join Meeting</Text>
            </TouchableOpacity>
          ) : null}
        </Card>

        {/* Notes */}
        {demo.notes ? (
          <Card>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notesText}>{demo.notes}</Text>
          </Card>
        ) : null}

        {/* Outcome / Feedback (completed demos) */}
        {demo.status === 'Completed' && (demo.outcome || demo.feedback || demo.feedbackSentiment) ? (
          <Card>
            <Text style={styles.sectionTitle}>Feedback</Text>
            <View style={styles.feedbackRow}>
              {demo.outcome ? (
                <Badge
                  label={demo.outcome}
                  color={demo.outcome === 'Successful' ? '#16A34A' : demo.outcome === 'Unsuccessful' ? '#DC2626' : '#F59E0B'}
                />
              ) : null}
              {demo.feedbackSentiment ? (
                <View style={[
                  styles.sentimentBadge,
                  demo.feedbackSentiment === 'Positive' ? styles.sentPos
                    : demo.feedbackSentiment === 'Negative' ? styles.sentNeg
                    : styles.sentNeu,
                ]}>
                  {demo.feedbackSentiment === 'Positive' && <ThumbsUp size={12} color="#16A34A" />}
                  {demo.feedbackSentiment === 'Negative' && <ThumbsDown size={12} color="#DC2626" />}
                  {demo.feedbackSentiment === 'Neutral' && <Minus size={12} color="#6B7280" />}
                  <Text style={[
                    styles.sentimentText,
                    demo.feedbackSentiment === 'Positive' ? { color: '#16A34A' }
                      : demo.feedbackSentiment === 'Negative' ? { color: '#DC2626' }
                      : { color: '#6B7280' },
                  ]}>{demo.feedbackSentiment}</Text>
                </View>
              ) : null}
            </View>
            {demo.feedback ? <Text style={[styles.notesText, { marginTop: 8 }]}>{demo.feedback}</Text> : null}
            {(demo.feedbackVideoUrl || demo.feedbackAudioUrl || demo.screenRecordingUrl) ? (
              <View style={styles.mediaRow}>
                {demo.feedbackVideoUrl ? (
                  <TouchableOpacity onPress={() => Linking.openURL(demo.feedbackVideoUrl!)}>
                    <Text style={[styles.mediaLink, { color: COLOR.primary }]}>▶ Video</Text>
                  </TouchableOpacity>
                ) : null}
                {demo.feedbackAudioUrl ? (
                  <TouchableOpacity onPress={() => Linking.openURL(demo.feedbackAudioUrl!)}>
                    <Text style={[styles.mediaLink, { color: COLOR.primary }]}>🎙 Audio</Text>
                  </TouchableOpacity>
                ) : null}
                {demo.screenRecordingUrl ? (
                  <TouchableOpacity onPress={() => Linking.openURL(demo.screenRecordingUrl!)}>
                    <Text style={[styles.mediaLink, { color: COLOR.primary }]}>🖥 Recording</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
          </Card>
        ) : null}

        {/* Action Buttons — Managers only */}
        {canAct ? (
          <Card>
            <Text style={styles.sectionTitle}>Actions</Text>
            <View style={styles.actionsGrid}>
              {demo.status === 'Requested' ? (
                <ActionBtn
                  label="Approve & Schedule"
                  color="#2563EB"
                  disabled={updating}
                  onPress={() => handleStatusUpdate('Scheduled')}
                />
              ) : null}
              {(demo.status === 'Scheduled' || demo.status === 'Approved') ? (<>
                <ActionBtn
                  label="Start Demo"
                  color="#0D9488"
                  icon={<Play size={14} color="#FFF" />}
                  disabled={updating}
                  onPress={() => handleStatusUpdate('InProgress')}
                />
                <ActionBtn
                  label="Mark Completed"
                  color="#16A34A"
                  disabled={updating}
                  onPress={openCompleteModal}
                />
              </>) : null}
              {demo.status === 'InProgress' ? (<>
                <ActionBtn
                  label="Resume Demo"
                  color="#0D9488"
                  icon={<Play size={14} color="#FFF" />}
                  disabled={updating}
                  onPress={() => handleStatusUpdate('InProgress')}
                />
                <ActionBtn
                  label="Mark Completed"
                  color="#16A34A"
                  disabled={updating}
                  onPress={openCompleteModal}
                />
              </>) : null}
              <ActionBtn
                label="Cancel Demo"
                color="#DC2626"
                ghost
                disabled={updating}
                onPress={() =>
                  Alert.alert('Cancel Demo', 'Are you sure you want to cancel this demo?', [
                    { text: 'No', style: 'cancel' },
                    { text: 'Yes, Cancel', style: 'destructive', onPress: () => handleStatusUpdate('Cancelled') },
                  ])
                }
              />
            </View>
          </Card>
        ) : null}
      </ScrollView>

      {/* Complete Demo Modal */}
      <Modal visible={showCompleteModal} transparent animationType="slide" onRequestClose={() => setShowCompleteModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Complete Demo</Text>
              <Text style={styles.modalSub}>Provide feedback after demo completion</Text>

              {/* Outcome */}
              <Text style={styles.fieldLabel}>Outcome *</Text>
              <View style={styles.chipRow}>
                {OUTCOMES.map(o => (
                  <TouchableOpacity
                    key={o}
                    style={[styles.chip, feedbackForm.outcome === o && { backgroundColor: COLOR.primary, borderColor: COLOR.primary }]}
                    onPress={() => setF('outcome')(o)}
                  >
                    <Text style={[styles.chipText, feedbackForm.outcome === o && { color: '#FFF' }]}>{o}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Sentiment */}
              <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Feedback Sentiment *</Text>
              <View style={styles.sentimentRow}>
                {SENTIMENTS.map(s => {
                  const active = feedbackForm.feedbackSentiment === s;
                  const sentColor = s === 'Positive' ? '#16A34A' : s === 'Negative' ? '#DC2626' : '#6B7280';
                  return (
                    <TouchableOpacity
                      key={s}
                      style={[styles.sentBtn, active && { borderColor: sentColor, backgroundColor: sentColor + '15' }]}
                      onPress={() => setF('feedbackSentiment')(s)}
                    >
                      {s === 'Positive' && <ThumbsUp size={16} color={active ? sentColor : '#9CA3AF'} />}
                      {s === 'Negative' && <ThumbsDown size={16} color={active ? sentColor : '#9CA3AF'} />}
                      {s === 'Neutral' && <Minus size={16} color={active ? sentColor : '#9CA3AF'} />}
                      <Text style={[styles.sentBtnText, active && { color: sentColor }]}>{s}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Feedback Notes */}
              <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Feedback Notes</Text>
              <TextInput
                style={styles.textarea}
                value={feedbackForm.feedback}
                onChangeText={setF('feedback')}
                placeholder="How did the demo go? School's response..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              {/* Optional URLs */}
              <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Video URL (optional)</Text>
              <TextInput
                style={styles.input}
                value={feedbackForm.feedbackVideoUrl}
                onChangeText={setF('feedbackVideoUrl')}
                placeholder="https://drive.google.com/..."
                placeholderTextColor="#9CA3AF"
                keyboardType="url"
                autoCapitalize="none"
              />

              <Text style={[styles.fieldLabel, { marginTop: 10 }]}>Audio URL (optional)</Text>
              <TextInput
                style={styles.input}
                value={feedbackForm.feedbackAudioUrl}
                onChangeText={setF('feedbackAudioUrl')}
                placeholder="https://drive.google.com/..."
                placeholderTextColor="#9CA3AF"
                keyboardType="url"
                autoCapitalize="none"
              />

              <Text style={[styles.fieldLabel, { marginTop: 10 }]}>Screen Recording URL (optional)</Text>
              <TextInput
                style={styles.input}
                value={feedbackForm.screenRecordingUrl}
                onChangeText={setF('screenRecordingUrl')}
                placeholder="https://drive.google.com/..."
                placeholderTextColor="#9CA3AF"
                keyboardType="url"
                autoCapitalize="none"
              />

              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCompleteModal(false)}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <Button
                  title={updating ? 'Saving...' : 'Complete Demo'}
                  onPress={handleCompleteDemo}
                  variant="primary"
                  disabled={updating}
                  style={{ flex: 1 }}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// ─── Action Button helper ──────────────────────────────────────────────────────
const ActionBtn = ({ label, color, ghost, icon, disabled, onPress }: any) => (
  <TouchableOpacity
    disabled={disabled}
    onPress={onPress}
    style={[
      actionStyles.btn,
      ghost
        ? { backgroundColor: '#FFF', borderWidth: 1, borderColor: color }
        : { backgroundColor: color },
      disabled && { opacity: 0.5 },
    ]}
  >
    {icon ? <View style={{ marginRight: 4 }}>{icon}</View> : null}
    <Text style={[actionStyles.label, ghost && { color }]}>{label}</Text>
  </TouchableOpacity>
);

const actionStyles = StyleSheet.create({
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10,
    flex: 1, minWidth: '45%',
  },
  label: { fontSize: rf(13), fontWeight: '600', color: '#FFF' },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sectionTitle: { fontSize: rf(14), fontWeight: '700', color: '#111827', marginBottom: 12 },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  infoLabel: { fontSize: rf(13), color: '#6B7280' },
  infoValue: { fontSize: rf(13), color: '#111827', fontWeight: '500', flex: 1, textAlign: 'right' },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 10 },
  linkText: { fontSize: rf(14), fontWeight: '600' },
  notesText: { fontSize: rf(14), color: '#374151', lineHeight: 22 },
  feedbackRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  sentimentBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100,
  },
  sentPos: { backgroundColor: '#F0FDF4' },
  sentNeg: { backgroundColor: '#FEF2F2' },
  sentNeu: { backgroundColor: '#F3F4F6' },
  sentimentText: { fontSize: rf(12), fontWeight: '600' },
  mediaRow: { flexDirection: 'row', gap: 12, marginTop: 8, flexWrap: 'wrap' },
  mediaLink: { fontSize: rf(13), fontWeight: '600' },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: {
    backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40, maxHeight: '90%',
  },
  modalTitle: { fontSize: rf(18), fontWeight: '700', color: '#111827', marginBottom: 4 },
  modalSub: { fontSize: rf(13), color: '#6B7280', marginBottom: 16 },
  fieldLabel: { fontSize: rf(13), fontWeight: '600', color: '#374151', marginBottom: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100,
    backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB',
  },
  chipText: { fontSize: rf(13), color: '#374151', fontWeight: '500' },
  sentimentRow: { flexDirection: 'row', gap: 8 },
  sentBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 12,
    borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FAFAFA',
  },
  sentBtnText: { fontSize: rf(13), fontWeight: '500', color: '#9CA3AF' },
  textarea: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: rf(14), color: '#111827',
    height: 90, textAlignVertical: 'top',
  },
  input: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: rf(14), color: '#111827', backgroundColor: '#FAFAFA',
  },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: rf(15), fontWeight: '600', color: '#6B7280' },
});
