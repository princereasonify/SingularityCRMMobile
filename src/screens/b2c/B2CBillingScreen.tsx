import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, Alert, Linking, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Wallet, Check, ExternalLink } from 'lucide-react-native';
import { ICON_STROKE } from '../../components/common/Icon';
import { Btn, FormModal } from '../../components/crud';
import { Card, SectionLabel } from '../../components/ui';
import { b2cBillingService } from '../../api/b2c/b2cBillingService';
import {
  B2CWalletDto, B2CBillingTransactionDto, B2CBillingPlan, B2C_BILLING_PLANS,
} from '../../types/b2c';
import { formatCurrency, formatRelativeDate } from '../../utils/formatting';
import { useToast } from '../../context/ToastContext';
import { useAppTheme } from '../../theme/useAppTheme';
import { rf } from '../../utils/responsive';

const POLL_MS = 5000;

export const B2CBillingScreen = () => {
  const T = useAppTheme();
  const toast = useToast();
  const [wallet, setWallet] = useState<B2CWalletDto | null>(null);
  const [txns, setTxns] = useState<B2CBillingTransactionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Top-up flow
  const [showBuy, setShowBuy] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<B2CBillingPlan | null>(null);
  const [initiating, setInitiating] = useState(false);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadWallet = useCallback(async () => {
    try {
      const [w, t] = await Promise.all([
        b2cBillingService.getWallet(),
        b2cBillingService.getTransactions({ page: 1, pageSize: 20 }),
      ]);
      setWallet(w.data);
      setTxns(t.data?.items ?? []);
    } catch {
      /* keep whatever we had */
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadWallet(); }, [loadWallet]);

  // Confirm the top-up: the server re-fetches gateway status and credits the wallet only if
  // paid. `silent` is used by the auto-poll so a still-pending check doesn't nag the user.
  const verify = useCallback(async (silent: boolean) => {
    if (!pendingOrderId) return;
    if (!silent) setVerifying(true);
    try {
      const res = await b2cBillingService.verifyPayment({ orderId: pendingOrderId });
      if (res.data) {
        // Payment confirmed — wallet balance came back updated.
        setWallet(res.data);
        stopPolling();
        setPendingOrderId(null);
        setShowBuy(false);
        setSelectedPlan(null);
        loadWallet();
        toast.success('Payment successful');
      } else if (!silent) {
        Alert.alert('Not confirmed yet', 'We could not confirm the payment yet. Try again in a moment.');
      }
    } catch (err: any) {
      if (!silent) Alert.alert('Not confirmed yet', err?.response?.data?.message || 'Payment is still pending.');
    } finally {
      if (!silent) setVerifying(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingOrderId, loadWallet]);

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  // Auto-poll while a payment is pending.
  useEffect(() => {
    if (!pendingOrderId) { stopPolling(); return; }
    pollRef.current = setInterval(() => { verify(true); }, POLL_MS);
    return stopPolling;
  }, [pendingOrderId, verify]);

  const handleInitiate = async () => {
    if (!selectedPlan) return;
    setInitiating(true);
    try {
      // Server is authoritative on credits/price — it only needs the plan name.
      const res = await b2cBillingService.initiatePayment(selectedPlan.name, selectedPlan.credits);
      const order = res.data;
      if (!order?.paymentUrl) {
        toast.error('Payment could not be started.');
        return;
      }
      // WebView is not installed — open the hosted payment page in the system browser.
      await Linking.openURL(order.paymentUrl);
      setPendingOrderId(order.orderId);
      toast.success('Payment started');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to start payment');
    } finally {
      setInitiating(false);
    }
  };

  const closeBuy = () => {
    stopPolling();
    setShowBuy(false);
    setPendingOrderId(null);
    setSelectedPlan(null);
  };

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: T.bg }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadWallet(); }} tintColor={T.accent} colors={[T.accent]} />}
      >
        {loading ? (
          <ActivityIndicator color={T.accent} style={{ marginTop: 48 }} />
        ) : (
          <>
            {/* Wallet */}
            <Card style={s.walletCard}>
              <View style={s.walletTop}>
                <View style={[s.walletIcon, { backgroundColor: T.accentSoft }]}>
                  <Wallet size={20} color={T.accent} strokeWidth={1.9} />
                </View>
                <Text style={[s.walletLabel, { color: T.sub }]}>Wallet Balance</Text>
              </View>
              <Text style={[s.walletBalance, { color: T.text }]}>{wallet ? wallet.balance.toLocaleString('en-IN') : '0'}</Text>
              <Text style={[s.walletSub, { color: T.dim }]}>credits available</Text>
              {!!wallet && (
                <View style={s.walletMeta}>
                  <Text style={[s.metaTxt, { color: T.dim }]}>Recharged {wallet.totalRecharged.toLocaleString('en-IN')}</Text>
                  <Text style={[s.metaTxt, { color: T.dim }]}>Consumed {wallet.totalConsumed.toLocaleString('en-IN')}</Text>
                </View>
              )}
              <Btn label="Top up credits" onPress={() => { setSelectedPlan(null); setShowBuy(true); }} style={{ marginTop: 14 }} />
            </Card>

            {/* Transactions */}
            <View style={s.section}>
              <SectionLabel>Transactions</SectionLabel>
              {txns.length === 0 ? (
                <Card><Text style={[s.empty, { color: T.dim }]}>No transactions yet.</Text></Card>
              ) : (
                <Card>
                  {txns.map((tx, i) => {
                    const credit = tx.type === 'Credit';
                    return (
                      <View key={tx.id} style={[s.txRow, i > 0 && { borderTopColor: T.line, borderTopWidth: StyleSheet.hairlineWidth }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={[s.txDesc, { color: T.text }]} numberOfLines={1}>{tx.description || tx.type}</Text>
                          <Text style={[s.txMeta, { color: T.dim }]}>{formatRelativeDate(tx.createdAt)}</Text>
                        </View>
                        <Text style={[s.txAmt, { color: credit ? T.success : T.danger }]}>{credit ? '+' : '-'}{Math.abs(tx.credits)}</Text>
                      </View>
                    );
                  })}
                </Card>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Buy modal */}
      <FormModal visible={showBuy} title="Top up credits" onClose={closeBuy}
        footer={
          pendingOrderId ? (
            <>
              <Btn label="Cancel" variant="secondary" onPress={closeBuy} style={{ flex: 1 }} />
              <Btn label={verifying ? 'Checking…' : "I've paid"} onPress={() => verify(false)} loading={verifying} style={{ flex: 1 }} />
            </>
          ) : (
            <>
              <Btn label="Cancel" variant="secondary" onPress={closeBuy} style={{ flex: 1 }} />
              <Btn label={initiating ? 'Starting…' : 'Pay'} onPress={handleInitiate} loading={initiating} disabled={!selectedPlan || initiating} style={{ flex: 1 }} />
            </>
          )
        }
      >
        {pendingOrderId ? (
          <View style={{ gap: 12, alignItems: 'center' }}>
            <View style={[s.pendIcon, { backgroundColor: T.accentSoft }]}>
              <ExternalLink size={26} color={T.accent} strokeWidth={1.9} />
            </View>
            <Text style={[s.pendTitle, { color: T.text }]}>Complete payment in your browser</Text>
            <Text style={[s.pendTxt, { color: T.sub }]}>
              Credits are added automatically once the payment is confirmed. This can take a few
              seconds — you can also tap "I've paid" to check now.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            <Text style={[s.pendTxt, { color: T.sub }]}>Select a plan to top up your AI session credits.</Text>
            {B2C_BILLING_PLANS.map(plan => {
              const active = selectedPlan?.name === plan.name;
              return (
                <TouchableOpacity key={plan.name} activeOpacity={0.85} onPress={() => setSelectedPlan(plan)}
                  style={[s.planRow, { borderColor: active ? T.accent : T.line, backgroundColor: active ? T.accentSoft : T.card }]}>
                  <View style={{ flex: 1 }}>
                    <View style={s.planTop}>
                      <Text style={[s.planName, { color: T.text }]}>{plan.name}</Text>
                      {active && <Check size={16} color={T.accent} strokeWidth={2.4} />}
                    </View>
                    <Text style={[s.planSub, { color: T.dim }]}>{plan.credits} credits</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[s.planPrice, { color: T.accent }]}>{formatCurrency(plan.price)}</Text>
                    <Text style={[s.planPer, { color: T.dim }]}>{formatCurrency(plan.price / plan.credits)}/credit</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </FormModal>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 14, gap: 14 },
  walletCard: { alignItems: 'center', paddingVertical: 22 },
  walletTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  walletIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  walletLabel: { fontSize: rf(12.5), fontWeight: '600' },
  walletBalance: { fontSize: rf(40), fontWeight: '800', letterSpacing: -1, marginTop: 10 },
  walletSub: { fontSize: rf(12), fontWeight: '500' },
  walletMeta: { flexDirection: 'row', gap: 16, marginTop: 10 },
  metaTxt: { fontSize: rf(11.5), fontWeight: '600' },
  section: { gap: 2 },
  txRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 },
  txDesc: { fontSize: rf(13), fontWeight: '600' },
  txMeta: { fontSize: rf(11), fontWeight: '500', marginTop: 2 },
  txAmt: { fontSize: rf(15), fontWeight: '800' },
  empty: { fontSize: rf(13), fontWeight: '500', textAlign: 'center', paddingVertical: 24 },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1.5, padding: 14 },
  planTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  planName: { fontSize: rf(14.5), fontWeight: '700' },
  planSub: { fontSize: rf(12), fontWeight: '500', marginTop: 2 },
  planPrice: { fontSize: rf(16), fontWeight: '800' },
  planPer: { fontSize: rf(10.5), fontWeight: '500' },
  pendIcon: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  pendTitle: { fontSize: rf(15), fontWeight: '700', textAlign: 'center' },
  pendTxt: { fontSize: rf(12.5), fontWeight: '500', lineHeight: 19, textAlign: 'center' },
});
