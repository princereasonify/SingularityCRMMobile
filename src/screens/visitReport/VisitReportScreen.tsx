import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Alert, TextInput, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { visitReportApi } from '../../api/visitReport';
import { AppHeader } from '../../components/ui';
import { GradientButton } from '../../components/common/GradientButton';
import { Fonts } from '../../theme';
import { useAppTheme } from '../../theme/useAppTheme';
import { rf, isTabletDevice } from '../../utils/responsive';

export const VisitReportScreen = ({ navigation, route }: any) => {
  const { schoolVisitLogId, schoolName, activityId } = route.params ?? {};
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

          <GradientButton
            label="Submit Visit Report"
            onPress={handleSubmit}
            loading={submitting}
            disabled={submitting}
            style={{ marginTop: 8 }}
          />
        </View>
      </ScrollView>
    </View>
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
  formWrapTablet: { alignSelf: 'center', width: '100%', maxWidth: 720 },
  infoBanner: { borderRadius: 14, padding: 12 },
  infoBannerText: { fontFamily: Fonts.medium, fontSize: rf(14), lineHeight: 20 },
  card: {
    borderRadius: 18, borderWidth: 1, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05, shadowRadius: 10, elevation: 1,
  },
  cardTitle: { fontFamily: Fonts.bold, fontSize: rf(13), marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldGroup: { marginBottom: 14 },
  fieldLabel: { fontFamily: Fonts.medium, fontSize: rf(13), marginBottom: 6 },
  input: {
    borderWidth: 1, borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 10,
    fontFamily: Fonts.regular, fontSize: rf(14),
  },
  inputMulti: { minHeight: 80, textAlignVertical: 'top' },
});
