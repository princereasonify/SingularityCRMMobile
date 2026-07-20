import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  useWindowDimensions, Animated, RefreshControl, Alert,
} from 'react-native';
import {
  PanGestureHandler,
  State,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import { useFocusEffect } from '@react-navigation/native';
import { MapPin, AlertCircle, Users } from 'lucide-react-native';
import { ICON_STROKE } from '../../components/common/Icon';
import { StatusBadge, ListCard, Trigger, Dropdown } from '../../components/crud';
import { leadsApi } from '../../api/leads';
import { LeadListDto, UserDto } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { KANBAN_COLUMNS, getScoreColor } from '../../utils/constants';
import { formatCurrency, formatRelativeDate, isOverdue } from '../../utils/formatting';

import { useAppTheme } from '../../theme/useAppTheme';
import { withAlpha, SOFT_TINT, Shadows } from '../../theme';
import { rf, isTabletDevice } from '../../utils/responsive';

// ─── Constants ────────────────────────────────────────────────────────────────
const COL_GAP = 10;
const BOARD_PADDING = 12;
// Ghost card offset: centres it under the finger (X derives from the live column width)
const GHOST_OFFSET_Y = 50;

const TOTAL_COLS = KANBAN_COLUMNS.length;
/** Resting column widths, used until the board area reports its real width. */
const COL_W_WIDE = 260;
const COL_W_PHONE = 190;
/** Below this a fitted column is unreadable — fall back to the resting width. */
const MIN_FIT_COL_W = 140;
/**
 * Approx height of a column header (10+10 padding · title + value lines · border).
 * An estimate is safe: it only trims the inner scroll area, which scrolls anyway.
 */
const COL_HEADER_H = 52;

/** Won cards carry the faintest possible wash — web parity with `bg-teal-50/30`. */
const WON_WASH = 0.06;

/** Web parity: the user picker groups RH ▸ ZH ▸ FO under these labels. */
const ROLE_ORDER = ['RH', 'ZH', 'FO'];
const ROLE_LABEL: Record<string, string> = {
  FO: 'Field Officers',
  ZH: 'Zonal Heads',
  RH: 'Regional Heads',
};

/**
 * Every stage in board order, flattened from KANBAN_COLUMNS. Used to pick the
 * least-surprising landing stage on a cross-column drop.
 */
const STAGE_ORDER: string[] = KANBAN_COLUMNS.flatMap(c => c.stages as string[]);

/**
 * Choose the stage a lead should land on when dropped into `targetStages`.
 *
 * The old code always took `targetCol.stages[0]`, so dragging a `ContractSent`
 * lead into "Proposal / Negotiation" rewrote it to `ProposalSent` — a two-stage
 * regression nobody asked for. Now: if the current stage already belongs to the
 * target column, keep it; otherwise take the target stage nearest the lead's
 * current position in STAGE_ORDER.
 */
function resolveDropStage(currentStage: string, targetStages: string[]): string {
  if (targetStages.includes(currentStage)) return currentStage;
  const from = STAGE_ORDER.indexOf(currentStage);
  if (from < 0) return targetStages[0];
  let best = targetStages[0];
  let bestDist = Infinity;
  for (const st of targetStages) {
    const idx = STAGE_ORDER.indexOf(st);
    const dist = idx < 0 ? Infinity : Math.abs(idx - from);
    if (dist < bestDist) { bestDist = dist; best = st; }
  }
  return best;
}

export const PipelineScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const T = useAppTheme();
  const role = user?.role || 'FO';
  const { width, height } = useWindowDimensions(); // also re-renders on rotation

  // Kanban must stay readable on an iPad in landscape and usable on a phone in
  // portrait, where a 260pt column would leave no room for its neighbour.
  const wide = isTabletDevice && width > height;

  // The permanent iPad sidebar (240 expanded / 76 rail) eats into the window, so
  // the screen width is NOT the board's width. Measure the canvas instead — it
  // re-reports on rotation and on every sidebar collapse/expand.
  const [boardAreaW, setBoardAreaW] = useState(0);
  const [boardAreaH, setBoardAreaH] = useState(0);
  const onCanvasLayout = useCallback((e: any) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    setBoardAreaW(prev => (Math.abs(prev - w) > 1 ? w : prev));
    setBoardAreaH(prev => (Math.abs(prev - h) > 1 ? h : prev));
  }, []);

  // On a wide screen, size the columns so all five stages fit the measured area
  // exactly. The board is absolutely positioned and scaled about its own centre,
  // so once boardWidth === boardAreaW it stays centred at any zoom and nothing is
  // clipped. Phones keep the fixed width and pan/pinch across the board.
  const fitColWidth = Math.floor(
    (boardAreaW - BOARD_PADDING * 2 - COL_GAP * (TOTAL_COLS - 1)) / TOTAL_COLS,
  );
  const fitted = wide && boardAreaW > 0 && fitColWidth >= MIN_FIT_COL_W;
  const colWidth = fitted ? fitColWidth : wide ? COL_W_WIDE : COL_W_PHONE;


  // Derive from the measured canvas, not `height`: the old `height - 300`
  // heuristic silently baked in the removed gradient hero, and it can't know the
  // nav header's height (which differs between FO's AppTopbar and the managers'
  // drawer header). Fall back to the heuristic until the canvas reports.
  const colScrollHeight =
    boardAreaH > 0
      ? Math.max(280, boardAreaH - BOARD_PADDING * 2 - COL_HEADER_H)
      : Math.max(280, height - (wide ? 300 : 320));

  // Gesture callbacks read this instead of closing over `colWidth`.
  const colWidthRef = useRef(colWidth);
  colWidthRef.current = colWidth;

  const [leads, setLeads] = useState<LeadListDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  /**
   * Manager user-filter — web parity, verbatim gate:
   * `const canFilterByUser = user.role !== 'FO'` (PipelineKanban.jsx).
   * FOs only ever see their own leads, so they get no picker.
   */
  const canFilterByUser = role !== 'FO';
  const [filterUsers, setFilterUsers] = useState<UserDto[]>([]);
  const [filterUserId, setFilterUserId] = useState('');
  const [openUserDd, setOpenUserDd] = useState(false);

  useEffect(() => {
    if (!canFilterByUser) return;
    // Web reuses the lead-assignment scoping here — same hierarchy.
    leadsApi.getAssignableFOs()
      .then(r => setFilterUsers(Array.isArray(r.data) ? r.data : (r.data as any)?.items ?? []))
      .catch(() => {});
  }, [canFilterByUser]);

  const selectedUser = filterUserId
    ? filterUsers.find(u => String(u.id) === filterUserId)
    : undefined;

  // The CRUD kit's Dropdown has no <optgroup>, so web's role grouping becomes a
  // role-ordered list with the group label appended to each name.
  const userOptions = useMemo(() => ([
    { label: 'All in my scope', value: '' },
    ...[...filterUsers]
      .sort((a, b) => {
        const d = ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role);
        return d !== 0 ? d : (a.name || '').localeCompare(b.name || '');
      })
      .map(u => {
        const scope = u.zone || u.region;
        return {
          label: `${u.name}${scope ? ` (${scope})` : ''} · ${ROLE_LABEL[u.role] || u.role}`,
          value: String(u.id),
        };
      }),
  ]), [filterUsers]);

  // ─── Drag-and-drop state ───────────────────────────────────────────────────
  const [draggedLead, setDraggedLead] = useState<LeadListDto | null>(null);
  const [dropTargetColId, setDropTargetColId] = useState<string | null>(null);

  // Refs for use inside gesture callbacks (avoids stale closures)
  const leadsRef = useRef<LeadListDto[]>([]);
  leadsRef.current = leads;
  const dropTargetColIdRef = useRef<string | null>(null);

  // Ghost card animated position (JS-driven, no native driver needed)
  const ghostTransX = useRef(new Animated.Value(0)).current;
  const ghostTransY = useRef(new Animated.Value(0)).current;

  // Column view refs for measureInWindow
  const colViewRefs = useRef<Array<View | null>>(new Array(KANBAN_COLUMNS.length).fill(null));
  const colRectsRef = useRef<Array<{ x: number; y: number; width: number; height: number } | null>>(
    new Array(KANBAN_COLUMNS.length).fill(null),
  );


  // ─── Data loading ──────────────────────────────────────────────────────────
  const fetchLeads = useCallback(async () => {
    try {
      // LeadsController.GetPipeline binds `[FromQuery] int? userId` — verified.
      const res = await leadsApi.getPipeline(filterUserId ? Number(filterUserId) : undefined);
      const data = Array.isArray(res.data) ? res.data : (res.data as any)?.items ?? [];
      setLeads(data);
    } catch {
      setLeads([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filterUserId]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  /**
   * Refetch whenever the board regains focus. Web does the same via window
   * 'focus' + 'visibilitychange' (PipelineKanban.jsx) — without it, a stage
   * changed on Lead Detail or Demos leaves this board showing stale columns
   * until a manual pull-to-refresh.
   */
  useFocusEffect(useCallback(() => { fetchLeads(); }, [fetchLeads]));



  // ─── Column measurement (called when drag starts) ──────────────────────────
  const measureColumns = () => {
    KANBAN_COLUMNS.forEach((_, i) => {
      const ref = colViewRefs.current[i];
      if (ref) {
        ref.measureInWindow((x, y, w, h) => {
          colRectsRef.current[i] = { x, y, width: w, height: h };
        });
      }
    });
  };

  const detectDropTarget = (absX: number, absY: number): string | null => {
    for (let i = 0; i < KANBAN_COLUMNS.length; i++) {
      const r = colRectsRef.current[i];
      if (r && absX >= r.x && absX <= r.x + r.width && absY >= r.y && absY <= r.y + r.height) {
        return KANBAN_COLUMNS[i].id;
      }
    }
    return null;
  };

  // ─── Drag gesture handlers (per card) ─────────────────────────────────────
  // PanGestureHandler with activateAfterLongPress gives us:
  //   • long-press detection (400ms) before the drag activates
  //   • continuous absoluteX/Y tracking once ACTIVE — ScrollView cannot steal it
  const makeDragGestureEvent = (_lead: LeadListDto) => (event: any) => {
    const { absoluteX, absoluteY } = event.nativeEvent;
    ghostTransX.setValue(absoluteX - colWidthRef.current / 2);
    ghostTransY.setValue(absoluteY - GHOST_OFFSET_Y);
    const targetId = detectDropTarget(absoluteX, absoluteY);
    if (targetId !== dropTargetColIdRef.current) {
      dropTargetColIdRef.current = targetId;
      setDropTargetColId(targetId);
    }
  };

  const makeDragStateChange = (lead: LeadListDto) => async (event: any) => {
    const { state, oldState, absoluteX, absoluteY } = event.nativeEvent;

    // Gesture activated after long-press → start drag
    if (state === State.ACTIVE) {
      setDraggedLead(lead);
      ghostTransX.setValue(absoluteX - colWidthRef.current / 2);
      ghostTransY.setValue(absoluteY - GHOST_OFFSET_Y);
      measureColumns();
      return;
    }

    // Finger lifted → commit or cancel
    if (oldState === State.ACTIVE) {
      const prevLeads = leadsRef.current;
      const targetColId = dropTargetColIdRef.current;
      const currentColId = KANBAN_COLUMNS.find(c =>
        (c.stages as string[]).includes(lead.stage),
      )?.id;

      setDraggedLead(null);
      setDropTargetColId(null);
      dropTargetColIdRef.current = null;

      if (targetColId && targetColId !== currentColId) {
        const targetCol = KANBAN_COLUMNS.find(c => c.id === targetColId)!;
        const newStage = resolveDropStage(lead.stage, targetCol.stages as string[]);
        // Already in the target column (or nothing to change) → leave it alone.
        if (newStage === lead.stage) return;
        setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, stage: newStage as any } : l));
        try {
          await leadsApi.updateLead(lead.id, { stage: newStage } as any);
        } catch {
          setLeads(prevLeads);
          Alert.alert('Error', 'Failed to move lead. Please try again.');
        }
      }
    }
  };

  // ─── Helpers ───────────────────────────────────────────────────────────────
  const getLeadsForColumn = (stages: string[]) => leads.filter(l => stages.includes(l.stage));

  const boardWidth = TOTAL_COLS * colWidth + (TOTAL_COLS - 1) * COL_GAP + BOARD_PADDING * 2;
  const isDragging = draggedLead !== null;

  // Legend → spec tokens: hot = warning (amber), overdue = danger (red), won = success (teal).
  const legend = [
    { key: 'hot', label: 'Hot lead (>70 score)', color: T.warning },
    { key: 'overdue', label: 'Overdue (>5 days)', color: T.danger },
    { key: 'won', label: 'Won', color: T.success },
  ];

  if (loading) return <LoadingSpinner fullScreen color={T.accent} />;

  return (
    <GestureHandlerRootView style={s.root}>
      <View style={[s.safe, { backgroundColor: T.bg }]}>

        {/* ── Title block — the drawer supplies the nav header for every role ── */}
        <View style={s.header}>
          <View style={s.headerTextWrap}>
            <Text style={[s.headerTitle, { color: T.text }]}>Pipeline Kanban</Text>
            <Text style={[s.headerSub, { color: T.dim }]} numberOfLines={1}>
              {selectedUser ? `Viewing ${selectedUser.name}'s pipeline` : 'Visual pipeline view'}
            </Text>
          </View>
        </View>

        {/* ── Manager user filter (web parity: canFilterByUser = role !== 'FO') ── */}
        {canFilterByUser && (
          <View style={s.filterBar}>
            <Trigger
              label={selectedUser ? selectedUser.name : 'All in my scope'}
              open={openUserDd}
              onPress={() => setOpenUserDd(v => !v)}
              icon={<Users size={14} color={T.sub} strokeWidth={ICON_STROKE} />}
              style={s.filterTrigger}
            />
            {openUserDd && (
              <Dropdown
                style={s.filterDd}
                maxHeight={260}
                value={filterUserId}
                onSelect={v => { setFilterUserId(v); setOpenUserDd(false); }}
                options={userOptions}
              />
            )}
          </View>
        )}

        {/* ── Legend + gesture hint ── */}
        <View style={[s.legendBar, { backgroundColor: T.card, borderBottomColor: T.line }]}>
          <View style={s.legendRow}>
            {legend.map(l => (
              <View key={l.key} style={s.legendItem}>
                <View
                  style={[
                    s.swatch,
                    { borderColor: l.color, backgroundColor: withAlpha(l.color, SOFT_TINT) },
                  ]}
                />
                <Text style={[s.legendTxt, { color: T.sub }]}>{l.label}</Text>
              </View>
            ))}
            <View style={s.legendSpacer} />
            <Text style={[s.legendTotal, { color: T.dim }]}>
              {leads.length} leads · {formatCurrency(leads.reduce((sum, l) => sum + l.value, 0))}
            </Text>
          </View>

          <Text
            style={[
              s.hintTxt,
              { color: T.dim },
              isDragging && { color: T.warning, fontWeight: '700' },
            ]}
          >
            {isDragging
              ? 'Drag over a column to move this lead'
              : 'Long-press a card to move it between stages'}
          </Text>
        </View>

        {/* ── Kanban Canvas ──
            Zoom and two-finger pan were removed: the five columns are sized to fit
            the measured canvas exactly, so there is nothing off-screen to pan to and
            nothing to zoom out for. Dropping the transform also removes the scale
            factor from the drag-drop hit maths. Long-press to move a card remains. */}
        {/* Horizontal scroll replaces the old two-finger pan. On iPad the board is
            sized to fit exactly (`fitted`), so it never actually scrolls; on a phone
            the board is deliberately wider than the screen and this is now the only
            way to reach columns 2-5 — without it they would be unreachable. Scrolling
            is disabled mid-drag so it cannot fight the long-press card drag. */}
        <ScrollView
          horizontal
          scrollEnabled={!fitted && !isDragging}
          showsHorizontalScrollIndicator={!fitted}
          style={s.canvas}
          contentContainerStyle={{ width: boardWidth }}
          onLayout={onCanvasLayout}
        >
              <View style={s.boardContainer}>
                <ScrollView
                  scrollEnabled={false}
                  refreshControl={
                    <RefreshControl
                      refreshing={refreshing}
                      onRefresh={() => { setRefreshing(true); fetchLeads(); }}
                      colors={[T.accent]}
                      tintColor={T.accent}
                    />
                  }
                  style={{ flex: 1 }}
                >
                  <View style={s.columnsRow}>
                    {KANBAN_COLUMNS.map((col, colIdx) => {
                      const colLeads = getLeadsForColumn(col.stages as any);
                      const colValue = colLeads.reduce((sum, l) => sum + l.value, 0);
                      const isWon = col.id === 'col5';
                      const isDropTarget = dropTargetColId === col.id;

                      return (
                        <View
                          key={col.id}
                          ref={(r) => { colViewRefs.current[colIdx] = r as View; }}
                          style={[
                            s.column,
                            { width: colWidth, backgroundColor: T.cardAlt, borderColor: T.line },
                            isDropTarget && { borderWidth: 2, borderColor: T.accent },
                          ]}
                        >
                          {/* Column header */}
                          <View style={[
                            s.colHeader,
                            { backgroundColor: T.card, borderBottomColor: T.line },
                            isWon && { backgroundColor: withAlpha(T.success, SOFT_TINT) },
                            isDropTarget && { backgroundColor: withAlpha(T.accent, SOFT_TINT) },
                          ]}>
                            <View style={s.colHeadText}>
                              <Text
                                style={[
                                  s.colTitle,
                                  { color: T.sub },
                                  isWon && { color: T.success },
                                  isDropTarget && { color: T.accent },
                                ]}
                                numberOfLines={1}
                              >
                                {col.title}
                              </Text>
                              {colValue > 0 && (
                                <Text style={[s.colValue, { color: T.dim }]} numberOfLines={1}>
                                  {formatCurrency(colValue)}
                                </Text>
                              )}
                            </View>
                            <StatusBadge
                              label={String(colLeads.length)}
                              color={isWon ? T.success : isDropTarget ? T.accent : T.sub}
                            />
                          </View>

                          {/* Cards — nested vertical scroll */}
                          <ScrollView
                            style={[s.colScroll, { height: colScrollHeight }]}
                            showsVerticalScrollIndicator={false}
                            nestedScrollEnabled
                            scrollEnabled={!isDragging}
                          >
                            {isDropTarget && isDragging && (
                              <View style={[s.dropZone, { borderColor: T.accent, backgroundColor: withAlpha(T.accent, SOFT_TINT) }]}>
                                <Text style={[s.dropZoneTxt, { color: T.accent }]}>Drop here</Text>
                              </View>
                            )}

                            {colLeads.length === 0 && !isDropTarget && (
                              <Text style={[s.emptyTxt, { color: T.dim }]}>No leads</Text>
                            )}

                            {colLeads.map((lead) => {
                              const overdue = isOverdue(lead.lastActivityDate, 5) && !isWon;
                              const hot = lead.score >= 70;
                              const isBeingDragged = draggedLead?.id === lead.id;

                              // Legend precedence, web parity: won ▸ hot ▸ overdue ▸ resting.
                              const stateColor = isWon ? T.success : hot ? T.warning : overdue ? T.danger : null;

                              return (
                                <PanGestureHandler
                                  key={lead.id}
                                  onGestureEvent={makeDragGestureEvent(lead)}
                                  onHandlerStateChange={makeDragStateChange(lead)}
                                  activateAfterLongPress={400}
                                  minPointers={1}
                                  maxPointers={1}
                                  minDist={0}
                                >
                                  <Animated.View
                                    style={isBeingDragged && [s.cardPlaceholder, { borderColor: T.line }]}
                                  >
                                    <ListCard
                                      onPress={() => !isDragging && navigation.navigate('LeadDetail', { leadId: lead.id })}
                                      style={[
                                        s.leadCard,
                                        Shadows.sm,
                                        stateColor
                                          ? { borderWidth: 1.5, borderColor: stateColor }
                                          : { borderColor: T.line },
                                        isWon && { backgroundColor: withAlpha(T.success, WON_WASH) },
                                        isBeingDragged && { opacity: 0 },
                                      ]}
                                    >
                                      <View style={s.cardTop}>
                                        <Text style={[s.cardSchool, { color: T.text }]} numberOfLines={2}>
                                          {lead.school}
                                        </Text>
                                        {overdue && (
                                          <AlertCircle size={13} color={T.danger} strokeWidth={ICON_STROKE} />
                                        )}
                                      </View>

                                      <View style={s.cardMeta}>
                                        <MapPin size={10} color={T.dim} strokeWidth={ICON_STROKE} />
                                        <Text style={[s.cardCity, { color: T.dim }]} numberOfLines={1}>
                                          {lead.city} · {lead.board}
                                        </Text>
                                      </View>

                                      <View style={s.cardFooter}>
                                        <Text style={[s.cardValue, { color: T.text }]}>{formatCurrency(lead.value)}</Text>
                                        <StatusBadge label={String(lead.score)} color={getScoreColor(lead.score)} />
                                      </View>

                                      {lead.lastActivityDate && (
                                        <Text style={[s.cardDate, { color: T.dim }]}>
                                          {formatRelativeDate(lead.lastActivityDate)}
                                        </Text>
                                      )}
                                      {lead.foName && role !== 'FO' && (
                                        <Text style={[s.cardFO, { color: T.sub }]} numberOfLines={1}>{lead.foName}</Text>
                                      )}
                                    </ListCard>
                                  </Animated.View>
                                </PanGestureHandler>
                              );
                            })}
                            <View style={{ height: 20 }} />
                          </ScrollView>
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>
        </ScrollView>

        {/* ── Ghost Card (follows finger during drag) ── */}
        {isDragging && (
          <Animated.View
            pointerEvents="none"
            style={[
              s.ghostCard,
              { width: colWidth, transform: [{ translateX: ghostTransX }, { translateY: ghostTransY }] },
            ]}
          >
            <View style={[s.ghostInner, Shadows.lg, { backgroundColor: T.card, borderColor: T.accent }]}>
              <Text style={[s.cardSchool, { color: T.text }]} numberOfLines={1}>{draggedLead!.school}</Text>
              <Text style={[s.cardCity, { color: T.dim }]} numberOfLines={1}>{draggedLead!.city}</Text>
              <Text style={[s.cardValue, { color: T.text }]}>{formatCurrency(draggedLead!.value)}</Text>
            </View>
          </Animated.View>
        )}

      </View>
    </GestureHandlerRootView>
  );
};

// ─── Styles (layout only — colour comes from the theme, inline) ───────────────
const s = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },

  // ── Title block ──
  header: {
    paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10, gap: 12,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  headerTextWrap: { flex: 1 },
  headerTitle: { fontSize: rf(20), fontWeight: '700', letterSpacing: -0.3 },
  headerSub: { fontSize: rf(12.5), fontWeight: '500', marginTop: 2 },

  // ── Manager user filter ──
  // zIndex keeps the inline dropdown above the legend bar and the board canvas.
  filterBar: { paddingHorizontal: 14, paddingBottom: 8, zIndex: 20 },
  filterTrigger: { alignSelf: 'flex-start', maxWidth: 320 },
  filterDd: { alignSelf: 'flex-start', minWidth: 240, maxWidth: 320 },

  // ── Legend + hint ──
  legendBar: { paddingHorizontal: 14, paddingVertical: 9, gap: 5, borderBottomWidth: 1 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 14, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 12, height: 12, borderRadius: 4, borderWidth: 2 },
  legendTxt: { fontSize: rf(11), fontWeight: '600' },
  legendSpacer: { flex: 1 },
  legendTotal: { fontSize: rf(11), fontWeight: '700' },
  hintTxt: { fontSize: rf(10.5), fontWeight: '500' },

  // ── Canvas ──
  canvas: { flex: 1, overflow: 'hidden' },
  boardContainer: { flex: 1 },

  // ── Columns ──
  columnsRow: {
    flexDirection: 'row',
    padding: BOARD_PADDING,
    gap: COL_GAP,
    alignItems: 'flex-start',
  },
  column: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  colHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    gap: 8, paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1,
  },
  colHeadText: { flex: 1 },
  colTitle: { fontSize: rf(11), fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  colValue: { fontSize: rf(11), fontWeight: '600', marginTop: 2 },
  colScroll: { padding: 8 },

  // ── Drop zone ──
  dropZone: {
    borderWidth: 2, borderRadius: 12,
    marginBottom: 8, paddingVertical: 14,
    alignItems: 'center',
  },
  dropZoneTxt: { fontSize: rf(12), fontWeight: '700' },

  // ── Lead cards ──
  emptyTxt: { fontSize: rf(11.5), fontWeight: '500', textAlign: 'center', paddingVertical: 16 },
  cardPlaceholder: { borderRadius: 14, borderWidth: 1.5, marginBottom: 8, height: 80 },
  leadCard: {
    flexDirection: 'column', alignItems: 'stretch', gap: 0,
    padding: 12, marginBottom: 8,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  cardSchool: { flex: 1, fontSize: rf(12.5), fontWeight: '700' },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, marginBottom: 9 },
  cardCity: { flex: 1, fontSize: rf(11), fontWeight: '500' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  cardValue: { fontSize: rf(13.5), fontWeight: '700' },
  cardDate: { fontSize: rf(10), fontWeight: '500', marginTop: 6 },
  cardFO: { fontSize: rf(10), fontWeight: '600', marginTop: 2 },

  // ── Ghost card ──
  ghostCard: { position: 'absolute', zIndex: 999, elevation: 20 },
  ghostInner: {
    borderRadius: 14, padding: 12, borderWidth: 1.5,
    elevation: 20, opacity: 0.95,
  },
});
