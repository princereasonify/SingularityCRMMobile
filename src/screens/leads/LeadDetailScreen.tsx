import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, Linking, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Phone, Mail, MapPin, User, Edit2, Plus, XCircle } from 'lucide-react-native';
import { leadsApi } from '../../api/leads';
import { LeadDto, LeadStage } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/Card';
import { Badge, StageBadge } from '../../components/common/Badge';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { Button } from '../../components/common/Button';
import { ROLE_COLORS, STAGE_COLORS, ACTIVITY_COLORS, ALL_STAGES, STAGE_LABELS, getScoreColor, OUTCOME_COLORS } from '../../utils/constants';
import { formatCurrency, formatDate, formatRelativeDate, formatDateTime } from '../../utils/formatting';
import { rf } from '../../utils/responsive';

const STAGE_ORDER: LeadStage[] = [
  'NewLead', 'Contacted', 'Qualified', 'DemoStage', 'DemoDone',
  'ProposalSent', 'Negotiation', 'ContractSent', 'Won', 'ImplementationStarted',
];

export const LeadDetailScreen = ({ route, navigation }: any) => {
  const { leadId } = route.params;
  const { user } = useAuth();
  const role = user?.role || 'FO';
  const COLOR = ROLE_COLORS[role];
  const { width } = useWindowDimensions();
  const tablet = width >= 768;

  const [lead, setLead] = useState<LeadDto | null>(null);
  const [loading, setLoading] = useState(true);

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

  const handleMarkLost = () => {
    Alert.prompt?.('Mark as Lost', 'Enter loss reason:', async (reason) => {
      if (!reason) return;
      try {
        await leadsApi.updateLead(leadId, { lossReason: reason } as any);
        fetch();
      } catch { Alert.alert('Error', 'Failed to update lead'); }
    });
  };

  if (loading) return <LoadingSpinner fullScreen color={COLOR.primary} />;
  if (!lead) return null;

  const stageIdx = STAGE_ORDER.indexOf(lead.stage as any);
  const canCreateDeal = role === 'FO' && !['Won', 'Lost'].includes(lead.stage);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: COLOR.primary }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <ArrowLeft size={22} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerSchool} numberOfLines={1}>{lead.school}</Text>
            <StageBadge stage={lead.stage} />
          </View>
          <View style={[styles.scoreCircle, { borderColor: getScoreColor(lead.score) }]}>
            <Text style={[styles.scoreValue, { color: getScoreColor(lead.score) }]}>{lead.score}</Text>
            <Text style={styles.scoreLabel}>score</Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, tablet && { padding: 24, gap: 20 }]}>
        {/* Stage Progression */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Pipeline Stage</Text>
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
                        done && { backgroundColor: current ? COLOR.primary : '#22C55E' },
                        !done && { backgroundColor: '#E5E7EB' },
                      ]}>
                        {done && <Text style={styles.stageDotCheck}>{current ? '●' : '✓'}</Text>}
                      </View>
                      <Text style={[styles.stageLabel, current && { color: COLOR.primary, fontWeight: '700' }]} numberOfLines={2}>
                        {STAGE_LABELS[stage]}
                      </Text>
                    </View>
                    {idx < STAGE_ORDER.length - 1 && (
                      <View style={[styles.stageLine, idx < stageIdx && { backgroundColor: '#22C55E' }]} />
                    )}
                  </React.Fragment>
                );
              })}
            </View>
          </ScrollView>
        </Card>

        {/* Contact Card */}
        {lead.contact && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Contact Person</Text>
            <View style={styles.contactRow}>
              <View style={styles.contactAvatar}>
                <Text style={styles.contactAvatarText}>
                  {lead.contact.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.contactInfo}>
                <Text style={styles.contactName}>{lead.contact.name}</Text>
                <Text style={styles.contactDesg}>{lead.contact.designation}</Text>
              </View>
            </View>
            <View style={styles.contactActions}>
              {lead.contact.phone && (
                <TouchableOpacity
                  style={[styles.contactBtn, { backgroundColor: '#EFF6FF' }]}
                  onPress={() => Linking.openURL(`tel:${lead.contact!.phone}`)}
                >
                  <Phone size={16} color="#3B82F6" />
                  <Text style={[styles.contactBtnText, { color: '#3B82F6' }]}>{lead.contact.phone}</Text>
                </TouchableOpacity>
              )}
              {lead.contact.email && (
                <TouchableOpacity
                  style={[styles.contactBtn, { backgroundColor: '#F0FDF4' }]}
                  onPress={() => Linking.openURL(`mailto:${lead.contact!.email}`)}
                >
                  <Mail size={16} color="#22C55E" />
                  <Text style={[styles.contactBtnText, { color: '#22C55E' }]} numberOfLines={1}>{lead.contact.email}</Text>
                </TouchableOpacity>
              )}
            </View>
          </Card>
        )}

        {/* Attributes Grid */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Lead Info</Text>
          <View style={[styles.attrGrid, tablet && styles.attrGridTablet]}>
            {[
              { label: 'Board', value: lead.board },
              { label: 'Type', value: lead.type },
              { label: 'Students', value: lead.students?.toLocaleString('en-IN') || '—' },
              { label: 'Est. Value', value: formatCurrency(lead.value) },
              { label: 'Close Date', value: formatDate(lead.closeDate) || '—' },
              { label: 'Source', value: lead.source },
              { label: 'City', value: lead.city },
              { label: 'State', value: lead.state || '—' },
            ].map(({ label, value }) => (
              <View key={label} style={styles.attrItem}>
                <Text style={styles.attrLabel}>{label}</Text>
                <Text style={styles.attrValue}>{value}</Text>
              </View>
            ))}
          </View>
          {lead.notes && (
            <View style={styles.notes}>
              <Text style={styles.attrLabel}>Notes</Text>
              <Text style={styles.notesText}>{lead.notes}</Text>
            </View>
          )}
          {lead.lossReason && (
            <View style={[styles.notes, { backgroundColor: '#FEF2F2' }]}>
              <Text style={[styles.attrLabel, { color: '#EF4444' }]}>Loss Reason</Text>
              <Text style={[styles.notesText, { color: '#DC2626' }]}>{lead.lossReason}</Text>
            </View>
          )}
        </Card>

        {/* Assignment */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Assignment</Text>
          {lead.foName && (
            <View style={styles.assignRow}>
              <User size={16} color={COLOR.primary} />
              <Text style={styles.assignLabel}>Assigned FO:</Text>
              <Text style={styles.assignValue}>{lead.foName}</Text>
            </View>
          )}
          {lead.assignedByName && (
            <View style={styles.assignRow}>
              <User size={16} color="#6B7280" />
              <Text style={styles.assignLabel}>Assigned By:</Text>
              <Text style={styles.assignValue}>{lead.assignedByName}</Text>
            </View>
          )}
        </Card>

        {/* Activity Timeline */}
        {(lead.activities?.length || 0) > 0 && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Activity Timeline</Text>
            {lead.activities!.map((act) => (
              <View key={act.id} style={styles.actItem}>
                <View style={[styles.actIcon, { backgroundColor: ACTIVITY_COLORS[act.type] + '22' }]}>
                  <Text style={[styles.actIconText, { color: ACTIVITY_COLORS[act.type] }]}>
                    {act.type.charAt(0)}
                  </Text>
                </View>
                <View style={styles.actContent}>
                  <View style={styles.actHeader}>
                    <Badge label={act.type} color={ACTIVITY_COLORS[act.type]} size="sm" />
                    <Badge label={act.outcome} color={OUTCOME_COLORS[act.outcome]} size="sm" />
                    <Text style={styles.actDate}>{formatRelativeDate(act.date)}</Text>
                  </View>
                  {act.notes && <Text style={styles.actNotes} numberOfLines={2}>{act.notes}</Text>}
                  {act.personMet && (
                    <Text style={styles.actMeta}>Met: {act.personMet} ({act.personDesignation})</Text>
                  )}
                </View>
              </View>
            ))}
          </Card>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            title="Edit Lead"
            onPress={() => navigation.navigate('EditLead', { leadId })}
            variant="secondary"
            color={COLOR.primary}
            style={styles.actionBtn}
          />
          {role === 'FO' && (
            <Button
              title="Log Activity"
              onPress={() => navigation.navigate('Activities', { screen: 'ActivityLog', params: { leadId } })}
              color={COLOR.primary}
              style={styles.actionBtn}
            />
          )}
          {canCreateDeal && (
            <Button
              title="Create Deal"
              onPress={() => navigation.navigate('CreateDeal', { leadId })}
              color="#22C55E"
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

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backBtn: { padding: 4 },
  headerCenter: { flex: 1, gap: 4 },
  headerSchool: { fontSize: rf(18), fontWeight: '700', color: '#FFF' },
  scoreCircle: {
    width: 52, height: 52, borderRadius: 26,
    borderWidth: 2, backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  scoreValue: { fontSize: rf(18), fontWeight: '800' },
  scoreLabel: { fontSize: rf(9), color: 'rgba(255,255,255,0.7)' },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 14 },
  section: { padding: 16 },
  sectionTitle: { fontSize: rf(14), fontWeight: '700', color: '#111827', marginBottom: 12 },
  stageScroll: { marginTop: 4 },
  stageTrack: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8, paddingHorizontal: 4 },
  stageItem: { alignItems: 'center', width: 64 },
  stageDot: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  stageDotCheck: { color: '#FFF', fontSize: rf(10), fontWeight: '700' },
  stageLabel: { fontSize: rf(10), color: '#9CA3AF', textAlign: 'center' },
  stageLine: { width: 24, height: 2, backgroundColor: '#E5E7EB', marginTop: 11 },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  contactAvatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center',
  },
  contactAvatarText: { fontSize: rf(20), fontWeight: '700', color: '#3B82F6' },
  contactInfo: { flex: 1 },
  contactName: { fontSize: rf(16), fontWeight: '600', color: '#111827' },
  contactDesg: { fontSize: rf(13), color: '#6B7280', marginTop: 2 },
  contactActions: { gap: 8 },
  contactBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 10, borderRadius: 10,
  },
  contactBtnText: { fontSize: rf(14), fontWeight: '500', flex: 1 },
  attrGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  attrGridTablet: { gap: 16 },
  attrItem: { width: '45%', minWidth: 120 },
  attrLabel: { fontSize: rf(11), color: '#9CA3AF', fontWeight: '500', textTransform: 'uppercase', marginBottom: 2 },
  attrValue: { fontSize: rf(14), fontWeight: '600', color: '#111827' },
  notes: { marginTop: 12, padding: 10, backgroundColor: '#F9FAFB', borderRadius: 10 },
  notesText: { fontSize: rf(13), color: '#374151', lineHeight: 20 },
  assignRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  assignLabel: { fontSize: rf(13), color: '#6B7280' },
  assignValue: { fontSize: rf(13), fontWeight: '600', color: '#111827' },
  actItem: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  actIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  actIconText: { fontSize: rf(14), fontWeight: '700' },
  actContent: { flex: 1 },
  actHeader: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, alignItems: 'center', marginBottom: 4 },
  actDate: { fontSize: rf(11), color: '#9CA3AF', marginLeft: 'auto' },
  actNotes: { fontSize: rf(13), color: '#374151', lineHeight: 19 },
  actMeta: { fontSize: rf(12), color: '#6B7280', marginTop: 2 },
  actions: { gap: 10 },
  actionBtn: {},
});
