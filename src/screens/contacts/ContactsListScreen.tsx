/**
 * ⚠️ UNREACHABLE DEAD CODE — kept on disk for reference only.
 *
 * Web has no standalone Contacts page; contacts live as a tab inside School
 * Detail, and mobile now mirrors that. This screen's Stack.Screen registration
 * has been removed from AppNavigator, so nothing can navigate here.
 *
 * It calls contacts endpoints that never existed on the backend (there is no
 * ContactsController — see src/api/contacts.ts). Those methods are gone from
 * contactsApi; the `legacyContactsApi` alias below only exists so this dead file
 * still typechecks. Do NOT re-register this route or revive the alias without
 * first adding the corresponding backend actions.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  TextInput, RefreshControl, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, Plus, Phone, Mail } from 'lucide-react-native';
import { contactsApi } from '../../api/contacts';
/** Phantom endpoints this dead screen still references — see header. */
const legacyContactsApi = contactsApi as any;

import { Contact } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Card, Badge } from '../../components/ui';
import { LoadingSpinner, EmptyState } from '../../components/common/LoadingSpinner';
import { Btn, SearchBar, Segmented } from '../../components/crud';
import { ROLE_COLORS } from '../../utils/constants';
import { rf } from '../../utils/responsive';
import { useAppTheme } from '../../theme/useAppTheme';
import type { AppTheme } from '../../theme';

const FILTERS = ['All', 'Decision Makers', 'Influencers', 'Champions'];

/**
 * Spec tokens, not the old literal palette (#9CA3AF/#F59E0B/#16A34A/#7C3AED/
 * #DC2626) — those were off-theme and, being fixed hues, broke in dark mode.
 * Same mapping ContactDetailScreen uses, so a contact reads identically in the
 * list and on its detail page.
 */
const relationshipColors = (T: AppTheme): Record<string, string> => ({
  New: T.dim, Warm: T.warning, Strong: T.success,
  Champion: T.info, Detractor: T.danger,
});

export const ContactsListScreen = ({ navigation }: any) => {
  const T = useAppTheme();
  const RELATIONSHIP_COLORS = relationshipColors(T);
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
      const res = await legacyContactsApi.getAll(params);
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

  // Full-width rows on every size — the house rule is list view, never a card
  // grid on tablet (a 2-up grid is what made Targets look inconsistent).
  const renderContact = ({ item }: { item: Contact }) => (
    <Card onPress={() => navigation.navigate('ContactDetail', { contactId: item.id })}>
      <View style={styles.cardHeader}>
        <View style={[styles.avatar, { backgroundColor: T.accentSoft }]}>
          <Text style={[styles.avatarText, { color: T.accent }]}>{item.name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.cardMain}>
          <View style={styles.nameRow}>
            <Text style={[styles.contactName, { color: T.text }]} numberOfLines={1}>{item.name}</Text>
            <Badge label={item.relationship} color={RELATIONSHIP_COLORS[item.relationship] || T.dim} />
          </View>
          {item.designation && <Text style={[styles.designation, { color: T.sub }]}>{item.designation}</Text>}
          {item.schoolName && <Text style={[styles.school, { color: T.dim }]} numberOfLines={1}>{item.schoolName}</Text>}
        </View>
      </View>
      <View style={styles.contactDetails}>
        {item.phone && (
          <View style={styles.detailRow}>
            <Phone size={12} color={T.dim} />
            <Text style={[styles.detailText, { color: T.sub }]}>{item.phone}</Text>
          </View>
        )}
        {item.email && (
          <View style={styles.detailRow}>
            <Mail size={12} color={T.dim} />
            <Text style={[styles.detailText, { color: T.sub }]}>{item.email}</Text>
          </View>
        )}
      </View>
      {(item.isDecisionMaker || item.isInfluencer) && (
        <View style={styles.badgeRow}>
          {item.isDecisionMaker && <Badge label="Decision Maker" color={T.success} />}
          {item.isInfluencer && <Badge label="Influencer" color={T.info} />}
        </View>
      )}
    </Card>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: T.bg }]} edges={['top']}>
      {/* Plain themed header on T.bg + kit SearchBar/Segmented — the house pattern
          from SchoolsListScreen, so every list page reads the same. */}
      <View style={[styles.header, { borderBottomColor: T.line }]}>
        <View style={styles.headerRow}>
          <Text style={[styles.headerTitle, { color: T.text }]}>Contacts</Text>
          {/* Gate preserved verbatim — FO and ZH only, exactly as before. */}
          {(role === 'FO' || role === 'ZH') && (
            <Btn
              label="Add Contact"
              small
              onPress={() => navigation.navigate('AddContact')}
              icon={<Plus size={14} color="#FFF" strokeWidth={1.9} />}
            />
          )}
        </View>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search contacts..."
          style={styles.searchGap}
        />
        <Segmented
          value={filter}
          options={FILTERS.map(f => ({ label: f, value: f }))}
          onChange={setFilter}
        />
      </View>

      {loading ? (
        <LoadingSpinner fullScreen color={T.accent} message="Loading contacts..." />
      ) : (
        <FlatList
          data={contacts}
          keyExtractor={item => String(item.id)}
          renderItem={renderContact}
          contentContainerStyle={[styles.list, contacts.length === 0 && { flex: 1 }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); setPage(1); fetchContacts(1, true); }}
              colors={[T.accent]}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={<EmptyState title="No contacts found" subtitle="Add your first contact" icon="👤" />}
          ListFooterComponent={loadingMore ? <LoadingSpinner color={T.accent} /> : null}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  headerTitle: { fontSize: rf(22), fontWeight: '700', letterSpacing: -0.4 },
  searchGap: { marginBottom: 10 },
  list: { padding: 12, gap: 10 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 8 },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: rf(16), fontWeight: '700' },
  cardMain: { flex: 1 },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  contactName: { fontSize: rf(15), fontWeight: '700', flex: 1 },
  designation: { fontSize: rf(12), fontWeight: '400', marginTop: 2 },
  school: { fontSize: rf(12), fontWeight: '400', marginTop: 2 },
  contactDetails: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  detailText: { fontSize: rf(12), fontWeight: '400' },
  badgeRow: { flexDirection: 'row', gap: 6 },
});
