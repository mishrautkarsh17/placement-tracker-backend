import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../api/client';
import { C, F, R, S, card } from '../components/theme';

type AnalyticsData = {
  overall: { total_students:number; placed_students:number; placement_rate:number; total_offers:number; companies_hiring:number; top_branch:string };
  branch_data: any[];
  batch_data: any[];
  recent_offers?: any[];
  rawOffers?: any[];
};

export default function AnalyticsScreen() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncingOffers, setSyncingOffers] = useState(false);
  const [syncingCTC, setSyncingCTC] = useState(false);
  const [visibleOffersCount, setVisibleOffersCount] = useState(50);

  // Collapse states
  const [showBranch, setShowBranch] = useState(true);
  const [showBatch, setShowBatch] = useState(false);
  const [showOffers, setShowOffers] = useState(false);

  const fetch_ = async () => {
    try { 
      const [r, o] = await Promise.all([
        apiClient.get('/analytics'),
        apiClient.get('/offers')
      ]);
      setData({ ...r.data, rawOffers: o.data.data }); 
    }
    catch {} finally { setLoading(false); setRefreshing(false); }
  };
  useEffect(() => { fetch_(); }, []);
  const onRefresh = () => { setRefreshing(true); fetch_(); };

  const handleSyncOffers = async () => {
    setSyncingOffers(true);
    try {
      await apiClient.post('/sync-email-offers');
      Alert.alert('Success', 'Emails synced successfully!');
      fetch_();
    } catch (e) {
      Alert.alert('Error', 'Failed to sync offers.');
    } finally {
      setSyncingOffers(false);
    }
  };

  const handleSyncCTC = async () => {
    setSyncingCTC(true);
    try {
      await apiClient.post('/sync-ctc-enrichment');
      Alert.alert('Success', 'CTC Enrichment started in background.');
    } catch (e) {
      Alert.alert('Error', 'Failed to start CTC sync.');
    } finally {
      setSyncingCTC(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.title}>Dashboard</Text>
          <Text style={s.subtitle}>Placement Overview</Text>
        </View>
        <View style={s.avatarBox}><Ionicons name="person" size={16} color={C.s1} /></View>
      </View>

      {loading ? (
        <View style={s.centered}><ActivityIndicator size="large" color={C.gold} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={s.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.gold} />}
          showsVerticalScrollIndicator={false}
        >
          {data?.overall ? (
            <>
              {/* ── Action Buttons ── */}
              <View style={{ flexDirection: 'row', gap: S.sm, marginBottom: S.md }}>
                <TouchableOpacity style={s.actionBtn} onPress={handleSyncOffers} disabled={syncingOffers}>
                  {syncingOffers ? <ActivityIndicator size="small" color={C.t1} /> : <><Ionicons name="mail" size={14} color={C.t1} /><Text style={s.actionBtnText}>Sync Offers</Text></>}
                </TouchableOpacity>
                <TouchableOpacity style={s.actionBtn} onPress={handleSyncCTC} disabled={syncingCTC}>
                  {syncingCTC ? <ActivityIndicator size="small" color={C.t1} /> : <><Ionicons name="cash" size={14} color={C.t1} /><Text style={s.actionBtnText}>Sync CTC</Text></>}
                </TouchableOpacity>
              </View>

              {/* ── 2x2 Grid ── */}
              <View style={s.grid}>
                <View style={s.metricCard}>
                  <View style={[s.iconBox, { backgroundColor: C.blueDim }]}><Ionicons name="people-outline" size={16} color={C.blue} /></View>
                  <Text style={s.metricLabel}>Total Students</Text>
                  <Text style={s.metricVal}>{data.overall.total_students}</Text>
                  <Text style={s.metricSub}>Enrolled</Text>
                </View>
                <View style={s.metricCard}>
                  <View style={[s.iconBox, { backgroundColor: C.goldMuted }]}><Ionicons name="cash-outline" size={16} color={C.gold} /></View>
                  <Text style={s.metricLabel}>Total Offers</Text>
                  <Text style={s.metricVal}>{data.overall.total_offers}</Text>
                  <Text style={[s.metricSub, { color: C.green }]}>Made across campus</Text>
                </View>
                <View style={s.metricCard}>
                  <View style={[s.iconBox, { backgroundColor: C.blueDim }]}><Ionicons name="time-outline" size={16} color={C.blue} /></View>
                  <Text style={s.metricLabel}>Placed Students</Text>
                  <Text style={s.metricVal}>{data.overall.placed_students}</Text>
                  <Text style={[s.metricSub, { color: C.blue }]}>{data.overall.placement_rate}% placement rate</Text>
                </View>
                <View style={s.metricCard}>
                  <View style={[s.iconBox, { backgroundColor: C.goldMuted }]}><Ionicons name="business-outline" size={16} color={C.gold} /></View>
                  <Text style={s.metricLabel}>Companies</Text>
                  <Text style={s.metricVal}>{data.overall.companies_hiring}</Text>
                  <Text style={[s.metricSub, { color: C.gold }]}>Top: {data.overall.top_branch}</Text>
                </View>
              </View>

              {/* ── Branch Engagement (Dynamic) ── */}
              {data.branch_data && data.branch_data.length > 0 && (
                <View style={s.cardLarge}>
                  <TouchableOpacity style={s.cardHeader} onPress={() => setShowBranch(!showBranch)} activeOpacity={0.7}>
                    <Text style={s.cardTitle}>Branch Engagement</Text>
                    <View style={{flexDirection: 'row', alignItems: 'center', gap: S.md}}>
                      {showBranch && (
                        <View style={s.legend}>
                          <View style={[s.legendDot, { backgroundColor: C.t1 }]} /><Text style={s.legendText}>Placed</Text>
                          <View style={[s.legendDot, { backgroundColor: C.gold, marginLeft: 12 }]} /><Text style={s.legendText}>Total</Text>
                        </View>
                      )}
                      <Ionicons name={showBranch ? "chevron-up" : "chevron-down"} size={20} color={C.t2} />
                    </View>
                  </TouchableOpacity>
                  {showBranch && data.branch_data.map((b: any, i: number) => {
                    const max = Math.max(...data.branch_data.map((x:any) => x.total_students || 0), 1);
                    const tPct = b.total_students > 0 ? (b.total_students / max) * 100 : 0;
                    const pPct = b.total_students > 0 ? (b.placed_students / b.total_students) * 100 : 0;
                    return (
                      <View key={i} style={s.barRow}>
                        <Text style={s.barLabel}>{b.branch}</Text>
                        <View style={s.barTrack}>
                          {b.total_students > 0 ? (
                            <>
                              <View style={[s.barTotal, { width: `${tPct}%` as any }]} />
                              <View style={[s.barPlaced, { width: `${pPct * (tPct/100)}%` as any }]} />
                            </>
                          ) : <View style={s.barEmpty} />}
                        </View>
                        <View style={s.barNums}>
                          <Text style={s.barNumText}>{b.placed_students || '-'}</Text>
                          <Text style={s.barNumText}>{b.total_students || '-'}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* ── Batch-wise Data (Restored) ── */}
              {data.batch_data && data.batch_data.length > 0 && (
                <View style={s.cardLarge}>
                  <TouchableOpacity style={s.cardHeader} onPress={() => setShowBatch(!showBatch)} activeOpacity={0.7}>
                    <Text style={s.cardTitle}>Batch-wise Placement</Text>
                    <Ionicons name={showBatch ? "chevron-up" : "chevron-down"} size={20} color={C.t2} />
                  </TouchableOpacity>
                  {showBatch && (
                    <>
                      <View style={s.listHeader}>
                        <Text style={[s.listH, {flex: 1}]}>Batch</Text>
                        <Text style={[s.listH, {width: 60, textAlign: 'right'}]}>Firms</Text>
                        <Text style={[s.listH, {width: 60, textAlign: 'right'}]}>Rate</Text>
                      </View>
                      {data.batch_data.map((b: any, i: number) => (
                        <View key={i} style={s.listRow}>
                          <Text style={s.listColMain}>{b.batch_year}</Text>
                          <Text style={s.listColNum}>{b.firms_visited}</Text>
                          <Text style={[s.listColNum, { fontFamily: F.m, color: C.green }]}>{b.placement_rate}%</Text>
                        </View>
                      ))}
                    </>
                  )}
                </View>
              )}

              {/* ── Recent Offers / Raw Data (Restored) ── */}
              {data.recent_offers && data.recent_offers.length > 0 && (
                <View style={s.cardLarge}>
                  <Text style={[s.cardTitle, { marginBottom: S.md }]}>Recent Offers</Text>
                  {data.recent_offers.slice(0, 10).map((o: any, i: number) => (
                    <View key={i} style={s.offerRow}>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={s.offerCompany} numberOfLines={1}>{o.company}</Text>
                        <Text style={s.offerBranch} numberOfLines={1}>{o.branch}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={s.offerType}>{o.offer_type}</Text>
                        <Text style={s.offerDate}>{o.date || 'Recent'}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* ── Raw Offers Data ── */}
              {data.rawOffers && data.rawOffers.length > 0 && (
                <View style={s.cardLarge}>
                  <TouchableOpacity style={s.cardHeader} onPress={() => setShowOffers(!showOffers)} activeOpacity={0.7}>
                    <Text style={s.cardTitle}>Raw Offers Data ({data.rawOffers.length})</Text>
                    <Ionicons name={showOffers ? "chevron-up" : "chevron-down"} size={20} color={C.t2} />
                  </TouchableOpacity>
                  {showOffers && (
                    <>
                      {data.rawOffers.slice(0, visibleOffersCount).map((o: any, i: number) => (
                        <View key={i} style={s.offerRow}>
                          <View style={{ flex: 1, paddingRight: 8 }}>
                            <Text style={s.offerCompany} numberOfLines={1}>{o.student_name || 'Unknown'}</Text>
                            <Text style={s.offerBranch} numberOfLines={1}>{o.company_name} • {o.branch}</Text>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={s.offerType}>{o.offer_type}</Text>
                            <Text style={[s.offerDate, {color: C.green, fontFamily: F.b}]}>{o.ctc || 'N/A'}</Text>
                          </View>
                        </View>
                      ))}
                      {data.rawOffers.length > visibleOffersCount && (
                        <TouchableOpacity 
                          style={{ marginTop: S.md, paddingVertical: 12, alignItems: 'center', backgroundColor: '#F0F0F0', borderRadius: R.sm }} 
                          onPress={() => setVisibleOffersCount(prev => prev + 50)}
                        >
                          <Text style={{ fontFamily: F.m, color: C.t1 }}>Load More</Text>
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                </View>
              )}

            </>
          ) : (
            <View style={s.centered}><Text style={{fontFamily:F.r, color:C.t2}}>No analytics data available</Text></View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: S.lg, paddingTop: S.md, marginBottom: S.md },
  title: { fontFamily: F.b, fontSize: 24, color: C.t1 },
  subtitle: { fontFamily: F.r, fontSize: 13, color: C.t2, marginTop: 4 },
  avatarBox: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.t1, alignItems: 'center', justifyContent: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: S.lg, paddingTop: S.sm, paddingBottom: S.xxl },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: S.md, marginBottom: S.md },
  metricCard: { ...card, flex: 1, minWidth: '45%', padding: S.lg },
  iconBox: { width: 32, height: 32, borderRadius: R.sm, alignItems: 'center', justifyContent: 'center', marginBottom: S.lg },
  metricLabel: { fontFamily: F.m, fontSize: 13, color: C.t1, marginBottom: 4 },
  metricVal: { fontFamily: F.b, fontSize: 28, color: C.t1, marginBottom: 4 },
  metricSub: { fontFamily: F.r, fontSize: 11, color: C.t2 },

  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0F0F0', paddingVertical: 10, borderRadius: R.sm, gap: 6 },
  actionBtnText: { fontFamily: F.m, fontSize: 13, color: C.t1 },

  cardLarge: { ...card, padding: S.lg, marginBottom: S.md },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: S.lg },
  cardTitle: { fontFamily: F.sb, fontSize: 15, color: C.t1 },
  legend: { flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  legendText: { fontFamily: F.m, fontSize: 11, color: C.t2 },

  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: S.md },
  barLabel: { width: 50, fontFamily: F.m, fontSize: 12, color: C.t1 },
  barTrack: { flex: 1, height: 4, marginHorizontal: S.sm, justifyContent: 'center' },
  barTotal: { position: 'absolute', height: 4, backgroundColor: C.gold, borderRadius: 2 },
  barPlaced: { position: 'absolute', height: 4, backgroundColor: C.t1, borderRadius: 2 },
  barEmpty: { width: 4, height: 4, borderRadius: 2, backgroundColor: C.t3 },
  barNums: { width: 50, flexDirection: 'row', justifyContent: 'space-between' },
  barNumText: { fontFamily: F.m, fontSize: 12, color: C.t2 },

  listHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#F0F0F0', paddingBottom: 8, marginBottom: 8 },
  listH: { fontFamily: F.m, fontSize: 11, color: C.t2, textTransform: 'uppercase' },
  listRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F9F9FA' },
  listColMain: { flex: 1, fontFamily: F.m, fontSize: 14, color: C.t1 },
  listColNum: { width: 60, textAlign: 'right', fontFamily: F.r, fontSize: 14, color: C.t1 },

  offerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  offerCompany: { fontFamily: F.sb, fontSize: 14, color: C.t1, marginBottom: 2 },
  offerBranch: { fontFamily: F.r, fontSize: 12, color: C.t2 },
  offerType: { fontFamily: F.m, fontSize: 12, color: C.navy, backgroundColor: C.blueDim, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden', marginBottom: 4 },
  offerDate: { fontFamily: F.r, fontSize: 10, color: C.t3 },
});
