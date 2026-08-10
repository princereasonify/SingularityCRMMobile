/**
 * My Profile — who you are and where you sit in the org.
 *
 * Split from Settings deliberately: the topbar menu offers "My profile" and
 * "Settings" but both used to navigate to `Settings`, so the two entries were
 * indistinguishable. Settings owns *preferences* (language, notifications,
 * offline, admin config); this screen owns *identity* (account, org placement,
 * base location). No overlap in either direction.
 *
 * Reads `useAuth().user` — the UserDto persisted at login — so it needs no new
 * endpoint. There is no `/auth/me` or `/auth/change-password` on the backend
 * (verified against AuthController), which is why nothing here is editable.
 */
import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, useWindowDimensions,
  Image, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { launchImageLibrary } from 'react-native-image-picker';
import {
  ArrowLeft, Mail, Phone, MapPin, Building2, Users, ShieldCheck, ChevronRight, Home, Camera, AlertTriangle,
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../api/auth';
import { Card } from '../../components/ui';
import { IconBtn, StatusBadge, ConfirmModal } from '../../components/crud';
import { ICON_STROKE } from '../../components/common/Icon';
import { rf, isTabletDevice } from '../../utils/responsive';
import { useAppTheme } from '../../theme/useAppTheme';
import { withAlpha, SOFT_TINT } from '../../theme';

const ROLE_LABEL: Record<string, string> = {
  FO: 'Field Officer',
  ZH: 'Zonal Head',
  RH: 'Regional Head',
  SH: 'Sales Head',
  SCA: 'Sales Control Admin',
  B2CAdmin: 'B2C Admin',
  Agent: 'Sales Agent',
  Counselor: 'Counselor',
};
const B2C_ROLES = ['B2CAdmin', 'Agent', 'Counselor'];

export const ProfileScreen = ({ navigation }: any) => {
  const T = useAppTheme();
  const insets = useSafeAreaInsets();
  const { user, updateUser } = useAuth();
  // B2C accounts live in a separate table with no avatar/home-location/org endpoints,
  // so those B2B-only bits are hidden for them (they'd 401 / dead-navigate otherwise).
  const isB2C = B2C_ROLES.includes(user?.role || '');
  const { width, height } = useWindowDimensions();
  const wide = isTabletDevice && width > height;

  const initials = (user?.name || '?')
    .split(' ')
    .map(p => p.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();

  // `User.Avatar` was always a column with nothing writing to it; POST /auth/avatar
  // now fills it. Optimistic local preview so the picture appears immediately —
  // reverted if the upload fails, so we never show a picture the server didn't take.
  //
  // The column predates the endpoint and DbSeeder still writes INITIALS into it
  // ("PP", "SK", "MG", "BN"), which login maps straight onto UserDto.Avatar. Feeding
  // that to <Image source={{uri:'PP'}}> is a silently-failing load, so seeded accounts
  // showed an empty circle instead of falling back to their initials. Only treat the
  // value as a picture if it is actually fetchable.
  const isImageSrc = (v?: string | null) =>
    !!v && (/^https?:\/\//i.test(v) || v.startsWith('file:') || v.startsWith('content:') || v.startsWith('data:'));

  const [avatar, setAvatar] = useState<string | null>(
    isImageSrc(user?.avatar) ? (user?.avatar as string) : null,
  );
  const [uploading, setUploading] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  const pickAvatar = async () => {
    const res = await launchImageLibrary({ mediaType: 'photo', quality: 0.8, selectionLimit: 1 });
    const asset = res.assets?.[0];
    const uri = asset?.uri;
    if (!uri) return;

    const previous = avatar;
    setAvatar(uri);
    setUploading(true);
    try {
      // Pass the picker's real mime + filename so the backend gets the correct type.
      const up = await authApi.uploadAvatar(uri, asset?.type, asset?.fileName);
      const url = up.data?.avatar || uri;
      setAvatar(url);
      // Persist to the auth context AND to AsyncStorage. Without this the new
      // picture lived only in this screen's state: navigating away and back
      // re-read the stale `auth_user` row and the old avatar came straight back.
      await updateUser({ avatar: url });
    } catch (err: any) {
      setAvatar(previous);
      Alert.alert('Upload failed', err?.response?.data?.message || 'Could not update your picture.');
    } finally {
      setUploading(false);
    }
  };

  const removeAvatar = () => setShowRemoveConfirm(true);

  const doRemoveAvatar = async () => {
    setShowRemoveConfirm(false);
    const previous = avatar;
    setAvatar(null); // optimistic — fall back to initials immediately
    setUploading(true);
    try {
      await authApi.removeAvatar();
      // Persist the initials the server now stores, so it survives navigation.
      await updateUser({ avatar: initials });
    } catch (err: any) {
      setAvatar(previous);
      Alert.alert('Remove failed', err?.response?.data?.message || 'Could not remove your picture.');
    } finally {
      setUploading(false);
    }
  };

  // `last` drops the divider on the final row of a section — otherwise every card
  // ended with a hairline floating in its bottom padding, separating nothing.
  const Row = ({
    icon, label, value, onPress, last,
  }: {
    icon: React.ReactNode; label: string; value?: string | null; onPress?: () => void; last?: boolean;
  }) => {
    const body = (
      <View style={[styles.row, { borderBottomColor: T.line }, last && styles.rowLast]}>
        <View style={[styles.rowIcon, { backgroundColor: T.accentSoft }]}>{icon}</View>
        <View style={styles.rowText}>
          <Text style={[styles.rowLabel, { color: T.dim }]} numberOfLines={1}>{label}</Text>
          {/* flexShrink:1 — RN defaults to 0, so a long value would paint over the chevron. */}
          <Text style={[styles.rowValue, { color: value ? T.text : T.dim }]} numberOfLines={1}>
            {value || '—'}
          </Text>
        </View>
        {onPress && <ChevronRight size={16} color={T.dim} strokeWidth={ICON_STROKE} />}
      </View>
    );
    return onPress
      ? <TouchableOpacity activeOpacity={0.75} onPress={onPress}>{body}</TouchableOpacity>
      : body;
  };

  return (
    <View style={[styles.root, { backgroundColor: T.bg }]}>
      {/* Plain themed title block on T.bg — matches every other page. The drawer
          topbar supplies the nav chrome, so this must NOT re-apply insets.top. */}
      <View style={styles.header}>
        <IconBtn kind="view" label="Back" onPress={() => navigation.goBack()}>
          <ArrowLeft size={16} color={T.accent} strokeWidth={ICON_STROKE} />
        </IconBtn>
        <View style={styles.headerTextWrap}>
          <Text style={[styles.headerTitle, { color: T.text }]} numberOfLines={1}>My Profile</Text>
          <Text style={[styles.headerSub, { color: T.sub }]} numberOfLines={1}>
            Your account and organisation details
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 28, gap: 12 }}
        showsVerticalScrollIndicator={false}
      >
        {/*
          `gap` must live on THIS view, not on the ScrollView's contentContainer.
          The container's gap:12 only ever applied between its own children, and it
          has exactly one child — this wrapper — so in portrait (where `wide` is
          false and no style was applied at all) every card stacked flush against
          the next with zero spacing. Only the max-width centring is conditional.
        */}
        <View style={[styles.stack, wide && styles.centeredWide]}>
          <Card style={styles.identity}>
            <TouchableOpacity activeOpacity={0.8} onPress={pickAvatar} disabled={isB2C || uploading}>
              <View style={[styles.avatar, { backgroundColor: T.accentSoft }]}>
                {avatar ? (
                  // onError → drop back to initials rather than leaving a blank circle
                  // if the stored URL 404s (bucket object deleted, stale seed value).
                  <Image source={{ uri: avatar }} style={styles.avatarImg} onError={() => setAvatar(null)} />
                ) : (
                  <Text style={[styles.avatarTxt, { color: T.accent }]}>{initials}</Text>
                )}
                {/* Avatar upload is a B2B-only endpoint — no edit affordance for B2C. */}
                {!isB2C && (
                  <View style={[styles.avatarEdit, { backgroundColor: T.accent, borderColor: T.card }]}>
                    {uploading
                      ? <ActivityIndicator size="small" color={T.onAccent} />
                      : <Camera size={13} color={T.onAccent} strokeWidth={2} />}
                  </View>
                )}
              </View>
            </TouchableOpacity>
            <Text style={[styles.name, { color: T.text }]} numberOfLines={1}>{user?.name || '—'}</Text>
            <Text style={[styles.email, { color: T.sub }]} numberOfLines={1}>{user?.email || '—'}</Text>
            {/* Remove only appears when a real photo is set — tapping the avatar changes it. */}
            {!!avatar && !uploading && !isB2C && (
              <TouchableOpacity onPress={removeAvatar} hitSlop={8} style={styles.removeBtn}>
                <Text style={[styles.removeTxt, { color: T.danger }]}>Remove photo</Text>
              </TouchableOpacity>
            )}
            <View style={styles.badges}>
              <StatusBadge label={ROLE_LABEL[user?.role || ''] || user?.role || '—'} color={T.info} />
              <StatusBadge label="Active" color={T.success} />
            </View>
          </Card>

          <Card style={styles.section}>
            <Text style={[styles.sectionTitle, { color: T.text }]}>Account</Text>
            <Row icon={<Mail size={15} color={T.accent} strokeWidth={ICON_STROKE} />} label="Email" value={user?.email} />
            <Row icon={<Phone size={15} color={T.accent} strokeWidth={ICON_STROKE} />} label="Phone" value={user?.phoneNumber} />
            <Row
              icon={<ShieldCheck size={15} color={T.accent} strokeWidth={ICON_STROKE} />}
              label="Role"
              value={ROLE_LABEL[user?.role || ''] || user?.role}
              last
            />
          </Card>

          {/* Organisation (zones/regions) is a B2B concept — hidden for B2C accounts. */}
          {!isB2C && (
          <Card style={styles.section}>
            <Text style={[styles.sectionTitle, { color: T.text }]}>Organisation</Text>
            <Row icon={<MapPin size={15} color={T.accent} strokeWidth={ICON_STROKE} />} label="Zone" value={user?.zone} />
            <Row icon={<Building2 size={15} color={T.accent} strokeWidth={ICON_STROKE} />} label="Region" value={user?.region} />
            <Row icon={<Users size={15} color={T.accent} strokeWidth={ICON_STROKE} />} label="Zonal Head" value={user?.zonalHead} />
            <Row icon={<Users size={15} color={T.accent} strokeWidth={ICON_STROKE} />} label="Regional Head" value={user?.regionalHead} last />
          </Card>
          )}

          {/* Base Location / travel-allowance is B2B-only (Home Location route + endpoint). */}
          {!isB2C && (
          <Card style={styles.section}>
            <Text style={[styles.sectionTitle, { color: T.text }]}>Base Location</Text>
            <Row
              icon={<Home size={15} color={T.accent} strokeWidth={ICON_STROKE} />}
              label="Home location"
              value="Set your travel-allowance start point"
              onPress={() => navigation.navigate('Home Location')}
              last
            />
            <Text style={[styles.hint, { color: T.dim }]}>
              Travel allowance is measured from here, so keep it accurate.
            </Text>
          </Card>
          )}

          <View style={[styles.note, { backgroundColor: withAlpha(T.info, SOFT_TINT) }]}>
            <Text style={[styles.noteTxt, { color: T.info }]}>
              To change your name, email or role, contact your administrator.
            </Text>
          </View>
        </View>
      </ScrollView>

      <ConfirmModal
        visible={showRemoveConfirm}
        title="Remove photo"
        message="Remove your profile picture? Your initials will show instead."
        icon={<AlertTriangle size={22} color={T.danger} strokeWidth={ICON_STROKE} />}
        tone="danger"
        confirmLabel="Remove"
        onConfirm={doRemoveAvatar}
        onCancel={() => setShowRemoveConfirm(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  headerTextWrap: { flex: 1, minWidth: 0 },
  headerTitle: { fontSize: rf(20), fontWeight: '700', letterSpacing: -0.4 },
  headerSub: { fontSize: rf(12.5), fontWeight: '400', marginTop: 1 },

  scroll: { flex: 1 },
  stack: { gap: 12 },
  centeredWide: { maxWidth: 720, alignSelf: 'center', width: '100%' },

  identity: { alignItems: 'center', paddingVertical: 20, gap: 6 },
  avatar: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: 72, height: 72, borderRadius: 36 },
  avatarTxt: { fontSize: rf(24), fontWeight: '800', letterSpacing: -0.5 },
  avatarEdit: {
    position: 'absolute', right: -2, bottom: -2,
    width: 26, height: 26, borderRadius: 13, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  name: { fontSize: rf(18), fontWeight: '700', letterSpacing: -0.3, marginTop: 6 },
  email: { fontSize: rf(13), fontWeight: '400' },
  badges: { flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap', justifyContent: 'center' },
  removeBtn: { marginTop: 8, paddingVertical: 2 },
  removeTxt: { fontSize: rf(12.5), fontWeight: '600' },

  section: { gap: 0 },
  sectionTitle: { fontSize: rf(14), fontWeight: '700', marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth },
  rowLast: { borderBottomWidth: 0 },
  rowIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  rowText: { flex: 1, minWidth: 0 },
  rowLabel: { fontSize: rf(11), fontWeight: '600' },
  rowValue: { fontSize: rf(13.5), fontWeight: '600', marginTop: 1, flexShrink: 1 },

  hint: { fontSize: rf(11.5), fontWeight: '400', marginTop: 8, lineHeight: 16 },
  note: { borderRadius: 12, padding: 12, marginTop: 2 },
  noteTxt: { fontSize: rf(12), fontWeight: '500', lineHeight: 17 },
});
