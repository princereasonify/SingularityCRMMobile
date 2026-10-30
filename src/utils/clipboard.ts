import { Clipboard } from 'react-native';

/**
 * The app's own keyboards (KeyField / NumField / the login CustomKeyboard) replace the OS
 * keyboard, so the OS paste menu never appears over them — these helpers back their
 * Paste / Copy buttons. RN core Clipboard is deprecated but still shipped in 0.84 and needs
 * no native dependency (PaymentsScreen already uses it).
 */

/** Clipboard text as ONE line: line breaks become spaces, ends trimmed. Empty on any failure. */
export const readClipboardLine = async (): Promise<string> => {
  try {
    const raw = await Clipboard.getString();
    return (raw || '').replace(/[\r\n]+/g, ' ').trim();
  } catch {
    return '';
  }
};

export const writeClipboard = (text: string) => {
  try { Clipboard.setString(text); } catch { /* clipboard unavailable — nothing to do */ }
};
