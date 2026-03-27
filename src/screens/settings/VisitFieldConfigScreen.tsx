import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Modal,
  ActivityIndicator, FlatList, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, X, Edit2, Trash2 } from 'lucide-react-native';
import { visitReportApi } from '../../api/visitReport';
import { VisitField, CreateVisitFieldRequest } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { Card } from '../../components/common/Card';
import { LoadingSpinner, EmptyState } from '../../components/common/LoadingSpinner';
import { ROLE_COLORS } from '../../utils/constants';
import { rf } from '../../utils/responsive';
import { ConfirmModal } from '../../components/common/ConfirmModal';

const FIELD_TYPES = ['Text', 'Number', 'Date', 'Dropdown', 'MultiSelect'] as const;

const TYPE_COLORS: Record<string, string> = {
  Text: '#2563EB', Number: '#7C3AED', Date: '#F59E0B',
  Dropdown: '#0D9488', MultiSelect: '#DC2626',
};

export const VisitFieldConfigScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const COLOR = ROLE_COLORS[(user?.role || 'SH') as keyof typeof ROLE_COLORS];

  const [fields, setFields] = useState<VisitField[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingField, setEditingField] = useState<VisitField | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ visible: boolean; id: number }>({ visible: false, id: -1 });

  // Form state
  const [fieldName, setFieldName] = useState('');
  const [fieldType, setFieldType] = useState<typeof FIELD_TYPES[number]>('Text');
  const [optionsText, setOptionsText] = useState('');
  const [displayOrder, setDisplayOrder] = useState('');
  const [isRequired, setIsRequired] = useState(false);

  const loadFields = useCallback(async () => {
    try {
      const res = await visitReportApi.getFields();
      setFields((res.data as any) ?? []);
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

      if (editingField) {
        await visitReportApi.updateField(editingField.id, payload);
      } else {
        await visitReportApi.createField(payload);
      }
      setShowForm(false);
      await loadFields();
    } catch {
      // silent
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await visitReportApi.deleteField(id);
      await loadFields();
    } catch {}
  };

  const renderField = ({ item, index }: { item: VisitField; index: number }) => (
    <Card style={styles.fieldCard}>
      <View style={styles.fieldCardHeader}>
        <View style={styles.orderBadge}>
          <Text style={styles.orderText}>{item.displayOrder}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.fieldNameRow}>
            <Text style={styles.fieldName}>{item.fieldName}</Text>
            {item.isRequired && (
              <View style={styles.requiredBadge}>
                <Text style={styles.requiredText}>Required</Text>
              </View>
            )}
          </View>
          <View style={styles.fieldTypeBadge}>
            <Text style={[styles.fieldTypeText, { color: TYPE_COLORS[item.fieldType] || '#6B7280' }]}>
              {item.fieldType}
            </Text>
          </View>
        </View>
        <View style={styles.fieldActions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => openEdit(item)}>
            <Edit2 size={15} color="#2563EB" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => setDeleteConfirm({ visible: true, id: item.id })}
          >
            <Trash2 size={15} color="#DC2626" />
          </TouchableOpacity>
        </View>
      </View>
      {item.options && item.options.length > 0 && (
        <View style={styles.optionsRow}>
          {item.options.map(opt => (
            <View key={opt} style={styles.optionChip}>
              <Text style={styles.optionText}>{opt}</Text>
            </View>
          ))}
        </View>
      )}
    </Card>
  );

  if (loading) return <LoadingSpinner fullScreen color={COLOR.primary} message="Loading fields..." />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title="Visit Field Config"
        color={COLOR.primary}
        onBack={() => navigation.goBack()}
        rightAction={
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: 'rgba(255,255,255,0.2)' }]}
            onPress={openCreate}
          >
            <Plus size={18} color="#FFF" />
          </TouchableOpacity>
        }
      />

      <FlatList
        data={fields}
        keyExtractor={item => String(item.id)}
        renderItem={renderField}
        contentContainerStyle={[styles.list, fields.length === 0 && { flex: 1 }]}
        ListEmptyComponent={
          <EmptyState
            title="No custom fields"
            subtitle="Add custom fields for visit reports"
            icon="📋"
          />
        }
      />

      {/* Create/Edit Modal */}
      <Modal visible={showForm} transparent animationType="slide" onRequestClose={() => setShowForm(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingField ? 'Edit Field' : 'New Field'}</Text>
              <TouchableOpacity onPress={() => setShowForm(false)}>
                <X size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Field Name *</Text>
                <TextInput
                  style={styles.input}
                  value={fieldName}
                  onChangeText={setFieldName}
                  placeholder="e.g. Decision Maker Present"
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Field Type *</Text>
                <View style={styles.chipRow}>
                  {FIELD_TYPES.map(type => (
                    <TouchableOpacity
                      key={type}
                      style={[styles.chip, fieldType === type && { backgroundColor: COLOR.primary }]}
                      onPress={() => setFieldType(type)}
                    >
                      <Text style={[styles.chipText, fieldType === type && { color: '#FFF' }]}>{type}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {['Dropdown', 'MultiSelect'].includes(fieldType) && (
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Options (comma-separated)</Text>
                  <TextInput
                    style={[styles.input, styles.inputMulti]}
                    value={optionsText}
                    onChangeText={setOptionsText}
                    placeholder="Option 1, Option 2, Option 3"
                    placeholderTextColor="#9CA3AF"
                    multiline
                  />
                </View>
              )}

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Display Order</Text>
                <TextInput
                  style={styles.input}
                  value={displayOrder}
                  onChangeText={setDisplayOrder}
                  placeholder="e.g. 1"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.toggleRow}>
                <Text style={styles.formLabel}>Required</Text>
                <Switch
                  value={isRequired}
                  onValueChange={setIsRequired}
                  trackColor={{ true: COLOR.primary }}
                  thumbColor="#FFF"
                />
              </View>

              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: COLOR.primary }, submitting && { opacity: 0.7 }]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting
                  ? <ActivityIndicator color="#FFF" />
                  : <Text style={styles.submitBtnText}>{editingField ? 'Update Field' : 'Add Field'}</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Delete confirm */}
      <ConfirmModal
        visible={deleteConfirm.visible}
        title="Delete Field"
        message="This will remove the custom field from all future visit reports."
        confirmText="Delete"
        confirmColor="#DC2626"
        onConfirm={() => {
          handleDelete(deleteConfirm.id);
          setDeleteConfirm({ visible: false, id: -1 });
        }}
        onCancel={() => setDeleteConfirm({ visible: false, id: -1 })}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  list: { padding: 16, gap: 10 },
  addBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },

  fieldCard: { padding: 14 },
  fieldCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  orderBadge: {
    width: 30, height: 30, borderRadius: 8, backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center',
  },
  orderText: { fontSize: rf(13), fontWeight: '700', color: '#374151' },
  fieldNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  fieldName: { fontSize: rf(14), fontWeight: '700', color: '#111827' },
  requiredBadge: { backgroundColor: '#FEF2F2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 100 },
  requiredText: { fontSize: rf(10), color: '#DC2626', fontWeight: '700' },
  fieldTypeBadge: {},
  fieldTypeText: { fontSize: rf(12), fontWeight: '600' },
  fieldActions: { flexDirection: 'row', gap: 4 },
  actionBtn: { padding: 6 },
  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  optionChip: { backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 },
  optionText: { fontSize: rf(12), color: '#374151' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 40, maxHeight: '85%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: rf(17), fontWeight: '700', color: '#111827' },
  formGroup: { marginBottom: 14 },
  formLabel: { fontSize: rf(13), fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: rf(14), color: '#111827', backgroundColor: '#FAFAFA',
  },
  inputMulti: { height: 80, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100,
    backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB',
  },
  chipText: { fontSize: rf(13), color: '#374151', fontWeight: '500' },
  toggleRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 14,
  },
  submitBtn: {
    borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8,
  },
  submitBtnText: { color: '#FFF', fontSize: rf(15), fontWeight: '700' },
});
