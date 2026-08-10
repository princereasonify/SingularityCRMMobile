import React, { createContext, useContext, useCallback, useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Easing, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react-native';
import { useAppTheme } from '../theme/useAppTheme';
import { rf } from '../utils/responsive';

/**
 * Global toast/snackbar — the app's own in-app notification style.
 * Mirrors the web `useToast()` API so call sites read the same:
 *   const toast = useToast();
 *   toast.success('Created successfully');
 *   toast.error('Something went wrong');
 *   toast.warning(msg); toast.info(msg);
 * Options: { title?, duration? } (duration ms; default 3500, errors 5000).
 *
 * Themed via useAppTheme so it turns green for B2C roles and blue for B2B,
 * and follows light/dark automatically.
 */

export type ToastType = 'success' | 'error' | 'warning' | 'info';
export interface ToastOptions { title?: string; duration?: number }
interface ToastItem { id: number; type: ToastType; message: string; title?: string; duration: number }

interface ToastApi {
  success: (message: string, options?: ToastOptions) => void;
  error: (message: string, options?: ToastOptions) => void;
  warning: (message: string, options?: ToastOptions) => void;
  info: (message: string, options?: ToastOptions) => void;
  show: (message: string, type?: ToastType, options?: ToastOptions) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const ICONS = { success: CheckCircle2, error: AlertCircle, warning: AlertTriangle, info: Info } as const;

const DEFAULT_DURATION = 3500;
const ERROR_DURATION = 5000;
const MAX_VISIBLE = 3;

let idSeq = 1;

function ToastRow({ item, color, onDismiss }: { item: ToastItem; color: string; onDismiss: (id: number) => void }) {
  const T = useAppTheme();
  const Icon = ICONS[item.type];
  const anim = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const close = useCallback(() => {
    Animated.timing(anim, { toValue: 0, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true })
      .start(() => onDismiss(item.id));
  }, [anim, item.id, onDismiss]);

  useEffect(() => {
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, bounciness: 6, speed: 14 }).start();
    timer.current = setTimeout(close, item.duration);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [anim, close, item.duration]);

  return (
    <Animated.View
      style={[
        s.toast,
        {
          backgroundColor: T.card,
          borderColor: T.line,
          borderLeftColor: color,
          shadowColor: T.isDark ? '#000' : '#1a2e12',
          opacity: anim,
          transform: [
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) },
            { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
          ],
        },
      ]}
    >
      <View style={[s.iconWrap, { backgroundColor: color + '22' }]}>
        <Icon size={18} color={color} strokeWidth={2.4} />
      </View>
      <View style={s.body}>
        {!!item.title && <Text style={[s.title, { color: T.text }]} numberOfLines={1}>{item.title}</Text>}
        <Text style={[item.title ? s.sub : s.msg, { color: item.title ? T.sub : T.text }]} numberOfLines={3}>
          {item.message}
        </Text>
      </View>
      <TouchableOpacity onPress={close} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={s.close}>
        <X size={15} color={T.dim} />
      </TouchableOpacity>
    </Animated.View>
  );
}

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const T = useAppTheme();
  const insets = useSafeAreaInsets();
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const show = useCallback((message: string, type: ToastType = 'info', options: ToastOptions = {}) => {
    if (!message) return;
    const item: ToastItem = {
      id: idSeq++,
      type,
      message,
      title: options.title,
      duration: options.duration ?? (type === 'error' ? ERROR_DURATION : DEFAULT_DURATION),
    };
    // Keep only the most recent MAX_VISIBLE toasts on screen.
    setToasts(prev => [...prev, item].slice(-MAX_VISIBLE));
  }, []);

  const api = useRef<ToastApi>({
    success: (m, o) => show(m, 'success', o),
    error: (m, o) => show(m, 'error', o),
    warning: (m, o) => show(m, 'warning', o),
    info: (m, o) => show(m, 'info', o),
    show,
    dismiss,
  }).current;
  // Keep closures fresh (show/dismiss are stable via useCallback, but be safe).
  api.success = (m, o) => show(m, 'success', o);
  api.error = (m, o) => show(m, 'error', o);
  api.warning = (m, o) => show(m, 'warning', o);
  api.info = (m, o) => show(m, 'info', o);
  api.show = show;
  api.dismiss = dismiss;

  const colorFor = (type: ToastType) =>
    type === 'success' ? T.success : type === 'error' ? T.danger : type === 'warning' ? T.warning : T.info;

  return (
    <ToastContext.Provider value={api}>
      {children}
      <View pointerEvents="box-none" style={[s.container, { top: insets.top + 8 }]}>
        {toasts.map(t => (
          <ToastRow key={t.id} item={t} color={colorFor(t.type)} onDismiss={dismiss} />
        ))}
      </View>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastApi => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
};

const s = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    zIndex: 9999,
    gap: 8,
    alignItems: 'center',
  },
  toast: {
    width: '100%',
    maxWidth: 460,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 12,
    paddingHorizontal: 13,
    borderRadius: 15,
    borderWidth: 1,
    borderLeftWidth: 4,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: Platform.OS === 'ios' ? 0.18 : 0.28,
    shadowRadius: 14,
    elevation: 8,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1 },
  title: { fontSize: rf(13.5), fontWeight: '700', letterSpacing: -0.2 },
  sub: { fontSize: rf(12), fontWeight: '500', marginTop: 1 },
  msg: { fontSize: rf(13), fontWeight: '600', letterSpacing: -0.1 },
  close: { padding: 2 },
});
