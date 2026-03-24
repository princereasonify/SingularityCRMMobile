import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Switch, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GripVertical, Eye, EyeOff } from 'lucide-react-native';
import { settingsApi } from '../../api/settings';
import { DashboardWidget } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { Button } from '../../components/common/Button';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ROLE_COLORS } from '../../utils/constants';
import { rf } from '../../utils/responsive';

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
  const { user } = useAuth();
  const COLOR = ROLE_COLORS[(user?.role || 'FO') as keyof typeof ROLE_COLORS];

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

  if (loading) return <LoadingSpinner fullScreen color={COLOR.primary} />;

  const visibleCount = widgets.filter(w => w.visible).length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title="Customize Dashboard"
        subtitle={`${visibleCount} of ${widgets.length} widgets visible`}
        color={COLOR.primary}
        onBack={() => navigation.goBack()}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Toggle widgets on/off and use the arrows to reorder them on your dashboard.
          </Text>
        </View>

        {widgets.map((widget, index) => {
          const typeColor = TYPE_COLORS[widget.type] ?? '#6B7280';
          const emoji = TYPE_EMOJI[widget.type] ?? '🔲';
          return (
            <View key={widget.id} style={[styles.row, !widget.visible && styles.rowDisabled]}>

              {/* Order arrows */}
              <View style={styles.orderCol}>
                <TouchableOpacity
                  style={[styles.arrowBtn, index === 0 && styles.arrowDisabled]}
                  onPress={() => moveUp(index)}
                  disabled={index === 0}
                >
                  <Text style={[styles.arrowText, index === 0 && { color: '#D1D5DB' }]}>▲</Text>
                </TouchableOpacity>
                <Text style={styles.orderNum}>{index + 1}</Text>
                <TouchableOpacity
                  style={[styles.arrowBtn, index === widgets.length - 1 && styles.arrowDisabled]}
                  onPress={() => moveDown(index)}
                  disabled={index === widgets.length - 1}
                >
                  <Text style={[styles.arrowText, index === widgets.length - 1 && { color: '#D1D5DB' }]}>▼</Text>
                </TouchableOpacity>
              </View>

              {/* Widget info */}
              <View style={[styles.typeTag, { backgroundColor: typeColor + '18' }]}>
                <Text style={styles.typeEmoji}>{emoji}</Text>
              </View>
              <View style={styles.widgetInfo}>
                <Text style={[styles.widgetTitle, !widget.visible && { color: '#9CA3AF' }]}>
                  {widget.title}
                </Text>
                <Text style={[styles.widgetMeta, { color: typeColor }]}>
                  {widget.type.toUpperCase()} · {widget.size}
                </Text>
              </View>

              {/* Grip icon */}
              <GripVertical size={18} color="#D1D5DB" style={styles.grip} />

              {/* Visibility toggle */}
              <Switch
                value={widget.visible}
                onValueChange={() => toggleWidget(widget.id)}
                trackColor={{ true: COLOR.primary, false: '#E5E7EB' }}
                thumbColor={widget.visible ? '#FFF' : '#F3F4F6'}
              />
            </View>
          );
        })}

        <View style={styles.actions}>
          <Button
            title="Reset to Default"
            onPress={handleReset}
            variant="secondary"
            style={styles.resetBtn}
          />
          <Button
            title={saving ? 'Saving...' : 'Save Layout'}
            onPress={handleSave}
            variant="primary"
            disabled={saving}
            style={styles.saveBtn}
          />
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 10, paddingBottom: 40 },

  infoBox: {
    backgroundColor: '#EFF6FF', borderRadius: 12, padding: 14, marginBottom: 4,
  },
  infoText: { fontSize: rf(13), color: '#1D4ED8', lineHeight: 20 },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FFF', borderRadius: 14, padding: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
  },
  rowDisabled: { backgroundColor: '#FAFAFA' },

  orderCol: { alignItems: 'center', gap: 2, width: 28 },
  arrowBtn: { padding: 2 },
  arrowDisabled: { opacity: 0.3 },
  arrowText: { fontSize: rf(10), color: '#6B7280', fontWeight: '700' },
  orderNum: { fontSize: rf(11), color: '#9CA3AF', fontWeight: '600' },

  typeTag: {
    width: 38, height: 38, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  typeEmoji: { fontSize: rf(18) },

  widgetInfo: { flex: 1 },
  widgetTitle: { fontSize: rf(14), fontWeight: '600', color: '#111827' },
  widgetMeta: { fontSize: rf(11), fontWeight: '600', marginTop: 2 },

  grip: { marginHorizontal: 2 },

  actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  resetBtn: { flex: 1 },
  saveBtn: { flex: 1 },
});
