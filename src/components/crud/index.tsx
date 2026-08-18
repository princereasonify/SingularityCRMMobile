import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleProp,
  ViewStyle,
  TextStyle,
  TextInputProps,
} from 'react-native';
import { Check, ChevronLeft, ChevronRight, ChevronDown, X, Search as SearchIcon } from 'lucide-react-native';
import { useAppTheme } from '../../theme/useAppTheme';
import { AppTheme, withAlpha, SOFT_TINT } from '../../theme';
import { GradientBackground } from '../common/GradientBackground';
import { rf } from '../../utils/responsive';

/**
 * CRUD component kit — a 1:1 port of SingularityCRM-CRUD-Components.html.
 * Every screen's buttons / inputs / list rows / pagination / modals come from here so
 * the app stays one system. Numbers below are the spec's, verbatim.
 */

// ─── Buttons ──────────────────────────────────────────────────────────────────
export type BtnVariant = 'primary' | 'secondary' | 'soft' | 'danger' | 'dangerGhost' | 'success';

interface BtnProps {
  label: string;
  onPress: () => void;
  variant?: BtnVariant;
  /** .b-sm — 36px / radius 11 / 12.5px */
  small?: boolean;
  icon?: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

const btnFace = (v: BtnVariant, T: AppTheme) => {
  switch (v) {
    case 'secondary':   return { bg: T.card,          fg: T.text,   border: T.lineStrong };
    case 'soft':        return { bg: T.accentSoft,    fg: T.accent, border: 'transparent' };
    case 'danger':      return { bg: T.danger,        fg: '#FFF',   border: 'transparent' };
    case 'dangerGhost': return { bg: T.danger + '1A', fg: T.danger, border: 'transparent' };
    case 'success':     return { bg: T.success,       fg: '#FFF',   border: 'transparent' };
    default:            return { bg: 'transparent',   fg: '#FFF',   border: 'transparent' }; // primary = gradient
  }
};

export const Btn = ({ label, onPress, variant = 'primary', small, icon, loading, disabled, style }: BtnProps) => {
  const T = useAppTheme();
  const f = btnFace(variant, T);
  const isPrimary = variant === 'primary';
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      style={[
        s.btn,
        small && s.btnSm,
        { backgroundColor: f.bg },
        variant === 'secondary' && { borderWidth: 1.5, borderColor: f.border },
        isPrimary && s.btnPrimaryShadow,
        (disabled || loading) && { opacity: 0.5 },
        style,
      ]}
    >
      {isPrimary && <GradientBackground glow={false} style={StyleSheet.absoluteFillObject} />}
      {loading ? (
        <ActivityIndicator color={f.fg} size="small" />
      ) : (
        <>
          {icon}
          <Text style={[s.btnTxt, small && s.btnTxtSm, { color: f.fg }]}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
};

/** .icon-btn — 32×32 · radius 9 */
export type IconBtnKind = 'edit' | 'del' | 'view';
export const IconBtn = ({ kind, onPress, children, label }: {
  kind: IconBtnKind; onPress: () => void; children: React.ReactNode; label?: string;
}) => {
  const T = useAppTheme();
  const bg = kind === 'edit' ? T.cardAlt : kind === 'del' ? T.danger + '1F' : T.accentSoft;
  return (
    <TouchableOpacity accessibilityLabel={label} onPress={onPress} activeOpacity={0.7} style={[s.iconBtn, { backgroundColor: bg }]}>
      {children}
    </TouchableOpacity>
  );
};

/** .fab — 52×52 · radius 16 · gradient */
export const Fab = ({ onPress, children, label }: { onPress: () => void; children: React.ReactNode; label?: string }) => (
  <TouchableOpacity accessibilityLabel={label} onPress={onPress} activeOpacity={0.85} style={s.fab}>
    <GradientBackground glow={false} style={StyleSheet.absoluteFillObject} />
    {children}
  </TouchableOpacity>
);

// ─── Inputs ───────────────────────────────────────────────────────────────────
/** .field + .flabel + .input — 46 · radius 13 · 1.5px; focus = deep border + soft ring */
export const Field = ({ label, children, style }: { label?: string; children: React.ReactNode; style?: StyleProp<ViewStyle> }) => {
  const T = useAppTheme();
  return (
    <View style={[s.field, style]}>
      {!!label && <Text style={[s.flabel, { color: T.text }]}>{label}</Text>}
      {children}
    </View>
  );
};

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  right?: React.ReactNode;
  left?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
}
export const Input = ({ label, error, right, left, containerStyle, ...p }: InputProps) => {
  const T = useAppTheme();
  const [focus, setFocus] = useState(false);
  return (
    <Field label={label} style={containerStyle}>
      <View
        style={[
          s.input,
          { backgroundColor: T.card, borderColor: error ? T.danger : focus ? T.accent : T.line },
          focus && !error && { shadowColor: T.accent, shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
        ]}
      >
        {left}
        <TextInput
          placeholderTextColor={T.dim}
          onFocus={e => { setFocus(true); p.onFocus?.(e); }}
          onBlur={e => { setFocus(false); p.onBlur?.(e); }}
          style={[s.inputTxt, { color: T.text }]}
          {...p}
        />
        {right}
      </View>
      {!!error && <Text style={[s.err, { color: T.danger }]}>{error}</Text>}
    </Field>
  );
};

/** .search — 46 · radius 13 · 1.5px */
export const SearchBar = ({ value, onChangeText, placeholder = 'Search…', style }: {
  value: string; onChangeText: (t: string) => void; placeholder?: string; style?: StyleProp<ViewStyle>;
}) => {
  const T = useAppTheme();
  return (
    <View style={[s.input, { backgroundColor: T.card, borderColor: T.line }, style]}>
      <SearchIcon size={16} color={T.dim} strokeWidth={1.9} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={T.dim}
        style={[s.inputTxt, { color: T.text }]}
      />
      {!!value && (
        <TouchableOpacity onPress={() => onChangeText('')} hitSlop={10}>
          <X size={15} color={T.dim} />
        </TouchableOpacity>
      )}
    </View>
  );
};

// ─── Checkbox · Toggle · Segmented ────────────────────────────────────────────
/** .check — box 20 · radius 7 · gradient when on */
export const Checkbox = ({ on, onToggle, label }: { on: boolean; onToggle: () => void; label?: string }) => {
  const T = useAppTheme();
  return (
    <TouchableOpacity onPress={onToggle} activeOpacity={0.7} style={s.check}>
      <View style={[s.checkBox, { borderColor: on ? 'transparent' : T.lineStrong }]}>
        {on && <GradientBackground glow={false} style={StyleSheet.absoluteFillObject} />}
        {on && <Check size={13} color="#FFF" strokeWidth={3} />}
      </View>
      {!!label && <Text style={[s.checkTxt, { color: T.text }]}>{label}</Text>}
    </TouchableOpacity>
  );
};

/** .tg — 44×26 · knob 20 */
export const Toggle = ({ on, onToggle }: { on: boolean; onToggle: () => void }) => {
  const T = useAppTheme();
  return (
    <TouchableOpacity onPress={onToggle} activeOpacity={0.8} style={[s.tg, { backgroundColor: on ? 'transparent' : T.lineStrong }]}>
      {on && <GradientBackground glow={false} style={StyleSheet.absoluteFillObject} />}
      <View style={[s.tgKnob, on ? { right: 3 } : { left: 3 }]} />
    </TouchableOpacity>
  );
};

/** .seg — cardAlt · pad 4 · radius 12; item h32 · radius 9 · gradient when on */
export const Segmented = <T extends string>({ value, options, onChange, style }: {
  value: T; options: { label: string; value: T }[]; onChange: (v: T) => void; style?: StyleProp<ViewStyle>;
}) => {
  const TH = useAppTheme();
  return (
    <View style={[s.seg, { backgroundColor: TH.cardAlt }, style]}>
      {options.map(o => {
        const on = o.value === value;
        return (
          <TouchableOpacity key={o.value} onPress={() => onChange(o.value)} activeOpacity={0.85} style={s.segItem}>
            {on && <GradientBackground glow={false} style={StyleSheet.absoluteFillObject} />}
            <Text style={[s.segTxt, { color: on ? '#FFF' : TH.sub }]}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

// ─── Filter trigger + dropdown ────────────────────────────────────────────────
/** .trigger — 44 · radius 13 · border turns accent when open */
export const Trigger = ({ label, open, onPress, icon, style }: {
  label: string; open?: boolean; onPress: () => void; icon?: React.ReactNode; style?: StyleProp<ViewStyle>;
}) => {
  const T = useAppTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[s.trigger, { backgroundColor: T.card, borderColor: open ? T.accent : T.line }, style]}
    >
      {icon}
      {/* flex:1 so the label fills the row and pushes the chevron to the far right. */}
      <Text style={[s.triggerTxt, { color: T.text }]} numberOfLines={1}>{label}</Text>
      {/* Static down-chevron — the affordance that says "this opens a list". It does
          NOT rotate: a transform on the icon flickered/mis-painted on first render and
          only settled after a re-render, so it stays fixed like a real select. Only the
          colour tracks the open state, matching the border. */}
      <ChevronDown size={16} color={open ? T.accent : T.dim} strokeWidth={2.2} />
    </TouchableOpacity>
  );
};

/**
 * .dd — 200 · radius 14 · shadow · selected row = soft tint + accent + 700.
 * Spec: "Panel opens below (8px gap)" — so render it inline, directly after its
 * <Trigger open>. Never put this in a Modal; that is not the spec's behaviour.
 *
 * `maxHeight` caps the panel and scrolls the rows inside it, so a long option
 * list (e.g. every Won lead) stays a spec dropdown instead of becoming a modal.
 */
export const Dropdown = <T extends string>({ options, value, onSelect, style, maxHeight }: {
  options: { label: string; value: T }[]; value?: T; onSelect: (v: T) => void;
  style?: StyleProp<ViewStyle>; maxHeight?: number;
}) => {
  const TH = useAppTheme();
  const rows = options.map(o => {
    const on = o.value === value;
    return (
      <TouchableOpacity
        key={o.value}
        onPress={() => onSelect(o.value)}
        activeOpacity={0.7}
        style={[s.ddItem, on && { backgroundColor: TH.accentSoft }]}
      >
        <Text style={[s.ddTxt, { color: on ? TH.accent : TH.text, fontWeight: on ? '700' : '500' }]} numberOfLines={1}>
          {o.label}
        </Text>
        {on && <Check size={15} color={TH.accent} strokeWidth={2.4} />}
      </TouchableOpacity>
    );
  });
  return (
    <View style={[s.dd, { backgroundColor: TH.card, borderColor: TH.line }, style]}>
      {maxHeight ? (
        <ScrollView style={{ maxHeight }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
          {rows}
        </ScrollView>
      ) : rows}
    </View>
  );
};

// ─── Badge · Chip ─────────────────────────────────────────────────────────────
/** .badge — 22 · radius 11 · 11/700 · colour @15% bg */
export const StatusBadge = ({ label, color }: { label: string; color?: string }) => {
  const T = useAppTheme();
  const c = color || T.accent;
  return (
    <View style={[s.badge, { backgroundColor: withAlpha(c, SOFT_TINT) }]}>
      <Text style={[s.badgeTxt, { color: c }]}>{label}</Text>
    </View>
  );
};

/** .chip — 28 · radius 14 · soft bg · deep text · optional × */
export const FilterChip = ({ label, onRemove }: { label: string; onRemove?: () => void }) => {
  const T = useAppTheme();
  return (
    <View style={[s.chip, { backgroundColor: T.accentSoft }]}>
      <Text style={[s.chipTxt, { color: T.accent }]}>{label}</Text>
      {!!onRemove && (
        <TouchableOpacity onPress={onRemove} hitSlop={8} style={[s.chipX, { backgroundColor: T.accent + '33' }]}>
          <X size={9} color={T.accent} strokeWidth={3} />
        </TouchableOpacity>
      )}
    </View>
  );
};

// ─── Pagination ───────────────────────────────────────────────────────────────
/** .pg — 32 · radius 9 · active = gradient */
export const Pagination = ({ page, pageCount, onChange, style }: {
  page: number; pageCount: number; onChange: (p: number) => void; style?: StyleProp<ViewStyle>;
}) => {
  const T = useAppTheme();
  if (pageCount <= 1) return null;

  // Window the numbers so long lists never overflow the row.
  const nums: number[] = [];
  const from = Math.max(1, Math.min(page - 1, pageCount - 2));
  for (let i = from; i < from + 3 && i <= pageCount; i++) nums.push(i);

  const cell = (key: string, content: React.ReactNode, onPress: () => void, on = false, disabled = false) => (
    <TouchableOpacity
      key={key}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      style={[s.pgCell, { borderColor: T.line }, on && s.pgCellOn, disabled && { opacity: 0.4 }]}
    >
      {on && <GradientBackground glow={false} style={StyleSheet.absoluteFillObject} />}
      {content}
    </TouchableOpacity>
  );

  return (
    <View style={[s.pg, style]}>
      {cell('prev', <ChevronLeft size={13} color={T.sub} strokeWidth={2.2} />, () => onChange(page - 1), false, page <= 1)}
      {nums.map(n =>
        cell(String(n), <Text style={[s.pgTxt, { color: n === page ? '#FFF' : T.sub }]}>{n}</Text>, () => onChange(n), n === page),
      )}
      {cell('next', <ChevronRight size={13} color={T.sub} strokeWidth={2.2} />, () => onChange(page + 1), false, page >= pageCount)}
    </View>
  );
};

// ─── List row (.lcard) ────────────────────────────────────────────────────────
export const ListCard = ({ children, onPress, style }: {
  children: React.ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle>;
}) => {
  const T = useAppTheme();
  const Wrap: any = onPress ? TouchableOpacity : View;
  return (
    <Wrap onPress={onPress} activeOpacity={0.8} style={[s.lcard, { backgroundColor: T.card, borderColor: T.line }, style]}>
      {children}
    </Wrap>
  );
};

/** .av — 36 · radius 10 · 12.5/800 */
export const Avatar = ({ initials, color }: { initials: string; color?: string }) => {
  const T = useAppTheme();
  const c = color || T.accent;
  return (
    <View style={[s.av, { backgroundColor: c + '26' }]}>
      <Text style={[s.avTxt, { color: c }]}>{initials}</Text>
    </View>
  );
};

// ─── Modals ───────────────────────────────────────────────────────────────────
/** Form modal: .mhead + body + .mfoot (340 · radius 20 · scrim rgba(20,15,8,.42)) */
export const FormModal = ({ visible, title, onClose, children, footer, wide }: {
  visible: boolean; title: string; onClose: () => void;
  children: React.ReactNode; footer?: React.ReactNode; wide?: boolean;
}) => {
  const T = useAppTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* KeyboardAvoidingView lifts the modal above the on-screen keyboard; the body is a
          bounded ScrollView so a tall form (many fields, an image preview) can always be
          scrolled to reach the footer. Previously the body was a fixed View, so on small
          phones the Save/Cancel footer was pushed off-screen with no way to reach it. */}
      <KeyboardAvoidingView
        style={s.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={s.scrim} onPress={onClose}>
          <Pressable
            onPress={() => {}}
            style={[s.modal, { backgroundColor: T.card, maxWidth: wide ? 560 : 340 }]}
          >
            <View style={[s.mhead, { borderBottomColor: T.line }]}>
              <Text style={[s.mtitle, { color: T.text }]}>{title}</Text>
              <TouchableOpacity onPress={onClose} hitSlop={10}>
                <X size={18} color={T.sub} />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={s.mbodyScroll}
              contentContainerStyle={s.mbody}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
            {!!footer && <View style={[s.mfoot, { borderTopColor: T.line }]}>{footer}</View>}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
};

/** Confirm/delete/success modal: centred icon tile + title + text + actions. */
export const ConfirmModal = ({ visible, title, message, icon, tone = 'danger', confirmLabel, onConfirm, onCancel, loading = false }: {
  visible: boolean; title: string; message: string; icon: React.ReactNode;
  tone?: 'danger' | 'success' | 'accent'; confirmLabel: string;
  onConfirm: () => void; onCancel: () => void;
  /** While true, the confirm button shows a spinner and both buttons are disabled —
   *  without this, a slow async onConfirm lets a fast double-tap fire it twice. */
  loading?: boolean;
}) => {
  const T = useAppTheme();
  const tint = tone === 'danger' ? T.danger : tone === 'success' ? T.success : T.accent;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={s.scrim} onPress={loading ? undefined : onCancel}>
        <Pressable onPress={() => {}} style={[s.modal, { backgroundColor: T.card, maxWidth: 340 }]}>
          <View style={[s.mbody, { alignItems: 'center' }]}>
            <View style={[s.mi, { backgroundColor: tint + '1F' }]}>{icon}</View>
            <Text style={[s.mtitle, { color: T.text, textAlign: 'center' }]}>{title}</Text>
            <Text style={[s.mtext, { color: T.sub }]}>{message}</Text>
            <View style={s.confirmRow}>
              <Btn label="Cancel" variant="secondary" onPress={onCancel} disabled={loading} style={{ flex: 1 }} />
              <Btn
                label={confirmLabel}
                variant={tone === 'danger' ? 'danger' : tone === 'success' ? 'success' : 'primary'}
                onPress={onConfirm}
                loading={loading}
                disabled={loading}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const s = StyleSheet.create({
  // buttons — .btn 44/r13/13.5-700 · .b-sm 36/r11/12.5
  btn: {
    height: 44, paddingHorizontal: 18, borderRadius: 13,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    overflow: 'hidden',
  },
  btnSm: { height: 36, paddingHorizontal: 14, borderRadius: 11 },
  btnPrimaryShadow: {
    shadowColor: '#8C5A2E', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28, shadowRadius: 20, elevation: 6,
  },
  btnTxt: { fontSize: rf(13.5), fontWeight: '700' },
  btnTxtSm: { fontSize: rf(12.5) },
  iconBtn: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  fab: {
    width: 52, height: 52, borderRadius: 16, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#8C5A2E', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28, shadowRadius: 24, elevation: 8,
  },

  // inputs — .field gap 7 · .flabel 12.5/600 · .input 46/r13/1.5px/pad 14/gap 9
  field: { gap: 7 },
  flabel: { fontSize: rf(12.5), fontWeight: '600' },
  input: {
    height: 46, borderRadius: 13, borderWidth: 1.5,
    flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 14,
  },
  inputTxt: { flex: 1, fontSize: rf(14), fontWeight: '500', padding: 0 },
  err: { fontSize: rf(11.5), fontWeight: '400' },

  // check / toggle / segmented
  check: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkBox: {
    width: 20, height: 20, borderRadius: 7, borderWidth: 2, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
  checkTxt: { fontSize: rf(13.5), fontWeight: '500' },
  tg: { width: 44, height: 26, borderRadius: 13, justifyContent: 'center', overflow: 'hidden' },
  tgKnob: { position: 'absolute', top: 3, width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFF' },
  seg: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 12 },
  segItem: { flex: 1, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  segTxt: { fontSize: rf(12.5), fontWeight: '700' },

  // trigger / dropdown
  trigger: {
    height: 44, borderRadius: 13, borderWidth: 1,
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14,
  },
  // flex:1 + minWidth:0 so a long label truncates instead of shoving the chevron
  // off the right edge (flexShrink defaults to 0 in RN).
  triggerTxt: { fontSize: rf(13), fontWeight: '600', flex: 1, minWidth: 0 },
  dd: {
    width: 200, borderRadius: 14, borderWidth: 1, padding: 6, marginTop: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.15, shadowRadius: 40, elevation: 12,
  },
  ddItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 9, paddingHorizontal: 11, borderRadius: 9,
  },
  ddTxt: { fontSize: rf(12.5) },

  // badge / chip
  badge: { height: 22, paddingHorizontal: 10, borderRadius: 11, alignSelf: 'flex-start', alignItems: 'center', justifyContent: 'center' },
  badgeTxt: { fontSize: rf(11), fontWeight: '700' },
  chip: { height: 28, paddingHorizontal: 12, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipTxt: { fontSize: rf(12), fontWeight: '600' },
  chipX: { width: 15, height: 15, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },

  // pagination — .p 32/r9
  pg: { flexDirection: 'row', gap: 6 },
  pgCell: { width: 32, height: 32, borderRadius: 9, borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  pgCellOn: { borderWidth: 0 },
  pgTxt: { fontSize: rf(12), fontWeight: '700' },

  // list row + avatar
  lcard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 13, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1,
  },
  av: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  avTxt: { fontSize: rf(12.5), fontWeight: '800' },

  // modal
  kav: { flex: 1 },
  scrim: { flex: 1, backgroundColor: 'rgba(20,15,8,0.42)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modal: {
    width: '100%', maxHeight: '90%', borderRadius: 20, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 24 }, shadowOpacity: 0.25, shadowRadius: 60, elevation: 20,
  },
  // Bounded so a tall form scrolls inside the modal instead of shoving the footer off-screen.
  mbodyScroll: { flexShrink: 1, flexGrow: 0 },
  mhead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 18, paddingHorizontal: 22, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  mbody: { padding: 24 },
  mfoot: { flexDirection: 'row', gap: 10, padding: 16, paddingHorizontal: 22, borderTopWidth: StyleSheet.hairlineWidth },
  mi: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  mtitle: { fontSize: rf(18), fontWeight: '800', letterSpacing: -0.3 },
  mtext: { fontSize: rf(13), lineHeight: 20, marginTop: 7, textAlign: 'center' },
  confirmRow: { flexDirection: 'row', gap: 10, width: '100%', marginTop: 18 },
});
