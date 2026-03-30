import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, useWindowDimensions, Modal, TextInput, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Eye, EyeOff, Key, ShieldAlert, X, Plus, Pencil, ChevronDown } from 'lucide-react-native';
import { onboardingApi } from '../../api/onboarding';
import { subscriptionsApi } from '../../api/subscriptions';
import { schoolProfilesApi } from '../../api/schoolProfiles';
import { OnboardAssignment } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { ProgressBar } from '../../components/common/ProgressBar';
import { LoadingSpinner, EmptyState } from '../../components/common/LoadingSpinner';
import { ROLE_COLORS } from '../../utils/constants';
import { formatDate } from '../../utils/formatting';
import { rf } from '../../utils/responsive';

const ONBOARD_FILTERS = ['All', 'Assigned', 'InProgress', 'Completed', 'OnHold', 'Cancelled'];
const SUB_FILTERS = ['All', 'Pending', 'Active', 'Expiring', 'Expired', 'Suspended'];

const STATUS_COLORS: Record<string, string> = {
  Assigned: '#F59E0B', InProgress: '#2563EB', Completed: '#16A34A',
  OnHold: '#9CA3AF', Cancelled: '#DC2626',
};
const SUB_STATUS_COLORS: Record<string, string> = {
  Pending: '#F59E0B', Active: '#16A34A', Expiring: '#EA580C',
  Expired: '#DC2626', Suspended: '#9CA3AF',
};
const CRED_COLORS: Record<string, string> = {
  NotProvisioned: '#9CA3AF', Provisioned: '#16A34A', Revoked: '#DC2626',
};
const PAYMENT_COLORS: Record<string, { bg: string; text: string }> = {
  Paid: { bg: '#DCFCE7', text: '#16A34A' },
  Partial: { bg: '#FEF3C7', text: '#D97706' },
  Pending: { bg: '#F3F4F6', text: '#6B7280' },
};

