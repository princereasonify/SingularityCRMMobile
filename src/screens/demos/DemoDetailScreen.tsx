import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Alert, TouchableOpacity,
  TextInput, Modal, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Video, Link, Calendar, Clock, User } from 'lucide-react-native';
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

export const DemoDetailScreen = ({ navigation, route }: any) => {
  const { demoId } = route.params;
  const { user } = useAuth();
  const role = user?.role || 'FO';
  const COLOR = ROLE_COLORS[role as keyof typeof ROLE_COLORS];

  const [demo, setDemo] = useState<DemoAssignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [outcome, setOutcome] = useState('Successful');
  const [feedback, setFeedback] = useState('');
  const [updating, setUpdating] = useState(false);

  const load = () => {
    setLoading(true);
    demosApi.getById(demoId)
      .then(res => setDemo(res.data))
      .catch(() => Alert.alert('Error', 'Failed to load demo'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [demoId]);

  const handleStartDemo = async () => {
    setUpdating(true);
    try {
      await demosApi.updateStatus(demoId, 'InProgress');
      load();
    } catch { Alert.alert('Error', 'Failed to update status'); }
    finally { setUpdating(false); }
  };

  const handleCompleteDemo = async () => {
    setUpdating(true);
    try {
      await demosApi.updateStatus(demoId, 'Completed', outcome, feedback);
      setShowCompleteModal(false);
      load();
    } catch { Alert.alert('Error', 'Failed to complete demo'); }
    finally { setUpdating(false); }
  };

  if (loading) return <LoadingSpinner fullScreen color={COLOR.primary} message="Loading..." />;
  if (!demo) return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Demo" color={COLOR.primary} onBack={() => navigation.goBack()} />
      <EmptyState title="Demo not found" icon="🖥️" />
    </SafeAreaView>
  );

  const isDemo = role === 'Demo' as any;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title={demo.schoolName} subtitle="Demo Details" color={COLOR.primary} onBack={() => navigation.goBack()} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Status */}
        <View style={styles.statusRow}>
          <Badge label={demo.status} color={STATUS_COLORS[demo.status] || '#9CA3AF'} />
          <Badge label={demo.demoMode} color={MODE_COLORS[demo.demoMode] || '#6B7280'} />
          {demo.hasRecording && <Badge label="Has Recording" color="#7C3AED" />}
        </View>

        {/* Info Card */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Demo Details</Text>
          {[
            { label: 'School', value: demo.schoolName, icon: '🏫' },
            { label: 'Date', value: formatDate(demo.scheduledDate), icon: '📅' },
            { label: 'Time', value: `${demo.scheduledStartTime} – ${demo.scheduledEndTime}`, icon: '⏰' },
            { label: 'Requested By', value: demo.requestedByName, icon: '👤' },
            { label: 'Assigned To', value: demo.assignedToName, icon: '👨‍💼' },
          ].map(row => (
            <View key={row.label} style={styles.infoRow}>
              <Text style={styles.infoLabel}>{row.icon} {row.label}</Text>
              <Text style={styles.infoValue}>{row.value}</Text>
            </View>
          ))}
          {demo.meetingLink && (
            <TouchableOpacity
              style={styles.linkRow}
              onPress={() => Linking.openURL(demo.meetingLink!)}
            >
              <Link size={14} color={COLOR.primary} />
              <Text style={[styles.linkText, { color: COLOR.primary }]}>Join Meeting</Text>
            </TouchableOpacity>
          )}
        </Card>

        {/* Notes */}
        {demo.notes && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notesText}>{demo.notes}</Text>
          </Card>
        )}

        {/* Outcome */}
        {demo.outcome && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Outcome</Text>
            <Badge label={demo.outcome} color={demo.outcome === 'Successful' ? '#16A34A' : demo.outcome === 'Unsuccessful' ? '#DC2626' : '#F59E0B'} />
            {demo.feedback && <Text style={[styles.notesText, { marginTop: 8 }]}>{demo.feedback}</Text>}
          </Card>
        )}

        {/* Actions */}
        {isDemo && demo.status === 'Scheduled' && (
          <Button title={updating ? 'Updating...' : 'Start Demo'} onPress={handleStartDemo} variant="primary" disabled={updating} />
        )}
        {isDemo && demo.status === 'InProgress' && (
          <Button title="Complete Demo" onPress={() => setShowCompleteModal(true)} variant="primary" />
        )}
      </ScrollView>

      {/* Complete Modal */}
      <Modal visible={showCompleteModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Complete Demo</Text>
            <Text style={styles.fieldLabel}>Outcome</Text>
            <View style={styles.chipRow}>
              {OUTCOMES.map(o => (
                <TouchableOpacity
                  key={o}
                  style={[styles.chip, outcome === o && { backgroundColor: COLOR.primary }]}
                  onPress={() => setOutcome(o)}
                >
                  <Text style={[styles.chipText, outcome === o && { color: '#FFF' }]}>{o}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Feedback</Text>
            <TextInput
              style={styles.textarea}
              value={feedback}
              onChangeText={setFeedback}
              placeholder="Client feedback or observations..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCompleteModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <Button title={updating ? 'Saving...' : 'Submit'} onPress={handleCompleteDemo} variant="primary" disabled={updating} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  section: {},
  sectionTitle: { fontSize: rf(14), fontWeight: '700', color: '#111827', marginBottom: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  infoLabel: { fontSize: rf(13), color: '#6B7280' },
  infoValue: { fontSize: rf(13), color: '#111827', fontWeight: '500', flex: 1, textAlign: 'right' },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 10 },
  linkText: { fontSize: rf(14), fontWeight: '600' },
  notesText: { fontSize: rf(14), color: '#374151', lineHeight: 22 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: rf(18), fontWeight: '700', color: '#111827', marginBottom: 16 },
  fieldLabel: { fontSize: rf(13), fontWeight: '600', color: '#374151', marginBottom: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100,
    backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB',
  },
  chipText: { fontSize: rf(13), color: '#374151', fontWeight: '500' },
  textarea: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: rf(14), color: '#111827',
    height: 100, textAlignVertical: 'top',
  },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center' },
  cancelText: { fontSize: rf(15), fontWeight: '600', color: '#6B7280' },
});
