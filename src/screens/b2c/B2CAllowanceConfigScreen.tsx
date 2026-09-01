import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { IndianRupee, Save } from 'lucide-react-native';
import { ICON_STROKE } from '../../components/common/Icon';
import { Btn, Input } from '../../components/crud';
import { Screen, Card } from '../../components/ui';
import { apiClient } from '../../api/client';
import { b2cAllowanceService } from '../../api/b2c/b2cAllowanceService';
import { useToast } from '../../context/ToastContext';
import { useAppTheme } from '../../theme/useAppTheme';
import { useResponsive, Responsive } from '../../hooks/useResponsive';

/**
 * Allowance Config — the mobile twin of web's B2CAllowanceConfig.jsx. Sets the three rates
 * the server multiplies out when an agent or counselor submits a claim; they only ever enter
 * a visit count and a distance, so these rates are the whole of the amount.
 *
 * Separate from the B2B `settings/AllowanceConfigScreen`, which drives a different endpoint
 * (/admin/allowance-config) with per-scope rules.
 */

interface RateConfig {
  ratePerVisit: string;
  ratePerKm: string;
  fixedDailyAmount: string;
}

const EMPTY: RateConfig = { ratePerVisit: '0', ratePerKm: '0', fixedDailyAmount: '0' };

const decimal = (v: string) => {
  const cleaned = (v || '').replace(/[^0-9.]/g, '');
  // One decimal point only — "12.3.4" is not a number the server will take.
  const [head, ...rest] = cleaned.split('.');
  return rest.length ? `${head}.${rest.join('')}` : head;
};

const num = (v: string) => (Number(v) > 0 ? Number(v) : 0);

