import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, Linking, useWindowDimensions, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Phone, Mail, User, History, X, Navigation } from 'lucide-react-native';
import { leadsApi } from '../../api/leads';
import { aiApi } from '../../api/ai';
import { LeadDto, LeadStage, LeadScoreBreakdown, UserDto } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { StageBadge } from '../../components/common/Badge';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { Button } from '../../components/common/Button';
import { GradientBackground } from '../../components/common/GradientBackground';
import { GradientButton } from '../../components/common/GradientButton';
import { Card, StatTile, Badge, SectionLabel } from '../../components/ui';
import { ACTIVITY_COLORS, STAGE_LABELS, getScoreColor, OUTCOME_COLORS } from '../../utils/constants';
import { formatCurrency, formatDate, formatRelativeDate } from '../../utils/formatting';
import { rf, isTabletDevice } from '../../utils/responsive';
import { Fonts } from '../../theme';
import { useAppTheme } from '../../theme/useAppTheme';

const STAGE_ORDER: LeadStage[] = [
  'NewLead', 'Contacted', 'Qualified', 'DemoStage', 'DemoDone',
  'ProposalSent', 'Negotiation', 'ContractSent', 'Won', 'ImplementationStarted',
];

export const LeadDetailScreen = ({ route, navigation }: any) => {
  const { leadId } = route.params;
  const { user } = useAuth();
  const role = user?.role || 'FO';
  const T = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const twoWide = isTabletDevice && width > height;

  const [lead, setLead] = useState<LeadDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [scoreBreakdown, setScoreBreakdown] = useState<LeadScoreBreakdown | null>(null);
  const [showScoreModal, setShowScoreModal] = useState(false);

  // Reassign modal (managers only)
  const isManager = role !== 'FO';
  const [fos, setFos] = useState<UserDto[]>([]);
  const [showAssign, setShowAssign] = useState(false);
  const [selectedFoId, setSelectedFoId] = useState<string | number>('');
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    if (isManager) {
      leadsApi.getAssignableFOs().then((r) => setFos(Array.isArray(r.data) ? r.data : (r.data as any)?.items ?? [])).catch(() => {});
    }
  }, [isManager]);

  const handleAssign = async () => {
    if (!selectedFoId) return;
    setAssigning(true);
    try {
      const res = await leadsApi.assignLead(leadId, Number(selectedFoId));
      setLead(res.data);
      setShowAssign(false);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to reassign lead');
    } finally {
      setAssigning(false);
    }
  };

  const fetch = useCallback(async () => {
    try {
      const res = await leadsApi.getLead(leadId);
      setLead(res.data);
    } catch {
      Alert.alert('Error', 'Failed to load lead details');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => { fetch(); }, [fetch]);

  const handleOpenScoreBreakdown = async () => {
    setShowScoreModal(true);
    if (!scoreBreakdown) {
      try {
        const res = await aiApi.getLeadScoreBreakdown(leadId);
        setScoreBreakdown(res.data);
      } catch {
        // graceful fallback: show total only
      }
    }
  };

  const handleMarkLost = () => {
    Alert.prompt?.('Mark as Lost', 'Enter loss reason:', async (reason) => {
      if (!reason) return;
      try {
        await leadsApi.updateLead(leadId, { lossReason: reason } as any);
        fetch();
      } catch { Alert.alert('Error', 'Failed to update lead'); }
    });
  };

  if (loading) return <LoadingSpinner fullScreen color={T.accent} />;
  if (!lead) return null;

  const stageIdx = STAGE_ORDER.indexOf(lead.stage as any);
  const canCreateDeal = ['DemoDone', 'ProposalSent', 'Negotiation', 'ContractSent', 'Won'].includes(lead.stage);

  const breakdownItems = scoreBreakdown ? [
    { label: 'Engagement', value: scoreBreakdown.engagement, max: 30, color: T.info },
    { label: 'Visit Quality', value: scoreBreakdown.visitQuality, max: 25, color: T.success },
    { label: 'Contact Quality', value: scoreBreakdown.contactQuality, max: 15, color: '#8B5CF6' },
    { label: 'Demo Progress', value: scoreBreakdown.demoProgress, max: 20, color: T.warning },
    { label: 'Deal Signals', value: scoreBreakdown.dealSignals, max: 10, color: T.accent },
  ] : [];

  return (
    <View style={[styles.root, { backgroundColor: T.bg }]}>
      {/* Sunstone hero header */}
      <GradientBackground glow style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <ArrowLeft size={20} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerSchool} numberOfLines={1}>{lead.school}</Text>
            <View style={styles.headerSubRow}>
              <StageBadge stage={lead.stage} />
              <TouchableOpacity
                style={styles.historyBtn}
                onPress={() => navigation.navigate('AuditHistory', { entityType: 'Lead', entityId: leadId, title: lead.school })}
              >
                <History size={14} color="rgba(255,255,255,0.85)" />
                <Text style={styles.historyBtnText}>History</Text>
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity onPress={handleOpenScoreBreakdown}>
            <View style={[styles.scoreCircle, { borderColor: getScoreColor(lead.score) }]}>
              <Text style={[styles.scoreValue, { color: getScoreColor(lead.score) }]}>{lead.score}</Text>
              <Text style={styles.scoreLabel}>score</Text>
            </View>
          </TouchableOpacity>
        </View>
      </GradientBackground>

      {/* Score Breakdown Modal */}
      <Modal visible={showScoreModal} transparent animationType="slide" onRequestClose={() => setShowScoreModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: T.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: T.text }]}>Score Breakdown</Text>
              <TouchableOpacity onPress={() => setShowScoreModal(false)}>
                <X size={20} color={T.sub} />
              </TouchableOpacity>
            </View>
            {scoreBreakdown ? (
              <>
                {breakdownItems.map(item => (
                  <View key={item.label} style={styles.breakdownRow}>
                    <View style={styles.breakdownLabel}>
                      <Text style={[styles.breakdownLabelText, { color: T.sub }]}>{item.label}</Text>
                      <Text style={[styles.breakdownScore, { color: item.color }]}>{item.value}/{item.max}</Text>
                    </View>
                    <View style={[styles.breakdownBarBg, { backgroundColor: T.cardAlt }]}>
                      <View style={[styles.breakdownBarFill, { width: `${(item.value / item.max) * 100}%`, backgroundColor: item.color }]} />
                    </View>
                  </View>
                ))}
                <View style={[styles.breakdownTotal, { borderTopColor: T.line }]}>
                  <Text style={[styles.breakdownTotalLabel, { color: T.text }]}>Total Score</Text>
                  <Text style={[styles.breakdownTotalValue, { color: getScoreColor(scoreBreakdown.total) }]}>
                    {scoreBreakdown.total}/100
                  </Text>
                </View>
              </>
            ) : (
              <View style={styles.scoreModalLoading}>
                <Text style={[styles.scoreModalLoadingText, { color: T.text }]}>Score: {lead.score}/100</Text>
                <Text style={[styles.scoreModalSub, { color: T.sub }]}>Detailed breakdown not available</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, twoWide && { padding: 24, gap: 18 }]}>
        {/* Key highlights */}
        <View style={styles.statRow}>
          <StatTile
            label="Est. Value"
            value={formatCurrency(lead.value)}
            tint={T.accent}
            style={styles.statTile}
          />
          <StatTile
            label="Students"
            value={lead.students?.toLocaleString('en-IN') || '—'}
            tint={T.info}
            style={styles.statTile}
          />
        </View>

        {/* Stage Progression */}
        <View>
          <SectionLabel>Pipeline Stage</SectionLabel>
          <Card>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stageScroll}>
              <View style={styles.stageTrack}>
                {STAGE_ORDER.map((stage, idx) => {
                  const done = idx <= stageIdx;
                  const current = idx === stageIdx;
                  return (
                    <React.Fragment key={stage}>
                      <View style={styles.stageItem}>
                        <View style={[
                          styles.stageDot,
                          { backgroundColor: done ? (current ? T.accent : T.success) : T.line },
                        ]}>
                          {done && <Text style={styles.stageDotCheck}>{current ? '●' : '✓'}</Text>}
                        </View>
                        <Text
                          style={[styles.stageLabel, { color: T.dim }, current && { color: T.accent, fontFamily: Fonts.bold }]}
                          numberOfLines={2}
                        >
                          {STAGE_LABELS[stage]}
                        </Text>
                      </View>
                      {idx < STAGE_ORDER.length - 1 && (
                        <View style={[styles.stageLine, { backgroundColor: idx < stageIdx ? T.success : T.line }]} />
                      )}
                    </React.Fragment>
                  );
                })}
              </View>
            </ScrollView>
          </Card>
        </View>

        {/* Contact Card */}
        {lead.contact && (
          <View>
            <SectionLabel>Contact Person</SectionLabel>
            <Card>
              <View style={styles.contactRow}>
                <View style={[styles.contactAvatar, { backgroundColor: T.accentSoft }]}>
                  <Text style={[styles.contactAvatarText, { color: T.accent }]}>
                    {lead.contact.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.contactInfo}>
                  <Text style={[styles.contactName, { color: T.text }]}>{lead.contact.name}</Text>
                  <Text style={[styles.contactDesg, { color: T.sub }]}>{lead.contact.designation}</Text>
                </View>
              </View>
              <View style={styles.contactActions}>
                {lead.contact.phone && (
                  <TouchableOpacity
                    style={[styles.contactBtn, { backgroundColor: T.info + '22' }]}
                    onPress={() => Linking.openURL(`tel:${lead.contact!.phone}`)}
                  >
                    <Phone size={16} color={T.info} />
                    <Text style={[styles.contactBtnText, { color: T.info }]}>{lead.contact.phone}</Text>
                  </TouchableOpacity>
                )}
                {lead.contact.email && (
                  <TouchableOpacity
                    style={[styles.contactBtn, { backgroundColor: T.success + '22' }]}
                    onPress={() => Linking.openURL(`mailto:${lead.contact!.email}`)}
                  >
                    <Mail size={16} color={T.success} />
                    <Text style={[styles.contactBtnText, { color: T.success }]} numberOfLines={1}>{lead.contact.email}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </Card>
          </View>
        )}

        {/* Attributes Grid */}
        <View>
          <SectionLabel>Lead Info</SectionLabel>
          <Card>
            <View style={styles.attrGrid}>
              {[
                { label: 'Board', value: lead.board },
                { label: 'Type', value: lead.type },
                { label: 'Close Date', value: formatDate(lead.closeDate) || '—' },
                { label: 'Source', value: lead.source },
                { label: 'City', value: lead.city },
                { label: 'State', value: lead.state || '—' },
              ].map(({ label, value }) => (
                <View key={label} style={[styles.attrItem, twoWide && { width: '30%' }]}>
                  <Text style={[styles.attrLabel, { color: T.dim }]}>{label}</Text>
                  <Text style={[styles.attrValue, { color: T.text }]}>{value}</Text>
                </View>
              ))}
            </View>
            {lead.notes && (
              <View style={[styles.notes, { backgroundColor: T.cardAlt }]}>
                <Text style={[styles.attrLabel, { color: T.dim }]}>Notes</Text>
                <Text style={[styles.notesText, { color: T.sub }]}>{lead.notes}</Text>
              </View>
            )}
            {lead.lossReason && (
              <View style={[styles.notes, { backgroundColor: T.danger + '18' }]}>
                <Text style={[styles.attrLabel, { color: T.danger }]}>Loss Reason</Text>
                <Text style={[styles.notesText, { color: T.danger }]}>{lead.lossReason}</Text>
              </View>
            )}
          </Card>
        </View>

        {/* Assignment */}
        <View>
          <SectionLabel>Assignment</SectionLabel>
          <Card>
            {lead.foName && (
              <View style={styles.assignRow}>
                <User size={16} color={T.accent} />
                <Text style={[styles.assignLabel, { color: T.sub }]}>Assigned FO:</Text>
                <Text style={[styles.assignValue, { color: T.text }]}>{lead.foName}</Text>
              </View>
            )}
            {lead.assignedByName && (
              <View style={styles.assignRow}>
                <User size={16} color={T.dim} />
                <Text style={[styles.assignLabel, { color: T.sub }]}>Assigned By:</Text>
                <Text style={[styles.assignValue, { color: T.text }]}>{lead.assignedByName}</Text>
              </View>
            )}
          </Card>
        </View>

        {/* Activity Timeline */}
        {(lead.activities?.length || 0) > 0 && (
          <View>
            <SectionLabel>Activity Timeline</SectionLabel>
            <Card>
              {lead.activities!.map((act) => (
                <View key={act.id} style={styles.actItem}>
                  <View style={[styles.actIcon, { backgroundColor: (ACTIVITY_COLORS[act.type] || T.accent) + '22' }]}>
                    <Text style={[styles.actIconText, { color: ACTIVITY_COLORS[act.type] || T.accent }]}>
                      {act.type.charAt(0)}
                    </Text>
                  </View>
                  <View style={styles.actContent}>
                    <View style={styles.actHeader}>
                      <Badge label={act.type} color={ACTIVITY_COLORS[act.type]} />
                      <Badge label={act.outcome} color={OUTCOME_COLORS[act.outcome]} />
                      {act.gpsVerified && (
                        <View style={[styles.gpsBadge, { backgroundColor: T.success + '22' }]}>
                          <Navigation size={10} color={T.success} />
                          <Text style={[styles.gpsBadgeText, { color: T.success }]}>GPS Verified</Text>
                        </View>
                      )}
                      <Text style={[styles.actDate, { color: T.dim }]}>{formatRelativeDate(act.date)}</Text>
                    </View>
                    {act.notes && <Text style={[styles.actNotes, { color: T.sub }]} numberOfLines={2}>{act.notes}</Text>}
                    {act.personMet && (
                      <Text style={[styles.actMeta, { color: T.dim }]}>Met: {act.personMet} ({act.personDesignation})</Text>
                    )}
                  </View>
                </View>
              ))}
            </Card>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          {isManager && (
            <Button
              title="Reassign Lead"
              onPress={() => { setShowAssign(true); setSelectedFoId(''); }}
              variant="secondary"
              color={T.accent}
              style={styles.actionBtn}
            />
          )}
          <GradientButton
            label="Edit Lead"
            onPress={() => navigation.navigate('EditLead', { leadId })}
            style={styles.actionBtn}
          />
          {canCreateDeal && (
            <Button
              title="Create Deal"
              onPress={() => navigation.navigate('CreateDeal', { leadId })}
              color={T.success}
              style={styles.actionBtn}
            />
          )}
          {role === 'FO' && !['Won', 'Lost'].includes(lead.stage) && (
            <Button
              title="Mark as Lost"
              onPress={handleMarkLost}
              variant="danger"
              style={styles.actionBtn}
            />
          )}
        </View>

        {/* Reassign Modal */}
        <Modal visible={showAssign} transparent animationType="slide" onRequestClose={() => setShowAssign(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalSheet, { backgroundColor: T.card }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: T.text }]}>Reassign Lead</Text>
                <TouchableOpacity onPress={() => setShowAssign(false)}>
                  <X size={20} color={T.sub} />
                </TouchableOpacity>
              </View>
              <Text style={[styles.modalSub, { color: T.sub }]}>
                Currently assigned to: <Text style={[styles.modalSubBold, { color: T.text }]}>{lead.foName || '—'}</Text>
              </Text>
              <Text style={[styles.modalSub, { color: T.sub }]}>Select a new Field Officer:</Text>
              <View style={styles.foList}>
                {fos.map((fo) => (
                  <TouchableOpacity
                    key={fo.id}
                    style={[
                      styles.foItem,
                      { backgroundColor: T.cardAlt },
                      selectedFoId === fo.id && { backgroundColor: T.accentSoft, borderWidth: 1, borderColor: T.accent },
                      fo.id === lead.foId && styles.foItemDisabled,
                    ]}
                    onPress={() => { if (fo.id !== lead.foId) setSelectedFoId(fo.id); }}
                  >
                    <Text style={[styles.foItemText, { color: T.text }, selectedFoId === fo.id && { color: T.accent, fontFamily: Fonts.bold }]}>
                      {fo.name}{(fo as any).zone ? ` (${(fo as any).zone})` : ''}{fo.id === lead.foId ? ' (Current)' : ''}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.modalActions}>
                <TouchableOpacity style={[styles.modalCancelBtn, { borderColor: T.line }]} onPress={() => setShowAssign(false)}>
                  <Text style={[styles.modalCancelText, { color: T.sub }]}>Cancel</Text>
                </TouchableOpacity>
                <GradientButton
                  label={assigning ? 'Reassigning...' : 'Reassign'}
                  onPress={handleAssign}
                  loading={assigning}
                  disabled={!selectedFoId || assigning}
                  style={styles.modalConfirmBtn}
                />
              </View>
            </View>
          </View>
        </Modal>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flex: 1, gap: 4 },
  headerSchool: { fontFamily: Fonts.bold, fontSize: rf(18), color: '#FFF', letterSpacing: -0.3 },
  scoreCircle: {
    width: 52, height: 52, borderRadius: 26,
    borderWidth: 2, backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  scoreValue: { fontFamily: Fonts.bold, fontSize: rf(18) },
  scoreLabel: { fontFamily: Fonts.regular, fontSize: rf(9), color: 'rgba(255,255,255,0.7)' },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 14 },
  statRow: { flexDirection: 'row', gap: 12 },
  statTile: { flex: 1 },
  stageScroll: { marginTop: 4 },
  stageTrack: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8, paddingHorizontal: 4 },
  stageItem: { alignItems: 'center', width: 64 },
  stageDot: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  stageDotCheck: { color: '#FFF', fontFamily: Fonts.bold, fontSize: rf(10) },
  stageLabel: { fontFamily: Fonts.regular, fontSize: rf(10), textAlign: 'center' },
  stageLine: { width: 24, height: 2, marginTop: 11 },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  contactAvatar: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  contactAvatarText: { fontFamily: Fonts.bold, fontSize: rf(20) },
  contactInfo: { flex: 1 },
  contactName: { fontFamily: Fonts.bold, fontSize: rf(16) },
  contactDesg: { fontFamily: Fonts.regular, fontSize: rf(13), marginTop: 2 },
  contactActions: { gap: 8 },
  contactBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 10, borderRadius: 12,
  },
  contactBtnText: { fontFamily: Fonts.medium, fontSize: rf(14), flex: 1 },
  attrGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  attrItem: { width: '45%', minWidth: 120 },
  attrLabel: { fontFamily: Fonts.medium, fontSize: rf(11), textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 },
  attrValue: { fontFamily: Fonts.bold, fontSize: rf(14) },
  notes: { marginTop: 12, padding: 12, borderRadius: 14 },
  notesText: { fontFamily: Fonts.regular, fontSize: rf(13), lineHeight: 20, marginTop: 2 },
  assignRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  assignLabel: { fontFamily: Fonts.regular, fontSize: rf(13) },
  assignValue: { fontFamily: Fonts.bold, fontSize: rf(13) },
  actItem: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  actIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  actIconText: { fontFamily: Fonts.bold, fontSize: rf(14) },
  actContent: { flex: 1 },
  actHeader: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, alignItems: 'center', marginBottom: 4 },
  actDate: { fontFamily: Fonts.regular, fontSize: rf(11), marginLeft: 'auto' },
  actNotes: { fontFamily: Fonts.regular, fontSize: rf(13), lineHeight: 19 },
  actMeta: { fontFamily: Fonts.regular, fontSize: rf(12), marginTop: 2 },
  actions: { gap: 10 },
  actionBtn: {},
  headerSubRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  historyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  historyBtnText: { fontFamily: Fonts.regular, fontSize: rf(11), color: 'rgba(255,255,255,0.85)' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 40,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontFamily: Fonts.bold, fontSize: rf(17) },
  breakdownRow: { marginBottom: 14 },
  breakdownLabel: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  breakdownLabelText: { fontFamily: Fonts.medium, fontSize: rf(13) },
  breakdownScore: { fontFamily: Fonts.bold, fontSize: rf(13) },
  breakdownBarBg: { height: 8, borderRadius: 4 },
  breakdownBarFill: { height: 8, borderRadius: 4 },
  breakdownTotal: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 16, marginTop: 4, borderTopWidth: 1,
  },
  breakdownTotalLabel: { fontFamily: Fonts.bold, fontSize: rf(15) },
  breakdownTotalValue: { fontFamily: Fonts.bold, fontSize: rf(22) },
  scoreModalLoading: { alignItems: 'center', paddingVertical: 20 },
  scoreModalLoadingText: { fontFamily: Fonts.bold, fontSize: rf(28) },
  scoreModalSub: { fontFamily: Fonts.regular, fontSize: rf(13), marginTop: 6 },
  gpsBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 100, paddingHorizontal: 6, paddingVertical: 2 },
  gpsBadgeText: { fontFamily: Fonts.bold, fontSize: rf(10) },
  modalSub: { fontFamily: Fonts.regular, fontSize: rf(13), marginBottom: 6 },
  modalSubBold: { fontFamily: Fonts.bold },
  foList: { marginVertical: 10, maxHeight: 220 },
  foItem: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, marginBottom: 4 },
  foItemDisabled: { opacity: 0.4 },
  foItemText: { fontFamily: Fonts.medium, fontSize: rf(14) },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalCancelBtn: { flex: 1, borderWidth: 1, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  modalCancelText: { fontFamily: Fonts.bold, fontSize: rf(14) },
  modalConfirmBtn: { flex: 1 },
});
