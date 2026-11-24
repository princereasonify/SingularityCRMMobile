import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import axios from 'axios';
import { AlertTriangle, Check, X } from 'lucide-react-native';
import { KeyField } from '../common/KeyField';
import { ICON_STROKE } from '../common/Icon';
import { b2cLeadService } from '../../api/b2c/b2cLeadService';
import { normalizeUserName, sanitizeUserNameInput, userNameFormatError } from '../../utils/b2cUserName';
import { useAppTheme } from '../../theme/useAppTheme';

const DEBOUNCE_MS = 450;
const UNVERIFIED_MSG = 'Could not check right now — it will be checked again when you save.';

/**
 * idle        blank (optional) or unchanged from the lead's current username — nothing to check
 * checking    waiting for the server
 * ok          green  — free
 * unverified  amber  — the format is fine but Reasonify could not be asked; checked again on save
 * taken       red    — already in use
 * invalid     red    — malformed (caught locally, instantly, without a request)
 */
export type UserNameStatus = 'idle' | 'checking' | 'ok' | 'unverified' | 'taken' | 'invalid';

/** A status the parent must hold its Save button back for. */
export const userNameBlocksSave = (s: UserNameStatus) => s === 'checking' || s === 'taken' || s === 'invalid';

interface Props {
  value: string;
  onChange: (v: string) => void;
  /** Editing: so the lead's own username is not reported as taken. */
  leadId?: number;
  /** Editing: what the lead has now — equal to it means "unchanged". */
  currentUserName?: string | null;
  onStatusChange?: (s: UserNameStatus) => void;
  label?: string;
  idleHint?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

/**
 * The student's login username with an Instagram-style live availability check — the mobile twin
 * of the web's UsernameField, same states and same rules.
 *
 * The check waits for typing to pause, and an answer that arrives for a name the user has since
 * changed is thrown away: a slow reply for "viraj" must never paint over the verdict for
 * "virajshah12". The verdict is also shown inside the keyboard sheet (`belowValue`), because the
 * app's own keyboard covers everything under the field while the person is typing.
 */
export const UsernameField = ({
  value, onChange, leadId, currentUserName, onStatusChange,
  label = 'Username',
  idleHint = 'Optional — leave blank and one is created automatically.',
  containerStyle,
}: Props) => {
  const T = useAppTheme();
  const [status, setStatus] = useState<UserNameStatus>('idle');
  const [message, setMessage] = useState('');
  const seq = useRef(0);
  const onStatusRef = useRef(onStatusChange);
  onStatusRef.current = onStatusChange;

  const normalized = normalizeUserName(value);
  const unchanged = !!currentUserName && normalized === normalizeUserName(currentUserName);

  useEffect(() => {
    const mine = ++seq.current;
    const controller = new AbortController();
    const publish = (s: UserNameStatus, m = '') => {
      if (seq.current !== mine) return;
      setStatus(s);
      setMessage(m);
      onStatusRef.current?.(s);
    };

    if (!normalized) { publish('idle'); return undefined; }
    if (unchanged) { publish('idle'); return undefined; }

    const formatError = userNameFormatError(normalized);
    if (formatError) { publish('invalid', formatError); return undefined; }

    publish('checking', 'Checking…');
    const timer = setTimeout(async () => {
      try {
        const res = await b2cLeadService.checkUserName(normalized, leadId, controller.signal);
        const d = res?.data;
        if (!d) { publish('unverified', UNVERIFIED_MSG); return; }
        if (d.reason === 'unverified') publish('unverified', d.message || UNVERIFIED_MSG);
        else if (d.available) publish('ok', `${normalized} is available`);
        else publish(d.reason === 'invalid' ? 'invalid' : 'taken', d.message || 'Username already in use');
      } catch (err) {
        if (controller.signal.aborted || axios.isCancel(err)) return;
        // A failed check is not a verdict: the real one happens on save.
        publish('unverified', UNVERIFIED_MSG);
      }
    }, DEBOUNCE_MS);

    return () => { clearTimeout(timer); controller.abort(); };
  }, [normalized, leadId, unchanged]);

  const bad = status === 'taken' || status === 'invalid';
  const good = status === 'ok';
  const tone = bad ? T.danger : good ? T.success : status === 'unverified' ? T.warning : T.dim;
  const text = status === 'idle' ? (unchanged ? 'Current username.' : idleHint) : message;

  const icon =
    status === 'checking' ? <ActivityIndicator size="small" color={T.dim} />
    : good ? <Check size={16} color={T.success} strokeWidth={ICON_STROKE} />
    : bad ? <X size={16} color={T.danger} strokeWidth={ICON_STROKE} />
    : status === 'unverified' ? <AlertTriangle size={16} color={T.warning} strokeWidth={ICON_STROKE} />
    : null;

  const statusLine = (
    <Text style={[s.status, { color: tone }]} accessibilityLiveRegion="polite">{text}</Text>
  );

  return (
    <View style={[s.wrap, containerStyle]}>
      <KeyField
        label={label}
        value={value}
        onChangeText={v => onChange(sanitizeUserNameInput(v))}
        placeholder="e.g. virajshah12"
        maxLength={30}
        right={icon ? <View style={s.icon}>{icon}</View> : undefined}
        // A bad verdict paints the border red and KeyField prints the message itself, so the
        // line below is only drawn for the other states.
        error={bad ? message : undefined}
        belowValue={statusLine}
      />
      {!bad && statusLine}
    </View>
  );
};

const s = StyleSheet.create({
  wrap: { gap: 5 },
  icon: { width: 20, alignItems: 'center', justifyContent: 'center' },
  status: { fontSize: 11.5, fontWeight: '500' },
});
