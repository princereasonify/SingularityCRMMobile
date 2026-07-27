import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, Switch, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, Edit2, Trash2, AlertTriangle } from 'lucide-react-native';
import { visitReportApi } from '../../api/visitReport';
import { VisitField, CreateVisitFieldRequest } from '../../types';
import { Card } from '../../components/common/Card';
import { LoadingSpinner, EmptyState } from '../../components/common/LoadingSpinner';
import { Btn, Field, Input, FormModal, ConfirmModal, StatusBadge } from '../../components/crud';
import { NumField } from '../../components/common/NumField';
import { useAppTheme } from '../../theme/useAppTheme';
import { withAlpha, SOFT_TINT } from '../../theme';
import { ICON_STROKE } from '../../components/common/Icon';
import { rf } from '../../utils/responsive';

const FIELD_TYPES = ['Text', 'Number', 'Date', 'Dropdown', 'MultiSelect'] as const;

export const VisitFieldConfigScreen = ({ route }: any) => {
  const T = useAppTheme();
  const insets = useSafeAreaInsets();

  // Field type → theme status tone (replaces the old hardcoded hex map).
  const typeTone = (t: string) =>
    t === 'Text' ? T.info : t === 'Number' ? T.accent : t === 'Date' ? T.warning
      : t === 'Dropdown' ? T.success : T.danger;

  const [fields, setFields] = useState<VisitField[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingField, setEditingField] = useState<VisitField | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ visible: boolean; id: number }>({ visible: false, id: -1 });

  const [fieldName, setFieldName] = useState('');
  const [fieldType, setFieldType] = useState<typeof FIELD_TYPES[number]>('Text');
  const [optionsText, setOptionsText] = useState('');
  const [displayOrder, setDisplayOrder] = useState('');
  const [isRequired, setIsRequired] = useState(false);

  const loadFields = useCallback(async () => {
    try {
      const res = await visitReportApi.getFields();
      const d = res.data as any;
      setFields(d?.fields ?? (Array.isArray(d) ? d : []));
    } catch {
      setFields([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadFields(); }, [loadFields]);

  const openCreate = () => {
    setEditingField(null);
    setFieldName('');
    setFieldType('Text');
    setOptionsText('');
    setDisplayOrder(String(fields.length + 1));
    setIsRequired(false);
    setShowForm(true);
  };

  const openEdit = (field: VisitField) => {
    setEditingField(field);
    setFieldName(field.fieldName);
    setFieldType(field.fieldType);
    setOptionsText(field.options?.join(', ') ?? '');
    setDisplayOrder(String(field.displayOrder));
    setIsRequired(field.isRequired);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!fieldName.trim()) return;
    setSubmitting(true);
    try {
      const options = ['Dropdown', 'MultiSelect'].includes(fieldType)
        ? optionsText.split(',').map(o => o.trim()).filter(Boolean)
        : undefined;
      const payload: CreateVisitFieldRequest = {
        fieldName: fieldName.trim(),
        fieldType,
        options,
        displayOrder: displayOrder ? parseInt(displayOrder) : undefined,
        isRequired,
      };
      if (editingField) await visitReportApi.updateField(editingField.id, payload);
      else await visitReportApi.createField(payload);
      setShowForm(false);
      await loadFields();
    } catch (err: any) {
      Alert.alert('Save failed', err?.response?.data?.message || 'Could not save the visit field. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await visitReportApi.deleteField(id);
      await loadFields();
    } catch (err: any) {
      Alert.alert('Delete failed', err?.response?.data?.message || 'Could not delete the visit field. Please try again.');
    }
  };

  const renderField = ({ item }: { item: VisitField }) => (
    <Card style={s.fieldCard}>
      <View style={s.fieldRow}>
        <View style={[s.orderBadge, { backgroundColor: T.cardAlt }]}>
          <Text style={[s.orderText, { color: T.sub }]}>{item.displayOrder}</Text>
        </View>
        <View style={s.flexMin}>
          <View style={s.nameRow}>
            <Text numberOfLines={1} style={[s.fieldName, { color: T.text }]}>{item.fieldName}</Text>
            {item.isRequired && (
              <View style={[s.reqBadge, { backgroundColor: withAlpha(T.danger, SOFT_TINT) }]}>
                <Text style={[s.reqTxt, { color: T.danger }]}>Required</Text>
              </View>
            )}
          </View>
          <View style={s.typeRow}>
            <StatusBadge label={item.fieldType} color={typeTone(item.fieldType)} />
          </View>
        </View>
        <View style={s.actions}>
          <TouchableOpacity style={s.actionBtn} hitSlop={8} onPress={() => openEdit(item)}>
            <Edit2 size={16} color={T.accent} strokeWidth={ICON_STROKE} />
          </TouchableOpacity>
          <TouchableOpacity style={s.actionBtn} hitSlop={8} onPress={() => setDeleteConfirm({ visible: true, id: item.id })}>
            <Trash2 size={16} color={T.danger} strokeWidth={ICON_STROKE} />
          </TouchableOpacity>
        </View>
      </View>
      {item.options && item.options.length > 0 && (
        <View style={[s.optionsRow, { borderTopColor: T.line }]}>
          {item.options.map(opt => (
            <View key={opt} style={[s.optionChip, { backgroundColor: T.cardAlt }]}>
              <Text style={[s.optionTxt, { color: T.sub }]}>{opt}</Text>
            </View>
          ))}
        </View>
      )}
    </Card>
  );

  if (loading) return <LoadingSpinner fullScreen color={T.accent} message="Loading fields..." />;

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: T.bg }]} edges={['bottom']}>
      {/* Stack-pushed from Settings → no AppTopbar; pad for the island. Drawer path (SH
          sidebar) has no `pushed` param and already gets the inset from AppTopbar. */}
      {route?.params?.pushed && <View style={{ height: insets.top }} />}
      <View style={[s.toolbar, { borderBottomColor: T.line }]}>
        <Text style={[s.toolbarTitle, { color: T.sub }]}>
          Custom Fields{fields.length ? ` · ${fields.length}` : ''}
        </Text>
        <View style={s.spacer} />
        <Btn label="New Field" onPress={openCreate} small icon={<Plus size={14} color={T.onAccent} strokeWidth={ICON_STROKE} />} />
      </View>

      <FlatList
        data={fields}
        keyExtractor={item => String(item.id)}
        renderItem={renderField}
        contentContainerStyle={[s.list, fields.length === 0 && s.listEmpty]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState title="No custom fields" subtitle="Add custom fields for visit reports" icon="📋" />
        }
      />

      <FormModal
        visible={showForm}
        title={editingField ? 'Edit Field' : 'New Field'}
        onClose={() => setShowForm(false)}
        footer={
          <>
            <Btn label="Cancel" variant="secondary" onPress={() => setShowForm(false)} small />
            <Btn
              label={editingField ? 'Update' : 'Add Field'}
              onPress={handleSubmit}
              loading={submitting}
              disabled={!fieldName.trim()}
              small
            />
          </>
        }
      >
        <Field label="Field Name *">
          <Input value={fieldName} onChangeText={setFieldName} placeholder="e.g. Decision Maker Present" />
        </Field>

        <Field label="Field Type *">
          <View style={s.chipRow}>
            {FIELD_TYPES.map(type => {
              const on = fieldType === type;
              return (
                <TouchableOpacity
                  key={type}
                  onPress={() => setFieldType(type)}
                  activeOpacity={0.8}
                  style={[s.chip, { borderColor: on ? T.accent : T.line, backgroundColor: on ? T.accent : T.card }]}
                >
                  <Text style={[s.chipTxt, { color: on ? T.onAccent : T.sub }]}>{type}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Field>

        {['Dropdown', 'MultiSelect'].includes(fieldType) && (
          <Field label="Options (comma-separated)">
            <Input value={optionsText} onChangeText={setOptionsText} placeholder="Option 1, Option 2, Option 3" multiline />
          </Field>
        )}

        <Field label="Display Order">
          <NumField value={displayOrder} onChangeText={setDisplayOrder} placeholder="e.g. 1" label="Display Order" allowDecimal={false} />
        </Field>

        <View style={s.toggleRow}>
          <Text style={[s.toggleLabel, { color: T.text }]}>Required</Text>
          <Switch
            value={isRequired}
            onValueChange={setIsRequired}
            trackColor={{ true: T.accent, false: T.line }}
            thumbColor={T.card}
          />
        </View>
      </FormModal>

      <ConfirmModal
        visible={deleteConfirm.visible}
        title="Delete Field"
        message="This will remove the custom field from all future visit reports."
        icon={<AlertTriangle size={22} color={T.danger} strokeWidth={ICON_STROKE} />}
        tone="danger"
        confirmLabel="Delete"
        onConfirm={() => { handleDelete(deleteConfirm.id); setDeleteConfirm({ visible: false, id: -1 }); }}
        onCancel={() => setDeleteConfirm({ visible: false, id: -1 })}
      />
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  safe: { flex: 1 },
  toolbar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  toolbarTitle: { fontSize: rf(12.5), fontWeight: '700' },
  spacer: { flex: 1 },
  list: { padding: 12, gap: 10 },
  listEmpty: { flex: 1 },

  fieldCard: { padding: 14 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  orderBadge: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  orderText: { fontSize: rf(13), fontWeight: '700' },
  flexMin: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  fieldName: { fontSize: rf(14), fontWeight: '700', flexShrink: 1, minWidth: 0 },
  reqBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 100, flexShrink: 0 },
  reqTxt: { fontSize: rf(10), fontWeight: '700' },
  typeRow: { flexDirection: 'row', alignItems: 'center' },
  actions: { flexDirection: 'row', gap: 2, flexShrink: 0 },
  actionBtn: { padding: 6 },
  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
  optionChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 },
  optionTxt: { fontSize: rf(12) },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 100, borderWidth: 1 },
  chipTxt: { fontSize: rf(12.5), fontWeight: '600' },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  toggleLabel: { fontSize: rf(13), fontWeight: '600' },
});
