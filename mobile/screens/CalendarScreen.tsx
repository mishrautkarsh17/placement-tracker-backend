import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../api/client';
import { AuthContext } from '../context/AuthContext';
import { C, F, R, S, card } from '../components/theme';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { scheduleLocalNotification, cancelAllScheduledNotifications } from '../utils/notifications';

type CalEvent = { Date: string; Day: string; Company: string; Process: string; Mode: string; TestStartTime: string; InterviewStartTime: string };

function getProcessColor(p: string) {
  const pl = p.toLowerCase();
  if (pl.includes('test'))      return C.gold;
  if (pl.includes('interview')) return C.blue;
  if (pl.includes('gd'))        return C.navy;
  if (pl.includes('ppt'))       return C.red;
  return C.t2;
}

export default function CalendarScreen() {
  const { user } = useContext(AuthContext);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [applied, setApplied] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Set default filter to 'My Companies' (Personalised)
  const [filter, setFilter] = useState('My Companies');

  const fetchData = async () => {
    try {
      const c = await apiClient.get('/calendar');
      const mapped = (c.data.data || [])
        .filter((i: any) => i['Date '] !== 'Column 1' && i['Date '] !== 'Date ')
        .map((i: any) => ({
          Date: i['Date ']?.trim() || '',
          Day: i['Day']?.trim() || '',
          Company: i['Company ']?.trim() || 'Unknown',
          Process: i['Process ']?.trim() || '',
          Mode: i[' Mode']?.trim() || '',
          TestStartTime: i['Test Start Time  ']?.trim() || '',
          InterviewStartTime: i['Interview start Time']?.trim() || '',
        }));
      setEvents(mapped);
      
      if (user?.rollNo) {
        const a = await apiClient.get(`/applications/${user.rollNo}`);
        setApplied((a.data.data || []).map((x: any) => x['company_name']?.trim().toLowerCase()).filter(Boolean));
      }
    } catch {} finally { setLoading(false); setRefreshing(false); }
  };
  useEffect(() => { fetchData(); }, [user]);

  const displayed = events.filter(e => {
    if (filter === 'My Companies') return applied.includes(e.Company.toLowerCase());
    if (filter === 'All') return true;
    const p = e.Process.toLowerCase();
    if (filter === 'Tests') return p.includes('test');
    if (filter === 'Interviews') return p.includes('interview');
    return true; // fallback
  });

  return (
    <SafeAreaView edges={['top']} style={s.root}>
      {/* ── Header ── */}
      <View style={s.header}>
        <View>
          <Text style={s.title}>Schedule</Text>
          <Text style={s.subtitle}>Stay on top of your events</Text>
        </View>
      </View>

      {/* ── Filters ── */}
      <View style={{ marginBottom: S.md }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterScroll}>
          {['My Companies', 'All', 'Tests', 'Interviews'].map(f => (
            <TouchableOpacity key={f} style={[s.filterPill, filter === f && s.filterPillActive]} onPress={() => setFilter(f)}>
              <Text style={[s.filterText, filter === f && s.filterTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={s.centered}><ActivityIndicator color={C.gold} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={s.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={C.gold} />}
          showsVerticalScrollIndicator={false}
        >
          {displayed.length === 0 ? (
            <View style={s.centered}><Text style={{fontFamily:F.r, color:C.t2, marginTop: 40}}>No events for this filter.</Text></View>
          ) : (
            displayed.map((item, index) => {
              const color = getProcessColor(item.Process);
              const dayAbbr = (item.Day || '').slice(0, 3).toUpperCase();
              const time = item.TestStartTime || item.InterviewStartTime || 'TBD';
              
              let badgeText = (item.Process || 'EVENT').toUpperCase();

              return (
                <Animated.View entering={FadeInDown.duration(400).delay(index * 100)} key={index} style={s.timelineGroup}>
                  {index !== displayed.length - 1 && <View style={s.timelineLine} />}
                  
                  <View style={s.dateHeader}>
                    <View style={[s.dot, { backgroundColor: color }]} />
                    <Text style={s.dateText}>{dayAbbr} • {item.Date}</Text>
                  </View>
                  
                  <View style={s.eventCard}>
                    <View style={s.eventBody}>
                      <Text style={s.eventTitle}>{item.Company}</Text>
                      
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                        <Text style={s.eventLoc} numberOfLines={1}>
                          {time !== 'TBD' ? time : 'TBD'}{item.Mode ? ` • ${item.Mode}` : ''}
                        </Text>
                      </View>
                    </View>
                    <View style={s.eventRight}>
                      <View style={[s.tag, { backgroundColor: color + '15', maxWidth: 90 }]}>
                        <Text style={[s.tagText, { color }]} numberOfLines={1}>{badgeText}</Text>
                      </View>
                    </View>
                  </View>
                </Animated.View>
              );
            })
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
  iconBtn: { padding: 4 },

  filterScroll: { paddingHorizontal: S.lg, paddingBottom: S.sm, gap: 10 },
  filterPill: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: R.full, borderWidth: 1, borderColor: '#EAEAEA', backgroundColor: C.s1 },
  filterPillActive: { borderColor: C.gold },
  filterText: { fontFamily: F.m, fontSize: 13, color: C.t2 },
  filterTextActive: { color: C.t1 },

  scroll: { paddingHorizontal: S.lg, paddingTop: S.sm, paddingBottom: 100 },
  centered: { alignItems: 'center', justifyContent: 'center' },

  timelineGroup: { position: 'relative', marginBottom: S.lg },
  timelineLine: { position: 'absolute', left: 4, top: 24, bottom: -40, width: 2, backgroundColor: '#EAEAEA' },
  
  dateHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: S.md },
  dot: { width: 10, height: 10, borderRadius: 5, zIndex: 2 },
  dateText: { fontFamily: F.sb, fontSize: 11, color: C.t1, textTransform: 'uppercase', letterSpacing: 0.5 },

  eventCard: { ...card, padding: S.md, marginLeft: 24, flexDirection: 'row', alignItems: 'center' },
  
  companyIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginRight: S.md },
  companyIconText: { fontFamily: F.sb, fontSize: 18 },
  
  eventBody: { flex: 1, paddingRight: 8 },
  eventTitle: { fontFamily: F.sb, fontSize: 16, color: C.t1 },
  eventLoc: { flex: 1, fontFamily: F.r, fontSize: 12, color: C.t2 },

  eventRight: { alignItems: 'flex-end', justifyContent: 'center' },
  tag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  tagText: { fontFamily: F.b, fontSize: 9 },
});
