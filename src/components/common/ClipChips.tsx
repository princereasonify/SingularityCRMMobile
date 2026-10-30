import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ClipboardPaste, Copy, Check } from 'lucide-react-native';
import { useAppTheme } from '../../theme/useAppTheme';
import { rf } from '../../utils/responsive';
import { readClipboardLine, writeClipboard } from '../../utils/clipboard';

/**
 * Paste / Copy chips for the app's own keyboard sheets (KeyField, NumField). The OS keyboard
 * is never shown over those fields, so its paste menu is unreachable — these give the same
 * ability. Leave `getCopyText` out for a field that must not be copied (a password).
 */
export const ClipChips = ({ onPaste, getCopyText }: {
  onPaste: (text: string) => void;
  getCopyText?: () => string;
}) => {
  const T = useAppTheme();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const paste = async () => {
    const text = await readClipboardLine();
    if (text) onPaste(text);
  };

  const copy = () => {
    const text = getCopyText?.() ?? '';
    if (!text) return;
    writeClipboard(text);
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1200);
  };

  return (
    <View style={s.wrap}>
      {!!getCopyText && (
        <TouchableOpacity activeOpacity={0.7} onPress={copy} style={[s.chip, { backgroundColor: T.cardAlt }]}>
          {copied ? <Check size={14} color={T.accent} strokeWidth={2.6} /> : <Copy size={14} color={T.sub} />}
          <Text style={[s.txt, { color: copied ? T.accent : T.sub }]}>{copied ? 'Copied' : 'Copy'}</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity activeOpacity={0.7} onPress={paste} style={[s.chip, { backgroundColor: T.cardAlt }]}>
        <ClipboardPaste size={14} color={T.sub} />
        <Text style={[s.txt, { color: T.sub }]}>Paste</Text>
      </TouchableOpacity>
    </View>
  );
};

const s = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  txt: { fontSize: rf(12), fontWeight: '700' },
});
