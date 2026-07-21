import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  RefreshControl, useWindowDimensions, Alert, ScrollView,
  Image, Platform, PermissionsAndroid, Linking, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Eye, EyeOff, Key, ShieldAlert, Plus, Pencil, Download, Upload,
  ClipboardList, MapPin,
} from 'lucide-react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import RNShare from 'react-native-share';

import { onboardingApi } from '../../api/onboarding';
import { subscriptionsApi } from '../../api/subscriptions';
import { schoolProfilesApi, ExportFormat } from '../../api/schoolProfiles';
import { OnboardAssignment } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { ProgressBar } from '../../components/common/ProgressBar';
import { ICON_STROKE } from '../../components/common/Icon';
import {
  Btn, IconBtn, Field, Input, Segmented, Trigger, Dropdown,
  StatusBadge, Pagination, ListCard, FormModal, ConfirmModal,
} from '../../components/crud';

import { useAppTheme } from '../../theme/useAppTheme';
import { AppTheme } from '../../theme/appTheme';
import { withAlpha, SOFT_TINT } from '../../theme';
import { formatDate } from '../../utils/formatting';
import { rf, isTabletDevice } from '../../utils/responsive';

const DASH = '—';
const GUTTER = 10;

/**
 * House page size — 10 on every list screen (SchoolsListScreen, LeadsListScreen,
 * TargetsScreen, AllowancesScreen, PaymentsScreen, DemoListScreen).
 *
 * The three tabs page differently because their endpoints differ:
 *
 * · Onboarding — SERVER-side. OnboardingController:
 *     [HttpGet]
 *     public async Task<IActionResult> GetOnboardings([FromQuery] string? status, [FromQuery] int? assignedToId,
 *         [FromQuery] int page = 1, [FromQuery] int limit = 20)
 *     { ... return Ok(ApiResponse<object>.Ok(new { items, total, page, limit })); }
 *   Real `page`/`limit` binding and a `total` in the envelope, so we let the server
 *   slice. NOTE the query key is `limit`, NOT `pageSize` — the OnboardFilters TS type
 *   says `pageSize`, which ASP.NET would silently drop, so params go over as `any`
 *   with the name the controller actually binds.
 *
 * · Subscriptions — CLIENT-side. SubscriptionsController:
 *     [HttpGet]
 *     public async Task<IActionResult> GetSubscriptions([FromQuery] string? status)
 *     { ... return Ok(ApiResponse<List<SchoolSubscriptionDto>>.Ok(result)); }
 *   `status` is the only bound parameter and the payload is a bare List<T> — no paging
 *   to defer to.
 *
 * · School Profiles — CLIENT-side. SchoolProfileController:
 *     [HttpGet]
 *     public async Task<IActionResult> GetAll()
 *     { if (UserRole != "SCA") return Forbid(); ... return Ok(ApiResponse<List<SchoolProfileDto>>.Ok(data)); }
 *   Zero [FromQuery] parameters, bare List<T>.
 */
const PAGE_SIZE = 10;

const ONBOARD_FILTERS = ['All', 'Assigned', 'InProgress', 'Completed', 'OnHold', 'Cancelled'];
const SUB_FILTERS = ['All', 'Pending', 'Active', 'Expiring', 'Expired', 'Suspended'];
const GENDERS = [
  { label: 'Male', value: 'Male' },
  { label: 'Female', value: 'Female' },
  { label: 'Other', value: 'Other' },
];

/** Status ramps — spec tokens only, one distinct hue per adjacent tier. */
const statusColor = (T: AppTheme, st?: string) => {
  switch (st) {
    case 'Assigned':   return T.warning;
    case 'InProgress': return T.info;
    case 'Completed':  return T.success;
    case 'Cancelled':  return T.danger;
    default:           return T.sub;   // OnHold
  }
};
const subStatusColor = (T: AppTheme, st?: string) => {
  switch (st) {
    case 'Pending':   return T.info;
    case 'Active':    return T.success;
    case 'Expiring':  return T.warning;
    case 'Expired':   return T.danger;
    default:          return T.sub;    // Suspended
  }
};
const credColor = (T: AppTheme, st?: string) =>
  st === 'Provisioned' ? T.success : st === 'Revoked' ? T.danger : T.sub;
const payColor = (T: AppTheme, st?: string) =>
  st === 'Paid' ? T.success : st === 'Partial' ? T.warning : T.sub;
/** Runway ramp on the subscription's Days Left tile. */
const daysColor = (T: AppTheme, d?: number) =>
  d == null ? T.text : d <= 30 ? T.danger : d <= 90 ? T.warning : T.success;

