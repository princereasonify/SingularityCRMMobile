import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Alert, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { visitReportApi } from '../../api/visitReport';
import { useAuth } from '../../context/AuthContext';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { Button } from '../../components/common/Button';
import { ROLE_COLORS } from '../../utils/constants';
import { rf } from '../../utils/responsive';

export const VisitReportScreen = ({ navigation, route }: any) => {
  const { schoolVisitLogId, schoolName, activityId } = route.params ?? {};
  const { user } = useAuth();
  const COLOR = ROLE_COLORS[(user?.role || 'FO') as keyof typeof ROLE_COLORS];

  const [purpose, setPurpose] = useState('');
  const [outcome, setOutcome] = useState('');
  const [remarks, setRemarks] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [nextActionDate, setNextActionDate] = useState('');
  const [nextActionNotes, setNextActionNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!purpose.trim()) { Alert.alert('Validation', 'Purpose of visit is required'); return; }
    if (!outcome.trim()) { Alert.alert('Validation', 'Visit outcome is required'); return; }
    if (!nextAction.trim()) { Alert.alert('Validation', 'Next action is required'); return; }
    setSubmitting(true);
    try {
      await visitReportApi.create({
        schoolVisitLogId,
        activityId,
        purpose: purpose.trim(),
        outcome: outcome.trim(),
        remarks: remarks || undefined,
        nextAction: nextAction.trim(),
        nextActionDate: nextActionDate || undefined,
        nextActionNotes: nextActionNotes || undefined,
      });
      Alert.alert('Success', 'Visit report submitted successfully');
      navigation.goBack();
    } catch {
      Alert.alert('Error', 'Failed to submit report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScreenHeader
        title="Visit Report"
        subtitle={schoolName}
        color={COLOR.primary}
        onBack={() => navigation.goBack()}
      />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={[styles.infoBanner, { backgroundColor: COLOR.light }]}>
          <Text style={[styles.infoBannerText, { color: COLOR.primary }]}>
            📍 Fill this report for your visit to {schoolName || 'the school'}
          </Text>
        </View>

        <SectionCard label="Visit Details">
          <Field
            label="Purpose of Visit *"
            value={purpose}
            onChange={setPurpose}
            placeholder="Why did you visit? (Demo, follow-up, introduction...)"
            multiline
          />
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

        <SectionCard label="Next Action">
          <Field
            label="Next Action *"
            value={nextAction}
            onChange={setNextAction}
            placeholder="What is the next step? (Schedule demo, send proposal...)"
            multiline
          />
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

        <Button
          title={submitting ? 'Submitting...' : 'Submit Visit Report'}
          onPress={handleSubmit}
          variant="primary"
          disabled={submitting}
          style={{ marginTop: 8 }}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const Field = ({ label, value, onChange, placeholder, multiline }: any) => (
  <View style={styles.fieldGroup}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      style={[styles.input, multiline && styles.inputMulti]}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor="#9CA3AF"
      multiline={multiline}
      numberOfLines={multiline ? 3 : 1}
    />
  </View>
);

const SectionCard = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <View style={styles.card}>
    <Text style={styles.cardTitle}>{label}</Text>
    {children}
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  infoBanner: { borderRadius: 12, padding: 12 },
  infoBannerText: { fontSize: rf(14), fontWeight: '500', lineHeight: 20 },
  card: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  cardTitle: { fontSize: rf(13), fontWeight: '700', color: '#6B7280', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldGroup: { marginBottom: 14 },
  fieldLabel: { fontSize: rf(13), fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: rf(14), color: '#111827', backgroundColor: '#FAFAFA',
  },
  inputMulti: { minHeight: 80, textAlignVertical: 'top' },
});
