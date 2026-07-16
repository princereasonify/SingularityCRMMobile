import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
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
import { LogoutModal } from './LogoutModal';

const brandLogo = require('../../asset/Images/image.png');

export const CustomDrawerContent = (props: DrawerContentComponentProps) => {
  const { logout } = useAuth();
  const insets = useSafeAreaInsets();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleLogout = () => {
    setShowLogoutModal(false);
    // Let the modal finish its dismiss animation BEFORE logout() clears the user —
    // clearing the user unmounts this whole drawer, and tearing down a <Modal> that
    // is still animating crashes natively on iOS. The small delay lets it close first.
    setTimeout(() => logout(), 350);
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

      {/* ── Themed Logout Modal (shared, Sunstone) ── */}
      <LogoutModal
        visible={showLogoutModal}
        onCancel={() => setShowLogoutModal(false)}
        onConfirm={handleLogout}
      />
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
});
