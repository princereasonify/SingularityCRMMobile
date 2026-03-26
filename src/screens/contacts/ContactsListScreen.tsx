import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  TextInput, RefreshControl, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, Plus, Phone, Mail } from 'lucide-react-native';
import { contactsApi } from '../../api/contacts';
import { Contact } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { LoadingSpinner, EmptyState } from '../../components/common/LoadingSpinner';
import { ROLE_COLORS } from '../../utils/constants';
import { rf } from '../../utils/responsive';

const FILTERS = ['All', 'Decision Makers', 'Influencers', 'Champions'];

const RELATIONSHIP_COLORS: Record<string, string> = {
  New: '#9CA3AF', Warm: '#F59E0B', Strong: '#16A34A',
  Champion: '#7C3AED', Detractor: '#DC2626',
};

export const ContactsListScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const role = user?.role || 'FO';
  const COLOR = ROLE_COLORS[role as keyof typeof ROLE_COLORS];
  const { width } = useWindowDimensions();
  const tablet = width >= 768;

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchContacts = useCallback(async (pg = 1, reset = false) => {
    try {
      const params: any = { page: pg, pageSize: 20, search: search || undefined };
      if (filter === 'Champions') params.relationship = 'Champion';
      const res = await contactsApi.getAll(params);
      let items: Contact[] = (res.data as any)?.items ?? res.data ?? [];
      if (filter === 'Decision Makers') items = items.filter(c => c.isDecisionMaker);
      if (filter === 'Influencers') items = items.filter(c => c.isInfluencer);
      if (reset) setContacts(items);
      else setContacts(prev => [...prev, ...items]);
      setTotalPages((res.data as any)?.totalPages ?? 1);
    } catch {
      if (reset) setContacts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [search, filter]);

  useEffect(() => {
    setLoading(true);
    setPage(1);
    fetchContacts(1, true);
  }, [search, filter]);

  const handleLoadMore = () => {
    if (page < totalPages && !loadingMore) {
      setLoadingMore(true);
      const next = page + 1;
      setPage(next);
      fetchContacts(next, false);
    }
  };

  const renderContact = ({ item }: { item: Contact }) => (
    <Card
      style={tablet ? { flex: 1 } : undefined}
      onPress={() => navigation.navigate('ContactDetail', { contactId: item.id })}
    >
      <View style={styles.cardHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.cardMain}>
          <View style={styles.nameRow}>
            <Text style={styles.contactName} numberOfLines={1}>{item.name}</Text>
            <Badge label={item.relationship} color={RELATIONSHIP_COLORS[item.relationship] || '#9CA3AF'} />
          </View>
          {item.designation && <Text style={styles.designation}>{item.designation}</Text>}
          {item.schoolName && <Text style={styles.school} numberOfLines={1}>🏫 {item.schoolName}</Text>}
        </View>
      </View>
      <View style={styles.contactDetails}>
        {item.phone && (
          <View style={styles.detailRow}>
            <Phone size={12} color="#9CA3AF" />
            <Text style={styles.detailText}>{item.phone}</Text>
          </View>
        )}
        {item.email && (
          <View style={styles.detailRow}>
            <Mail size={12} color="#9CA3AF" />
            <Text style={styles.detailText}>{item.email}</Text>
          </View>
        )}
      </View>
      {(item.isDecisionMaker || item.isInfluencer) && (
        <View style={styles.badgeRow}>
          {item.isDecisionMaker && <Badge label="Decision Maker" color="#16A34A" />}
          {item.isInfluencer && <Badge label="Influencer" color="#2563EB" />}
        </View>
      )}
    </Card>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={[styles.header, { backgroundColor: COLOR.primary }]}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Contacts</Text>
          {(role === 'FO' || role === 'ZH') && (
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('AddContact')}>
              <Plus size={20} color="#FFF" />
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.searchBar}>
          <Search size={16} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search contacts..."
            placeholderTextColor="#9CA3AF"
            value={search}
            onChangeText={setSearch}
          />
        </View>
        <View style={styles.filterRow}>
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, filter === f && { backgroundColor: '#FFF' }]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterText, filter === f && { color: COLOR.primary }]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        <LoadingSpinner fullScreen color={COLOR.primary} message="Loading contacts..." />
      ) : (
        <FlatList
          data={contacts}
          keyExtractor={item => String(item.id)}
          renderItem={renderContact}
          contentContainerStyle={[styles.list, contacts.length === 0 && { flex: 1 }]}
          key={tablet ? 'grid' : 'list'}
          numColumns={tablet ? 2 : 1}
          columnWrapperStyle={tablet ? { gap: 10 } : undefined}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); setPage(1); fetchContacts(1, true); }}
              colors={[COLOR.primary]}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={<EmptyState title="No contacts found" subtitle="Add your first contact" icon="👤" />}
          ListFooterComponent={loadingMore ? <LoadingSpinner color={COLOR.primary} /> : null}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  headerTitle: { fontSize: rf(22), fontWeight: '700', color: '#FFF' },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    marginBottom: 10, gap: 8,
  },
  searchInput: { flex: 1, fontSize: rf(14), color: '#111827' },
  filterRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  filterText: { fontSize: rf(12), color: 'rgba(255,255,255,0.9)', fontWeight: '600' },
  list: { padding: 12, gap: 10 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 8 },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#E0E7FF', alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: rf(16), fontWeight: '700', color: '#4338CA' },
  cardMain: { flex: 1 },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  contactName: { fontSize: rf(15), fontWeight: '700', color: '#111827', flex: 1 },
  designation: { fontSize: rf(12), color: '#6B7280', marginTop: 2 },
  school: { fontSize: rf(12), color: '#9CA3AF', marginTop: 2 },
  contactDetails: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  detailText: { fontSize: rf(12), color: '#6B7280' },
  badgeRow: { flexDirection: 'row', gap: 6 },
});