export const OnboardListScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const T = useAppTheme();
  const role = user?.role || 'FO';
  const isSCA = role === 'SCA' || role === 'SH';
  const { width, height } = useWindowDimensions();
  const wide = isTabletDevice && width > height;
  /**
   * House split: iPad renders a real table, phone renders .lcard rows
   * (SchoolsListScreen is the reference). This replaces the old two-per-row card
   * grid — these three tabs are tabular data, so on a tablet they get a table.
   */
  const table = isTabletDevice;

  // Main tab
  const [activeTab, setActiveTab] = useState<'onboarding' | 'subscriptions' | 'profiles'>('onboarding');

  // Onboarding state
  const [items, setItems] = useState<OnboardAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('All');
  /** Server-paged: `items` is already just this page, `itemsTotal` is the server's count. */
  const [itemsPage, setItemsPage] = useState(1);
  const [itemsTotal, setItemsTotal] = useState(0);
  const itemsPages = Math.max(1, Math.ceil(itemsTotal / PAGE_SIZE));

  // Subscriptions state
  const [subs, setSubs] = useState<any[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(true);
  const [refreshingSubs, setRefreshingSubs] = useState(false);
  const [subFilter, setSubFilter] = useState('All');
  /** Client-paged: `subs` holds every row, so we slice it here. */
  const [subPage, setSubPage] = useState(1);

  /** Which filter Dropdown is open — the panel renders inline under its Trigger. */
  const [filterOpen, setFilterOpen] = useState(false);

  // Credential modal
  const [credModalId, setCredModalId] = useState<number | null>(null);
  const [credEmail, setCredEmail] = useState('');
  const [credPassword, setCredPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [revokeId, setRevokeId] = useState<number | null>(null);

  // School Profiles state (SCA only)
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  /** Client-paged, same as subscriptions. */
  const [profilePage, setProfilePage] = useState(1);
  const [onboardedSchools, setOnboardedSchools] = useState<any[]>([]);
  const [profileFormVisible, setProfileFormVisible] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<number | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [schoolPickerVisible, setSchoolPickerVisible] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [formatModalVisible, setFormatModalVisible] = useState(false);
  const [exporting, setExporting] = useState(false);
  const emptyProfileForm = {
    schoolId: '', firstName: '', lastName: '', userPhone: '', userEmail: '',
    password: '', gender: 'Male', schoolName: '', schoolAddress: '', area: '',
    city: '', state: '', country: 'India', schoolPhone: '', schoolEmail: '', zipcode: '',
    schoolLogo: '',
  };
  const [pf, setPf] = useState(emptyProfileForm);

  // ─── Onboarding fetch (SERVER-side paging — see PAGE_SIZE) ─────────────────
  const fetchItems = useCallback(async (pg: number) => {
    try {
      // `limit`, not `pageSize` — that is the parameter name the controller binds.
      const params: any = { page: pg, limit: PAGE_SIZE };
      if (filter !== 'All') params.status = filter;
      const res = await onboardingApi.getAll(params);
      const d: any = res.data;
      const data: OnboardAssignment[] = d?.items ?? (Array.isArray(d) ? d : []);
      setItems(data);
      setItemsTotal(d?.total ?? data.length);
    } catch {
      setItems([]);
      setItemsTotal(0);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  // A filter change is a new result set, so go back to page 1.
  useEffect(() => {
    if (activeTab === 'onboarding') {
      setLoading(true);
      setItemsPage(1);
      fetchItems(1);
    }
  }, [filter, activeTab]);

  const goToItemsPage = (p: number) => {
    if (p < 1 || p > itemsPages || p === itemsPage) return;
    setItemsPage(p);
    setLoading(true);
    fetchItems(p);
  };

  // ─── Quick % update with auto-complete ─────────────────────────────────────
  const handleQuickProgress = async (id: number, pct: number) => {
    try {
      await onboardingApi.updateProgress(id, pct);
      if (pct >= 100) {
        await onboardingApi.updateStatus(id, 'Completed');
      }
      // Stay on the page the user is looking at, not back at page 1.
      fetchItems(itemsPage);
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
      setSubPage(1);
      fetchSubs();
    }
  }, [subFilter, activeTab]);

  // ─── Client-side slices for the two unpaged tabs ───────────────────────────
  const subTotal = subs.length;
  const subPages = Math.max(1, Math.ceil(subTotal / PAGE_SIZE));
  /** Clamp rather than reset, so a refresh that shrinks the list never strands us. */
  useEffect(() => { setSubPage(p => Math.min(p, subPages)); }, [subPages]);
  const pagedSubs = useMemo(
    () => subs.slice((subPage - 1) * PAGE_SIZE, subPage * PAGE_SIZE),
    [subs, subPage],
  );

  const profileTotal = profiles.length;
  const profilePages = Math.max(1, Math.ceil(profileTotal / PAGE_SIZE));
  useEffect(() => { setProfilePage(p => Math.min(p, profilePages)); }, [profilePages]);
  const pagedProfiles = useMemo(
    () => profiles.slice((profilePage - 1) * PAGE_SIZE, profilePage * PAGE_SIZE),
    [profiles, profilePage],
  );

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

  /** Validation only — the actual write waits on the export-format choice, mirroring
   *  web's handleSaveClick → Export Format modal → handleSaveAndSend(format). */
  const handleSaveClick = () => {
    if (!pf.schoolId || !pf.firstName || !pf.userEmail || !pf.schoolName) {
      Alert.alert('Required', 'Please fill School, First Name, Email & School Name');
      return;
    }
    setFormatModalVisible(true);
  };

  const handleSaveAndSend = async (format: ExportFormat) => {
    setFormatModalVisible(false);
    setSavingProfile(true);
    try {
      if (editingProfileId) {
        await schoolProfilesApi.update(editingProfileId, pf, format);
      } else {
        await schoolProfilesApi.create({ ...pf, schoolId: parseInt(pf.schoolId) }, format);
      }
      Alert.alert('Success', `Profile saved & ${format === 'excel' ? 'Excel' : 'CSV'} sent via email successfully`);
      setProfileFormVisible(false);
      setEditingProfileId(null);
      setPf(emptyProfileForm);
      fetchProfiles();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to save profile');
    }
    finally { setSavingProfile(false); }
  };

  /** Android needs an explicit read grant before the picker will hand back a uri;
   *  the permission split at API 33 matches AllowancesScreen's bill picker. */
  const ensurePhotoPermission = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;
    try {
      const permission = Number(Platform.Version) >= 33
        ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
        : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;
      if (await PermissionsAndroid.check(permission)) return true;
      const result = await PermissionsAndroid.request(permission, {
        title: 'Photo Library Permission Required',
        message: 'The app needs access to your photos to upload a school logo.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      });
      if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
        Alert.alert('Photo Permission Blocked', 'Photo access is blocked. Please enable it in Settings.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]);
        return false;
      }
      return result === PermissionsAndroid.RESULTS.GRANTED;
    } catch {
      Alert.alert('Error', 'Could not request photo library permission.');
      return false;
    }
  };

  const handlePickLogo = async () => {
    if (!(await ensurePhotoPermission())) return;
    launchImageLibrary({ mediaType: 'photo', quality: 0.8, includeBase64: false }, async res => {
      if (res.didCancel) return;
      if (res.errorCode === 'permission') {
        Alert.alert('Photo Permission Required', 'Please enable photo library access in your device Settings.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]);
        return;
      }
      if (res.errorCode) {
        Alert.alert('Error', res.errorMessage ?? 'Could not open photo library.');
        return;
      }
      const asset = res.assets?.[0];
      if (!asset?.uri) return;
      // Same 5MB ceiling web enforces, and the controller's [RequestSizeLimit(5 * 1024 * 1024)].
      if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
        Alert.alert('Too Large', 'Max 5MB allowed');
        return;
      }
      setLogoUploading(true);
      try {
        const fd = new FormData();
        // Field name must be `file` — see schoolProfilesApi.uploadLogo.
        fd.append('file', {
          uri: asset.uri,
          type: asset.type || 'image/jpeg',
          name: asset.fileName || `logo_${Date.now()}.jpg`,
        } as any);
        const up = await schoolProfilesApi.uploadLogo(fd);
        const url = up.data?.logoUrl;
        if (url) {
          setPf(p => ({ ...p, schoolLogo: url }));
          Alert.alert('Success', 'Logo uploaded');
        } else {
          Alert.alert('Error', 'Upload failed');
        }
      } catch (err: any) {
        Alert.alert('Error', err?.response?.data?.message || 'Failed to upload logo');
      } finally {
        setLogoUploading(false);
      }
    });
  };

  /** Web downloads the server-rendered CSV as a file; on mobile the equivalent is the
   *  OS share sheet, following the RNShare pattern LeadsListScreen already uses. */
  const handleExportProfilesCsv = async () => {
    if (profiles.length === 0) return;
    setExporting(true);
    try {
      const res = await schoolProfilesApi.exportCsv();
      const csv = typeof res.data === 'string' ? res.data : String(res.data ?? '');
      if (!csv.trim()) {
        Alert.alert('Nothing to Export', 'The server returned an empty file.');
        return;
      }
      await RNShare.open({
        title: 'Export School Profiles',
        subject: 'School Profiles Export',
        message: csv,
        failOnCancel: false,
      });
    } catch (err: any) {
      if (err?.message !== 'User did not share') Alert.alert('Error', 'Failed to export school profiles');
    } finally {
      setExporting(false);
    }
  };

  const handleEditProfile = (p: any) => {
    setEditingProfileId(p.id);
    setPf({
      schoolId: String(p.schoolId || ''), firstName: p.firstName || '', lastName: p.lastName || '',
      userPhone: p.userPhone || '', userEmail: p.userEmail || '', password: p.password || '',
      gender: p.gender || 'Male', schoolName: p.schoolName || '', schoolAddress: p.schoolAddress || '',
      area: p.area || '', city: p.city || '', state: p.state || '', country: p.country || 'India',
      schoolPhone: p.schoolPhone || '', schoolEmail: p.schoolEmail || '', zipcode: p.zipcode || '',
      schoolLogo: p.schoolLogo || '',
    });
    setProfileFormVisible(true);
  };

  const handleRevoke = async () => {
    if (revokeId == null) return;
    const id = revokeId;
    setRevokeId(null);
    try {
      await subscriptionsApi.revokeCredentials(id);
      Alert.alert('Success', 'Credentials revoked');
      fetchSubs();
    } catch {
      Alert.alert('Error', 'Failed to revoke credentials');
    }
  };

  // ─── Onboarding: phone .lcard row ──────────────────────────────────────────
  const renderOnboardCard = (item: OnboardAssignment) => {
    const p = item.completionPercentage;
    return (
      <ListCard
        key={String(item.id)}
        style={s.stackCard}
        onPress={() => navigation.navigate('OnboardDetail', { onboardId: item.id })}
      >
        <View style={s.rowTop}>
          <Text style={[s.cardTitle, { color: T.text }]} numberOfLines={1}>{item.schoolName}</Text>
          <StatusBadge label={item.status} color={statusColor(T, item.status)} />
        </View>
        <Text style={[s.cardMeta, { color: T.sub }]} numberOfLines={1}>
          {item.assignedToName || DASH}
        </Text>

        <View style={s.progressHead}>
          <Text style={[s.metaLabel, { color: T.dim }]}>Progress</Text>
          <Text style={[s.metaVal, { color: T.text }]}>{p}%</Text>
        </View>
        <ProgressBar
          value={p}
          height={5}
          color={p >= 100 ? T.success : p >= 50 ? T.info : T.warning}
          trackColor={T.line}
        />

        <View style={s.quickRow}>
          {[25, 50, 75, 100].map(q => (
            <Btn
              key={q}
              label={`${q}%`}
              small
              variant={p >= q ? 'soft' : 'secondary'}
              onPress={() => handleQuickProgress(item.id, q)}
              style={{ flex: 1, paddingHorizontal: 0 }}
            />
          ))}
        </View>

        {!!item.scheduledEndDate && (
          <Text style={[s.cardFoot, { color: p === 100 ? T.success : T.dim }]} numberOfLines={1}>
            Due {formatDate(item.scheduledEndDate)}
          </Text>
        )}
      </ListCard>
    );
  };

  // ─── Render Subscription Card ──────────────────────────────────────────────
  const renderSubCard = (sub: any) => {
    const stats: { label: string; value: string; color?: string }[] = [
      { label: 'Plan', value: sub.planType || DASH },
      { label: 'Licenses', value: sub.numberOfLicenses ? String(sub.numberOfLicenses) : DASH },
      { label: 'Amount', value: sub.amount != null ? `₹${sub.amount.toLocaleString()}` : DASH },
      {
        label: 'Days Left',
        value: sub.daysRemaining ?? DASH,
        color: daysColor(T, sub.daysRemaining),
      },
    ];
    return (
      <ListCard key={String(sub.id)} style={s.stackCard}>
        <View style={s.rowTop}>
          <Text style={[s.cardTitle, { color: T.text }]} numberOfLines={1}>{sub.schoolName}</Text>
          <StatusBadge label={sub.status} color={subStatusColor(T, sub.status)} />
        </View>
        <View style={s.subMetaRow}>
          <Text style={[s.cardMeta, { color: T.sub }]} numberOfLines={1}>
            FO: {sub.foName || DASH} · Deal #{sub.dealId}
          </Text>
          <StatusBadge
            label={sub.credentialStatus === 'NotProvisioned' ? 'No Credentials' : sub.credentialStatus}
            color={credColor(T, sub.credentialStatus)}
          />
        </View>

        {/* Four tiles, one row on the tablet and two on a phone — the grid stretches
            every cell so no tile leaves dead space beside a taller neighbour. */}
        <View style={[s.grid, { marginHorizontal: -GUTTER / 2 }]}>
          {stats.map(st => (
            <View key={st.label} style={{ width: '50%', padding: GUTTER / 2 }}>
              <View style={[s.tile, { backgroundColor: T.cardAlt, borderColor: T.line }]}>
                <Text style={[s.tileLabel, { color: T.dim }]} numberOfLines={1}>{st.label}</Text>
                <Text style={[s.tileVal, { color: st.color || T.text }]} numberOfLines={1}>{st.value}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={s.inlineRow}>
          <Text style={[s.metaLabel, { color: T.dim }]}>Period</Text>
          <Text style={[s.metaVal, { color: T.text, flexShrink: 1, minWidth: 0 }]} numberOfLines={1}>
            {formatDate(sub.periodStart)} {DASH} {formatDate(sub.periodEnd)}
          </Text>
        </View>

        {sub.credentialStatus === 'Provisioned' && (
          <View style={[s.note, { backgroundColor: withAlpha(T.success, 0.1), borderColor: withAlpha(T.success, 0.2) }]}>
            <Text style={[s.noteLabel, { color: T.success }]}>School Portal Credentials</Text>
            <Text style={[s.noteVal, { color: T.text }]} numberOfLines={1}>{sub.schoolLoginEmail}</Text>
            <Text style={[s.noteMeta, { color: T.sub }]}>
              Provisioned by {sub.credentialProvisionedByName} on {formatDate(sub.credentialProvisionedAt)}
            </Text>
          </View>
        )}

        {sub.credentialStatus === 'Revoked' && (
          <View style={[s.revoked, { backgroundColor: withAlpha(T.danger, 0.1), borderColor: withAlpha(T.danger, 0.2) }]}>
            <ShieldAlert size={14} color={T.danger} strokeWidth={ICON_STROKE} />
            <Text style={[s.noteMeta, { color: T.danger, flexShrink: 1, minWidth: 0 }]}>
              Credentials have been revoked
            </Text>
          </View>
        )}

        <View style={s.inlineRow}>
          <Text style={[s.metaLabel, { color: T.dim }]}>Payment</Text>
          <StatusBadge
            label={sub.dealPaymentStatus || 'Pending'}
            color={payColor(T, sub.dealPaymentStatus)}
          />
        </View>

        {isSCA && (sub.credentialStatus === 'NotProvisioned' || sub.credentialStatus === 'Provisioned') && (
          <View style={[s.actionStrip, { borderTopColor: T.line }]}>
            {sub.credentialStatus === 'NotProvisioned' && (
              <Btn
                label="Provision Credentials"
                small
                icon={<Key size={13} color="#FFF" strokeWidth={ICON_STROKE} />}
                onPress={() => {
                  setCredModalId(sub.id);
                  setCredEmail('');
                  setCredPassword('');
                  setShowPassword(false);
                }}
              />
            )}
            {sub.credentialStatus === 'Provisioned' && (
              <Btn
                label="Revoke"
                variant="dangerGhost"
                small
                onPress={() => setRevokeId(sub.id)}
              />
            )}
          </View>
        )}
      </ListCard>
    );
  };

  // ─── Empty state ───────────────────────────────────────────────────────────
  const emptyBlock = (title: string, subtitle: string) => (
    <View style={[s.empty, { backgroundColor: T.card, borderColor: T.line }]}>
      <ClipboardList size={34} color={T.dim} strokeWidth={ICON_STROKE} />
      <Text style={[s.emptyTitle, { color: T.text }]}>{title}</Text>
      <Text style={[s.emptyTxt, { color: T.dim }]}>{subtitle}</Text>
    </View>
  );

  /** Spec's pagination panel: "Showing 1–6 of 210" left, the .pg cells right. */
  const pgFooter = (page: number, pages: number, total: number, onChange: (p: number) => void) => {
    if (pages <= 1) return null;
    const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
    const to = Math.min(page * PAGE_SIZE, total);
    return (
      <View style={s.pgRow}>
        <Text style={[s.count, { color: T.dim }]}>
          Showing {from}{DASH}{to} of {total}
        </Text>
        <Pagination page={page} pageCount={pages} onChange={onChange} />
      </View>
    );
  };

  /**
   * ── iPad tables ──
   * In all three tables every header <Text> carries the SAME column style object as
   * the body cell under it, so a value can never drift out from under its heading.
   */
  const renderOnboardTable = () => (
    <View style={[s.tbl, { backgroundColor: T.card, borderColor: T.line }]}>
      <View style={[s.tr, { backgroundColor: T.cardAlt }]}>
        <Text style={[s.th, { color: T.dim }, s.cSchool]}>School</Text>
        <Text style={[s.th, { color: T.dim }, s.cAssignee]}>Assigned To</Text>
        <Text style={[s.th, { color: T.dim }, s.cProgress]}>Progress</Text>
        <Text style={[s.th, { color: T.dim }, s.cQuick]}>Set Progress</Text>
        <Text style={[s.th, { color: T.dim }, s.cDue]}>Due</Text>
        <Text style={[s.th, { color: T.dim }, s.cStatus]}>Status</Text>
      </View>

      {items.map(item => {
        const p = item.completionPercentage;
        return (
          <TouchableOpacity
            key={String(item.id)}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('OnboardDetail', { onboardId: item.id })}
            style={[s.tr, { borderTopColor: T.line, borderTopWidth: 1 }]}
          >
            <Text style={[s.tdName, { color: T.text }, s.cSchool]} numberOfLines={1}>
              {item.schoolName}
            </Text>
            <Text style={[s.td, { color: T.sub }, s.cAssignee]} numberOfLines={1}>
              {item.assignedToName || DASH}
            </Text>

            <View style={s.cProgress}>
              <Text style={[s.tdSub, { color: T.text }]} numberOfLines={1}>{p}%</Text>
              <ProgressBar
                value={p}
                height={5}
                color={p >= 100 ? T.success : p >= 50 ? T.info : T.warning}
                trackColor={T.line}
              />
            </View>

            {/* Quick-progress buttons — unchanged behaviour, just relocated. */}
            <View style={[s.cQuick, s.quickRow]}>
              {[25, 50, 75, 100].map(q => (
                <Btn
                  key={q}
                  label={`${q}%`}
                  small
                  variant={p >= q ? 'soft' : 'secondary'}
                  onPress={() => handleQuickProgress(item.id, q)}
                  style={s.quickBtn}
                />
              ))}
            </View>

            <Text
              style={[s.td, { color: p === 100 ? T.success : T.sub }, s.cDue]}
              numberOfLines={1}
            >
              {item.scheduledEndDate ? formatDate(item.scheduledEndDate) : DASH}
            </Text>

            <View style={s.cStatus}>
              <StatusBadge label={item.status} color={statusColor(T, item.status)} />
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderSubTable = () => (
    <View style={[s.tbl, { backgroundColor: T.card, borderColor: T.line }]}>
      <View style={[s.tr, { backgroundColor: T.cardAlt }]}>
        <Text style={[s.th, { color: T.dim }, s.cSubSchool]}>School</Text>
        <Text style={[s.th, { color: T.dim }, s.cPlan]}>Plan</Text>
        <Text style={[s.th, { color: T.dim }, s.cAmount]}>Amount</Text>
        <Text style={[s.th, { color: T.dim }, s.cDays]}>Days Left</Text>
        <Text style={[s.th, { color: T.dim }, s.cSubStatus]}>Status</Text>
        <Text style={[s.th, { color: T.dim }, s.cCred]}>Credentials</Text>
        <Text style={[s.th, { color: T.dim }, s.cSubActions]}>Actions</Text>
      </View>

      {pagedSubs.map(sub => (
        <View key={String(sub.id)} style={[s.tr, { borderTopColor: T.line, borderTopWidth: 1 }]}>
          <View style={s.cSubSchool}>
            <Text style={[s.tdName, { color: T.text }]} numberOfLines={1}>{sub.schoolName}</Text>
            <Text style={[s.tdSub, { color: T.dim }]} numberOfLines={1}>
              FO: {sub.foName || DASH} · Deal #{sub.dealId}
            </Text>
          </View>

          <View style={s.cPlan}>
            <Text style={[s.td, { color: T.sub }]} numberOfLines={1}>{sub.planType || DASH}</Text>
            <Text style={[s.tdSub, { color: T.dim }]} numberOfLines={1}>
              {sub.numberOfLicenses ? `${sub.numberOfLicenses} licenses` : DASH}
            </Text>
          </View>

          <Text style={[s.td, { color: T.text }, s.cAmount]} numberOfLines={1}>
            {sub.amount != null ? `₹${sub.amount.toLocaleString()}` : DASH}
          </Text>
          <Text
            style={[s.td, { color: daysColor(T, sub.daysRemaining) }, s.cDays]}
            numberOfLines={1}
          >
            {sub.daysRemaining ?? DASH}
          </Text>

          <View style={s.cSubStatus}>
            <StatusBadge label={sub.status} color={subStatusColor(T, sub.status)} />
          </View>

          <View style={s.cCred}>
            <StatusBadge
              label={sub.credentialStatus === 'NotProvisioned' ? 'No Credentials' : sub.credentialStatus}
              color={credColor(T, sub.credentialStatus)}
            />
            {sub.credentialStatus === 'Provisioned' && !!sub.schoolLoginEmail && (
              <Text style={[s.tdSub, { color: T.dim }]} numberOfLines={1}>{sub.schoolLoginEmail}</Text>
            )}
          </View>

          <View style={s.cSubActions}>
            {isSCA && sub.credentialStatus === 'NotProvisioned' && (
              <Btn
                label="Provision"
                small
                icon={<Key size={13} color="#FFF" strokeWidth={ICON_STROKE} />}
                onPress={() => {
                  setCredModalId(sub.id);
                  setCredEmail('');
                  setCredPassword('');
                  setShowPassword(false);
                }}
              />
            )}
            {isSCA && sub.credentialStatus === 'Provisioned' && (
              <Btn label="Revoke" variant="dangerGhost" small onPress={() => setRevokeId(sub.id)} />
            )}
          </View>
        </View>
      ))}
    </View>
  );

  const renderProfileTable = () => (
    <View style={[s.tbl, { backgroundColor: T.card, borderColor: T.line }]}>
      <View style={[s.tr, { backgroundColor: T.cardAlt }]}>
        <Text style={[s.th, { color: T.dim }, s.cProfSchool]}>School</Text>
        <Text style={[s.th, { color: T.dim }, s.cAdmin]}>Admin</Text>
        <Text style={[s.th, { color: T.dim }, s.cEmail]}>Email</Text>
        <Text style={[s.th, { color: T.dim }, s.cPhone]}>Phone</Text>
        <Text style={[s.th, { color: T.dim }, s.cFo]}>FO</Text>
        <Text style={[s.th, { color: T.dim }, s.cCreated]}>Created</Text>
        <Text style={[s.th, { color: T.dim }, s.cProfActions]}>Actions</Text>
      </View>

      {pagedProfiles.map(p => (
        <View key={String(p.id)} style={[s.tr, { borderTopColor: T.line, borderTopWidth: 1 }]}>
          <View style={s.cProfSchool}>
            <Text style={[s.tdName, { color: T.text }]} numberOfLines={1}>{p.schoolName}</Text>
            {(p.city || p.state) ? (
              <Text style={[s.tdSub, { color: T.dim }]} numberOfLines={1}>
                {[p.city, p.state].filter(Boolean).join(', ')}
              </Text>
            ) : null}
          </View>
          <Text style={[s.td, { color: T.sub }, s.cAdmin]} numberOfLines={1}>
            {`${p.firstName || ''} ${p.lastName || ''}`.trim() || DASH}
          </Text>
          <Text style={[s.td, { color: T.sub }, s.cEmail]} numberOfLines={1}>{p.userEmail || DASH}</Text>
          <Text style={[s.td, { color: T.sub }, s.cPhone]} numberOfLines={1}>{p.userPhone || DASH}</Text>
          <Text style={[s.td, { color: T.sub }, s.cFo]} numberOfLines={1}>{p.foName || DASH}</Text>
          <Text style={[s.td, { color: T.sub }, s.cCreated]} numberOfLines={1}>
            {formatDate(p.createdAt) || DASH}
          </Text>
          <View style={s.cProfActions}>
            <IconBtn kind="edit" label="Edit profile" onPress={() => handleEditProfile(p)}>
              <Pencil size={14} color={T.sub} strokeWidth={ICON_STROKE} />
            </IconBtn>
          </View>
        </View>
      ))}
    </View>
  );

  /** Phone: the school-profile .lcard row. */
  const renderProfileCard = (p: any) => (
    <ListCard key={String(p.id)} style={s.stackCard}>
      <View style={s.rowTop}>
        <Text style={[s.cardTitle, { color: T.text }]} numberOfLines={1}>{p.schoolName}</Text>
        {(p.city || p.state) ? (
          <View style={[s.locChip, { backgroundColor: withAlpha(T.info, SOFT_TINT) }]}>
            <MapPin size={10} color={T.info} strokeWidth={ICON_STROKE} />
            <Text style={[s.locTxt, { color: T.info }]} numberOfLines={1}>
              {[p.city, p.state].filter(Boolean).join(', ')}
            </Text>
          </View>
        ) : null}
        <IconBtn kind="edit" label="Edit profile" onPress={() => handleEditProfile(p)}>
          <Pencil size={14} color={T.sub} strokeWidth={ICON_STROKE} />
        </IconBtn>
      </View>
      <View style={s.metaGrid}>
        {[
          { label: 'Admin', value: `${p.firstName || ''} ${p.lastName || ''}`.trim() || DASH },
          { label: 'Email', value: p.userEmail || DASH },
          { label: 'Phone', value: p.userPhone || DASH },
          { label: 'FO', value: p.foName || DASH },
          { label: 'Created', value: formatDate(p.createdAt) || DASH },
        ].map(f => (
          <View key={f.label} style={s.metaCell}>
            <Text style={[s.metaLabel, { color: T.dim }]} numberOfLines={1}>{f.label}</Text>
            <Text style={[s.metaVal, { color: T.text }]} numberOfLines={1}>{f.value}</Text>
          </View>
        ))}
      </View>
    </ListCard>
  );

  const tabOptions = [
    { label: 'Onboarding', value: 'onboarding' as const },
    { label: 'Subscriptions', value: 'subscriptions' as const },
    ...(role === 'SCA' ? [{ label: 'School Profiles', value: 'profiles' as const }] : []),
  ];

  const currentFilters = activeTab === 'onboarding' ? ONBOARD_FILTERS : SUB_FILTERS;
  const currentFilter = activeTab === 'onboarding' ? filter : subFilter;
  const setCurrentFilter = activeTab === 'onboarding' ? setFilter : setSubFilter;

  const selectedSchoolLabel = pf.schoolName || 'Tap to select school…';

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: T.bg }]} edges={['top']}>
      <View style={[s.header, wide && s.headerWide]}>
        {/* No in-page title or hamburger — the topbar names the screen and carries
            the menu. The tab bar leads the content, consistent across nav screens. */}
        <Segmented<'onboarding' | 'subscriptions' | 'profiles'>
          value={activeTab}
          options={tabOptions}
          onChange={v => { setActiveTab(v); setFilterOpen(false); }}
          style={wide ? { maxWidth: 460 } : undefined}
        />

        {activeTab !== 'profiles' && (
          <View>
            <Trigger
              label={currentFilter === 'All' ? 'All Statuses' : currentFilter}
              open={filterOpen}
              onPress={() => setFilterOpen(o => !o)}
              style={wide ? { alignSelf: 'flex-start', minWidth: 240 } : undefined}
            />
            {filterOpen && (
              <Dropdown
                style={{ width: wide ? 240 : '100%' }}
                maxHeight={260}
                value={currentFilter}
                onSelect={v => { setCurrentFilter(v); setFilterOpen(false); }}
                options={currentFilters.map(f => ({ label: f === 'All' ? 'All Statuses' : f, value: f }))}
              />
            )}
          </View>
        )}
      </View>

      {/* One scroller for whichever tab is active. These lists are capped at
          PAGE_SIZE rows, so FlatList virtualisation bought nothing and a plain
          ScrollView lets the iPad table render as one bordered block — the same
          shape SchoolsListScreen uses. */}
      <ScrollView
        contentContainerStyle={[s.list, wide && s.listWide]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={
              activeTab === 'onboarding' ? refreshing
                : activeTab === 'subscriptions' ? refreshingSubs
                  : loadingProfiles
            }
            onRefresh={() => {
              if (activeTab === 'onboarding') { setRefreshing(true); fetchItems(itemsPage); }
              else if (activeTab === 'subscriptions') { setRefreshingSubs(true); fetchSubs(); }
              else { fetchProfiles(); }
            }}
            colors={[T.accent]}
            tintColor={T.accent}
          />
        }
      >
        {/* ─── ONBOARDING TAB ─── */}
        {activeTab === 'onboarding' && (
          loading ? (
            <ActivityIndicator color={T.accent} style={s.loader} />
          ) : items.length === 0 ? (
            emptyBlock('No onboarding tasks', 'Assigned tasks will appear here.')
          ) : (
            <>
              {table ? renderOnboardTable() : (
                <View style={s.rowGap}>{items.map(renderOnboardCard)}</View>
              )}
              {pgFooter(itemsPage, itemsPages, itemsTotal, goToItemsPage)}
            </>
          )
        )}

        {/* ─── SUBSCRIPTIONS TAB ─── */}
        {activeTab === 'subscriptions' && (
          loadingSubs ? (
            <ActivityIndicator color={T.accent} style={s.loader} />
          ) : subs.length === 0 ? (
            emptyBlock('No subscriptions', 'Subscriptions will appear here.')
          ) : (
            <>
              {table ? renderSubTable() : (
                <View style={s.rowGap}>{pagedSubs.map(renderSubCard)}</View>
              )}
              {pgFooter(subPage, subPages, subTotal, setSubPage)}
            </>
          )
        )}

        {/* ─── SCHOOL PROFILES TAB (SCA only) ─── */}
        {activeTab === 'profiles' && role === 'SCA' && (
          loadingProfiles ? (
            <ActivityIndicator color={T.accent} style={s.loader} />
          ) : (
            <>
              <View style={s.profHeader}>
                <Text style={[s.count, { color: T.dim, flexShrink: 1, minWidth: 0 }]}>
                  {profileTotal} profile{profileTotal !== 1 ? 's' : ''}
                </Text>
                <View style={s.profActions}>
                  {profileTotal > 0 && (
                    <Btn
                      label={exporting ? 'Exporting…' : 'Export CSV'}
                      variant="secondary"
                      small
                      loading={exporting}
                      onPress={handleExportProfilesCsv}
                      icon={<Download size={13} color={T.text} strokeWidth={ICON_STROKE} />}
                    />
                  )}
                  <Btn
                    label="Add Profile"
                    small
                    onPress={() => { setPf(emptyProfileForm); setEditingProfileId(null); setProfileFormVisible(true); }}
                    icon={<Plus size={14} color="#FFF" strokeWidth={ICON_STROKE} />}
                  />
                </View>
              </View>

              {profileTotal === 0 ? (
                emptyBlock('No school profiles yet', "Tap 'Add Profile' to create one.")
              ) : (
                <>
                  {table ? renderProfileTable() : (
                    <View style={s.rowGap}>{pagedProfiles.map(renderProfileCard)}</View>
                  )}
                  {pgFooter(profilePage, profilePages, profileTotal, setProfilePage)}
                </>
              )}
            </>
          )
        )}
      </ScrollView>

      {/* ─── School Profile Add/Edit ─── */}
      <FormModal
        visible={profileFormVisible}
        wide
        title={editingProfileId ? 'Edit School Profile' : 'Add School Profile'}
        onClose={() => { setProfileFormVisible(false); setEditingProfileId(null); }}
        footer={
          <>
            <View style={{ flex: 1 }} />
            <Btn
              label="Cancel"
              variant="secondary"
              small
              onPress={() => { setProfileFormVisible(false); setEditingProfileId(null); }}
            />
            <Btn
              label={savingProfile ? 'Saving…' : editingProfileId ? 'Update Profile' : 'Save Profile'}
              small
              loading={savingProfile}
              onPress={handleSaveClick}
            />
          </>
        }
      >
        <ScrollView
          style={{ maxHeight: 460 }}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={s.mForm}>
            {!editingProfileId && (
              <Field label="Select School *">
                <Trigger
                  label={selectedSchoolLabel}
                  open={schoolPickerVisible}
                  onPress={() => setSchoolPickerVisible(o => !o)}
                />
                {schoolPickerVisible && (
                  onboardedSchools.length === 0 ? (
                    <View style={[s.hint, { backgroundColor: withAlpha(T.warning, 0.1), borderColor: withAlpha(T.warning, 0.2) }]}>
                      <Text style={[s.hintTxt, { color: T.warning }]}>No onboarded schools found.</Text>
                    </View>
                  ) : (
                    <Dropdown
                      style={{ width: '100%' }}
                      maxHeight={210}
                      value={pf.schoolId}
                      onSelect={v => {
                        const sch = onboardedSchools.find(x => String(x.id) === v);
                        if (sch) handleSchoolSelect(sch);
                      }}
                      options={onboardedSchools.map(sch => ({
                        value: String(sch.id),
                        label: sch.city ? `${sch.name} — ${sch.city}` : String(sch.name),
                      }))}
                    />
                  )
                )}
              </Field>
            )}

            <Text style={[s.sectionHeading, { color: T.accent }]}>User Information</Text>
            <View style={wide ? s.row2 : s.col2}>
              <Input label="First Name *" value={pf.firstName} onChangeText={v => setPf(p => ({ ...p, firstName: v }))} placeholder="First name" containerStyle={{ flex: 1 }} />
              <Input label="Last Name *" value={pf.lastName} onChangeText={v => setPf(p => ({ ...p, lastName: v }))} placeholder="Last name" containerStyle={{ flex: 1 }} />
            </View>
            <View style={wide ? s.row2 : s.col2}>
              <Input label="Phone *" value={pf.userPhone} onChangeText={v => setPf(p => ({ ...p, userPhone: v }))} placeholder="Phone" keyboardType="phone-pad" containerStyle={{ flex: 1 }} />
              <Input label="Email *" value={pf.userEmail} onChangeText={v => setPf(p => ({ ...p, userEmail: v }))} placeholder="Email" keyboardType="email-address" autoCapitalize="none" containerStyle={{ flex: 1 }} />
            </View>
            <Input label="Password *" value={pf.password} onChangeText={v => setPf(p => ({ ...p, password: v }))} placeholder="Password" />
            <Field label="Gender *">
              <Segmented<string>
                value={pf.gender}
                options={GENDERS}
                onChange={v => setPf(p => ({ ...p, gender: v }))}
              />
            </Field>

            <Text style={[s.sectionHeading, { color: T.accent }]}>School Information</Text>
            <Input label="School Name *" value={pf.schoolName} onChangeText={v => setPf(p => ({ ...p, schoolName: v }))} placeholder="School name" />
            <Input label="School Address *" value={pf.schoolAddress} onChangeText={v => setPf(p => ({ ...p, schoolAddress: v }))} placeholder="Address" />
            <View style={wide ? s.row2 : s.col2}>
              <Input label="Area *" value={pf.area} onChangeText={v => setPf(p => ({ ...p, area: v }))} placeholder="Area" containerStyle={{ flex: 1 }} />
              <Input label="City *" value={pf.city} onChangeText={v => setPf(p => ({ ...p, city: v }))} placeholder="City" containerStyle={{ flex: 1 }} />
            </View>
            <View style={wide ? s.row2 : s.col2}>
              <Input label="State *" value={pf.state} onChangeText={v => setPf(p => ({ ...p, state: v }))} placeholder="State" containerStyle={{ flex: 1 }} />
              <Input label="Country *" value={pf.country} onChangeText={v => setPf(p => ({ ...p, country: v }))} placeholder="Country" containerStyle={{ flex: 1 }} />
            </View>
            <View style={wide ? s.row2 : s.col2}>
              <Input label="School Phone *" value={pf.schoolPhone} onChangeText={v => setPf(p => ({ ...p, schoolPhone: v }))} placeholder="Phone" keyboardType="phone-pad" containerStyle={{ flex: 1 }} />
              <Input label="School Email *" value={pf.schoolEmail} onChangeText={v => setPf(p => ({ ...p, schoolEmail: v }))} placeholder="Email" keyboardType="email-address" autoCapitalize="none" containerStyle={{ flex: 1 }} />
            </View>
            <Input label="Zipcode *" value={pf.zipcode} onChangeText={v => setPf(p => ({ ...p, zipcode: v }))} placeholder="Zipcode" keyboardType="number-pad" />

            {/* File upload — spec's dashed drop tile, then the uploaded .file-row. */}
            <Field label="School Logo">
              {pf.schoolLogo ? (
                <View style={[s.fileRow, { backgroundColor: T.card, borderColor: T.line }]}>
                  <Image source={{ uri: pf.schoolLogo }} style={[s.logoPreview, { borderColor: T.line }]} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[s.fileName, { color: T.text }]} numberOfLines={1}>School logo</Text>
                    <Text style={[s.fileMeta, { color: T.sub }]} numberOfLines={1}>
                      {logoUploading ? 'Uploading…' : 'Uploaded'}
                    </Text>
                  </View>
                  <Btn
                    label={logoUploading ? 'Uploading…' : 'Change'}
                    variant="secondary"
                    small
                    loading={logoUploading}
                    onPress={handlePickLogo}
                  />
                </View>
              ) : (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handlePickLogo}
                  disabled={logoUploading}
                  style={[s.upload, { borderColor: T.lineStrong, backgroundColor: T.cardAlt }]}
                >
                  <View style={[s.uploadIcon, { backgroundColor: T.accentSoft }]}>
                    {logoUploading
                      ? <ActivityIndicator size="small" color={T.accent} />
                      : <Upload size={20} color={T.accent} strokeWidth={ICON_STROKE} />}
                  </View>
                  <Text style={[s.uploadTitle, { color: T.text }]}>
                    {logoUploading ? 'Uploading…' : 'Tap to upload a logo'}
                  </Text>
                  <Text style={[s.uploadSub, { color: T.sub }]}>JPG, JPEG or PNG · up to 5 MB</Text>
                </TouchableOpacity>
              )}
            </Field>
          </View>
        </ScrollView>

        {/* Export Format picker — gates the save, mirroring web's format modal.
            Nested inside the form modal so it renders above it. */}
        <FormModal
          visible={formatModalVisible}
          title="Export Format"
          onClose={() => setFormatModalVisible(false)}
          footer={
            <>
              <View style={{ flex: 1 }} />
              <Btn label="Cancel" variant="secondary" small onPress={() => setFormatModalVisible(false)} />
            </>
          }
        >
          <View style={s.mForm}>
            <Text style={[s.mSub, { color: T.sub }]}>
              Choose a format to export and send via email
            </Text>
            <View style={s.formatRow}>
              <Btn label="CSV" onPress={() => handleSaveAndSend('csv')} style={{ flex: 1 }} />
              <Btn label="Excel" variant="soft" onPress={() => handleSaveAndSend('excel')} style={{ flex: 1 }} />
            </View>
          </View>
        </FormModal>
      </FormModal>

      {/* ─── Credential Provisioning ─── */}
      <FormModal
        visible={!!credModalId}
        title="Provision School Credentials"
        onClose={() => setCredModalId(null)}
        footer={
          <>
            <View style={{ flex: 1 }} />
            <Btn label="Cancel" variant="secondary" small onPress={() => setCredModalId(null)} />
            <Btn
              label={provisioning ? 'Provisioning…' : 'Provision'}
              small
              loading={provisioning}
              onPress={handleProvision}
              icon={<Key size={13} color="#FFF" strokeWidth={ICON_STROKE} />}
            />
          </>
        }
      >
        <View style={s.mForm}>
          <Text style={[s.mSub, { color: T.sub }]}>Enter the login details for the school portal</Text>
          <Input
            label="School Login Email *"
            value={credEmail}
            onChangeText={setCredEmail}
            placeholder="school@educrm.in"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Input
            label="School Login Password *"
            value={credPassword}
            onChangeText={setCredPassword}
            placeholder="Enter password"
            secureTextEntry={!showPassword}
            right={
              <TouchableOpacity onPress={() => setShowPassword(p => !p)} hitSlop={10}>
                {showPassword
                  ? <EyeOff size={17} color={T.sub} strokeWidth={ICON_STROKE} />
                  : <Eye size={17} color={T.sub} strokeWidth={ICON_STROKE} />}
              </TouchableOpacity>
            }
          />
        </View>
      </FormModal>

      <ConfirmModal
        visible={revokeId != null}
        tone="danger"
        title="Revoke Credentials"
        message="Are you sure you want to revoke credentials? The school will lose portal access immediately."
        icon={<ShieldAlert size={24} color={T.danger} strokeWidth={ICON_STROKE} />}
        confirmLabel="Revoke"
        onConfirm={handleRevoke}
        onCancel={() => setRevokeId(null)}
      />
    </SafeAreaView>
  );
};

// ─── Styles (layout only — colour is applied inline from the theme) ────────────
const s = StyleSheet.create({
  safe: { flex: 1 },

  header: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 10, gap: 10 },
  headerWide: { paddingHorizontal: 22 },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: rf(20), fontWeight: '800', letterSpacing: -0.4 },
  subtitle: { fontSize: rf(12), fontWeight: '500', marginTop: 2 },

  list: { padding: 14, paddingTop: 4, gap: 10 },
  listWide: { paddingHorizontal: 22 },
  rowGap: { gap: 10 },
  loader: { marginTop: 48 },

  // ── table — .tbl r16 · .th cardAlt 11/700/.4 upper · .tr borderTop line ──
  tbl: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  tr: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16 },
  th: { fontSize: rf(11), fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  td: { fontSize: rf(13), fontWeight: '500' },
  tdName: { fontSize: rf(13.5), fontWeight: '700' },
  tdSub: { fontSize: rf(11.5), fontWeight: '500', marginTop: 1 },

  /**
   * Column bases. Each is applied to BOTH the header <Text> and its body cell — that
   * pairing is the whole reason the data lines up under its own heading.
   */
  // onboarding
  cSchool: { flex: 2 },
  cAssignee: { flex: 1.4 },
  cProgress: { flex: 1.4, gap: 4 },
  cQuick: { width: 188 },
  cDue: { flex: 1 },
  cStatus: { flex: 1.1 },
  quickBtn: { flex: 1, paddingHorizontal: 0 },
  // subscriptions
  cSubSchool: { flex: 2 },
  cPlan: { flex: 1.2 },
  cAmount: { flex: 1 },
  cDays: { flex: 0.8 },
  cSubStatus: { flex: 1 },
  cCred: { flex: 1.4 },
  cSubActions: { width: 116 },
  // school profiles
  cProfSchool: { flex: 1.8 },
  cAdmin: { flex: 1.3 },
  cEmail: { flex: 1.8 },
  cPhone: { flex: 1.1 },
  cFo: { flex: 1.1 },
  cCreated: { flex: 1 },
  cProfActions: { width: 44 },

  pgRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },

  // cards
  stackCard: { flexDirection: 'column', alignItems: 'stretch', gap: 8 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  cardTitle: { fontSize: rf(14), fontWeight: '700', flexShrink: 1, minWidth: 0 },
  cardMeta: { fontSize: rf(12), fontWeight: '500', flexShrink: 1, minWidth: 0 },
  cardFoot: { fontSize: rf(11.5), fontWeight: '600' },
  subMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },

  progressHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  quickRow: { flexDirection: 'row', gap: 6 },

  // stat tiles
  grid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch' },
  tile: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 9, gap: 2 },
  tileLabel: { fontSize: rf(10), fontWeight: '700', letterSpacing: 0.3, textTransform: 'uppercase' },
  tileVal: { fontSize: rf(13.5), fontWeight: '800' },

  inlineRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  metaLabel: { fontSize: rf(10.5), fontWeight: '600' },
  metaVal: { fontSize: rf(12.5), fontWeight: '700' },
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 8 },
  metaCell: { width: '50%', paddingRight: 8 },

  note: { borderRadius: 12, borderWidth: 1, padding: 10, gap: 2 },
  noteLabel: { fontSize: rf(10.5), fontWeight: '700' },
  noteVal: { fontSize: rf(13), fontWeight: '700' },
  noteMeta: { fontSize: rf(11), fontWeight: '500' },
  revoked: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, borderWidth: 1, padding: 10 },

  actionStrip: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', borderTopWidth: 1, paddingTop: 10 },

  // profiles header
  profHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  count: { fontSize: rf(11.5), fontWeight: '600' },
  profActions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  locChip: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 22, paddingHorizontal: 9, borderRadius: 11, flexShrink: 1, minWidth: 0 },
  locTxt: { fontSize: rf(10.5), fontWeight: '700', flexShrink: 1, minWidth: 0 },

  empty: { borderRadius: 16, borderWidth: 1, paddingVertical: 46, paddingHorizontal: 24, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: rf(14), fontWeight: '700' },
  emptyTxt: { fontSize: rf(12.5), fontWeight: '500', textAlign: 'center' },

  // modals
  mForm: { gap: 14 },
  mSub: { fontSize: rf(12), fontWeight: '500' },
  sectionHeading: { fontSize: rf(11), fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  row2: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  col2: { gap: 14 },
  hint: { padding: 10, borderRadius: 13, borderWidth: 1, marginTop: 8 },
  hintTxt: { fontSize: rf(12), fontWeight: '600' },
  formatRow: { flexDirection: 'row', gap: 10 },

  // file upload — spec's .upload dashed tile + .file-row
  upload: {
    borderWidth: 1.6, borderStyle: 'dashed', borderRadius: 16,
    paddingVertical: 22, paddingHorizontal: 16, alignItems: 'center', gap: 8,
  },
  uploadIcon: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  uploadTitle: { fontSize: rf(13.5), fontWeight: '700', textAlign: 'center' },
  uploadSub: { fontSize: rf(11.5), fontWeight: '500', textAlign: 'center' },
  fileRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, paddingHorizontal: 12, borderRadius: 13, borderWidth: 1,
  },
  logoPreview: { width: 44, height: 44, borderRadius: 11, borderWidth: 1 },
  fileName: { fontSize: rf(13), fontWeight: '700' },
  fileMeta: { fontSize: rf(11.5), fontWeight: '500' },
});
