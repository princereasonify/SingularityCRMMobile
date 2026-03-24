import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  useWindowDimensions, Animated, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  PinchGestureHandler,
  PanGestureHandler,
  State,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react-native';
import { leadsApi } from '../../api/leads';
import { LeadListDto } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ROLE_COLORS, KANBAN_COLUMNS, getScoreColor } from '../../utils/constants';
import { formatCurrency, formatRelativeDate, isOverdue } from '../../utils/formatting';
import { rf } from '../../utils/responsive';

// ─── Constants ────────────────────────────────────────────────────────────────
const COL_WIDTH = 220;
const COL_GAP = 10;
const BOARD_PADDING = 12;
const MIN_SCALE = 0.3;
const MAX_SCALE = 2.0;
const DEFAULT_SCALE = 0.85;
// Ghost card offset: centres it under the finger
const GHOST_OFFSET_X = COL_WIDTH / 2;
const GHOST_OFFSET_Y = 50;

export const PipelineScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const role = user?.role || 'FO';
  const COLOR = ROLE_COLORS[role];
  useWindowDimensions(); // triggers re-render on rotation

  const [leads, setLeads] = useState<LeadListDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  // ─── Pinch/Pan animated values ────────────────────────────────────────────
  const baseScale = useRef(new Animated.Value(DEFAULT_SCALE)).current;
  const pinchScale = useRef(new Animated.Value(1)).current;
  const totalScale = useRef(Animated.multiply(baseScale, pinchScale)).current;
  const lastScale = useRef(DEFAULT_SCALE);
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const lastPan = useRef({ x: 0, y: 0 });
  const pinchRef = useRef<any>(null);
  const panRef = useRef<any>(null);

  // ─── Data loading ──────────────────────────────────────────────────────────
  const fetchLeads = useCallback(async () => {
    try {
      const res = await leadsApi.getPipeline();
      const data = Array.isArray(res.data) ? res.data : (res.data as any)?.items ?? [];
      setLeads(data);
    } catch {
      setLeads([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  // ─── Pinch handlers ────────────────────────────────────────────────────────
  const onPinchEvent = Animated.event(
    [{ nativeEvent: { scale: pinchScale } }],
    { useNativeDriver: true },
  );

  const onPinchStateChange = (event: any) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      let ns = lastScale.current * event.nativeEvent.scale;
      ns = Math.max(MIN_SCALE, Math.min(MAX_SCALE, ns));
      lastScale.current = ns;
      baseScale.setValue(ns);
      pinchScale.setValue(1);
    }
  };

  // ─── Pan handlers (2-finger drag) ─────────────────────────────────────────
  const onPanEvent = Animated.event(
    [{ nativeEvent: { translationX: pan.x, translationY: pan.y } }],
    { useNativeDriver: true },
  );

  const onPanStateChange = (event: any) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      lastPan.current.x += event.nativeEvent.translationX;
      lastPan.current.y += event.nativeEvent.translationY;
      pan.setOffset(lastPan.current);
      pan.setValue({ x: 0, y: 0 });
    }
  };

  // ─── Zoom controls ─────────────────────────────────────────────────────────
  const animateTo = (targetScale: number) => {
    lastScale.current = targetScale;
    Animated.spring(baseScale, {
      toValue: targetScale,
      useNativeDriver: true,
      tension: 120,
      friction: 8,
    }).start();
    pinchScale.setValue(1);
  };

  const resetView = () => {
    animateTo(DEFAULT_SCALE);
    lastPan.current = { x: 0, y: 0 };
    pan.setOffset({ x: 0, y: 0 });
    pan.setValue({ x: 0, y: 0 });
  };

  // ─── Column measurement (called when drag starts) ──────────────────────────
  const measureColumns = () => {
    KANBAN_COLUMNS.forEach((_, i) => {
      const ref = colViewRefs.current[i];
      if (ref) {
        ref.measureInWindow((x, y, width, height) => {
          colRectsRef.current[i] = { x, y, width, height };
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
    ghostTransX.setValue(absoluteX - GHOST_OFFSET_X);
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
      ghostTransX.setValue(absoluteX - GHOST_OFFSET_X);
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
        const newStage = targetCol.stages[0];
        setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, stage: newStage } : l));
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

  const totalCols = KANBAN_COLUMNS.length;
  const boardWidth = totalCols * COL_WIDTH + (totalCols - 1) * COL_GAP + BOARD_PADDING * 2;
  const isDragging = draggedLead !== null;

  if (loading) return <LoadingSpinner fullScreen color={COLOR.primary} />;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>

        {/* ── Header ── */}
        <View style={[styles.header, { backgroundColor: COLOR.primary }]}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Pipeline</Text>
            <Text style={styles.headerSub}>
              {leads.length} leads • {formatCurrency(leads.reduce((s, l) => s + l.value, 0))}
            </Text>
          </View>
          <View style={styles.zoomControls}>
            <TouchableOpacity style={styles.zoomBtn} onPress={() => animateTo(Math.max(lastScale.current - 0.2, MIN_SCALE))}>
              <ZoomOut size={18} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.zoomBtn} onPress={() => animateTo(Math.min(lastScale.current + 0.2, MAX_SCALE))}>
              <ZoomIn size={18} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.zoomBtn} onPress={resetView}>
              <Maximize size={16} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Hint bar ── */}
        <View style={[styles.hintBar, isDragging && { backgroundColor: '#FEF3C7' }]}>
          <Text style={[styles.hintText, isDragging && { color: '#92400E', fontWeight: '700' as const }]}>
            {isDragging
              ? '📦 Drag over a column to move this lead'
              : '🤏 Pinch to zoom  •  ✌️ Two-finger drag  •  👆 Long press card to move'}
          </Text>
        </View>

        {/* ── Zoomable Kanban Canvas ── */}
        <PanGestureHandler
          ref={panRef}
          onGestureEvent={onPanEvent}
          onHandlerStateChange={onPanStateChange}
          simultaneousHandlers={pinchRef}
          minPointers={2}
          maxPointers={2}
          enabled={!isDragging}
        >
          <Animated.View style={styles.canvas}>
            <PinchGestureHandler
              ref={pinchRef}
              onGestureEvent={onPinchEvent}
              onHandlerStateChange={onPinchStateChange}
              simultaneousHandlers={panRef}
              enabled={!isDragging}
            >
              <Animated.View
                style={[
                  styles.boardContainer,
                  {
                    width: boardWidth,
                    transform: [
                      { translateX: pan.x },
                      { translateY: pan.y },
                      { scale: totalScale },
                    ],
                  },
                ]}
              >
                <ScrollView
                  scrollEnabled={false}
                  refreshControl={
                    <RefreshControl
                      refreshing={refreshing}
                      onRefresh={() => { setRefreshing(true); fetchLeads(); }}
                      colors={[COLOR.primary]}
                    />
                  }
                  style={{ flex: 1 }}
                >
                  <View style={styles.columnsRow}>
                    {KANBAN_COLUMNS.map((col, colIdx) => {
                      const colLeads = getLeadsForColumn(col.stages as any);
                      const colValue = colLeads.reduce((s, l) => s + l.value, 0);
                      const isWon = col.id === 'col5';
                      const isDropTarget = dropTargetColId === col.id;

                      return (
                        <View
                          key={col.id}
                          ref={(r) => { colViewRefs.current[colIdx] = r as View; }}
                          style={[
                            styles.column,
                            isDropTarget && { borderWidth: 2, borderColor: COLOR.primary },
                          ]}
                        >
                          {/* Column header */}
                          <View style={[
                            styles.colHeader,
                            isWon && styles.colHeaderWon,
                            isDropTarget && { backgroundColor: COLOR.primary + '18' },
                          ]}>
                            <Text
                              style={[
                                styles.colTitle,
                                isWon && styles.colTitleWon,
                                isDropTarget && { color: COLOR.primary },
                              ]}
                              numberOfLines={1}
                            >
                              {col.title}
                            </Text>
                            <View style={[styles.colBadge, { backgroundColor: isWon ? '#22C55E' : COLOR.primary }]}>
                              <Text style={styles.colCount}>{colLeads.length}</Text>
                            </View>
                          </View>

                          {colValue > 0 && (
                            <Text style={styles.colValue}>{formatCurrency(colValue)}</Text>
                          )}

                          {/* Cards — nested vertical scroll */}
                          <ScrollView
                            style={styles.colScroll}
                            showsVerticalScrollIndicator={false}
                            nestedScrollEnabled
                            scrollEnabled={!isDragging}
                          >
                            {/* Drop zone indicator */}
                            {isDropTarget && isDragging && (
                              <View style={[styles.dropZone, { borderColor: COLOR.primary }]}>
                                <Text style={[styles.dropZoneText, { color: COLOR.primary }]}>
                                  ↓ Drop here
                                </Text>
                              </View>
                            )}

                            {colLeads.length === 0 && !isDropTarget && (
                              <View style={styles.emptyCol}>
                                <Text style={styles.emptyColText}>No leads</Text>
                              </View>
                            )}

                            {colLeads.map((lead) => {
                              const overdue = isOverdue(lead.lastActivityDate, 5);
                              const hot = lead.score >= 70;
                              const isBeingDragged = draggedLead?.id === lead.id;

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
                                    style={isBeingDragged && styles.cardPlaceholder}
                                  >
                                    <TouchableOpacity
                                      style={[
                                        styles.leadCard,
                                        hot && styles.hotCard,
                                        overdue && !isWon && styles.overdueCard,
                                        isWon && styles.wonCard,
                                        isBeingDragged && { opacity: 0 },
                                      ]}
                                      onPress={() => !isDragging && navigation.navigate('LeadDetail', { leadId: lead.id })}
                                      activeOpacity={0.8}
                                    >
                                      {hot && <Text style={styles.hotBadge}>🔥 Hot</Text>}
                                      {overdue && !isWon && <View style={styles.overdueDot} />}
                                      <Text style={styles.cardSchool} numberOfLines={2}>{lead.school}</Text>
                                      <Text style={styles.cardCity}>{lead.city} • {lead.board}</Text>
                                      <View style={styles.cardFooter}>
                                        <Text style={styles.cardValue}>{formatCurrency(lead.value)}</Text>
                                        <View style={[styles.scoreChip, { backgroundColor: getScoreColor(lead.score) + '22' }]}>
                                          <Text style={[styles.scoreText, { color: getScoreColor(lead.score) }]}>
                                            {lead.score}
                                          </Text>
                                        </View>
                                      </View>
                                      {lead.lastActivityDate && (
                                        <Text style={styles.cardDate}>{formatRelativeDate(lead.lastActivityDate)}</Text>
                                      )}
                                      {lead.foName && role !== 'FO' && (
                                        <Text style={styles.cardFO} numberOfLines={1}>👤 {lead.foName}</Text>
                                      )}
                                    </TouchableOpacity>
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
              </Animated.View>
            </PinchGestureHandler>
          </Animated.View>
        </PanGestureHandler>

        {/* ── Ghost Card (follows finger during drag) ── */}
        {isDragging && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.ghostCard,
              { transform: [{ translateX: ghostTransX }, { translateY: ghostTransY }] },
            ]}
          >
            <View style={[styles.ghostInner, { borderLeftColor: COLOR.primary }]}>
              <Text style={styles.cardSchool} numberOfLines={1}>{draggedLead!.school}</Text>
              <Text style={styles.cardCity} numberOfLines={1}>{draggedLead!.city}</Text>
              <Text style={styles.cardValue}>{formatCurrency(draggedLead!.value)}</Text>
            </View>
          </Animated.View>
        )}

      </SafeAreaView>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, backgroundColor: '#F1F5F9' },

  // ── Header ──
  header: {
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  headerLeft: { flex: 1 },
  headerTitle: { fontSize: rf(22), fontWeight: '700', color: '#FFF' },
  headerSub: { fontSize: rf(13), color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  zoomControls: { flexDirection: 'row', gap: 4 },
  zoomBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Hint ──
  hintBar: {
    backgroundColor: '#E0E7FF', paddingVertical: 5, paddingHorizontal: 12,
  },
  hintText: { fontSize: rf(11), color: '#4338CA', textAlign: 'center' },

  // ── Canvas ──
  canvas: { flex: 1, overflow: 'hidden' },

  // ── Board container ──
  boardContainer: {
    position: 'absolute',
    top: 0, left: 0, bottom: 0,
  },

  // ── Columns ──
  columnsRow: {
    flexDirection: 'row',
    padding: BOARD_PADDING,
    gap: COL_GAP,
    alignItems: 'flex-start',
  },
  column: {
    width: COL_WIDTH,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    overflow: 'hidden',
  },
  colHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 12, backgroundColor: '#F3F4F6',
  },
  colHeaderWon: { backgroundColor: '#F0FDF4' },
  colTitle: { fontSize: rf(13), fontWeight: '700', color: '#374151', flex: 1 },
  colTitleWon: { color: '#16A34A' },
  colBadge: { borderRadius: 100, width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  colCount: { fontSize: rf(11), fontWeight: '700', color: '#FFF' },
  colValue: { fontSize: rf(12), color: '#6B7280', paddingHorizontal: 12, paddingTop: 4 },
  colScroll: { height: 480, padding: 8 },

  // ── Drop zone ──
  dropZone: {
    borderWidth: 2, borderRadius: 10,
    marginBottom: 8, paddingVertical: 14,
    alignItems: 'center',
  },
  dropZoneText: { fontSize: rf(13), fontWeight: '700' },

  // ── Lead cards ──
  emptyCol: { padding: 16, alignItems: 'center' },
  emptyColText: { fontSize: rf(12), color: '#D1D5DB' },
  cardPlaceholder: {
    borderRadius: 12, borderWidth: 1.5, borderColor: '#D1D5DB',
    marginBottom: 8, height: 80,
  },
  leadCard: {
    backgroundColor: '#FFF',
    borderRadius: 12, padding: 12, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
    position: 'relative',
  },
  hotCard: {
    borderWidth: 1.5, borderColor: '#F59E0B',
    shadowColor: '#F59E0B', shadowOpacity: 0.15,
  },
  overdueCard: { borderLeftWidth: 3, borderLeftColor: '#EF4444' },
  wonCard: { borderLeftWidth: 3, borderLeftColor: '#22C55E' },
  hotBadge: { fontSize: rf(10), color: '#D97706', fontWeight: '700', marginBottom: 4 },
  overdueDot: {
    position: 'absolute', top: 10, right: 10,
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444',
  },
  cardSchool: { fontSize: rf(13), fontWeight: '700', color: '#111827', marginBottom: 3 },
  cardCity: { fontSize: rf(11), color: '#9CA3AF', marginBottom: 8 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardValue: { fontSize: rf(14), fontWeight: '700', color: '#111827' },
  scoreChip: { borderRadius: 100, paddingHorizontal: 6, paddingVertical: 2 },
  scoreText: { fontSize: rf(11), fontWeight: '700' },
  cardDate: { fontSize: rf(10), color: '#9CA3AF', marginTop: 4 },
  cardFO: { fontSize: rf(10), color: '#6B7280', marginTop: 2 },

  // ── Ghost card ──
  ghostCard: {
    position: 'absolute',
    width: COL_WIDTH,
    zIndex: 999,
    elevation: 20,
  },
  ghostInner: {
    backgroundColor: '#FFF',
    borderRadius: 12, padding: 12,
    borderLeftWidth: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2, shadowRadius: 10, elevation: 20,
    opacity: 0.92,
  },
});
