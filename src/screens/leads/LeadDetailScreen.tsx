import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, Linking, useWindowDimensions, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft, Phone, Mail, Navigation, MapPin,
  Edit2, XCircle, UserCheck, ArrowRight, ChevronRight,
} from 'lucide-react-native';

import { leadsApi } from '../../api/leads';
import { LeadDto, LeadStage, UserDto } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { SelectPicker } from '../../components/common/SelectPicker';
import { ICON_STROKE } from '../../components/common/Icon';
import {
  Btn, IconBtn, Input, StatusBadge, ListCard, Avatar, FormModal,
} from '../../components/crud';
import { ACTIVITY_COLORS, STAGE_COLORS, STAGE_LABELS, getScoreColor, OUTCOME_COLORS } from '../../utils/constants';
import { formatCurrency, formatDate, formatRelativeDate } from '../../utils/formatting';
import { rf, isTabletDevice } from '../../utils/responsive';
import { withAlpha, SOFT_TINT } from '../../theme';
import { useAppTheme } from '../../theme/useAppTheme';

/**
 * Web parity (LeadDetail.jsx `stageOrder`): the stepper runs New Lead → Won.
 * ImplementationStarted is set automatically when a payment link is paid, so it is
 * only appended when the lead is actually in it — otherwise the stepper would be
 * blank for those leads (indexOf → -1).
 */
const STAGE_ORDER: LeadStage[] = [
  'NewLead', 'Contacted', 'Qualified', 'DemoStage', 'DemoDone',
  'ProposalSent', 'Negotiation', 'ContractSent', 'Won',
];

const DASH = '—';

