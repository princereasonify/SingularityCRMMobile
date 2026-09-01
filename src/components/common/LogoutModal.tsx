/**
 * Logout confirmation — a bespoke card (gradient icon ring, its own shape), not another
 * instance of the generic `ConfirmModal` shared by every delete/reject dialog in the app.
 * Six screens use it (AppSidebar, AppTopbar, SettingsScreen, RH/SH/SCA dashboards) with the
 * same `{ visible, onCancel, onConfirm }` props as before, so none of those call sites
 * needed editing.
 *
 * DELIBERATE — the confirm button stays the same Sunstone gradient (`Btn variant="primary"`)
 * it already used, NOT red/danger: signing out is reversible and routine, unlike the
 * destructive deletes that own the red button, so it should not read as a warning. This has
 * been reverted to danger tone once already by mistake — do not "fix" it back.
 */
import React from 'react';
import { Modal, Pressable, View, Text, StyleSheet } from 'react-native';
import { LogOut } from 'lucide-react-native';
import { Btn } from '../crud';
import { GradientBackground } from './GradientBackground';
import { ICON_STROKE } from './Icon';
import { useAppTheme } from '../../theme/useAppTheme';
import { rf } from '../../utils/responsive';

interface Props {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export const LogoutModal = ({ visible, onCancel, onConfirm }: Props) => {
  const T = useAppTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={s.scrim} onPress={onCancel}>
        <Pressable onPress={() => {}} style={[s.card, { backgroundColor: T.card }]}>
          <GradientBackground glow={false} style={s.iconRing}>
            <LogOut size={28} color="#FFF" strokeWidth={ICON_STROKE} />
          </GradientBackground>
          <Text style={[s.title, { color: T.text }]}>Sign out?</Text>
          <Text style={[s.msg, { color: T.sub }]}>
            You'll be signed out on this device and returned to the login screen.
          </Text>
          <View style={s.row}>
            <Btn label="Cancel" variant="secondary" onPress={onCancel} style={s.flex} />
            <Btn label="Sign out" variant="primary" onPress={onConfirm} style={s.flex} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const s = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(20,15,8,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    width: '100%', maxWidth: 340, borderRadius: 28, padding: 26, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.22, shadowRadius: 40, elevation: 16,
  },
  iconRing: {
    width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#8C5A2E', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8,
  },
  title: { fontSize: rf(18), fontWeight: '800', letterSpacing: -0.3 },
  msg: { fontSize: rf(13), fontWeight: '500', textAlign: 'center', lineHeight: 19, marginTop: 8, marginBottom: 22 },
  row: { flexDirection: 'row', gap: 10, width: '100%' },
  flex: { flex: 1 },
});
