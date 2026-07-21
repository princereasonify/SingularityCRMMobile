/**
 * Logout confirmation.
 *
 * This used to be a bespoke modal with its own scrim, radius and buttons. It is now
 * a thin wrapper over the CRUD kit's `ConfirmModal`, so the sign-out prompt shares
 * one surface with "Delete target", "Reject claim", etc.
 *
 * DELIBERATE DEVIATION — tone is `accent` (the Sunstone gradient), NOT `danger`.
 * The user explicitly chose the gradient confirm button here over the spec's solid
 * error red. Signing out is reversible and routine, unlike the destructive deletes
 * that own the red button, so it does not read as a warning. Do not "fix" this to
 * danger tone; it has been changed back once already.
 * The icon tile stays red-tinted so the action still reads as an exit.
 *
 * Kept as a named component rather than inlining ConfirmModal at each call site
 * because six screens use it (AppSidebar, AppTopbar, SettingsScreen and the RH/SH/SCA
 * dashboards) — one definition keeps the copy and the tone identical everywhere.
 * The props are unchanged, so those call sites needed no edit.
 */
import React from 'react';
import { LogOut } from 'lucide-react-native';
import { ConfirmModal } from '../crud';
import { ICON_STROKE } from './Icon';
import { useAppTheme } from '../../theme/useAppTheme';

interface Props {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export const LogoutModal = ({ visible, onCancel, onConfirm }: Props) => {
  const T = useAppTheme();
  return (
    <ConfirmModal
      visible={visible}
      tone="accent"
      title="Sign out?"
      message="You'll be signed out on this device and returned to the login screen."
      icon={<LogOut size={24} color={T.danger} strokeWidth={ICON_STROKE} />}
      confirmLabel="Sign out"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
};
