/**
 * Signature capture for a sales document — mobile twin of web's salesDocs/SignatureField.jsx.
 * Web supports draw-on-canvas OR upload; this ports the upload path only (photo library, via
 * the same react-native-image-picker already used for the profile avatar) — a touch-drawn pad
 * is a reasonable follow-up but not required for the document to be usable end to end. The
 * PNG's own aspect ratio is preserved and letterboxed into a fixed 3:1 box wherever it's shown
 * (here and in the PDF template) rather than physically resized, since there's no image-resize
 * library on this client — visually identical to web's canvas-normalised PNG.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { Pen, X, Loader2 } from 'lucide-react-native';
import { useAppTheme } from '../../theme/useAppTheme';
import { ICON_STROKE } from '../common/Icon';
import { rf } from '../../utils/responsive';

interface Props {
  value: string;
  onChange: (dataUri: string) => void;
  label: string;
}

export const SignatureField = ({ value, onChange, label }: Props) => {
  const T = useAppTheme();
  const [busy, setBusy] = useState(false);

  const pick = async () => {
    setBusy(true);
    try {
      const res = await launchImageLibrary({ mediaType: 'photo', includeBase64: true, quality: 0.8 });
      if (res.didCancel) return;
      const asset = res.assets?.[0];
      if (!asset?.base64) {
        if (res.errorMessage) Alert.alert('Error', res.errorMessage);
        return;
      }
      onChange(`data:${asset.type || 'image/jpeg'};base64,${asset.base64}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <Text style={[styles.label, { color: T.dim }]}>{label}</Text>
      {value ? (
        <View style={[styles.box, { borderColor: T.line, backgroundColor: '#FFF' }]}>
          <Image source={{ uri: value }} style={styles.img} resizeMode="contain" />
          <TouchableOpacity
            onPress={() => onChange('')}
            hitSlop={10}
            style={[styles.removeBtn, { backgroundColor: T.card, borderColor: T.line }]}
            accessibilityLabel="Remove signature"
          >
            <X size={13} color={T.danger} strokeWidth={ICON_STROKE} />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          onPress={pick}
          disabled={busy}
          activeOpacity={0.8}
          style={[styles.box, styles.empty, { borderColor: T.line, backgroundColor: T.cardAlt }]}
        >
          {busy
            ? <Loader2 size={16} color={T.dim} strokeWidth={ICON_STROKE} />
            : <Pen size={16} color={T.dim} strokeWidth={ICON_STROKE} />}
          <Text style={[styles.emptyTxt, { color: T.dim }]}>{busy ? 'Loading…' : 'Add signature'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// A 3:1 box, matching the PDF template's fixed signature frame.
const styles = StyleSheet.create({
  label: { fontSize: rf(11), fontWeight: '600', marginBottom: 6 },
  box: { width: '100%', aspectRatio: 3, borderRadius: 10, borderWidth: 1.5, overflow: 'hidden' },
  empty: { alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  emptyTxt: { fontSize: rf(12), fontWeight: '600' },
  img: { width: '100%', height: '100%' },
  removeBtn: {
    position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },
});

export default SignatureField;
