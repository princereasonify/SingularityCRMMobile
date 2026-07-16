import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Switch, Alert,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GripVertical } from 'lucide-react-native';
import { settingsApi } from '../../api/settings';
import { DashboardWidget } from '../../types';
import { AppHeader } from '../../components/ui';
import { GradientButton } from '../../components/common/GradientButton';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { Fonts } from '../../theme';
import { useAppTheme } from '../../theme/useAppTheme';
import { rf, isTabletDevice } from '../../utils/responsive';

const DEFAULT_WIDGETS: DashboardWidget[] = [
  { id: 'kpi_summary',    type: 'kpi',         title: 'KPI Summary',        position: 0, visible: true,  size: 'large' },
  { id: 'pipeline_chart', type: 'chart',        title: 'Pipeline Chart',     position: 1, visible: true,  size: 'large' },
  { id: 'recent_leads',   type: 'list',         title: 'Recent Leads',       position: 2, visible: true,  size: 'medium' },
  { id: 'team_map',       type: 'map',          title: 'Team Map',           position: 3, visible: false, size: 'large' },
  { id: 'calendar',       type: 'calendar',     title: 'Today\'s Schedule',  position: 4, visible: true,  size: 'medium' },
  { id: 'leaderboard',    type: 'leaderboard',  title: 'Leaderboard',        position: 5, visible: false, size: 'medium' },
  { id: 'ai_insights',    type: 'ai',           title: 'AI Insights',        position: 6, visible: true,  size: 'small' },
];

const TYPE_COLORS: Record<string, string> = {
  kpi:         '#2563EB',
  chart:       '#7C3AED',
  list:        '#0D9488',
  map:         '#EA580C',
  calendar:    '#D97706',
  leaderboard: '#DC2626',
  ai:          '#8B5CF6',
};

const TYPE_EMOJI: Record<string, string> = {
  kpi: '📊', chart: '📈', list: '📋', map: '🗺️', calendar: '📅', leaderboard: '🏆', ai: '🤖',
};

