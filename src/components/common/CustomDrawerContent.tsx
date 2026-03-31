import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  DrawerContentScrollView,
  DrawerItemList,
  DrawerContentComponentProps,
} from '@react-navigation/drawer';
import { LogOut } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { rf } from '../../utils/responsive';

const brandLogo = require('../../asset/Images/image.png');

export const CustomDrawerContent = (props: DrawerContentComponentProps) => {
  const { logout } = useAuth();
  const insets = useSafeAreaInsets();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleLogout = () => {
    setShowLogoutModal(false);
    logout();
  };

  return (
    <View style={styles.container}>
      {/* ── Fixed Header with Logo ── */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.logoWrap}>
          <Image source={brandLogo} style={styles.logoImg} resizeMode="cover" />
        </View>
        <View>
          <Text style={styles.brandName}>SINGULARITY</Text>
          <Text style={styles.brandSub}>CRM</Text>
        </View>
      </View>
      <View style={styles.divider} />

      {/* ── Scrollable Menu Items ── */}
      <DrawerContentScrollView
        {...props}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}
      >
        <DrawerItemList {...props} />
      </DrawerContentScrollView>

      {/* ── Fixed Footer with Logout ── */}
      <View style={styles.divider} />
      <TouchableOpacity
        style={[styles.logoutBtn, { paddingBottom: Math.max(insets.bottom, 16) }]}
        onPress={() => setShowLogoutModal(true)}
        activeOpacity={0.7}
      >
        <LogOut size={20} color="#DC2626" />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      {/* ── Custom Logout Modal ── */}
      <Modal visible={showLogoutModal} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setShowLogoutModal(false)}>
          <Pressable style={styles.modal} onPress={() => {}}>
            <View style={styles.modalIconWrap}>
              <LogOut size={28} color="#DC2626" />
            </View>
            <Text style={styles.modalTitle}>Logout</Text>
            <Text style={styles.modalMessage}>
              Are you sure you want to logout from your account?
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowLogoutModal(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={handleLogout}
                activeOpacity={0.7}
              >
                <Text style={styles.confirmBtnText}>Yes, Logout</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 14,
  },
  logoWrap: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#000',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImg: {
    width: 50,
    height: 46,
  },
  brandName: {
    fontSize: rf(16),
    fontWeight: '800',
    color: '#111827',
    letterSpacing: 1,
  },
  brandSub: {
    fontSize: rf(11),
    fontWeight: '600',
    color: '#6B7280',
    letterSpacing: 2,
    marginTop: -2,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 4,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginBottom: 8,
  },
  logoutText: {
    fontSize: rf(14),
    fontWeight: '600',
    color: '#DC2626',
  },

  // ── Logout Modal ──
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  modal: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 28,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.15,
    shadowRadius: 32,
    elevation: 12,
  },
  modalIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: rf(20),
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: rf(13),
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: rf(14),
    fontWeight: '600',
    color: '#374151',
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: '#DC2626',
    alignItems: 'center',
  },
  confirmBtnText: {
    fontSize: rf(14),
    fontWeight: '600',
    color: '#FFF',
  },
});
