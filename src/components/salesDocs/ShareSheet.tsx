/**
 * Share a saved sales document (quotation / PO / invoice) — mobile twin of web's ShareModal.
 * One signed 7-day link, sent straight to WhatsApp, Email, Microsoft Teams or Telegram, or handed
 * to the system share sheet (any other app); or the PDF file itself. Used by the document list and,
 * for SH/SCA, the register.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Linking } from 'react-native';
import RNShare from 'react-native-share';
import { MessageCircle, Mail, Users, Send, Share2, FileText, Download } from 'lucide-react-native';
import { FormModal } from '../crud';
import { ICON_STROKE } from '../common/Icon';
import { useAppTheme } from '../../theme/useAppTheme';
import { useToast } from '../../context/ToastContext';
import { rf } from '../../utils/responsive';
import { formatDateTime } from '../../utils/formatting';
import { salesDocumentService, SalesDocumentShareLink, fileShareOptions } from '../../api/salesDocumentService';
import { DOC_META, DocType, pdfFileName } from '../../utils/salesDocUtils';

export interface ShareTarget { type: DocType; id: string; documentNumber: string; schoolName?: string; }

/** Opens the stored PDF in the phone's browser/viewer, which downloads it — no share sheet, no print step. */
export async function openStoredPdf(type: DocType, id: string): Promise<void> {
  const res = await salesDocumentService.shareLink(type, id);
  if (!res.data?.url) throw new Error('No PDF has been saved for this document.');
  await Linking.openURL(res.data.url);
}

export const ShareSheet = ({ target, onClose }: { target: ShareTarget | null; onClose: () => void }) => {
  const T = useAppTheme();
  const toast = useToast();
  const [link, setLink] = useState<SalesDocumentShareLink | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    setLink(null); setError(null); setBusy(null);
    if (!target) return;
    let alive = true;
    salesDocumentService.shareLink(target.type, target.id)
      .then((res) => { if (alive) setLink(res.data || null); })
      .catch((err: any) => { if (alive) setError(err?.response?.data?.message || 'Could not create a share link.'); });
    return () => { alive = false; };
  }, [target]);

  if (!target) return null;
  const label = DOC_META[target.type].label;
  const subject = `${label} ${target.documentNumber}${target.schoolName ? ` – ${target.schoolName}` : ''}`;

  // External apps are opened by URL; if the app/site can't be opened, say so rather than failing silently.
  const open = async (url: string, name: string) => {
    try { await Linking.openURL(url); onClose(); } catch { toast.error(`Could not open ${name}.`); }
  };

  const items = link ? [
    { key: 'wa', name: 'WhatsApp', icon: MessageCircle, run: () => open(`https://wa.me/?text=${encodeURIComponent(`${subject}\n${link.url}`)}`, 'WhatsApp') },
    { key: 'mail', name: 'Email', icon: Mail, run: () => open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`${subject}\n${link.url}`)}`, 'your mail app') },
    { key: 'teams', name: 'Microsoft Teams', icon: Users, run: () => open(`https://teams.microsoft.com/share?href=${encodeURIComponent(link.url)}&msgText=${encodeURIComponent(subject)}`, 'Teams') },
    { key: 'tg', name: 'Telegram', icon: Send, run: () => open(`https://t.me/share/url?url=${encodeURIComponent(link.url)}&text=${encodeURIComponent(subject)}`, 'Telegram') },
  ] : [];

  const systemShare = async (kind: 'link' | 'file') => {
    setBusy(kind);
    try {
      if (kind === 'link' && link) {
        await RNShare.open({ url: link.url, title: subject, message: subject, failOnCancel: false });
      } else if (kind === 'file') {
        const file = await salesDocumentService.downloadPdf(target.type, target.id, pdfFileName(target.type, target.documentNumber));
        await RNShare.open({ ...fileShareOptions(file), title: subject, subject, failOnCancel: false });
      }
    } catch (err: any) {
      if (err?.message !== 'User did not share') toast.error(err?.response?.data?.message || 'Could not share.');
    } finally {
      setBusy(null);
    }
  };

  const Row = ({ icon: Icon, name, onPress, loading }: { icon: any; name: string; onPress: () => void; loading?: boolean }) => (
    <TouchableOpacity onPress={onPress} disabled={!!busy} activeOpacity={0.7}
      style={[styles.row, { borderColor: T.line, backgroundColor: T.card }]}>
      <View style={[styles.icon, { backgroundColor: T.accentSoft }]}>
        {loading ? <ActivityIndicator size="small" color={T.accent} /> : <Icon size={18} color={T.accent} strokeWidth={ICON_STROKE} />}
      </View>
      <Text style={[styles.name, { color: T.text }]}>{name}</Text>
    </TouchableOpacity>
  );

  return (
    <FormModal visible title={`Share ${label}`} onClose={onClose}>
      <View style={{ gap: 10 }}>
        <View>
          <Text style={[styles.num, { color: T.text }]}>{target.documentNumber}</Text>
          {!!target.schoolName && <Text style={{ color: T.sub, fontSize: rf(12) }}>{target.schoolName}</Text>}
        </View>

        {error ? (
          <Text style={{ color: T.danger, fontSize: rf(12.5) }}>{error}</Text>
        ) : !link ? (
          <View style={styles.loading}><ActivityIndicator color={T.accent} /><Text style={{ color: T.sub, fontSize: rf(12.5) }}>Creating link…</Text></View>
        ) : (
          <>
            <Text style={{ color: T.sub, fontSize: rf(11.5) }}>
              Anyone with the link can open the PDF until {formatDateTime(link.expiresAt)} (7 days).
            </Text>
            {items.map((i) => <Row key={i.key} icon={i.icon} name={i.name} onPress={i.run} />)}
            <Row icon={Share2} name="More apps…" onPress={() => systemShare('link')} loading={busy === 'link'} />
          </>
        )}
        <Row icon={FileText} name="Send the PDF file…" onPress={() => systemShare('file')} loading={busy === 'file'} />
      </View>
    </FormModal>
  );
};

const styles = StyleSheet.create({
  num: { fontSize: rf(14), fontWeight: '700' },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 12, padding: 10 },
  icon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: rf(13.5), fontWeight: '600' },
});

export default ShareSheet;
