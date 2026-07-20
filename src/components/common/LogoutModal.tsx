import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { LogOut } from 'lucide-react-native';
import { rf } from '../../utils/responsive';
import { useAppTheme } from '../../theme/useAppTheme';

import { GradientBackground } from './GradientBackground';

interface Props {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export const LogoutModal = ({ visible, onCancel, onConfirm }: Props) => {
  const T = useAppTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable
          style={[styles.modal, { backgroundColor: T.card, borderColor: T.line }]}
          onPress={() => {}}
        >
          <View style={[styles.iconWrap, { backgroundColor: T.accentSoft }]}>
            <LogOut size={28} color={T.accent} />
          </View>
          <Text style={[styles.title, { color: T.text }]}>Logout</Text>
          <Text style={[styles.message, { color: T.sub }]}>
            Are you sure you want to logout from your account?
          </Text>
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.cancelBtn, { backgroundColor: T.cardAlt, borderColor: T.line }]}
              onPress={onCancel}
              activeOpacity={0.7}
            >
              <Text style={[styles.cancelText, { color: T.text }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={onConfirm} activeOpacity={0.85}>
              <GradientBackground glow={false} style={StyleSheet.absoluteFillObject} />
              <Text style={styles.confirmText}>Yes, Logout</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  modal: {
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 28,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18,
    shadowRadius: 32,
    elevation: 12,
  },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontWeight: '700',
    fontSize: rf(20),
    marginBottom: 8,
  },
  message: {
    fontWeight: '400',
    fontSize: rf(13),
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontWeight: '600',
    fontSize: rf(14),
  },
  confirmBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: {
    fontWeight: '700',
    fontSize: rf(14),
    color: '#FFF',
  },
});
