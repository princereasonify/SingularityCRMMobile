/**
 * A lead's live Reasonify coin balance — mobile twin of web's components/b2c/CoinBalance.jsx.
 *
 * NULL IS NOT ZERO: the backend sends null when the lead never provisioned a Reasonify
 * account, the account has no wallet, or Reasonify didn't answer; a real 0 is a student who
 * has spent everything. Printing "0" for the unknown cases would send an agent chasing a
 * recharge that isn't owed, so unknown renders as a dash instead.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Coins } from 'lucide-react-native';
import { useAppTheme } from '../../theme/useAppTheme';
import { AppTheme } from '../../theme';
import { rf } from '../../utils/responsive';
import { ICON_STROKE } from '../common/Icon';

/** Mirrors LowBalanceThreshold in Reasonify's WalletController. */
const LOW_BALANCE = 50;

/** Out of coins is the one state a salesperson has to act on, so it's the one that shouts.
 *  The icon itself is always warm-toned (never neutral) — matches web's iconTone exactly. */
export const coinIconTone = (T: AppTheme, value?: number | null): string =>
  value != null && value <= 0 ? T.danger : T.warning;

export const coinValueTone = (T: AppTheme, value?: number | null): string =>
  value == null ? T.dim : value <= 0 ? T.danger : value < LOW_BALANCE ? T.warning : T.text;

export const coinBalanceText = (value?: number | null): string =>
  value == null ? '—' : value.toLocaleString('en-IN');

/** Compact icon+value badge for list/card rows. */
export const CoinBalance = ({ value }: { value?: number | null }) => {
  const T = useAppTheme();
  if (value == null) {
    return <Text style={[styles.value, { color: T.dim }]}>—</Text>;
  }
  return (
    <View style={styles.row}>
      <Coins size={12} color={coinIconTone(T, value)} strokeWidth={ICON_STROKE} />
      <Text style={[styles.value, { color: coinValueTone(T, value) }]}>{coinBalanceText(value)}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  value: { fontWeight: '700', fontSize: rf(12) },
});

export default CoinBalance;
