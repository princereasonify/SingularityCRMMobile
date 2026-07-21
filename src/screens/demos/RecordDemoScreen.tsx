import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Share,
  Linking,
  PermissionsAndroid,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { launchCamera } from 'react-native-image-picker';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import {
  Video as VideoIcon,
  Mic,
  Square,
  Trash2,
  Play,
  Pause,
  Link2,
  Check,
  Circle,
  Clock,
  HardDrive,
  Save,
  Edit2,
  Volume2,
  AlertTriangle,
  Monitor,
  Filter,
  User as UserIcon,
  Upload,
} from 'lucide-react-native';

import { demosApi, MAX_RECORDING_BYTES } from '../../api/demos';
import { DemoRecordingDto, RecordingMediaType, DemoAssignment } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { DateInput } from '../../components/common/DateInput';
import {
  Btn, Field, Input, SearchBar, Segmented, Trigger, Dropdown,
  StatusBadge, FilterChip, Pagination, ListCard, FormModal, ConfirmModal,
} from '../../components/crud';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useAppTheme } from '../../theme/useAppTheme';
import { AppTheme, withAlpha, SOFT_TINT } from '../../theme';
import { rf, isTabletDevice } from '../../utils/responsive';

/**
 * Record Demo — the mobile counterpart of the web RecordingStudio.
 *
 * Platform note: this screen is **video + audio only**. The web studio also offers
 * screen capture (getDisplayMedia); there is no equivalent a plain RN app can drive,
 * so it is deliberately absent from the recorder. The library still *filters* by
 * screen, because rows recorded on the web can appear in the same list.
 */

const MAX_TITLE = 200;
/** Web warns at 270 MB against its 300 MB cap — same 90% ratio, off the backend's constant. */
const WARN_RECORDING_BYTES = Math.round(MAX_RECORDING_BYTES * 0.9);

type Phase = 'idle' | 'recording' | 'review';
/** Recorder modes. `screen` is intentionally not offered — see the note above. */
type Mode = 'video' | 'audio';

const MODES: { key: Mode; label: string; desc: string }[] = [
  { key: 'video', label: 'Camera', desc: 'Record yourself with the camera and mic.' },
  { key: 'audio', label: 'Audio', desc: 'Voice-only — smallest files, quickest upload.' },
];

const MEDIA_FILTERS: { label: string; value: '' | RecordingMediaType }[] = [
  { label: 'All', value: '' },
  { label: 'Camera', value: 'video' },
  { label: 'Audio', value: 'audio' },
  { label: 'Screen', value: 'screen' },
];

const fmtBytes = (b?: number | null) => {
  if (b == null) return '—';
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1073741824) return `${(b / 1048576).toFixed(1)} MB`;
  return `${(b / 1073741824).toFixed(2)} GB`;
};

const fmtDuration = (sec: number) => {
  const t = Math.max(0, Math.floor(sec));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
};

const fmtDate = (d?: string) =>
  !d ? '—' : new Date(d).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

/** Role tint — theme tokens only, one hue per role like web's role badge. */
const roleColor = (role: string, T: AppTheme) =>
  ({ FO: T.info, ZH: T.accent, RH: T.warning, SH: T.success, SCA: T.danger } as Record<string, string>)[role] || T.sub;

const mediaColor = (m: string, T: AppTheme) =>
  m === 'audio' ? T.info : m === 'screen' ? T.warning : T.accent;

/** dBFS (−160…0) → 0–100. The recorder reports metering only when it is enabled. */
const dbToPct = (db?: number) => {
  if (db == null || !isFinite(db)) return 0;
  return Math.round(Math.max(0, Math.min(100, ((db + 60) / 60) * 100)));
};

/** Progress/meter bar — one bar style for mic level, size and upload. */
const Meter = ({ pct, color }: { pct: number; color: string }) => {
  const T = useAppTheme();
  return (
    <View style={[s.track, { backgroundColor: T.cardAlt }]}>
      <View style={[s.trackFill, { width: `${Math.max(0, Math.min(100, pct))}%`, backgroundColor: color }]} />
    </View>
  );
};

/**
 * House page size — 10 on every list screen (SchoolsListScreen, LeadsListScreen,
 * TargetsScreen, AllowancesScreen, PaymentsScreen, DemoListScreen).
 *
 * CLIENT-side, because the recordings endpoint has filters but no paging.
 * DemosController:
 *   [HttpGet("recordings")]
 *   public async Task<IActionResult> GetVisibleRecordings(
 *       [FromQuery] string? mediaType,
 *       [FromQuery] DateTime? from,
 *       [FromQuery] DateTime? to,
 *       [FromQuery] int? userId,
 *       [FromQuery] string? search)
 *   { ... return Ok(ApiResponse<List<DemoRecordingDto>>.Ok(rows)); }
 * No page/limit parameters and a bare List<DemoRecordingDto> — nothing to defer to,
 * so the filtered set arrives whole and we slice it here.
 *
 * (The separate attach picker, GET /demos, *is* paged — `[FromQuery] int page = 1,
 * [FromQuery] int limit = 20` → `Ok(ApiResponse<object>.Ok(new { demos, total, page,
 * limit }))` — but it is a one-shot modal picker, not a browsable list, so its
 * existing `{ page: 1, limit: 100 }` fetch and the ownership filter stay untouched.)
 */
const PAGE_SIZE = 10;