export const B2CAllowanceConfigScreen = () => {
  const T = useAppTheme();
  const r = useResponsive();
  const toast = useToast();

  const [cfg, setCfg] = useState<RateConfig>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (k: keyof RateConfig, v: string) => setCfg(c => ({ ...c, [k]: decimal(v) }));

  const load = useCallback(async () => {
    try {
      const res = await b2cAllowanceService.getConfig();
      const d = res.data ?? {};
      setCfg({
        ratePerVisit: String(d.ratePerVisit ?? 0),
        ratePerKm: String(d.ratePerKm ?? 0),
        fixedDailyAmount: String(d.fixedDailyAmount ?? 0),
      });
    } catch {
      setCfg(EMPTY);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      // PUT /b2c/allowances/config. Called directly because b2cAllowanceService exposes only
      // getConfig — src/api is owned elsewhere in this workstream, so the method could not be
      // added there.
      await apiClient.put('/b2c/allowances/config', {
        ratePerVisit: num(cfg.ratePerVisit),
        ratePerKm: num(cfg.ratePerKm),
        fixedDailyAmount: num(cfg.fixedDailyAmount),
      });
      toast.success('Configuration saved');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  // A worked example beats the formula alone — it shows what the rates actually pay out.
  const example = num(cfg.ratePerVisit) * 5 + num(cfg.ratePerKm) * 20 + num(cfg.fixedDailyAmount);

  // iPad landscape: the form and the explainer sit side by side instead of stacking.
  const sideBySide = r.width >= 900;
  // The three rate fields are laid out against the pane they actually sit in, measured in
  // points. A percentage would be measured against the wrong box once the panes split, and
  // three 31.5% fields plus their gaps would spill and wrap 2 + 1.
  const outer = Math.min(r.width, r.maxContentWidth) - r.gutter * 2;
  const paneInner = (sideBySide ? ((outer - r.gap) * 2) / 3 : outer) - 32; // 32 = Card padding
  const fieldCols = paneInner >= 560 ? 3 : paneInner >= 380 ? 2 : 1;
  const fieldW: number | '100%' = fieldCols === 1
    ? '100%'
    : (paneInner - r.gap * (fieldCols - 1)) / fieldCols;

  const s = useMemo(() => makeStyles(r, sideBySide), [r, sideBySide]);

  // paddingHorizontal/Top rather than `padding`: Screen already sets paddingBottom from the
  // bottom safe-area inset, and the shorthand would overwrite it.
  const content = { paddingHorizontal: r.gutter, paddingTop: r.gutter, maxWidth: r.maxContentWidth, width: '100%', alignSelf: 'center' } as const;

  return (
    <Screen scroll contentStyle={content} refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <Text style={[s.subtitle, { color: T.sub }]}>
        Set the rates used to compute agent &amp; counselor claims
      </Text>

      {loading ? (
        <ActivityIndicator color={T.accent} style={{ marginTop: 48 }} />
      ) : (
        <View style={s.panes}>
          <View style={s.formPane}>
            <Card style={s.card}>
              <View style={s.grid}>
                <Input
                  label="Rate per Visit (₹)"
                  value={cfg.ratePerVisit}
                  onChangeText={v => set('ratePerVisit', v)}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  containerStyle={{ width: fieldW }}
                />
                <Input
                  label="Rate per Km (₹)"
                  value={cfg.ratePerKm}
                  onChangeText={v => set('ratePerKm', v)}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  containerStyle={{ width: fieldW }}
                />
                <Input
                  label="Fixed Daily (₹)"
                  value={cfg.fixedDailyAmount}
                  onChangeText={v => set('fixedDailyAmount', v)}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  containerStyle={{ width: fieldW }}
                />
              </View>
              <Text style={[s.hint, { color: T.dim }]}>
                Per recorded visit · per km travelled · flat daily amount.
              </Text>
              <View style={s.saveRow}>
                <Btn
                  label={saving ? 'Saving…' : 'Save Config'}
                  onPress={save}
                  loading={saving}
                  disabled={saving}
                  icon={<Save size={15} color="#FFF" strokeWidth={ICON_STROKE} />}
                />
              </View>
            </Card>
          </View>

          <View style={s.sidePane}>
            <Card style={s.card}>
              <View style={s.explTop}>
                <View style={[s.explIcon, { backgroundColor: T.accentSoft }]}>
                  <IndianRupee size={18} color={T.accent} strokeWidth={ICON_STROKE} />
                </View>
                <Text style={[s.explTitle, { color: T.text }]}>How the amount is computed</Text>
              </View>
              <Text style={[s.explTxt, { color: T.sub }]}>
                Each claim amount is calculated server-side as:
              </Text>
              <View style={[s.formula, { backgroundColor: T.cardAlt, borderColor: T.line }]}>
                <Text style={[s.formulaTxt, { color: T.text }]}>
                  (visits × ratePerVisit) + (km × ratePerKm) + fixedDailyAmount
                </Text>
              </View>
              <View style={s.exampleRow}>
                <Text style={[s.exampleLbl, { color: T.dim }]}>5 visits · 20 km</Text>
                <Text style={[s.exampleVal, { color: T.accent }]}>
                  ₹{example.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </Text>
              </View>
              <Text style={[s.hint, { color: T.dim, marginTop: 0 }]}>
                Agents and counselors only enter their visit count and distance; the amount is
                derived automatically from these rates.
              </Text>
            </Card>
          </View>
        </View>
      )}
    </Screen>
  );
};

/**
 * Styles are a function of the live layout metrics, not a module-level constant: a
 * `StyleSheet.create` evaluated at import freezes every font size and padding at the launch
 * orientation, which is what leaves an iPad clipped and overlapping after a rotation.
 */
const makeStyles = (r: Responsive, sideBySide: boolean) => StyleSheet.create({
  subtitle: { fontSize: r.rf(12.5), fontWeight: '500', marginBottom: r.rs(14) },
  panes: { flexDirection: sideBySide ? 'row' : 'column', gap: r.gap, alignItems: 'flex-start' },
  formPane: { flex: sideBySide ? 2 : undefined, width: sideBySide ? undefined : '100%' },
  sidePane: { flex: sideBySide ? 1 : undefined, width: sideBySide ? undefined : '100%' },
  card: { gap: r.gap },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: r.gap },
  hint: { fontSize: r.rf(11), fontWeight: '500', marginTop: -6 },
  saveRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  explTop: { flexDirection: 'row', alignItems: 'center', gap: r.rs(8) },
  explIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  explTitle: { fontSize: r.rf(13.5), fontWeight: '700', flex: 1 },
  explTxt: { fontSize: r.rf(12.5), fontWeight: '500', lineHeight: r.rf(19) },
  formula: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
  formulaTxt: { fontSize: r.rf(11.5), fontWeight: '600' },
  exampleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: r.rs(8) },
  exampleLbl: { fontSize: r.rf(12), fontWeight: '500', flex: 1 },
  exampleVal: { fontSize: r.rf(16), fontWeight: '800' },
});

export default B2CAllowanceConfigScreen;