export const DashboardCustomizeScreen = ({ navigation }: any) => {
  const T = useAppTheme();
  const { width, height } = useWindowDimensions();
  const wide = isTabletDevice && width > height;

  const [widgets, setWidgets] = useState<DashboardWidget[]>(DEFAULT_WIDGETS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await settingsApi.getDashboardConfig();
        const data = (res.data as any)?.widgets;
        if (Array.isArray(data) && data.length > 0) {
          setWidgets(data.sort((a: DashboardWidget, b: DashboardWidget) => a.position - b.position));
        }
      } catch {
        // fall back to defaults
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggleWidget = (id: string) => {
    setWidgets(prev => prev.map(w => w.id === id ? { ...w, visible: !w.visible } : w));
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    setWidgets(prev => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next.map((w, i) => ({ ...w, position: i }));
    });
  };

  const moveDown = (index: number) => {
    setWidgets(prev => {
      if (index === prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next.map((w, i) => ({ ...w, position: i }));
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await settingsApi.saveDashboardConfig({ widgets });
      Alert.alert('Saved', 'Dashboard layout updated successfully.');
      navigation.goBack();
    } catch {
      Alert.alert('Error', 'Failed to save layout. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    Alert.alert('Reset Layout', 'Restore default dashboard layout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: () => setWidgets(DEFAULT_WIDGETS) },
    ]);
  };

  if (loading) return <LoadingSpinner fullScreen color={T.accent} />;

  const visibleCount = widgets.filter(w => w.visible).length;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: T.bg }]} edges={['top', 'bottom']}>
      <AppHeader
        title="Customize Dashboard"
        subtitle={`${visibleCount} of ${widgets.length} widgets visible`}
        onBack={() => navigation.goBack()}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={[styles.constrain, wide && styles.constrainWide]}>

          <View style={[styles.infoBox, { backgroundColor: T.accentSoft, borderColor: T.line }]}>
            <Text style={[styles.infoText, { color: T.sub }]}>
              Toggle widgets on/off and use the arrows to reorder them on your dashboard.
            </Text>
          </View>

          {widgets.map((widget, index) => {
            const typeColor = TYPE_COLORS[widget.type] ?? T.sub;
            const emoji = TYPE_EMOJI[widget.type] ?? '🔲';
            const isFirst = index === 0;
            const isLast = index === widgets.length - 1;
            return (
              <View
                key={widget.id}
                style={[
                  styles.row,
                  { backgroundColor: T.card, borderColor: T.line },
                  !widget.visible && styles.rowDisabled,
                ]}
              >

                {/* Order arrows */}
                <View style={styles.orderCol}>
                  <TouchableOpacity
                    style={[styles.arrowBtn, isFirst && styles.arrowDisabled]}
                    onPress={() => moveUp(index)}
                    disabled={isFirst}
                  >
                    <Text style={[styles.arrowText, { color: isFirst ? T.dim : T.sub }]}>▲</Text>
                  </TouchableOpacity>
                  <Text style={[styles.orderNum, { color: T.dim }]}>{index + 1}</Text>
                  <TouchableOpacity
                    style={[styles.arrowBtn, isLast && styles.arrowDisabled]}
                    onPress={() => moveDown(index)}
                    disabled={isLast}
                  >
                    <Text style={[styles.arrowText, { color: isLast ? T.dim : T.sub }]}>▼</Text>
                  </TouchableOpacity>
                </View>

                {/* Widget info */}
                <View style={[styles.typeTag, { backgroundColor: typeColor + '18' }]}>
                  <Text style={styles.typeEmoji}>{emoji}</Text>
                </View>
                <View style={styles.widgetInfo}>
                  <Text style={[styles.widgetTitle, { color: widget.visible ? T.text : T.dim }]}>
                    {widget.title}
                  </Text>
                  <Text style={[styles.widgetMeta, { color: typeColor }]}>
                    {widget.type.toUpperCase()} · {widget.size}
                  </Text>
                </View>

                {/* Grip icon */}
                <GripVertical size={18} color={T.dim} style={styles.grip} />

                {/* Visibility toggle */}
                <Switch
                  value={widget.visible}
                  onValueChange={() => toggleWidget(widget.id)}
                  trackColor={{ true: T.accent, false: T.line }}
                  thumbColor={widget.visible ? '#FFF' : T.card}
                />
              </View>
            );
          })}

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.resetBtn, { backgroundColor: T.card, borderColor: T.line }]}
              onPress={handleReset}
              activeOpacity={0.85}
            >
              <Text style={[styles.resetText, { color: T.text }]}>Reset to Default</Text>
            </TouchableOpacity>
            <GradientButton
              label="Save Layout"
              onPress={handleSave}
              loading={saving}
              disabled={saving}
              style={styles.saveBtn}
            />
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },

  constrain: { gap: 10, width: '100%' },
  constrainWide: { maxWidth: 720, alignSelf: 'center' },

  infoBox: {
    borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 4,
  },
  infoText: { fontFamily: Fonts.regular, fontSize: rf(13), lineHeight: 20 },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 18, borderWidth: 1, padding: 12,
  },
  rowDisabled: { opacity: 0.6 },

  orderCol: { alignItems: 'center', gap: 2, width: 28 },
  arrowBtn: { padding: 2 },
  arrowDisabled: { opacity: 0.3 },
  arrowText: { fontFamily: Fonts.bold, fontSize: rf(10) },
  orderNum: { fontFamily: Fonts.medium, fontSize: rf(11) },

  typeTag: {
    width: 38, height: 38, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  typeEmoji: { fontSize: rf(18) },

  widgetInfo: { flex: 1 },
  widgetTitle: { fontFamily: Fonts.medium, fontSize: rf(14) },
  widgetMeta: { fontFamily: Fonts.medium, fontSize: rf(11), marginTop: 2 },

  grip: { marginHorizontal: 2 },

  actions: { flexDirection: 'row', gap: 10, marginTop: 8, alignItems: 'center' },
  resetBtn: {
    flex: 1, height: 54, borderRadius: 16, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  resetText: { fontFamily: Fonts.bold, fontSize: rf(15), letterSpacing: 0.2 },
  saveBtn: { flex: 1 },
});
