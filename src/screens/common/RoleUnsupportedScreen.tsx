/**
 * Shown instead of a drawer for a signed-in role the mobile app has no screens for yet
 * (currently: CallingAgent — desk-based call-centre staff, fully built on web).
 *
 * Before this existed, `getRoleNavigator`'s `default` case silently handed such a user
 * the Field Officer drawer with an empty sidebar underneath (NAV_BY_ROLE has no entry
 * for the role) — B2B screens scoped to a role that isn't one, guaranteed 403s. This is
 * the graceful version: explain the gap and offer the one thing that's still safe to do,
 * signing out.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Laptop } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useAppTheme } from '../../theme/useAppTheme';
import { GradientBackground } from '../../components/common/GradientBackground';
import { LogoutModal } from '../../components/common/LogoutModal';
import { SingularityLogo } from '../../components/common/SingularityLogo';
import { ICON_STROKE } from '../../components/common/Icon';
import { Btn } from '../../components/crud';
import { rf } from '../../utils/responsive';

const ROLE_LABEL: Record<string, string> = {
  CallingAgent: 'Calling Agent',
};

export const RoleUnsupportedScreen = () => {
  const T = useAppTheme();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const roleLabel = ROLE_LABEL[user?.role ?? ''] ?? user?.role ?? 'This role';

  return (
    <View style={[styles.root, { backgroundColor: T.bg, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <SingularityLogo size={36} />
      <View style={styles.center}>
        <GradientBackground glow={false} style={styles.iconRing}>
          <Laptop size={30} color="#FFF" strokeWidth={ICON_STROKE} />
        </GradientBackground>
        <Text style={[styles.title, { color: T.text }]}>Not available on mobile yet</Text>
        <Text style={[styles.msg, { color: T.sub }]}>
          The {roleLabel} workspace — call queue, parent requests, caller assignments — is
          currently only on the SalesCRM web app. Sign in from a desktop browser to continue.
        </Text>
        {!!user?.name && (
          <Text style={[styles.signedInAs, { color: T.dim }]}>
            Signed in as {user.name} · {roleLabel}
          </Text>
        )}
      </View>
      <Btn label="Sign Out" variant="secondary" onPress={() => setConfirmOpen(true)} style={styles.signOutBtn} />
      <LogoutModal
        visible={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => { setConfirmOpen(false); logout(); }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', paddingHorizontal: 28 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', maxWidth: 380 },
  iconRing: {
    width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#8C5A2E', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8,
  },
  title: { fontSize: rf(20), fontWeight: '800', letterSpacing: -0.4, textAlign: 'center' },
  msg: { fontSize: rf(14), fontWeight: '500', textAlign: 'center', lineHeight: 21, marginTop: 10 },
  signedInAs: { fontSize: rf(12), fontWeight: '600', textAlign: 'center', marginTop: 18 },
  signOutBtn: { width: '100%', maxWidth: 280 },
});

export default RoleUnsupportedScreen;