export const RecordDemoScreen = (_props: any) => {
  const T = useAppTheme();
  const { width, height } = useWindowDimensions();
  const wide = isTabletDevice && width > height;
  /** House split: iPad gets a real table, phone gets .lcard rows (SchoolsListScreen). */
  const table = isTabletDevice;
  const { user } = useAuth();

  // Gate copied from web RecordingStudio: SCA is view-only (backend 403s SCA writes),
  // and write actions on a row only appear for the row's own poster.
  const isSca = user?.role === 'SCA';
  const myUserId = user?.id;

  const [rows, setRows] = useState<DemoRecordingDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ── Studio state ──
  const [phase, setPhase] = useState<Phase>('idle');
  const [mode, setMode] = useState<Mode>('video');
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState('');
  const audioUri = useRef<string | null>(null);

  // Captured-but-not-yet-uploaded file (web's "review" phase).
  const [pending, setPending] = useState<
    { uri: string; name: string; type: string; mode: Mode; durationSec: number; sizeBytes?: number } | null
  >(null);
  const [title, setTitle] = useState('');

  // Review playback (audio only — RN core has no video player and none is installed).
  const [playing, setPlaying] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [pct, setPct] = useState(0);

  // ── Filters ──
  const [mediaType, setMediaType] = useState<'' | RecordingMediaType>('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [userId, setUserId] = useState('');
  const [posterOpen, setPosterOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // ── Row actions ──
  const [editing, setEditing] = useState<DemoRecordingDto | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleting, setDeleting] = useState<DemoRecordingDto | null>(null);
  const [attaching, setAttaching] = useState<DemoRecordingDto | null>(null);
  const [demos, setDemos] = useState<DemoAssignment[]>([]);
  const [loadingDemos, setLoadingDemos] = useState(false);

  const fetchRows = useCallback(async () => {
    try {
      // Controller: GetVisibleRecordings([FromQuery] mediaType, from, to, userId, search)
      // → Ok(ApiResponse<List<DemoRecordingDto>>) — apiClient unwraps to a bare array.
      const res = await demosApi.getRecordings({
        mediaType: mediaType || undefined,
        from: from || undefined,
        to: to || undefined,
        userId: userId ? Number(userId) : undefined,
        search: search || undefined,
      });
      setRows(res.data ?? []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [mediaType, from, to, userId, search]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  // ── Pagination (client-side; see PAGE_SIZE) ────────────────────────────────
  const [page, setPage] = useState(1);
  /** Any filter change re-queries the server, so the old page number is meaningless. */
  useEffect(() => { setPage(1); }, [mediaType, from, to, userId, search]);

  const totalCount = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  /** Clamp: deleting the last row on the final page must not strand us past the end. */
  useEffect(() => { setPage(p => Math.min(p, totalPages)); }, [totalPages]);

  const pagedRows = useMemo(
    () => rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [rows, page],
  );
  const shownFrom = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const shownTo = Math.min(page * PAGE_SIZE, totalCount);

  // Debounce the search box so we don't hit the API on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Remember every poster we have ever seen unfiltered. Web derives its poster
  // dropdown from the *current* list, which collapses to a single option the moment
  // you filter by a poster; accumulating keeps the control usable while offering the
  // same set. Only unfiltered fetches contribute, since a filtered list is a subset.
  const [posters, setPosters] = useState<{ id: number; name: string; role: string }[]>([]);
  useEffect(() => {
    if (userId) return;
    setPosters(prev => {
      const map = new Map(prev.map(p => [p.id, p]));
      rows.forEach(r => map.set(r.userId, { id: r.userId, name: r.userName, role: r.userRole }));
      const next = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
      // Bail out when nothing new appeared, otherwise setState would loop forever.
      if (next.length === prev.length && next.every((p, i) => p.id === prev[i].id)) return prev;
      return next;
    });
  }, [rows, userId]);

  const posterOptions = useMemo(() => [
    { label: 'All posters', value: '' },
    ...posters.map(p => ({ label: `${p.name} (${p.role})`, value: String(p.id) })),
  ], [posters]);

  const posterLabel = posterOptions.find(o => o.value === userId)?.label ?? 'All posters';

  const activeChips = [
    mediaType && { label: MEDIA_FILTERS.find(f => f.value === mediaType)?.label ?? mediaType, clear: () => setMediaType('') },
    search && { label: `“${search}”`, clear: () => { setSearchInput(''); setSearch(''); } },
    userId && { label: posterLabel, clear: () => setUserId('') },
    from && { label: `From ${from}`, clear: () => setFrom('') },
    to && { label: `To ${to}`, clear: () => setTo('') },
  ].filter(Boolean) as { label: string; clear: () => void }[];

  const clearFilters = () => {
    setMediaType(''); setFrom(''); setTo(''); setUserId(''); setSearchInput(''); setSearch('');
  };

  // Stop any listeners if the screen goes away mid-session.
  useEffect(() => () => {
    AudioRecorderPlayer.removeRecordBackListener();
    AudioRecorderPlayer.removePlayBackListener();
    AudioRecorderPlayer.stopPlayer().catch(() => {});
  }, []);

  // ─── Capture ───────────────────────────────────────────────────────────────
  const ensureMic = async () => {
    if (Platform.OS !== 'android') return true;
    const g = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
    return g === PermissionsAndroid.RESULTS.GRANTED;
  };

  /** Video: capture with the system camera, then hand off to review. */
  const recordVideo = async () => {
    setError('');
    const res = await launchCamera({
      mediaType: 'video',
      videoQuality: 'high',
      durationLimit: 600,
      saveToPhotos: false,
    });
    if (res.didCancel) return;
    const asset = res.assets?.[0];
    if (!asset?.uri) {
      if (res.errorMessage) setError(res.errorMessage);
      return;
    }
    if ((asset.fileSize ?? 0) > MAX_RECORDING_BYTES) {
      setError(`That recording is ${fmtBytes(asset.fileSize)} — the maximum is ${fmtBytes(MAX_RECORDING_BYTES)}.`);
      return;
    }
    const name = asset.fileName || `demo-${Date.now()}.mov`;
    setPending({
      uri: asset.uri,
      name,
      // iOS returns .mov (video/quicktime), Android .mp4 — both accepted server-side.
      type: asset.type || (Platform.OS === 'ios' ? 'video/quicktime' : 'video/mp4'),
      mode: 'video',
      durationSec: asset.duration ?? 0,
      sizeBytes: asset.fileSize,
    });
    setTitle(name.replace(/\.[^.]+$/, ''));
    setPhase('review');
  };

  /** Audio: record with the mic. */
  const startAudio = async () => {
    setError('');
    if (!(await ensureMic())) {
      setError('Microphone access is required to record audio. Enable it in Settings.');
      return;
    }
    try {
      AudioRecorderPlayer.setSubscriptionDuration(0.5);
      // Third arg enables metering so we can show a live mic level, like web does.
      const uri = await AudioRecorderPlayer.startRecorder(undefined, undefined, true);
      audioUri.current = uri;
      setElapsed(0);
      setLevel(0);
      setPaused(false);
      setPhase('recording');
      AudioRecorderPlayer.addRecordBackListener(e => {
        setElapsed((e.currentPosition ?? 0) / 1000);
        setLevel(dbToPct(e.currentMetering));
      });
    } catch {
      setError('Could not start recording. Please try again.');
    }
  };

  const start = () => (mode === 'video' ? recordVideo() : startAudio());

  const pauseAudio = async () => {
    try { await AudioRecorderPlayer.pauseRecorder(); setPaused(true); setLevel(0); }
    catch { setError('Could not pause the recording.'); }
  };

  const resumeAudio = async () => {
    try { await AudioRecorderPlayer.resumeRecorder(); setPaused(false); }
    catch { setError('Could not resume the recording.'); }
  };

  /** Stop the mic and move to review — the upload happens on Save, like web. */
  const stopAudio = async () => {
    try {
      const uri = await AudioRecorderPlayer.stopRecorder();
      AudioRecorderPlayer.removeRecordBackListener();
      const secs = elapsed;
      setPaused(false);
      setLevel(0);
      const path = uri || audioUri.current;
      if (!path) { setPhase('idle'); return; }
      setPending({
        uri: path,
        name: `demo-audio-${Date.now()}.m4a`,
        type: 'audio/mp4', // .m4a — in the backend's allowed audio list
        mode: 'audio',
        durationSec: secs,
      });
      setTitle(`Audio demo — ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`);
      setElapsed(0);
      setPhase('review');
    } catch {
      setPhase('idle');
      setError('Could not save the recording. Please try again.');
    }
  };

  // ─── Review ────────────────────────────────────────────────────────────────
  const stopPlayback = useCallback(async () => {
    try {
      AudioRecorderPlayer.removePlayBackListener();
      await AudioRecorderPlayer.stopPlayer();
    } catch { /* player may not be running */ }
    setPlaying(false);
  }, []);

  const togglePlay = async () => {
    if (!pending) return;
    if (playing) { await stopPlayback(); return; }
    try {
      await AudioRecorderPlayer.startPlayer(pending.uri);
      setPlaying(true);
      AudioRecorderPlayer.addPlayBackListener(e => {
        if (e.currentPosition >= e.duration && e.duration > 0) { stopPlayback(); }
      });
    } catch {
      setError('Could not play this recording back.');
    }
  };

  const discard = async () => {
    await stopPlayback();
    setPending(null);
    setTitle('');
    setPhase('idle');
  };

  const save = async () => {
    if (!pending || !title.trim()) return;
    await stopPlayback();
    setUploading(true);
    setPct(0);
    try {
      // Unchanged pipeline call — POST /demos/recordings (multipart) with progress.
      await demosApi.uploadRecording(
        { uri: pending.uri, name: pending.name, type: pending.type },
        pending.mode,
        title.trim(),
        pending.durationSec,
        setPct,
      );
      setPending(null);
      setTitle('');
      setPhase('idle');
      await fetchRows();
    } catch (err: any) {
      Alert.alert('Upload failed', err?.response?.data?.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
      setPct(0);
    }
  };

  // ─── Row actions ───────────────────────────────────────────────────────────
  const saveRename = async () => {
    if (!editing) return;
    const t = editTitle.trim();
    if (!t) { Alert.alert('Title required', 'Title cannot be empty.'); return; }
    if (t === editing.title) { setEditing(null); return; }
    setSavingEdit(true);
    try {
      await demosApi.renameRecording(editing.id, t);
      setEditing(null);
      await fetchRows();
    } catch (err: any) {
      Alert.alert('Rename failed', err?.response?.data?.message || 'Please try again.');
    } finally {
      setSavingEdit(false);
    }
  };

  const doDelete = async () => {
    if (!deleting) return;
    const row = deleting;
    setDeleting(null);
    try {
      await demosApi.deleteRecording(row.id);
      await fetchRows();
    } catch (err: any) {
      Alert.alert('Delete failed', err?.response?.data?.message || 'Please try again.');
    }
  };

  const openUrl = async (url: string) => {
    try { await Linking.openURL(url); }
    catch { Alert.alert('Cannot open', 'No app is available to open this recording.'); }
  };

  /** Mobile stand-in for web's "Copy link" — the share sheet includes Copy. */
  const shareUrl = async (r: DemoRecordingDto) => {
    try { await Share.share({ message: r.url, url: r.url, title: r.title }); }
    catch { /* user dismissed the sheet */ }
  };

  const openAttach = async (r: DemoRecordingDto) => {
    setAttaching(r);
    setLoadingDemos(true);
    try {
      // Controller: GetDemos([FromQuery] ... int page = 1, int limit = 20)
      //   → Ok(ApiResponse<object>.Ok(new { demos, total, page, limit }))
      const res = await demosApi.getAll({ page: 1, limit: 100 });

      // Show only demos this user can actually attach to. The server rule is
      // "assignee or requester only" (DemoRecordingService.AttachRecordingToDemoAsync),
      // so listing anything else produces a row that 403s the moment it is tapped.
      // This matters most for a ZH, whose list now spans their whole zone: without
      // the filter, nearly every row in the picker would be a dead end.
      const rows = res.data?.demos ?? [];
      setDemos(rows.filter(d => d.assignedToId === myUserId || d.requestedById === myUserId));
    } catch {
      setDemos([]);
    } finally {
      setLoadingDemos(false);
    }
  };

  const doAttach = async (demoId: number) => {
    if (!attaching) return;
    try {
      await demosApi.attachRecording(demoId, attaching.id);
      setAttaching(null);
      await fetchRows();
    } catch (err: any) {
      Alert.alert('Attach failed', err?.response?.data?.message || 'Please try again.');
    }
  };

  if (loading) return <LoadingSpinner fullScreen color={T.accent} message="Loading recordings..." />;

  // ─── Studio panel ──────────────────────────────────────────────────────────
  const sizePct = pending?.sizeBytes ? (pending.sizeBytes / MAX_RECORDING_BYTES) * 100 : 0;
  const sizeColor = !pending?.sizeBytes
    ? T.success
    : pending.sizeBytes >= MAX_RECORDING_BYTES ? T.danger
      : pending.sizeBytes >= WARN_RECORDING_BYTES ? T.warning : T.success;

  const errorBanner = !!error && (
    <View style={[s.banner, { backgroundColor: withAlpha(T.danger, SOFT_TINT), borderColor: withAlpha(T.danger, SOFT_TINT) }]}>
      <AlertTriangle size={15} color={T.danger} strokeWidth={2} />
      <Text style={[s.bannerTxt, { color: T.danger }]}>{error}</Text>
    </View>
  );

  const idlePanel = (
    <View style={s.gap14}>
      <Text style={[s.h3, { color: T.text }]}>Choose recording mode</Text>
      <View style={[s.modeGrid, !wide && s.modeGridPhone]}>
        {MODES.map(m => {
          const on = mode === m.key;
          const Icon = m.key === 'audio' ? Mic : VideoIcon;
          return (
            <TouchableOpacity
              key={m.key}
              onPress={() => setMode(m.key)}
              activeOpacity={0.85}
              style={[
                s.modeCard,
                { backgroundColor: on ? T.accentSoft : T.card, borderColor: on ? T.accent : T.line },
              ]}
            >
              <View style={s.modeTop}>
                <Icon size={19} color={on ? T.accent : T.dim} strokeWidth={1.9} />
                <Text style={[s.modeLabel, { color: T.text }]}>{m.label}</Text>
                {on && <Check size={15} color={T.accent} strokeWidth={2.4} />}
              </View>
              <Text style={[s.modeDesc, { color: T.sub }]}>{m.desc}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={[s.banner, { backgroundColor: T.cardAlt, borderColor: T.line }]}>
        <HardDrive size={14} color={T.dim} strokeWidth={1.9} />
        <Text style={[s.bannerTxt, { color: T.sub }]}>
          Max recording size: {fmtBytes(MAX_RECORDING_BYTES)}. Camera clips are capped at 10 minutes.
        </Text>
      </View>

      {errorBanner}

      <Btn
        label="Start Recording"
        variant="danger"
        onPress={start}
        icon={<Circle size={13} color="#FFF" fill="#FFF" />}
      />
    </View>
  );

  const recordingPanel = (
    <View style={s.gap14}>
      <View style={s.recHead}>
        <View style={[s.dot, { backgroundColor: paused ? T.dim : T.danger }]} />
        <Text style={[s.h3, { color: T.text }]}>{paused ? 'Paused' : 'Recording…'}</Text>
        <Text style={[s.recMode, { color: T.sub }]}>Audio</Text>
        <View style={s.flex} />
        <Clock size={12} color={T.sub} strokeWidth={2} />
        <Text style={[s.recTime, { color: T.text }]}>{fmtDuration(elapsed)}</Text>
      </View>

      <View style={[s.micStage, { backgroundColor: T.cardAlt, borderColor: T.line }]}>
        <Mic size={38} color={paused ? T.dim : T.danger} strokeWidth={1.7} />
        <Text style={[s.micTxt, { color: T.sub }]}>
          {paused ? 'Recording paused' : 'Audio recording in progress'}
        </Text>
      </View>

      {/* Mic level — confirms the mic is actually picking up sound. */}
      <View style={s.gap6}>
        <View style={s.meterHead}>
          <View style={s.meterLabel}>
            <Volume2 size={12} color={T.sub} strokeWidth={2} />
            <Text style={[s.meta, { color: T.sub }]}>Mic level {level === 0 && !paused ? '— silent' : ''}</Text>
          </View>
          <Text style={[s.meta, { color: T.sub }]}>{level}%</Text>
        </View>
        <Meter pct={level} color={T.success} />
        {!paused && level === 0 && elapsed > 2 && (
          <Text style={[s.warnTxt, { color: T.warning }]}>
            No sound from your mic yet — speak to test, or check the mic permission.
          </Text>
        )}
      </View>

      {errorBanner}

      <View style={s.row10}>
        {paused ? (
          <Btn label="Resume" onPress={resumeAudio} icon={<Play size={15} color="#FFF" />} style={s.flex} />
        ) : (
          <Btn label="Pause" variant="secondary" onPress={pauseAudio} icon={<Pause size={15} color={T.text} />} style={s.flex} />
        )}
        <Btn
          label="End Recording"
          variant="danger"
          onPress={stopAudio}
          icon={<Square size={13} color="#FFF" fill="#FFF" />}
          style={s.flex}
        />
      </View>
    </View>
  );

  const reviewPanel = pending && (
    <View style={s.gap14}>
      <View style={s.recHead}>
        <Check size={15} color={T.success} strokeWidth={2.4} />
        <Text style={[s.h3, { color: T.text }]}>Recording finished</Text>
        <View style={s.flex} />
        <Text style={[s.meta, { color: T.sub }]}>
          {fmtDuration(pending.durationSec)}{pending.sizeBytes ? ` · ${fmtBytes(pending.sizeBytes)}` : ''}
        </Text>
      </View>

      {pending.mode === 'audio' ? (
        <TouchableOpacity
          onPress={togglePlay}
          activeOpacity={0.85}
          style={[s.micStage, { backgroundColor: T.cardAlt, borderColor: T.line }]}
        >
          <View style={[s.playTile, { backgroundColor: T.accentSoft }]}>
            {playing ? <Pause size={22} color={T.accent} strokeWidth={2} /> : <Play size={22} color={T.accent} strokeWidth={2} />}
          </View>
          <Text style={[s.micTxt, { color: T.sub }]}>{playing ? 'Playing… tap to stop' : 'Tap to play back'}</Text>
        </TouchableOpacity>
      ) : (
        <View style={[s.micStage, { backgroundColor: T.cardAlt, borderColor: T.line }]}>
          <VideoIcon size={34} color={T.accent} strokeWidth={1.7} />
          <Text style={[s.micTxt, { color: T.sub }]}>Video captured — ready to upload</Text>
        </View>
      )}

      {/* Real byte size against the cap, coloured like web's size bar. */}
      {!!pending.sizeBytes && (
        <View style={s.gap6}>
          <View style={s.meterHead}>
            <Text style={[s.meta, { color: T.sub }]}>{fmtBytes(pending.sizeBytes)} / {fmtBytes(MAX_RECORDING_BYTES)}</Text>
            <Text style={[s.meta, { color: T.sub }]}>{sizePct.toFixed(1)}%</Text>
          </View>
          <Meter pct={sizePct} color={sizeColor} />
        </View>
      )}

      <Input
        label="Title *"
        value={title}
        onChangeText={t => setTitle(t.slice(0, MAX_TITLE))}
        placeholder="e.g. ABC School demo — 12 May"
        maxLength={MAX_TITLE}
      />
      <Text style={[s.meta, { color: T.dim }]}>
        {title.length}/{MAX_TITLE} characters · You can rename it later from the library too.
      </Text>

      {uploading && (
        <View style={s.gap6}>
          <View style={s.meterHead}>
            <Text style={[s.meta, { color: T.sub }]}>Uploading…</Text>
            <Text style={[s.meta, { color: T.sub }]}>{pct}%</Text>
          </View>
          <Meter pct={pct} color={T.accent} />
        </View>
      )}

      {errorBanner}

      <View style={s.row10}>
        <Btn
          label="Discard"
          variant="dangerGhost"
          onPress={discard}
          disabled={uploading}
          icon={<Trash2 size={14} color={T.danger} />}
          style={s.flex}
        />
        <Btn
          label={uploading ? 'Uploading…' : 'Save Recording'}
          onPress={save}
          loading={uploading}
          disabled={uploading || !title.trim()}
          icon={<Save size={14} color="#FFF" />}
          style={s.flex}
        />
      </View>
    </View>
  );

  const studio = !isSca && (
    <View style={[s.card, { backgroundColor: T.card, borderColor: T.line }]}>
      {phase === 'idle' && idlePanel}
      {phase === 'recording' && recordingPanel}
      {phase === 'review' && reviewPanel}
    </View>
  );

  // ─── Library row parts (shared by the iPad table and the phone rows) ───────
  const mediaTile = (r: DemoRecordingDto) => {
    const c = mediaColor(r.mediaType, T);
    return (
      <View style={[s.tile, { backgroundColor: withAlpha(c, SOFT_TINT) }]}>
        {r.mediaType === 'audio'
          ? <Mic size={16} color={c} strokeWidth={1.9} />
          : r.mediaType === 'screen'
            ? <Monitor size={16} color={c} strokeWidth={1.9} />
            : <VideoIcon size={16} color={c} strokeWidth={1.9} />}
      </View>
    );
  };

  /** Web parity: write actions only on rows you posted, never for SCA. Unchanged. */
  const recActions = (r: DemoRecordingDto) => {
    const canWrite = !isSca && r.userId === myUserId;
    return (
      <>
        <TouchableOpacity style={s.act} onPress={() => openUrl(r.url)}>
          <Play size={14} color={T.sub} strokeWidth={1.9} />
          <Text style={[s.actTxt, { color: T.sub }]}>Open</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.act} onPress={() => shareUrl(r)}>
          <Link2 size={14} color={T.sub} strokeWidth={1.9} />
          <Text style={[s.actTxt, { color: T.sub }]}>Share</Text>
        </TouchableOpacity>
        {canWrite && (
          <>
            <TouchableOpacity style={s.act} onPress={() => { setEditing(r); setEditTitle(r.title); }}>
              <Edit2 size={14} color={T.sub} strokeWidth={1.9} />
              <Text style={[s.actTxt, { color: T.sub }]}>Rename</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.act} onPress={() => openAttach(r)}>
              <Upload size={14} color={T.accent} strokeWidth={1.9} />
              <Text style={[s.actTxt, { color: T.accent }]}>{r.attachedDemoId ? 'Re-attach' : 'Attach'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityLabel="Delete recording"
              style={s.act}
              onPress={() => setDeleting(r)}
            >
              <Trash2 size={14} color={T.danger} strokeWidth={1.9} />
            </TouchableOpacity>
          </>
        )}
      </>
    );
  };

  /**
   * iPad table. Every header <Text> carries the SAME column style object as the body
   * cell beneath it (s.cRec / s.cPoster / s.cDate / s.cLen / s.cSize / s.cRecActions),
   * so a column can never drift out from under its heading.
   */
  const renderRecTable = () => (
    <View style={[s.tbl, { borderColor: T.line }]}>
      <View style={[s.tr, { backgroundColor: T.cardAlt }]}>
        <Text style={[s.th, { color: T.dim }, s.cRec]}>Recording</Text>
        <Text style={[s.th, { color: T.dim }, s.cPoster]}>Poster</Text>
        <Text style={[s.th, { color: T.dim }, s.cDate]}>Recorded</Text>
        <Text style={[s.th, { color: T.dim }, s.cLen]}>Length</Text>
        <Text style={[s.th, { color: T.dim }, s.cSize]}>Size</Text>
        <Text style={[s.th, { color: T.dim }, s.cRecActions]}>Actions</Text>
      </View>

      {pagedRows.map(r => (
        <View key={r.id} style={[s.tr, { borderTopColor: T.line, borderTopWidth: 1 }]}>
          <View style={[s.cRec, s.recNameCell]}>
            {mediaTile(r)}
            <View style={s.flexMin}>
              <Text numberOfLines={1} style={[s.rowTitle, { color: T.text }]}>{r.title}</Text>
              {!!r.attachedDemoId && (
                <Text numberOfLines={1} style={[s.attached, { color: T.success }]}>
                  Attached to demo #{r.attachedDemoId}
                </Text>
              )}
            </View>
          </View>

          <View style={[s.cPoster, s.posterCell]}>
            <Text numberOfLines={1} style={[s.meta, s.flexMin, { color: T.sub }]}>
              {r.userName || '—'}
            </Text>
            {!!r.userRole && <StatusBadge label={r.userRole} color={roleColor(r.userRole, T)} />}
          </View>

          <Text numberOfLines={1} style={[s.meta, { color: T.sub }, s.cDate]}>{fmtDate(r.createdAt)}</Text>
          <Text numberOfLines={1} style={[s.meta, { color: T.sub }, s.cLen]}>{fmtDuration(r.durationSec)}</Text>
          <Text numberOfLines={1} style={[s.meta, { color: T.sub }, s.cSize]}>{fmtBytes(r.fileSizeBytes)}</Text>

          <View style={[s.cRecActions, s.tblActions]}>{recActions(r)}</View>
        </View>
      ))}
    </View>
  );

  /** Phone: .lcard rows, one recording per row. */
  const renderRecRows = () => (
    <View style={s.gap8}>
      {pagedRows.map(r => (
        <ListCard key={r.id} style={s.rowCard}>
          <View style={s.rowTop}>
            {mediaTile(r)}
            <View style={s.flexMin}>
              <View style={s.titleRow}>
                <Text numberOfLines={1} style={[s.rowTitle, s.flexMin, { color: T.text }]}>{r.title}</Text>
                {!!r.userRole && <StatusBadge label={r.userRole} color={roleColor(r.userRole, T)} />}
              </View>
              <Text numberOfLines={2} style={[s.meta, { color: T.sub }]}>
                {r.userName ? `${r.userName} · ` : ''}{fmtDate(r.createdAt)} · {fmtDuration(r.durationSec)} · {fmtBytes(r.fileSizeBytes)}
              </Text>
              {!!r.attachedDemoId && (
                <Text style={[s.attached, { color: T.success }]}>Attached to demo #{r.attachedDemoId}</Text>
              )}
            </View>
          </View>

          <View style={[s.rowActions, { borderTopColor: T.line }]}>{recActions(r)}</View>
        </ListCard>
      ))}
    </View>
  );

  // ─── Library ───────────────────────────────────────────────────────────────
  const library = (
    <View style={[s.card, { backgroundColor: T.card, borderColor: T.line }]}>
      <View style={s.libHead}>
        <View style={s.flex}>
          <Text style={[s.h3, { color: T.text }]}>{isSca ? 'All Recordings' : 'Recordings'}</Text>
          <Text style={[s.meta, { color: T.sub }]}>
            {isSca
              ? 'Every recording posted across the company.'
              : 'Yours and your team’s. Rename, attach to a demo, or delete your own.'}
          </Text>
        </View>
        <Text style={[s.meta, { color: T.dim }]}>{rows.length} {rows.length === 1 ? 'recording' : 'recordings'}</Text>
      </View>

      <Segmented<'' | RecordingMediaType>
        value={mediaType}
        options={MEDIA_FILTERS}
        onChange={setMediaType}
      />

      <View style={s.searchRow}>
        <SearchBar
          value={searchInput}
          onChangeText={setSearchInput}
          placeholder="Search title or poster name…"
          style={s.flex}
        />
        <Trigger
          label="Filters"
          open={showFilters}
          onPress={() => setShowFilters(v => !v)}
          icon={<Filter size={14} color={T.sub} strokeWidth={1.9} />}
        />
      </View>

      {showFilters && (
        <View style={[s.filters, { borderTopColor: T.line }]}>
          <Field label="Poster">
            <Trigger
              label={posterLabel}
              open={posterOpen}
              onPress={() => setPosterOpen(v => !v)}
              icon={<UserIcon size={14} color={T.sub} strokeWidth={1.9} />}
            />
            {posterOpen && (
              <Dropdown
                style={s.ddFull}
                maxHeight={220}
                value={userId}
                options={posterOptions}
                onSelect={v => { setUserId(v); setPosterOpen(false); }}
              />
            )}
          </Field>
          <View style={[s.row10, !wide && s.colPhone]}>
            <View style={s.flex}><DateInput label="From" value={from} onChange={setFrom} accentColor={T.accent} /></View>
            <View style={s.flex}><DateInput label="To" value={to} onChange={setTo} accentColor={T.accent} /></View>
          </View>
        </View>
      )}

      {activeChips.length > 0 && (
        <View style={s.chipRow}>
          {activeChips.map(c => <FilterChip key={c.label} label={c.label} onRemove={c.clear} />)}
          <TouchableOpacity onPress={clearFilters} hitSlop={8} style={s.clearAll}>
            <Text style={[s.clearTxt, { color: T.accent }]}>Clear all</Text>
          </TouchableOpacity>
        </View>
      )}

      {rows.length === 0 ? (
        <View style={s.empty}>
          <Monitor size={30} color={T.dim} strokeWidth={1.6} />
          <Text style={[s.emptyTxt, { color: T.sub }]}>
            {activeChips.length > 0 ? 'No recordings match your filters.' : 'No recordings yet. Record one above.'}
          </Text>
        </View>
      ) : (
        <>
          {table ? renderRecTable() : renderRecRows()}
          {totalPages > 1 && (
            <View style={s.pgRow}>
              <Text style={[s.meta, { color: T.dim }]}>
                Showing {shownFrom}–{shownTo} of {totalCount}
              </Text>
              <Pagination page={page} pageCount={totalPages} onChange={setPage} />
            </View>
          )}
        </>
      )}
    </View>
  );

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: T.bg }]} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={[s.scroll, wide && s.scrollWide]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchRows(); }}
            colors={[T.accent]}
            tintColor={T.accent}
          />
        }
      >
        {/* Plain title block on the page background — the house pattern. */}
        <View>
          <Text style={[s.h1, { color: T.text }]}>{isSca ? 'Demo Recordings' : 'Recording Studio'}</Text>
          <Text style={[s.h1sub, { color: T.sub }]}>
            {isSca
              ? 'Browse all demo recordings posted across the company. Read-only access.'
              : 'Record demos in-app — camera or audio. Name each take before it uploads.'}
          </Text>
        </View>

        {/* Full-width stacked rows on every size: "Choose recording mode" is one row,
            Recordings is the next. The old wide branch put them side by side with
            `alignItems:'flex-start'`, so the shorter column left a large dead gap
            beside the taller one. */}
        {studio}
        {library}
      </ScrollView>

      {/* ── Rename ── */}
      <FormModal
        visible={!!editing}
        title="Rename recording"
        onClose={() => setEditing(null)}
        footer={
          <>
            <Btn label="Cancel" variant="secondary" onPress={() => setEditing(null)} style={s.flex} />
            <Btn label="Save" onPress={saveRename} loading={savingEdit} style={s.flex} />
          </>
        }
      >
        <Input
          label="Title *"
          value={editTitle}
          onChangeText={t => setEditTitle(t.slice(0, MAX_TITLE))}
          placeholder="Title"
          maxLength={MAX_TITLE}
          autoFocus
        />
      </FormModal>

      {/* ── Delete ── */}
      <ConfirmModal
        visible={!!deleting}
        title="Delete recording?"
        message={`"${deleting?.title ?? ''}" will be permanently removed. This cannot be undone.`}
        icon={<Trash2 size={24} color={T.danger} strokeWidth={2} />}
        tone="danger"
        confirmLabel="Delete"
        onConfirm={doDelete}
        onCancel={() => setDeleting(null)}
      />

      {/* ── Attach to demo ── */}
      <FormModal
        visible={!!attaching}
        title="Attach to demo"
        onClose={() => setAttaching(null)}
        wide={wide}
      >
        <Text style={[s.meta, s.attachHint, { color: T.sub }]}>
          Pick a demo to attach “{attaching?.title ?? ''}”.
        </Text>
        {loadingDemos ? (
          <ActivityIndicator color={T.accent} style={s.spin} />
        ) : demos.length === 0 ? (
          <Text style={[s.emptyTxt, s.attachEmpty, { color: T.sub }]}>
            No demos you can attach to. You can attach a recording only to a demo
            assigned to you or one you requested.
          </Text>
        ) : (
          <ScrollView style={s.attachList} nestedScrollEnabled>
            <View style={s.gap8}>
              {demos.map(d => (
                <ListCard key={d.id} onPress={() => doAttach(d.id)}>
                  <View style={s.flex}>
                    <Text numberOfLines={1} style={[s.rowTitle, { color: T.text }]}>{d.schoolName}</Text>
                    <Text numberOfLines={1} style={[s.meta, { color: T.sub }]}>
                      {d.assignedToName} · {new Date(d.scheduledDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} · {d.status}
                    </Text>
                  </View>
                  {attaching?.attachedDemoId === d.id && <Check size={15} color={T.accent} strokeWidth={2.4} />}
                </ListCard>
              ))}
            </View>
          </ScrollView>
        )}
      </FormModal>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 14, gap: 12 },
  scrollWide: { paddingHorizontal: 22, gap: 16 },
  grid: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  libCol: { flex: 1.15 },
  flex: { flex: 1 },
  gap6: { gap: 6 },
  gap8: { gap: 8 },
  gap14: { gap: 14 },
  row10: { flexDirection: 'row', gap: 10 },
  colPhone: { flexDirection: 'column' },

  h1: { fontSize: rf(21), fontWeight: '800', letterSpacing: -0.4 },
  h1sub: { fontSize: rf(12.5), fontWeight: '400', marginTop: 3, lineHeight: 18 },
  h3: { fontSize: rf(14), fontWeight: '700', letterSpacing: -0.2 },
  meta: { fontSize: rf(11.5), fontWeight: '400', lineHeight: 16 },

  card: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 12 },

  // ── studio ──
  modeGrid: { flexDirection: 'row', gap: 10 },
  modeGridPhone: { flexDirection: 'column' },
  modeCard: { flex: 1, borderRadius: 14, borderWidth: 1.5, padding: 13, gap: 6 },
  modeTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modeLabel: { fontSize: rf(13), fontWeight: '700', flex: 1 },
  modeDesc: { fontSize: rf(11.5), fontWeight: '400', lineHeight: 16 },

  banner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 13, borderWidth: 1, padding: 11 },
  bannerTxt: { flex: 1, fontSize: rf(11.5), fontWeight: '400', lineHeight: 16 },

  recHead: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  recMode: { fontSize: rf(11.5), fontWeight: '500' },
  recTime: { fontSize: rf(13), fontWeight: '700' },

  micStage: { borderRadius: 14, borderWidth: 1, paddingVertical: 30, alignItems: 'center', gap: 10 },
  micTxt: { fontSize: rf(12), fontWeight: '500' },
  playTile: { width: 54, height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },

  track: { height: 7, borderRadius: 4, overflow: 'hidden' },
  trackFill: { height: '100%', borderRadius: 4 },
  meterHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meterLabel: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  warnTxt: { fontSize: rf(11), fontWeight: '500', lineHeight: 15 },

  // ── library ──
  libHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  searchRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  filters: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, gap: 12 },
  ddFull: { width: '100%' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, alignItems: 'center' },
  clearAll: { paddingHorizontal: 4, paddingVertical: 4 },
  clearTxt: { fontSize: rf(12), fontWeight: '700' },

  rowCard: { flexDirection: 'column', alignItems: 'stretch', gap: 10 },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  tile: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  rowTitle: { fontSize: rf(13), fontWeight: '700', flexShrink: 1 },
  attached: { fontSize: rf(11), fontWeight: '600', marginTop: 2 },

  /** flexWrap: five actions (Open/Share/Rename/Attach/Delete) must never clip on a
   *  narrow iPhone — they wrap to a second line instead. */
  rowActions: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 14,
    borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 9,
  },
  act: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actTxt: { fontSize: rf(11.5), fontWeight: '600' },

  // ── iPad table — .tbl r16 · .th cardAlt 11/700/.4 upper · .tr borderTop line ──
  tbl: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  tr: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16 },
  th: { fontSize: rf(11), fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  /**
   * Column widths. Each of these is applied to BOTH the header <Text> and the body
   * cell, so headings and data always share a basis — the one thing that keeps a
   * column's values under its own label.
   */
  cRec: { flex: 2.8 },
  cPoster: { flex: 1.4 },
  cDate: { flex: 1.2 },
  cLen: { flex: 0.8 },
  cSize: { flex: 0.8 },
  cRecActions: { width: 250 }, // a header <Text> ignores alignItems, so both stay left
  recNameCell: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  posterCell: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tblActions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
  /** RN defaults flexShrink to 0 — a <Text> sharing a row needs this or it pushes
   *  its neighbours out of their columns. */
  flexMin: { flex: 1, flexShrink: 1, minWidth: 0 },

  pgRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },

  empty: { alignItems: 'center', gap: 9, paddingVertical: 30 },
  emptyTxt: { fontSize: rf(12.5), textAlign: 'center' },

  spin: { marginVertical: 24 },
  attachList: { maxHeight: 340 },
  attachHint: { marginBottom: 10 },
  attachEmpty: { marginVertical: 20 },
});