const initialsOf = (name?: string) =>
  (name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase() || '?';

export const LeadDetailScreen = ({ route, navigation }: any) => {
  const { leadId } = route.params;
  const { user } = useAuth();
  const role = user?.role || 'FO';
  const T = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const wide = isTabletDevice && width > height;

  const [lead, setLead] = useState<LeadDto | null>(null);
  const [loading, setLoading] = useState(true);

  // Mark as Lost
  const [showMarkLost, setShowMarkLost] = useState(false);
  const [lossReason, setLossReason] = useState('');
  const [markingLost, setMarkingLost] = useState(false);

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

  const handleMarkLost = async () => {
    const reason = lossReason.trim();
    if (!reason) return;
    setMarkingLost(true);
    try {
      // POST /leads/{id}/mark-lost — sets Stage = Lost + the reason. updateLead({ lossReason })
      // only writes the reason and leaves the lead in its old stage forever.
      const res = await leadsApi.markLost(leadId, reason);
      setLead(res.data);
      setShowMarkLost(false);
      setLossReason('');
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to mark lead as lost');
    } finally {
      setMarkingLost(false);
    }
  };

  if (loading) {
    return (
      <View style={[s.root, s.center, { backgroundColor: T.bg }]}>
        <ActivityIndicator color={T.accent} />
      </View>
    );
  }
  if (!lead) return null;

  const stages: LeadStage[] = lead.stage === 'ImplementationStarted'
    ? [...STAGE_ORDER, 'ImplementationStarted']
    : STAGE_ORDER;
  const stageIdx = stages.indexOf(lead.stage as LeadStage);
  const canCreateDeal = ['DemoDone', 'ProposalSent', 'Negotiation', 'ContractSent', 'Won'].includes(lead.stage);
  const canMarkLost = role === 'FO' && !['Won', 'Lost'].includes(lead.stage);

  // Web parity: LeadDetail.jsx's info card, in order.
  const info: { label: string; value: string }[] = [
    { label: 'Board', value: lead.board || DASH },
    { label: 'Type', value: lead.type || DASH },
    { label: 'Students', value: lead.students?.toLocaleString('en-IN') || DASH },
    { label: 'Est. Value', value: formatCurrency(lead.value) },
    { label: 'Close Date', value: formatDate(lead.closeDate) || DASH },
    { label: 'Source', value: lead.source || DASH },
    { label: 'Lead Score', value: `${lead.score}/100` },
    { label: 'Assigned FO', value: lead.foName || DASH },
    { label: 'Assigned By', value: lead.assignedByName || 'Self-created' },
  ];

  const activities = lead.activities || [];

  return (
    <View style={[s.root, { backgroundColor: T.bg }]}>
      {/* House pattern: plain themed title block on T.bg — no gradient hero. */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <View style={s.headerRow}>
          <IconBtn kind="view" label="Back" onPress={() => navigation.goBack()}>
            <ArrowLeft size={18} color={T.accent} strokeWidth={ICON_STROKE} />
          </IconBtn>
          <View style={s.headerCenter}>
            <Text style={[s.h1, { color: T.text }]} numberOfLines={1}>{lead.school}</Text>
            <View style={s.headerSub}>
              <MapPin size={11} color={T.dim} strokeWidth={ICON_STROKE} />
              <Text style={[s.h2, { color: T.sub }]} numberOfLines={1}>
                {[lead.city, lead.state].filter(Boolean).join(', ') || DASH}
              </Text>
              {/* Change History removed: GET /audit has no controller in the backend,
                  so this could only ever open a permanently-empty screen. Web has no
                  audit UI either. Restore alongside a real AuditController. */}
            </View>
          </View>
          <View style={[s.scoreCircle, { borderColor: getScoreColor(lead.score), backgroundColor: T.card }]}>
            <Text style={[s.scoreValue, { color: getScoreColor(lead.score) }]}>{lead.score}</Text>
            <Text style={[s.scoreLabel, { color: T.dim }]}>score</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={[s.scroll, wide && s.scrollWide]}>
        {/* Stage stepper */}
        <View style={[s.card, { backgroundColor: T.card, borderColor: T.line }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={s.stepper}>
              {stages.map((stage, idx) => {
                const done = idx < stageIdx;
                const current = idx === stageIdx;
                return (
                  <React.Fragment key={stage}>
                    <View
                      style={[
                        s.step,
                        { backgroundColor: done ? T.success : current ? T.accent : T.cardAlt },
                      ]}
                    >
                      <Text
                        style={[
                          s.stepTxt,
                          { color: done || current ? '#FFF' : T.dim },
                        ]}
                      >
                        {STAGE_LABELS[stage]}
                      </Text>
                    </View>
                    {idx < stages.length - 1 && (
                      <ChevronRight size={12} color={done ? T.success : T.line} strokeWidth={2.4} />
                    )}
                  </React.Fragment>
                );
              })}
            </View>
          </ScrollView>
        </View>

        <View style={wide ? s.cols : undefined}>
          <View style={wide ? s.colLeft : s.stack}>
            {/* Lead info */}
            <View style={[s.card, { backgroundColor: T.card, borderColor: T.line }]}>
              <View style={s.infoHead}>
                <Avatar initials={initialsOf(lead.school)} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.infoName, { color: T.text }]} numberOfLines={2}>{lead.school}</Text>
                  <Text style={[s.infoCity, { color: T.dim }]} numberOfLines={1}>
                    {[lead.city, lead.state].filter(Boolean).join(', ') || DASH}
                  </Text>
                </View>
                <StatusBadge label={STAGE_LABELS[lead.stage] || lead.stage} color={STAGE_COLORS[lead.stage]} />
              </View>

              <View style={[s.infoList, { borderTopColor: T.line }]}>
                {info.map(({ label, value }) => (
                  <View key={label} style={s.infoRow}>
                    <Text style={[s.infoLabel, { color: T.dim }]}>{label}</Text>
                    <Text style={[s.infoValue, { color: T.text }]} numberOfLines={1}>{value}</Text>
                  </View>
                ))}
              </View>

              {!!lead.notes && (
                <View style={[s.note, { backgroundColor: T.cardAlt }]}>
                  <Text style={[s.noteLabel, { color: T.dim }]}>Notes</Text>
                  <Text style={[s.noteTxt, { color: T.sub }]}>{lead.notes}</Text>
                </View>
              )}

              {!!lead.lossReason && (
                <View style={[s.note, { backgroundColor: withAlpha(T.danger, SOFT_TINT) }]}>
                  <View style={s.noteHead}>
                    <XCircle size={13} color={T.danger} strokeWidth={ICON_STROKE} />
                    <Text style={[s.noteLabel, { color: T.danger }]}>Loss Reason</Text>
                  </View>
                  <Text style={[s.noteTxt, { color: T.danger }]}>{lead.lossReason}</Text>
                </View>
              )}
            </View>

            {/* Decision maker */}
            {!!lead.contact?.name && (
              <View style={[s.card, { backgroundColor: T.card, borderColor: T.line }]}>
                <Text style={[s.cardTitle, { color: T.text }]}>Decision Maker</Text>
                <View style={s.contactRow}>
                  <Avatar initials={initialsOf(lead.contact.name)} color={T.info} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.infoName, { color: T.text }]} numberOfLines={1}>{lead.contact.name}</Text>
                    <Text style={[s.infoCity, { color: T.dim }]} numberOfLines={1}>{lead.contact.designation}</Text>
                  </View>
                </View>
                <View style={s.contactBtns}>
                  {!!lead.contact.phone && (
                    <TouchableOpacity
                      style={[s.contactBtn, { backgroundColor: withAlpha(T.info, SOFT_TINT) }]}
                      onPress={() => Linking.openURL(`tel:${lead.contact!.phone}`)}
                    >
                      <Phone size={14} color={T.info} strokeWidth={ICON_STROKE} />
                      <Text style={[s.contactTxt, { color: T.info }]} numberOfLines={1}>{lead.contact.phone}</Text>
                    </TouchableOpacity>
                  )}
                  {!!lead.contact.email && (
                    <TouchableOpacity
                      style={[s.contactBtn, { backgroundColor: withAlpha(T.success, SOFT_TINT) }]}
                      onPress={() => Linking.openURL(`mailto:${lead.contact!.email}`)}
                    >
                      <Mail size={14} color={T.success} strokeWidth={ICON_STROKE} />
                      <Text style={[s.contactTxt, { color: T.success }]} numberOfLines={1}>{lead.contact.email}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {/* Actions */}
            <View style={s.actions}>
              {isManager && (
                <Btn
                  label="Reassign Lead"
                  variant="soft"
                  onPress={() => { setShowAssign(true); setSelectedFoId(''); }}
                  icon={<UserCheck size={14} color={T.accent} strokeWidth={ICON_STROKE} />}
                />
              )}
              <Btn
                label="Edit Lead"
                variant="secondary"
                onPress={() => navigation.navigate('EditLead', { leadId })}
                icon={<Edit2 size={14} color={T.text} strokeWidth={ICON_STROKE} />}
              />
              {canCreateDeal && (
                <Btn
                  label="Create Deal"
                  variant="success"
                  onPress={() => navigation.navigate('CreateDeal', { leadId })}
                  icon={<ArrowRight size={14} color="#FFF" strokeWidth={ICON_STROKE} />}
                />
              )}
              {canMarkLost && (
                <Btn
                  label="Mark as Lost"
                  variant="dangerGhost"
                  onPress={() => { setLossReason(''); setShowMarkLost(true); }}
                  icon={<XCircle size={14} color={T.danger} strokeWidth={ICON_STROKE} />}
                />
              )}
            </View>
          </View>

          {/* Activity Timeline */}
          <View style={wide ? s.colRight : s.stack}>
            <View style={[s.card, { backgroundColor: T.card, borderColor: T.line }]}>
              <Text style={[s.cardTitle, { color: T.text }]}>Activity Timeline</Text>
              {activities.length === 0 ? (
                <Text style={[s.emptyTxt, { color: T.dim }]}>No activities recorded yet.</Text>
              ) : (
                <View style={{ gap: 8 }}>
                  {activities.map(act => (
                    <ListCard key={act.id} style={[s.actCard, { backgroundColor: T.cardAlt }]}>
                      <Avatar initials={act.type.charAt(0)} color={ACTIVITY_COLORS[act.type] || T.accent} />
                      <View style={{ flex: 1, gap: 4 }}>
                        <View style={s.actHead}>
                          <StatusBadge label={act.type} color={ACTIVITY_COLORS[act.type]} />
                          <StatusBadge label={act.outcome} color={OUTCOME_COLORS[act.outcome]} />
                          {act.gpsVerified && (
                            <View style={[s.gps, { backgroundColor: withAlpha(T.success, SOFT_TINT) }]}>
                              <Navigation size={10} color={T.success} strokeWidth={ICON_STROKE} />
                              <Text style={[s.gpsTxt, { color: T.success }]}>GPS Verified</Text>
                            </View>
                          )}
                          <Text style={[s.actDate, { color: T.dim }]}>{formatRelativeDate(act.date)}</Text>
                        </View>
                        {!!act.notes && <Text style={[s.actNotes, { color: T.sub }]} numberOfLines={3}>{act.notes}</Text>}
                        {!!act.personMet && (
                          <Text style={[s.actMeta, { color: T.dim }]}>
                            Met: {act.personMet}{act.personDesignation ? ` (${act.personDesignation})` : ''}
                          </Text>
                        )}
                      </View>
                    </ListCard>
                  ))}
                </View>
              )}
            </View>
          </View>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Mark as Lost */}
      <FormModal
        visible={showMarkLost}
        title="Mark Lead as Lost"
        onClose={() => setShowMarkLost(false)}
        footer={
          <>
            <Btn label="Cancel" variant="secondary" onPress={() => setShowMarkLost(false)} style={{ flex: 1 }} />
            <Btn
              label={markingLost ? 'Marking...' : 'Mark as Lost'}
              variant="danger"
              onPress={handleMarkLost}
              loading={markingLost}
              disabled={!lossReason.trim() || markingLost}
              style={{ flex: 1 }}
            />
          </>
        }
      >
        <View style={{ gap: 12 }}>
          <Text style={[s.mSub, { color: T.sub }]}>
            {lead.school}{lead.city ? ` · ${lead.city}` : ''}
          </Text>
          <Text style={[s.mSub, { color: T.sub }]}>
            Record why this deal was lost — this feeds the Lost Deal Analysis report.
          </Text>
          <Input
            label="Loss Reason *"
            value={lossReason}
            onChangeText={setLossReason}
            maxLength={500}
            placeholder="e.g. Pricing too high, competitor selected..."
          />
        </View>
      </FormModal>

      {/* Reassign */}
      <FormModal
        visible={showAssign}
        title="Reassign Lead"
        onClose={() => setShowAssign(false)}
        footer={
          <>
            <Btn label="Cancel" variant="secondary" onPress={() => setShowAssign(false)} style={{ flex: 1 }} />
            <Btn
              label={assigning ? 'Reassigning...' : 'Reassign'}
              onPress={handleAssign}
              loading={assigning}
              disabled={!selectedFoId || assigning}
              style={{ flex: 1 }}
            />
          </>
        }
      >
        <View style={{ gap: 14 }}>
          <Text style={[s.mSub, { color: T.sub }]}>
            Currently assigned to: <Text style={[s.mSubBold, { color: T.text }]}>{lead.foName || DASH}</Text>
          </Text>
          <SelectPicker
            label="Select a new Field Officer"
            options={fos
              .filter(fo => fo.id !== lead.foId)
              .map(fo => ({
                label: `${fo.name}${(fo as any).zone ? ` (${(fo as any).zone})` : ''}`,
                value: fo.id,
              }))}
            value={selectedFoId}
            onChange={(v) => setSelectedFoId(v)}
            accentColor={T.accent}
          />
        </View>
      </FormModal>
    </View>
  );
};

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },

  header: { paddingHorizontal: 14, paddingBottom: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerCenter: { flex: 1, minWidth: 0, gap: 2 },
  h1: { fontWeight: '800', fontSize: rf(19), letterSpacing: -0.4 },
  headerSub: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  h2: { fontWeight: '500', fontSize: rf(12.5), flexShrink: 1, minWidth: 0 },
  historyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 6, flexShrink: 0 },
  historyTxt: { fontWeight: '600', fontSize: rf(11) },
  scoreCircle: {
    width: 52, height: 52, borderRadius: 26, borderWidth: 2, flexShrink: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  scoreValue: { fontWeight: '800', fontSize: rf(18) },
  scoreLabel: { fontWeight: '500', fontSize: rf(9) },

  scroll: { padding: 14, gap: 12 },
  scrollWide: { paddingHorizontal: 22 },
  stack: { gap: 12 },
  cols: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  colLeft: { flex: 1, gap: 12 },
  colRight: { flex: 1.4, gap: 12 },

  card: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 12 },
  cardTitle: { fontSize: rf(13.5), fontWeight: '700' },

  // stepper — web parity: pill per stage, chevron between
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 },
  step: { height: 28, paddingHorizontal: 12, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  stepTxt: { fontSize: rf(11.5), fontWeight: '700' },

  infoHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoName: { fontSize: rf(14), fontWeight: '700' },
  infoCity: { fontSize: rf(11.5), fontWeight: '500', marginTop: 1 },
  infoList: { borderTopWidth: 1, paddingTop: 10, gap: 8 },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  infoLabel: { fontSize: rf(12.5), fontWeight: '500' },
  infoValue: { fontSize: rf(12.5), fontWeight: '700', flexShrink: 1, textAlign: 'right' },

  note: { borderRadius: 13, padding: 12, gap: 3 },
  noteHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  noteLabel: { fontSize: rf(10.5), fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  noteTxt: { fontSize: rf(12.5), fontWeight: '500', lineHeight: 19 },

  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  contactBtns: { gap: 8 },
  contactBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 12 },
  contactTxt: { fontSize: rf(13), fontWeight: '600', flex: 1 },

  actions: { gap: 10 },

  actCard: { alignItems: 'flex-start', borderWidth: 0 },
  actHead: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, alignItems: 'center' },
  actDate: { fontSize: rf(11), fontWeight: '500', marginLeft: 'auto' },
  actNotes: { fontSize: rf(12.5), fontWeight: '500', lineHeight: 19 },
  actMeta: { fontSize: rf(11.5), fontWeight: '500' },
  emptyTxt: { fontSize: rf(12.5), fontWeight: '500', textAlign: 'center', paddingVertical: 18 },

  gps: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 11, paddingHorizontal: 7, height: 22 },
  gpsTxt: { fontSize: rf(10), fontWeight: '700' },

  mSub: { fontSize: rf(13), fontWeight: '500' },
  mSubBold: { fontWeight: '700' },
});