export const OnboardListScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const role = user?.role || 'FO';
  const COLOR = ROLE_COLORS[role as keyof typeof ROLE_COLORS];
  const isSCA = role === 'SCA' || role === 'SH';
  const { width } = useWindowDimensions();
  const tablet = width >= 768;

  // Main tab
  const [activeTab, setActiveTab] = useState<'onboarding' | 'subscriptions' | 'profiles'>('onboarding');

  // Onboarding state
  const [items, setItems] = useState<OnboardAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('All');

  // Subscriptions state
  const [subs, setSubs] = useState<any[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(true);
  const [refreshingSubs, setRefreshingSubs] = useState(false);
  const [subFilter, setSubFilter] = useState('All');

  // Credential modal
  const [credModalId, setCredModalId] = useState<number | null>(null);
  const [credEmail, setCredEmail] = useState('');
  const [credPassword, setCredPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [provisioning, setProvisioning] = useState(false);

  // School Profiles state (SCA only)
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [onboardedSchools, setOnboardedSchools] = useState<any[]>([]);
  const [profileFormVisible, setProfileFormVisible] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<number | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [schoolPickerVisible, setSchoolPickerVisible] = useState(false);
  const emptyProfileForm = {
    schoolId: '', firstName: '', lastName: '', userPhone: '', userEmail: '',
    password: '', gender: 'Male', schoolName: '', schoolAddress: '', area: '',
    city: '', state: '', country: 'India', schoolPhone: '', schoolEmail: '', zipcode: '',
  };
  const [pf, setPf] = useState(emptyProfileForm);

  // ─── Onboarding fetch ──────────────────────────────────────────────────────
  const fetchItems = useCallback(async () => {
    try {
      const params: any = {};
      if (filter !== 'All') params.status = filter;
      const res = await onboardingApi.getAll(params);
      const data: OnboardAssignment[] = (res.data as any)?.items ?? res.data ?? [];
      setItems(data);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => {
    if (activeTab === 'onboarding') {
      setLoading(true);
      fetchItems();
    }
  }, [filter, activeTab]);

  // ─── Quick % update with auto-complete ─────────────────────────────────────
  const handleQuickProgress = async (id: number, pct: number) => {
    try {
      await onboardingApi.updateProgress(id, pct);
      if (pct >= 100) {
        await onboardingApi.updateStatus(id, 'Completed');
      }
      fetchItems();
    } catch {
      Alert.alert('Error', 'Failed to update progress');
    }
  };

  // ─── Subscriptions fetch ───────────────────────────────────────────────────
  const fetchSubs = useCallback(async () => {
    try {
      const res = await subscriptionsApi.getAll(subFilter !== 'All' ? subFilter : undefined);
      const data: any[] = Array.isArray(res.data) ? res.data : (res.data as any)?.items ?? [];
      setSubs(data);
    } catch {
      setSubs([]);
    } finally {
      setLoadingSubs(false);
      setRefreshingSubs(false);
    }
  }, [subFilter]);

  useEffect(() => {
    if (activeTab === 'subscriptions') {
      setLoadingSubs(true);
      fetchSubs();
    }
  }, [subFilter, activeTab]);

  // ─── Credential provisioning ───────────────────────────────────────────────
  const handleProvision = async () => {
    if (!credEmail.trim() || !credPassword.trim()) {
      Alert.alert('Required', 'Email and password are required');
      return;
    }
    setProvisioning(true);
    try {
      await subscriptionsApi.provisionCredentials(credModalId!, {
        schoolLoginEmail: credEmail,
        schoolLoginPassword: credPassword,
      });
      Alert.alert('Success', 'Credentials provisioned successfully');
      setCredModalId(null);
      setCredEmail('');
      setCredPassword('');
      fetchSubs();
    } catch {
      Alert.alert('Error', 'Failed to provision credentials');
    } finally {
      setProvisioning(false);
    }
  };

  // ─── School Profiles fetch (SCA only) ───────────────────────────────────────
  const fetchProfiles = useCallback(async () => {
    setLoadingProfiles(true);
    try {
      const res = await schoolProfilesApi.getAll();
      const d: any = res.data;
      setProfiles(Array.isArray(d) ? d : d?.items ?? d?.profiles ?? []);
    } catch { setProfiles([]); }
    finally { setLoadingProfiles(false); }
  }, []);

  const fetchOnboardedSchools = useCallback(async () => {
    try {
      const res = await schoolProfilesApi.getOnboardedSchools();
      const d: any = res.data;
      setOnboardedSchools(Array.isArray(d) ? d : d?.items ?? d?.schools ?? []);
    } catch {}
  }, []);

  useEffect(() => {
    if (activeTab === 'profiles' && isSCA) {
      fetchProfiles();
      fetchOnboardedSchools();
    }
  }, [activeTab]);

  const handleSchoolSelect = async (school: any) => {
    setSchoolPickerVisible(false);
    setPf(prev => ({ ...prev, schoolId: String(school.id), schoolName: school.name || '' }));
    try {
      const res = await schoolProfilesApi.getPrefill(school.id);
      const pre: any = res.data?.data ?? res.data ?? res;
      setPf(prev => ({
        ...prev,
        firstName: pre.firstName || prev.firstName,
        lastName: pre.lastName || prev.lastName,
        userPhone: pre.userPhone || prev.userPhone,
        userEmail: pre.userEmail || prev.userEmail,
        schoolName: pre.schoolName || prev.schoolName,
        schoolAddress: pre.schoolAddress || prev.schoolAddress,
        city: pre.city || prev.city,
        state: pre.state || prev.state,
        schoolPhone: pre.schoolPhone || prev.schoolPhone,
        schoolEmail: pre.schoolEmail || prev.schoolEmail,
        zipcode: pre.zipcode || prev.zipcode,
      }));
    } catch {}
  };

  const handleSaveProfile = async () => {
    if (!pf.schoolId || !pf.firstName || !pf.userEmail || !pf.schoolName) {
      Alert.alert('Required', 'Please fill School, First Name, Email & School Name');
      return;
    }
    setSavingProfile(true);
    try {
      if (editingProfileId) {
        await schoolProfilesApi.update(editingProfileId, pf);
        Alert.alert('Success', 'Profile updated');
      } else {
        await schoolProfilesApi.create({ ...pf, schoolId: parseInt(pf.schoolId) });
        Alert.alert('Success', 'Profile created');
      }
      setProfileFormVisible(false);
      setEditingProfileId(null);
      setPf(emptyProfileForm);
      fetchProfiles();
    } catch { Alert.alert('Error', 'Failed to save profile'); }
    finally { setSavingProfile(false); }
  };

  const handleEditProfile = (p: any) => {
    setEditingProfileId(p.id);
    setPf({
      schoolId: String(p.schoolId || ''), firstName: p.firstName || '', lastName: p.lastName || '',
      userPhone: p.userPhone || '', userEmail: p.userEmail || '', password: p.password || '',
      gender: p.gender || 'Male', schoolName: p.schoolName || '', schoolAddress: p.schoolAddress || '',
      area: p.area || '', city: p.city || '', state: p.state || '', country: p.country || 'India',
      schoolPhone: p.schoolPhone || '', schoolEmail: p.schoolEmail || '', zipcode: p.zipcode || '',
    });
    setProfileFormVisible(true);
  };

  const handleRevoke = (id: number) => {
    Alert.alert('Revoke Credentials', 'Are you sure you want to revoke credentials?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revoke', style: 'destructive', onPress: async () => {
          try {
            await subscriptionsApi.revokeCredentials(id);
            Alert.alert('Success', 'Credentials revoked');
            fetchSubs();
          } catch {
            Alert.alert('Error', 'Failed to revoke credentials');
          }
        },
      },
    ]);
  };

  // ─── Render Onboarding Card ────────────────────────────────────────────────
  const renderOnboardCard = ({ item }: { item: OnboardAssignment }) => (
    <Card
      style={tablet ? { flex: 1 } : undefined}
      onPress={() => navigation.navigate('OnboardDetail', { onboardId: item.id })}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.schoolName} numberOfLines={1}>{item.schoolName}</Text>
        <Badge label={item.status} color={STATUS_COLORS[item.status] || '#9CA3AF'} />
      </View>
      <Text style={styles.assignedTo}>👤 {item.assignedToName}</Text>
      <View style={styles.progressSection}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>Progress</Text>
          <Text style={styles.progressPct}>{item.completionPercentage}%</Text>
        </View>
        <ProgressBar value={item.completionPercentage} color={COLOR.primary} />
      </View>
      {/* Quick % buttons */}
      <View style={styles.quickBtnRow}>
        {[25, 50, 75, 100].map(p => (
          <TouchableOpacity
            key={p}
            style={[
              styles.quickBtn,
              item.completionPercentage >= p
                ? { backgroundColor: COLOR.primary + '20' }
                : { backgroundColor: '#F3F4F6' },
            ]}
            onPress={() => handleQuickProgress(item.id, p)}
          >
            <Text style={[
              styles.quickBtnText,
              item.completionPercentage >= p
                ? { color: COLOR.primary }
                : { color: '#6B7280' },
            ]}>{p}%</Text>
          </TouchableOpacity>
        ))}
      </View>
      {item.scheduledEndDate && (
        <Text style={styles.deadline}>
          {item.completionPercentage === 100 ? '✅' : '📅'} Due {formatDate(item.scheduledEndDate)}
        </Text>
      )}
    </Card>
  );

  // ─── Render Subscription Card ──────────────────────────────────────────────
  const renderSubCard = ({ item: s }: { item: any }) => {
    const payColor = PAYMENT_COLORS[s.dealPaymentStatus] || PAYMENT_COLORS.Pending;
    return (
      <Card style={tablet ? { flex: 1 } : undefined}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <Text style={styles.schoolName} numberOfLines={1}>{s.schoolName}</Text>
          <Badge label={s.status} color={SUB_STATUS_COLORS[s.status] || '#9CA3AF'} />
        </View>
        <Text style={styles.assignedTo}>FO: {s.foName} | Deal #{s.dealId}</Text>

        {/* Credential status badge */}
        <View style={styles.credRow}>
          <Badge
            label={s.credentialStatus === 'NotProvisioned' ? 'No Credentials' : s.credentialStatus}
            color={CRED_COLORS[s.credentialStatus] || '#9CA3AF'}
          />
        </View>

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Plan</Text>
            <Text style={styles.statValue}>{s.planType || '—'}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Licenses</Text>
            <Text style={styles.statValue}>{s.numberOfLicenses || '—'}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Amount</Text>
            <Text style={styles.statValue}>₹{s.amount?.toLocaleString() || '—'}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Days Left</Text>
            <Text style={[
              styles.statValue,
              s.daysRemaining <= 30 ? { color: '#DC2626' } :
              s.daysRemaining <= 90 ? { color: '#D97706' } :
              { color: '#16A34A' },
            ]}>{s.daysRemaining ?? '—'}</Text>
          </View>
        </View>

        {/* Period */}
        <View style={styles.periodRow}>
          <Text style={styles.statLabel}>Period: </Text>
          <Text style={styles.periodText}>{formatDate(s.periodStart)} – {formatDate(s.periodEnd)}</Text>
        </View>

        {/* Provisioned credentials info */}
        {s.credentialStatus === 'Provisioned' && (
          <View style={styles.credInfoBox}>
            <Text style={styles.credInfoLabel}>School Portal Credentials</Text>
            <Text style={styles.credInfoEmail}>{s.schoolLoginEmail}</Text>
            <Text style={styles.credInfoMeta}>
              Provisioned by {s.credentialProvisionedByName} on {formatDate(s.credentialProvisionedAt)}
            </Text>
          </View>
        )}

        {s.credentialStatus === 'Revoked' && (
          <View style={styles.revokedBox}>
            <ShieldAlert size={14} color="#DC2626" />
            <Text style={styles.revokedText}>Credentials have been revoked</Text>
          </View>
        )}

        {/* Payment status */}
        <View style={styles.paymentRow}>
          <Text style={styles.statLabel}>Payment: </Text>
          <View style={[styles.paymentBadge, { backgroundColor: payColor.bg }]}>
            <Text style={[styles.paymentText, { color: payColor.text }]}>{s.dealPaymentStatus || 'Pending'}</Text>
          </View>
        </View>

        {/* SCA/SH Actions */}
        {isSCA && (
          <View style={styles.credActions}>
            {s.credentialStatus === 'NotProvisioned' && (
              <TouchableOpacity
                style={[styles.provisionBtn, { backgroundColor: COLOR.primary }]}
                onPress={() => {
                  setCredModalId(s.id);
                  setCredEmail('');
                  setCredPassword('');
                  setShowPassword(false);
                }}
              >
                <Key size={14} color="#FFF" />
                <Text style={styles.provisionBtnText}>Provision Credentials</Text>
              </TouchableOpacity>
            )}
            {s.credentialStatus === 'Provisioned' && (
              <TouchableOpacity style={styles.revokeBtn} onPress={() => handleRevoke(s.id)}>
                <ShieldAlert size={14} color="#DC2626" />
                <Text style={styles.revokeBtnText}>Revoke</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </Card>
    );
  };

  // ─── Filter bar renderer ───────────────────────────────────────────────────
  const renderFilters = (filters: string[], current: string, onSelect: (f: string) => void) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
      {filters.map(f => (
        <TouchableOpacity
          key={f}
          style={[styles.filterChip, current === f && { backgroundColor: '#FFF' }]}
          onPress={() => onSelect(f)}
        >
          <Text style={[styles.filterText, current === f && { color: COLOR.primary }]}>{f}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={[styles.header, { backgroundColor: COLOR.primary }]}>
        <Text style={styles.headerTitle}>Onboarding & Subscriptions</Text>

        {/* Main Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 10 }} contentContainerStyle={{ flexDirection: 'row', gap: 6 }}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'onboarding' && { backgroundColor: '#FFF' }]}
            onPress={() => setActiveTab('onboarding')}
          >
            <Text style={[styles.tabText, activeTab === 'onboarding' && { color: COLOR.primary }]}>Onboarding</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'subscriptions' && { backgroundColor: '#FFF' }]}
            onPress={() => setActiveTab('subscriptions')}
          >
            <Text style={[styles.tabText, activeTab === 'subscriptions' && { color: COLOR.primary }]}>Subscriptions</Text>
          </TouchableOpacity>
          {role === 'SCA' && (
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'profiles' && { backgroundColor: '#FFF' }]}
              onPress={() => setActiveTab('profiles')}
            >
              <Text style={[styles.tabText, activeTab === 'profiles' && { color: COLOR.primary }]}>School Profiles</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        {/* Status Filters */}
        {activeTab === 'onboarding'
          ? renderFilters(ONBOARD_FILTERS, filter, setFilter)
          : activeTab === 'subscriptions'
          ? renderFilters(SUB_FILTERS, subFilter, setSubFilter)
          : null
        }
      </View>

      {/* ─── ONBOARDING TAB ─── */}
      {activeTab === 'onboarding' && (
        loading ? (
          <LoadingSpinner fullScreen color={COLOR.primary} message="Loading..." />
        ) : (
          <FlatList
            data={items}
            keyExtractor={item => String(item.id)}
            renderItem={renderOnboardCard}
            contentContainerStyle={[styles.list, items.length === 0 && { flex: 1 }]}
            key={tablet ? 'grid' : 'list'}
            numColumns={tablet ? 2 : 1}
            columnWrapperStyle={tablet ? { gap: 10 } : undefined}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => { setRefreshing(true); fetchItems(); }}
                colors={[COLOR.primary]}
              />
            }
            ListEmptyComponent={<EmptyState title="No onboarding tasks" subtitle="Assigned tasks will appear here" icon="📋" />}
          />
        )
      )}

      {/* ─── SUBSCRIPTIONS TAB ─── */}
      {activeTab === 'subscriptions' && (
        loadingSubs ? (
          <LoadingSpinner fullScreen color={COLOR.primary} message="Loading subscriptions..." />
        ) : (
          <FlatList
            data={subs}
            keyExtractor={item => String(item.id)}
            renderItem={renderSubCard}
            contentContainerStyle={[styles.list, subs.length === 0 && { flex: 1 }]}
            key={tablet ? 'sub-grid' : 'sub-list'}
            numColumns={tablet ? 2 : 1}
            columnWrapperStyle={tablet ? { gap: 10 } : undefined}
            refreshControl={
              <RefreshControl
                refreshing={refreshingSubs}
                onRefresh={() => { setRefreshingSubs(true); fetchSubs(); }}
                colors={[COLOR.primary]}
              />
            }
            ListEmptyComponent={<EmptyState title="No subscriptions" subtitle="Subscriptions will appear here" icon="🔑" />}
          />
        )
      )}

      {/* ─── SCHOOL PROFILES TAB (SCA only) ─── */}
      {activeTab === 'profiles' && role === 'SCA' && (
        loadingProfiles ? (
          <LoadingSpinner fullScreen color={COLOR.primary} message="Loading profiles..." />
        ) : (
          <FlatList
            data={profiles}
            keyExtractor={item => String(item.id)}
            contentContainerStyle={[styles.list, profiles.length === 0 && { flex: 1 }]}
            ListHeaderComponent={
              <View style={ps.headerRow}>
                <Text style={ps.countText}>{profiles.length} profile{profiles.length !== 1 ? 's' : ''}</Text>
                <TouchableOpacity
                  style={[ps.addBtn, { backgroundColor: COLOR.primary }]}
                  onPress={() => { setPf(emptyProfileForm); setEditingProfileId(null); setProfileFormVisible(true); }}
                >
                  <Plus size={14} color="#FFF" />
                  <Text style={ps.addBtnText}>Add Profile</Text>
                </TouchableOpacity>
              </View>
            }
            renderItem={({ item: p }) => (
              <Card style={{ marginBottom: 10 }}>
                <View style={ps.cardTop}>
                  <View style={{ flex: 1 }}>
                    <View style={ps.nameRow}>
                      <Text style={ps.schoolNameText} numberOfLines={1}>{p.schoolName}</Text>
                      {(p.city || p.state) ? (
                        <View style={ps.locBadge}>
                          <Text style={ps.locText}>{[p.city, p.state].filter(Boolean).join(', ')}</Text>
                        </View>
                      ) : null}
                    </View>
                    <View style={ps.infoGrid}>
                      <View style={ps.infoItem}><Text style={ps.infoLabel}>Admin</Text><Text style={ps.infoValue}>{p.firstName} {p.lastName}</Text></View>
                      <View style={ps.infoItem}><Text style={ps.infoLabel}>Email</Text><Text style={ps.infoValue} numberOfLines={1}>{p.userEmail}</Text></View>
                      <View style={ps.infoItem}><Text style={ps.infoLabel}>Phone</Text><Text style={ps.infoValue}>{p.userPhone}</Text></View>
                      <View style={ps.infoItem}><Text style={ps.infoLabel}>Created</Text><Text style={ps.infoValue}>{formatDate(p.createdAt)}</Text></View>
                    </View>
                  </View>
                  <TouchableOpacity style={ps.editBtn} onPress={() => handleEditProfile(p)}>
                    <Pencil size={14} color="#6B7280" />
                  </TouchableOpacity>
                </View>
              </Card>
            )}
            ListEmptyComponent={
              <EmptyState title="No school profiles yet" subtitle="Tap 'Add Profile' to create one" icon="🎓" />
            }
          />
        )
      )}

      {/* ─── School Profile Add/Edit Modal ─── */}
      <Modal visible={profileFormVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setProfileFormVisible(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }} edges={['top']}>
          <View style={[ps.modalHeader, { backgroundColor: COLOR.primary }]}>
            <Text style={ps.modalTitle}>{editingProfileId ? 'Edit School Profile' : 'Add School Profile'}</Text>
            <TouchableOpacity onPress={() => { setProfileFormVisible(false); setEditingProfileId(null); }}>
              <X size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={ps.formContent} keyboardShouldPersistTaps="handled">
            {/* School Selector (new only) */}
            {!editingProfileId && (
              <View style={ps.fieldWrap}>
                <Text style={ps.sectionLabel}>Select School *</Text>
                <TouchableOpacity style={ps.pickerBtn} onPress={() => setSchoolPickerVisible(true)}>
                  <Text style={[ps.pickerText, !pf.schoolId && { color: '#9CA3AF' }]} numberOfLines={1}>
                    {pf.schoolName || 'Tap to select school...'}
                  </Text>
                  <ChevronDown size={16} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
            )}

            {/* User Information */}
            <Text style={ps.sectionHeading}>User Information</Text>
            <View style={ps.fieldRow}>
              <View style={ps.fieldHalf}><Text style={ps.label}>First Name *</Text><TextInput style={ps.inp} value={pf.firstName} onChangeText={v => setPf(p => ({ ...p, firstName: v }))} placeholder="First name" placeholderTextColor="#9CA3AF" /></View>
              <View style={ps.fieldHalf}><Text style={ps.label}>Last Name *</Text><TextInput style={ps.inp} value={pf.lastName} onChangeText={v => setPf(p => ({ ...p, lastName: v }))} placeholder="Last name" placeholderTextColor="#9CA3AF" /></View>
            </View>
            <View style={ps.fieldRow}>
              <View style={ps.fieldHalf}><Text style={ps.label}>Phone *</Text><TextInput style={ps.inp} value={pf.userPhone} onChangeText={v => setPf(p => ({ ...p, userPhone: v }))} placeholder="Phone" placeholderTextColor="#9CA3AF" keyboardType="phone-pad" /></View>
              <View style={ps.fieldHalf}><Text style={ps.label}>Email *</Text><TextInput style={ps.inp} value={pf.userEmail} onChangeText={v => setPf(p => ({ ...p, userEmail: v }))} placeholder="Email" placeholderTextColor="#9CA3AF" keyboardType="email-address" autoCapitalize="none" /></View>
            </View>
            <View style={ps.fieldRow}>
              <View style={ps.fieldHalf}><Text style={ps.label}>Password *</Text><TextInput style={ps.inp} value={pf.password} onChangeText={v => setPf(p => ({ ...p, password: v }))} placeholder="Password" placeholderTextColor="#9CA3AF" /></View>
              <View style={ps.fieldHalf}>
                <Text style={ps.label}>Gender *</Text>
                <View style={ps.genderRow}>
                  {['Male', 'Female', 'Other'].map(g => (
                    <TouchableOpacity key={g} style={[ps.genderChip, pf.gender === g && { backgroundColor: COLOR.primary }]} onPress={() => setPf(p => ({ ...p, gender: g }))}>
                      <Text style={[ps.genderText, pf.gender === g && { color: '#FFF' }]}>{g}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            {/* School Information */}
            <Text style={[ps.sectionHeading, { marginTop: 20 }]}>School Information</Text>
            <View style={ps.fieldWrap}><Text style={ps.label}>School Name *</Text><TextInput style={ps.inp} value={pf.schoolName} onChangeText={v => setPf(p => ({ ...p, schoolName: v }))} placeholder="School name" placeholderTextColor="#9CA3AF" /></View>
            <View style={ps.fieldWrap}><Text style={ps.label}>School Address *</Text><TextInput style={ps.inp} value={pf.schoolAddress} onChangeText={v => setPf(p => ({ ...p, schoolAddress: v }))} placeholder="Address" placeholderTextColor="#9CA3AF" /></View>
            <View style={ps.fieldRow}>
              <View style={ps.fieldHalf}><Text style={ps.label}>Area *</Text><TextInput style={ps.inp} value={pf.area} onChangeText={v => setPf(p => ({ ...p, area: v }))} placeholder="Area" placeholderTextColor="#9CA3AF" /></View>
              <View style={ps.fieldHalf}><Text style={ps.label}>City *</Text><TextInput style={ps.inp} value={pf.city} onChangeText={v => setPf(p => ({ ...p, city: v }))} placeholder="City" placeholderTextColor="#9CA3AF" /></View>
            </View>
            <View style={ps.fieldRow}>
              <View style={ps.fieldHalf}><Text style={ps.label}>State *</Text><TextInput style={ps.inp} value={pf.state} onChangeText={v => setPf(p => ({ ...p, state: v }))} placeholder="State" placeholderTextColor="#9CA3AF" /></View>
              <View style={ps.fieldHalf}><Text style={ps.label}>Country *</Text><TextInput style={ps.inp} value={pf.country} onChangeText={v => setPf(p => ({ ...p, country: v }))} placeholder="Country" placeholderTextColor="#9CA3AF" /></View>
            </View>
            <View style={ps.fieldRow}>
              <View style={ps.fieldHalf}><Text style={ps.label}>School Phone *</Text><TextInput style={ps.inp} value={pf.schoolPhone} onChangeText={v => setPf(p => ({ ...p, schoolPhone: v }))} placeholder="Phone" placeholderTextColor="#9CA3AF" keyboardType="phone-pad" /></View>
              <View style={ps.fieldHalf}><Text style={ps.label}>School Email *</Text><TextInput style={ps.inp} value={pf.schoolEmail} onChangeText={v => setPf(p => ({ ...p, schoolEmail: v }))} placeholder="Email" placeholderTextColor="#9CA3AF" keyboardType="email-address" autoCapitalize="none" /></View>
            </View>
            <View style={ps.fieldWrap}><Text style={ps.label}>Zipcode *</Text><TextInput style={ps.inp} value={pf.zipcode} onChangeText={v => setPf(p => ({ ...p, zipcode: v }))} placeholder="Zipcode" placeholderTextColor="#9CA3AF" keyboardType="number-pad" /></View>

            {/* Actions */}
            <View style={ps.formBtns}>
              <TouchableOpacity style={ps.formCancelBtn} onPress={() => { setProfileFormVisible(false); setEditingProfileId(null); }}>
                <Text style={ps.formCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[ps.formSaveBtn, { backgroundColor: COLOR.primary, opacity: savingProfile ? 0.6 : 1 }]}
                onPress={handleSaveProfile}
                disabled={savingProfile}
              >
                <Text style={ps.formSaveText}>{savingProfile ? 'Saving...' : editingProfileId ? 'Update Profile' : 'Save Profile'}</Text>
              </TouchableOpacity>
            </View>
            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>

        {/* School Picker Bottom Sheet */}
        <Modal visible={schoolPickerVisible} transparent animationType="slide" onRequestClose={() => setSchoolPickerVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalBox, { maxHeight: '70%' }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select School</Text>
                <TouchableOpacity onPress={() => setSchoolPickerVisible(false)}><X size={20} color="#6B7280" /></TouchableOpacity>
              </View>
              <FlatList
                data={onboardedSchools}
                keyExtractor={item => String(item.id)}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item: sch }) => (
                  <TouchableOpacity style={ps.schoolItem} onPress={() => handleSchoolSelect(sch)}>
                    <Text style={ps.schoolItemName}>{sch.name}</Text>
                    {sch.city ? <Text style={ps.schoolItemCity}>{sch.city}</Text> : null}
                  </TouchableOpacity>
                )}
                ListEmptyComponent={<Text style={{ textAlign: 'center', padding: 28, color: '#9CA3AF', fontSize: rf(13) }}>No onboarded schools found</Text>}
              />
            </View>
          </View>
        </Modal>
      </Modal>

      {/* ─── Credential Provisioning Modal ─── */}
      <Modal visible={!!credModalId} transparent animationType="slide" onRequestClose={() => setCredModalId(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Provision School Credentials</Text>
              <TouchableOpacity onPress={() => setCredModalId(null)}>
                <X size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSub}>Enter the login details for the school portal</Text>

            <Text style={styles.fieldLabel}>School Login Email *</Text>
            <TextInput
              style={styles.input}
              value={credEmail}
              onChangeText={setCredEmail}
              placeholder="school@educrm.in"
              placeholderTextColor="#9CA3AF"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>School Login Password *</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={credPassword}
                onChangeText={setCredPassword}
                placeholder="Enter password"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(p => !p)}>
                {showPassword ? <EyeOff size={18} color="#6B7280" /> : <Eye size={18} color="#6B7280" />}
              </TouchableOpacity>
            </View>

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setCredModalId(null)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.provisionModalBtn, { backgroundColor: COLOR.primary, opacity: provisioning ? 0.6 : 1 }]}
                onPress={handleProvision}
                disabled={provisioning}
              >
                <Text style={styles.provisionModalText}>{provisioning ? 'Provisioning...' : 'Provision'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  headerTitle: { fontSize: rf(22), fontWeight: '700', color: '#FFF', marginBottom: 10 },
  tabBtn: {
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  tabText: { fontSize: rf(13), fontWeight: '600', color: 'rgba(255,255,255,0.9)' },
  filterScroll: { flexGrow: 0 },
  filterContent: { flexDirection: 'row', gap: 6 },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  filterText: { fontSize: rf(12), color: 'rgba(255,255,255,0.9)', fontWeight: '600' },
  list: { padding: 12, gap: 10 },
  // Onboarding card
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, gap: 8 },
  schoolName: { fontSize: rf(15), fontWeight: '700', color: '#111827', flex: 1 },
  assignedTo: { fontSize: rf(13), color: '#6B7280', marginBottom: 10 },
  progressSection: { gap: 4, marginBottom: 8 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { fontSize: rf(12), color: '#6B7280' },
  progressPct: { fontSize: rf(12), fontWeight: '700', color: '#111827' },
  quickBtnRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  quickBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  quickBtnText: { fontSize: rf(11), fontWeight: '600' },
  deadline: { fontSize: rf(12), color: '#9CA3AF' },
  // Subscription card
  credRow: { marginBottom: 10 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  statBox: { backgroundColor: '#F9FAFB', borderRadius: 8, padding: 10, minWidth: '45%', flex: 1 },
  statLabel: { fontSize: rf(11), color: '#9CA3AF', marginBottom: 2 },
  statValue: { fontSize: rf(14), fontWeight: '700', color: '#111827' },
  periodRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  periodText: { fontSize: rf(12), fontWeight: '600', color: '#111827' },
  credInfoBox: { backgroundColor: '#F0FDF4', borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#BBF7D0' },
  credInfoLabel: { fontSize: rf(11), color: '#16A34A', fontWeight: '600', marginBottom: 4 },
  credInfoEmail: { fontSize: rf(14), fontWeight: '700', color: '#166534' },
  credInfoMeta: { fontSize: rf(11), color: '#6B7280', marginTop: 4 },
  revokedBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF2F2', borderRadius: 10, padding: 12, marginBottom: 10 },
  revokedText: { fontSize: rf(12), color: '#DC2626', fontWeight: '500' },
  paymentRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  paymentBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  paymentText: { fontSize: rf(11), fontWeight: '600' },
  credActions: { borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 10, flexDirection: 'row', gap: 8 },
  provisionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10 },
  provisionBtnText: { fontSize: rf(13), fontWeight: '600', color: '#FFF' },
  revokeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, backgroundColor: '#FEF2F2' },
  revokeBtnText: { fontSize: rf(13), fontWeight: '600', color: '#DC2626' },
  // Credential modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  modalTitle: { fontSize: rf(18), fontWeight: '700', color: '#111827' },
  modalSub: { fontSize: rf(13), color: '#6B7280', marginBottom: 20 },
  fieldLabel: { fontSize: rf(13), fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: rf(14),
    color: '#111827', backgroundColor: '#FAFAFA',
  },
  passwordRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyeBtn: { padding: 8 },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center' },
  cancelText: { fontSize: rf(14), fontWeight: '600', color: '#6B7280' },
  provisionModalBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  provisionModalText: { fontSize: rf(14), fontWeight: '600', color: '#FFF' },
});

// ─── School Profile Styles ──────────────────────────────────────────────────
const ps = StyleSheet.create({
  // List header
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  countText: { fontSize: rf(12), color: '#6B7280' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10 },
  addBtnText: { fontSize: rf(13), fontWeight: '600', color: '#FFF' },
  // Profile card
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  schoolNameText: { fontSize: rf(15), fontWeight: '700', color: '#111827' },
  locBadge: { backgroundColor: '#F0FDFA', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 100 },
  locText: { fontSize: rf(10), color: '#0D9488', fontWeight: '600' },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  infoItem: { minWidth: '40%' },
  infoLabel: { fontSize: rf(11), color: '#9CA3AF', marginBottom: 2 },
  infoValue: { fontSize: rf(13), fontWeight: '600', color: '#111827' },
  editBtn: { padding: 8, backgroundColor: '#F3F4F6', borderRadius: 8 },
  // Form modal
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  modalTitle: { fontSize: rf(18), fontWeight: '700', color: '#FFF' },
  formContent: { padding: 16, gap: 12 },
  sectionLabel: { fontSize: rf(13), fontWeight: '600', color: '#374151', marginBottom: 4 },
  sectionHeading: { fontSize: rf(14), fontWeight: '700', color: '#0D9488', marginBottom: 4, marginTop: 8 },
  fieldWrap: { marginBottom: 4 },
  fieldRow: { flexDirection: 'row', gap: 10 },
  fieldHalf: { flex: 1 },
  label: { fontSize: rf(12), fontWeight: '600', color: '#6B21A8', marginBottom: 4 },
  inp: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: rf(14),
    color: '#111827', backgroundColor: '#FAFAFA',
  },
  pickerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 12, backgroundColor: '#FAFAFA',
  },
  pickerText: { fontSize: rf(14), color: '#111827', flex: 1 },
  genderRow: { flexDirection: 'row', gap: 8, paddingTop: 4 },
  genderChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: '#F3F4F6' },
  genderText: { fontSize: rf(13), fontWeight: '600', color: '#6B7280' },
  formBtns: { flexDirection: 'row', gap: 10, marginTop: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 16 },
  formCancelBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center' },
  formCancelText: { fontSize: rf(14), fontWeight: '600', color: '#6B7280' },
  formSaveBtn: { flex: 1.4, paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
  formSaveText: { fontSize: rf(14), fontWeight: '700', color: '#FFF' },
  // School picker items
  schoolItem: { paddingHorizontal: 20, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  schoolItemName: { fontSize: rf(14), color: '#111827', fontWeight: '500' },
  schoolItemCity: { fontSize: rf(12), color: '#9CA3AF', marginTop: 2 },
});
