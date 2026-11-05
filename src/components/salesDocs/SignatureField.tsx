/**
 * Signature capture for a sales document — mobile twin of web's salesDocs/SignatureField.jsx.
 * Like web, it offers DRAW (a touch/stylus pad) or UPLOAD (photo library). The pad is a 3:1 box
 * — the same shape as the PDF's signature frame — drawn as SVG paths and exported to a
 * 600×200 transparent PNG (react-native-svg's toDataURL), exactly what web stores. An uploaded
 * photo keeps its own aspect ratio and is letterboxed into the 3:1 frame.
 */
import React, { useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, Modal, PanResponder, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { launchImageLibrary } from 'react-native-image-picker';
import { Pen, X, Loader2, Upload, Eraser } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../theme/useAppTheme';
import { ICON_STROKE } from '../common/Icon';
import { rf } from '../../utils/responsive';

interface Props {
  value: string;
  onChange: (dataUri: string) => void;
  label: string;
}


const INK = '#0b1f44';
const OUT_W = 600;
const OUT_H = 200;
const STROKE = 3;

/** Full-screen sheet with a 3:1 drawing pad. Calls onUse with a transparent 600×200 PNG data URI. */
const SignaturePad = ({ open, onClose, onUse }: { open: boolean; onClose: () => void; onUse: (uri: string) => void }) => {
  const T = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
  const padW = Math.round(Math.min(winW - 40, 640));
  const padH = Math.round(padW / 3);
  const [strokes, setStrokes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const svgRef = useRef<any>(null);
  const cur = useRef<string>('');
  const [live, setLive] = useState('');

  const clamp = (v: number, max: number) => Math.max(0, Math.min(max, v));
  const pt = (e: any) => `${clamp(e.nativeEvent.locationX, padW).toFixed(1)} ${clamp(e.nativeEvent.locationY, padH).toFixed(1)}`;

  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (e) => { const p = pt(e); const [x, y] = p.split(' ').map(Number); cur.current = `M${p} L${(x + 0.1).toFixed(1)} ${y}`; setLive(cur.current); },
    onPanResponderMove: (e) => { cur.current += ` L${pt(e)}`; setLive(cur.current); },
    onPanResponderRelease: () => { const d = cur.current; cur.current = ''; setLive(''); if (d) setStrokes(s => [...s, d]); },
    onPanResponderTerminate: () => { const d = cur.current; cur.current = ''; setLive(''); if (d) setStrokes(s => [...s, d]); },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [padW, padH]);

  const clear = () => { cur.current = ''; setLive(''); setStrokes([]); };
  const close = () => { clear(); onClose(); };
  const empty = strokes.length === 0 && !live;

  const use = () => {
    if (!svgRef.current || strokes.length === 0) return;
    setBusy(true);
    svgRef.current.toDataURL((b64: string) => {
      setBusy(false);
      if (!b64) { Alert.alert('Error', 'Could not save the signature. Please try again.'); return; }
      onUse(`data:image/png;base64,${b64}`);
      clear();
    }, { width: OUT_W, height: OUT_H });
  };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={close} supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right', 'portrait-upside-down']}>
      <View style={[styles.backdrop, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
        <View style={[styles.sheet, { backgroundColor: T.card, borderColor: T.line }]}>
          <Text style={[styles.sheetTitle, { color: T.text }]}>Draw signature</Text>
          <Text style={[styles.sheetSub, { color: T.sub }]}>Sign inside the box with your finger or stylus.</Text>
          <View
            style={{ width: padW, height: padH, backgroundColor: '#FFF', borderRadius: 10, borderWidth: 1.5, borderStyle: 'dashed', borderColor: T.line, overflow: 'hidden', alignSelf: 'center' }}
            {...responder.panHandlers}
          >
            <Svg ref={svgRef} width={padW} height={padH} viewBox={`0 0 ${padW} ${padH}`} pointerEvents="none">
              {strokes.map((d, i) => <Path key={i} d={d} stroke={INK} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" fill="none" />)}
              {!!live && <Path d={live} stroke={INK} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" fill="none" />}
            </Svg>
          </View>
          <View style={styles.sheetBtns}>
            <TouchableOpacity onPress={clear} disabled={empty || busy} style={[styles.sBtn, { borderColor: T.line, opacity: empty || busy ? 0.4 : 1 }]}>
              <Eraser size={15} color={T.text} strokeWidth={ICON_STROKE} /><Text style={[styles.sBtnTxt, { color: T.text }]}>Clear</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={close} disabled={busy} style={[styles.sBtn, { borderColor: T.line }]}>
              <Text style={[styles.sBtnTxt, { color: T.text }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={use} disabled={empty || busy} style={[styles.sBtn, { backgroundColor: T.accent, borderColor: T.accent, opacity: empty || busy ? 0.4 : 1 }]}>
              <Text style={[styles.sBtnTxt, { color: '#FFF' }]}>{busy ? 'Saving…' : 'Use signature'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export const SignatureField = ({ value, onChange, label }: Props) => {
  const T = useAppTheme();
  const [busy, setBusy] = useState(false);
  const [padOpen, setPadOpen] = useState(false);
  const [w, setW] = useState(0);

  const pick = async () => {
    setBusy(true);
    try {
      const res = await launchImageLibrary({ mediaType: 'photo', includeBase64: true, quality: 0.7, maxWidth: 600, maxHeight: 200 });
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
    <View onLayout={(e) => setW(Math.round(e.nativeEvent.layout.width))}>
      <Text style={[styles.label, { color: T.dim }]}>{label}</Text>
      {value ? (
        <View style={[styles.box, { borderColor: T.line, backgroundColor: '#FFF', height: w ? Math.round(w / 3) : 64 }]}>
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
        <View style={[styles.box, styles.empty, { borderColor: T.line, backgroundColor: T.cardAlt }]}>
          <TouchableOpacity onPress={() => setPadOpen(true)} disabled={busy} activeOpacity={0.8} style={[styles.act, { borderColor: T.line, backgroundColor: T.card }]}>
            <Pen size={15} color={T.accent} strokeWidth={ICON_STROKE} />
            <Text style={[styles.emptyTxt, { color: T.accent }]}>Draw</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={pick} disabled={busy} activeOpacity={0.8} style={[styles.act, { borderColor: T.line, backgroundColor: T.card }]}>
            {busy ? <Loader2 size={15} color={T.dim} strokeWidth={ICON_STROKE} /> : <Upload size={15} color={T.accent} strokeWidth={ICON_STROKE} />}
            <Text style={[styles.emptyTxt, { color: T.accent }]}>{busy ? 'Loading…' : 'Upload'}</Text>
          </TouchableOpacity>
        </View>
      )}
      <SignaturePad open={padOpen} onClose={() => setPadOpen(false)} onUse={(u) => { setPadOpen(false); onChange(u); }} />
    </View>
  );
};

// A 3:1 box, matching the PDF template's fixed signature frame.
const styles = StyleSheet.create({
  label: { fontSize: rf(11), fontWeight: '600', marginBottom: 6 },
  box: { width: '100%', aspectRatio: 3, borderRadius: 10, borderWidth: 1.5, overflow: 'hidden' },
  empty: { alignItems: 'center', justifyContent: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8, aspectRatio: undefined, minHeight: 64, paddingVertical: 8 },
  act: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 9, borderWidth: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  sheet: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 10, maxWidth: 700, width: '100%' },
  sheetTitle: { fontSize: rf(16), fontWeight: '700' },
  sheetSub: { fontSize: rf(12), fontWeight: '500' },
  sheetBtns: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  sBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  sBtnTxt: { fontSize: rf(12.5), fontWeight: '700' },
  emptyTxt: { fontSize: rf(12), fontWeight: '600' },
  // Absolute-fill so the image's own pixel size can never stretch the fixed 3:1 frame.
  img: { ...StyleSheet.absoluteFillObject },
  removeBtn: {
    position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },
});

export default SignatureField;
