import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, TextInput, Keyboard, SectionList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../api/client';
import { AuthContext } from '../context/AuthContext';
import { C, F, R, S, card } from '../components/theme';
import Animated, { FadeInDown } from 'react-native-reanimated';

type Application = { company_name: string; ctc: string; offer_type: string; status: string };
type Tab = 'Applications' | 'Company Lookup';

function getStatusColor(s: string) {
  const str = (s || '').toLowerCase();
  if (str.includes('offer')) return C.green;
  if (str.includes('interview') || str.includes('shortlist')) return C.gold;
  if (str.includes('reject') || str.includes('not')) return C.red;
  return C.navy;
}

export default function HubScreen() {
  const [tab, setTab] = useState<Tab>('Applications');
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useContext(AuthContext);
  
  const [query, setQuery] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const fetchApps = async () => {
    if (!user) return;
    try {
      const r = await apiClient.get(`/applications/${user.rollNo}`);
      setApps([...(r.data.data || [])].reverse());
    } catch {} finally { setLoading(false); setRefreshing(false); }
  };
  useEffect(() => { fetchApps(); }, [user]);

  const lookup = async () => {
    if (!query.trim()) return;
    Keyboard.dismiss(); setLookupLoading(true); setResult(null);
    try {
      const r = await apiClient.get(`/company/${encodeURIComponent(query.trim())}`);
      setResult(r.data.data);
    } catch { setResult({ error: 'Company not found or no data.' }); }
    finally { setLookupLoading(false); }
  };

  const renderApp = ({ item, index }: { item: Application, index: number }) => {
    const sCol = getStatusColor(item.status);
    const l = (item.company_name || '?').charAt(0).toUpperCase();
    return (
      <Animated.View entering={FadeInDown.duration(400).delay(index * 100)} style={s.appCard}>
        <View style={s.appBody}>
          <Text style={s.appName} numberOfLines={1}>{item.company_name}</Text>
          <Text style={s.appRole} numberOfLines={1}>{item.offer_type || '—'}</Text>
        </View>
        <View style={s.appRight}>
          <Text style={s.appSal}>{item.ctc || '—'}</Text>
          <View style={[s.statusPill, { backgroundColor: sCol + '15' }]}>
            <Text style={[s.statusText, { color: sCol }]}>{item.status}</Text>
          </View>
        </View>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView edges={['top']} style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.title}>Hub</Text>
          <Text style={s.subtitle}>Career Center</Text>
        </View>
        <View style={s.headerIcons}>
          <TouchableOpacity style={s.iconBtn} onPress={() => setTab('Company Lookup')}><Ionicons name="search-outline" size={22} color={C.t1} /></TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View style={s.tabRow}>
        {(['Applications', 'Company Lookup'] as Tab[]).map(t => (
          <TouchableOpacity key={t} style={[s.tab, tab === t && s.tabActive]} onPress={() => setTab(t)}>
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Applications */}
      {tab === 'Applications' && (
        loading ? <View style={s.centered}><ActivityIndicator color={C.gold} /></View> : (
          <SectionList
            sections={[{ data: apps }]}
            keyExtractor={(_, i) => i.toString()}
            renderItem={renderApp}
            contentContainerStyle={s.scroll}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchApps(); }} tintColor={C.gold} />}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={s.empty}>
                <Ionicons name="briefcase-outline" size={44} color={C.t3} />
                <Text style={s.emptyTitle}>No applications found</Text>
              </View>
            }
          />
        )
      )}

      {/* Lookup */}
      {tab === 'Company Lookup' && (
        <ScrollView style={s.scroll} contentContainerStyle={{ paddingBottom: 100 }}>
          <View style={s.searchCard}>
            <Text style={s.searchHint}>Search historical CTCs and timelines.</Text>
            <View style={s.searchRow}>
              <TextInput
                style={s.searchInput}
                placeholder="e.g. Microsoft"
                placeholderTextColor={C.t3}
                value={query} onChangeText={setQuery} onSubmitEditing={lookup}
                returnKeyType="search" autoCorrect={false}
              />
              <TouchableOpacity style={s.searchBtn} onPress={lookup} activeOpacity={0.8}>
                {lookupLoading ? <ActivityIndicator size="small" color={C.s1} /> : <Ionicons name="search" size={18} color={C.s1} />}
              </TouchableOpacity>
            </View>
          </View>

          {result && !lookupLoading && (
            result.error ? (
              <Animated.View entering={FadeInDown.duration(400)} style={[card, { padding: S.md, backgroundColor: C.redDim }]}><Text style={{fontFamily:F.m, color:C.red}}>{result.error}</Text></Animated.View>
            ) : (
              <Animated.View entering={FadeInDown.duration(400)} style={{ gap: S.md }}>
                <View style={{ flexDirection: 'row', gap: S.md }}>
                  <View style={[card, { flex: 1, padding: S.lg }]}>
                    <Text style={s.lookupStatLabel}>AVG CTC</Text>
                    <Text style={[s.lookupStatNum, { color: C.blue }]}>{result.average_ctc || '—'}</Text>
                  </View>
                  <View style={[card, { flex: 1, padding: S.lg }]}>
                    <Text style={s.lookupStatLabel}>OFFER TYPES</Text>
                    <Text style={[s.lookupStatNum, { fontSize: 16 }]}>{result.offer_types?.join(', ') || '—'}</Text>
                  </View>
                </View>
                <View style={[card, { padding: S.lg }]}>
                  <Text style={s.lookupStatLabel}>PREFERRED BRANCHES</Text>
                  <Text style={s.lookupInfoVal}>{result.preferred_branches?.join(', ') || 'Any'}</Text>
                </View>
                <View style={[card, { padding: S.lg }]}>
                  <Text style={s.lookupStatLabel}>TYPICAL TIMELINE</Text>
                  <Text style={s.lookupInfoVal}>{result.timeline?.join(' → ') || '—'}</Text>
                </View>
              </Animated.View>
            )
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: S.lg, paddingTop: S.md },
  title: { fontFamily: F.b, fontSize: 24, color: C.t1 },
  subtitle: { fontFamily: F.r, fontSize: 13, color: C.t2, marginTop: 4 },
  headerIcons: { flexDirection: 'row', gap: S.sm },
  iconBtn: { padding: 4 },

  tabRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#EAEAEA', marginTop: S.md },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: C.gold },
  tabText: { fontFamily: F.m, fontSize: 13, color: C.t2 },
  tabTextActive: { color: C.gold },

  scroll: { paddingHorizontal: S.lg, paddingTop: S.lg, paddingBottom: 100 },

  appCard: { ...card, padding: S.md, flexDirection: 'row', alignItems: 'center', marginBottom: S.md },
  appIcon: { width: 44, height: 44, borderRadius: R.md, backgroundColor: '#F5F6F8', alignItems: 'center', justifyContent: 'center', marginRight: S.md },
  appIconText: { fontFamily: F.sb, fontSize: 20 },
  
  appBody: { flex: 1, gap: 4 },
  appName: { fontFamily: F.sb, fontSize: 15, color: C.t1 },
  appRole: { fontFamily: F.r, fontSize: 12, color: C.t2 },
  
  appRight: { alignItems: 'flex-end', justifyContent: 'center' },
  appSal: { fontFamily: F.m, fontSize: 13, color: C.t1 },
  statusPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 4 },
  statusText: { fontFamily: F.b, fontSize: 9, letterSpacing: 0.5 },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTitle: { fontFamily: F.m, fontSize: 14, color: C.t2 },

  searchCard: { ...card, padding: S.lg, marginBottom: S.xl },
  searchHint: { fontFamily: F.m, fontSize: 13, color: C.t2, marginBottom: S.md },
  searchRow: { flexDirection: 'row', gap: S.sm },
  searchInput: { flex: 1, backgroundColor: C.bg, borderRadius: R.md, paddingHorizontal: 16, paddingVertical: 14, fontFamily: F.r, fontSize: 15, color: C.t1 },
  searchBtn: { backgroundColor: C.navy, borderRadius: R.md, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },

  lookupStatLabel: { fontFamily: F.sb, fontSize: 10, color: C.t2, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  lookupStatNum: { fontFamily: F.b, fontSize: 26, color: C.t1, letterSpacing: -0.5 },
  lookupInfoVal: { fontFamily: F.m, fontSize: 15, color: C.t1, lineHeight: 22 },
});
