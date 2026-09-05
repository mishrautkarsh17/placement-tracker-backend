import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../api/client';
import { AuthContext } from '../context/AuthContext';
import { C, F, R, S, card } from '../components/theme';
import Animated, { FadeInDown } from 'react-native-reanimated';

export default function CopilotScreen() {
  const [brief, setBrief] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checklist, setChecklist] = useState<any[]>([]);
  const { user } = useContext(AuthContext);

  const fetch_ = async () => {
    if (!user) return;
    try {
      const r = await apiClient.get(`/daily-brief/${user.rollNo}`);
      setBrief(r.data.brief);
      if (r.data.brief?.progress?.checklist) {
        setChecklist(r.data.brief.progress.checklist);
      }
    } catch { setBrief(null); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { fetch_(); }, [user]);

  const toggleCheck = async (idx: number) => {
    const newList = [...checklist];
    newList[idx].done = !newList[idx].done;
    setChecklist(newList);

    if (brief && user) {
      const updatedBrief = {
        ...brief,
        progress: {
          ...brief.progress,
          checklist: newList,
          completed: newList.filter(i => i.done).length
        }
      };
      setBrief(updatedBrief);
      try {
        await apiClient.post(`/daily-brief/${user.rollNo}`, updatedBrief);
      } catch (e) {
        console.error("Failed to sync progress", e);
      }
    }
  };

  const completedCount = checklist.filter(i => i.done).length;
  const totalCount = checklist.length || 1;
  const percentage = Math.round((completedCount / totalCount) * 100);

  const firstName = user?.name?.split(' ')[0] || 'Utkarsh';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning,' : hour < 18 ? 'Good afternoon,' : 'Good evening,';

  return (
    <SafeAreaView edges={['top']} style={s.root}>
      
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetch_(); }} tintColor={C.gold} />}
      >
        
        {/* ── Welcome ── */}
        <Animated.View entering={FadeInDown.duration(500)} style={s.welcome}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View>
              <Text style={s.title}>{greeting}</Text>
              <Text style={s.titleName}>{firstName} <Text style={{fontSize: 24}}>👋</Text></Text>
            </View>
            <View style={s.avatarBox}>
              <Ionicons name="person" size={16} color={C.s1} />
            </View>
          </View>
          <Text style={s.subtitle}>Let's ace your placements today!</Text>
        </Animated.View>

        {loading ? (
          <View style={{ paddingVertical: 80, alignItems: 'center' }}><ActivityIndicator size="large" color={C.gold} /></View>
        ) : brief ? (
          <>
            {/* ── Your Next Action Card ── */}
            <Animated.View entering={FadeInDown.duration(500).delay(100)} style={s.card}>
              <View style={s.cardHeader}>
                <Ionicons name="sparkles" size={14} color={C.gold} />
                <Text style={s.cardLabel}>YOUR NEXT ACTION</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: S.md }}>
                <Text style={s.actionTitle}>{brief.next_action?.company} {brief.next_action?.title}</Text>
                <View style={s.tagGold}><Text style={s.tagGoldText}>{brief.next_action?.tag || 'UPCOMING'}</Text></View>
              </View>
              <View style={s.actionInfoRow}>
                <Ionicons name="time-outline" size={14} color={C.gold} />
                <Text style={s.actionInfoText}>
                  {brief.next_action?.countdown !== 'Continuous' && brief.next_action?.countdown !== 'No upcoming events scheduled' 
                    ? `${brief.next_action?.countdown?.replace('Upcoming on ', '')} • ` 
                    : ''}
                  {brief.next_action?.time_location}
                </Text>
              </View>
              
              <Ionicons name="clipboard-outline" size={80} color={C.goldDim} style={s.cardDecoIcon} />
            </Animated.View>

            {/* ── Today's Progress ── */}
            <Animated.View entering={FadeInDown.duration(500).delay(200)} style={s.card}>
              <View style={[s.rowSpace, { marginBottom: S.md }]}>
                <Text style={s.sectionTitle}>Today's Progress</Text>
                <Text style={s.progressRatio}>{completedCount}/{checklist.length}</Text>
              </View>
              <View style={{ gap: 12 }}>
                {checklist.map((item: any, i: number) => (
                  <TouchableOpacity key={i} onPress={() => toggleCheck(i)} activeOpacity={0.7} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                    <Ionicons name={item.done ? "checkmark-circle" : "ellipse-outline"} size={20} color={item.done ? C.green : C.t3} style={{ marginTop: 1 }} />
                    <Text style={[s.checkText, item.done && s.checkTextDone, { fontSize: 13, lineHeight: 18, paddingRight: 20 }]}>{item.task}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Animated.View>


          </>
        ) : (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <Text style={{ fontFamily: F.m, color: C.t2 }}>Could not load briefing. Pull to refresh.</Text>
          </View>
        )}
        
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  avatarBox: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.t1, alignItems: 'center', justifyContent: 'center' },
  
  scroll: { padding: S.lg, paddingBottom: S.xxl },
  welcome: { marginBottom: S.xl },
  title: { fontFamily: F.m, fontSize: 28, color: C.t1 },
  titleName: { fontFamily: F.b, fontSize: 28, color: C.t1 },
  subtitle: { fontFamily: F.r, fontSize: 14, color: C.t2, marginTop: 4 },

  card: { ...card, padding: S.lg, marginBottom: S.md, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardLabel: { fontFamily: F.sb, fontSize: 11, color: C.t2, textTransform: 'uppercase', letterSpacing: 1 },
  actionTitle: { fontFamily: F.sb, fontSize: 18, color: C.t1, marginRight: S.sm },
  tagGold: { backgroundColor: C.goldMuted, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  tagGoldText: { fontFamily: F.b, fontSize: 10, color: C.gold },
  actionInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, marginBottom: S.md },
  actionInfoText: { fontFamily: F.m, fontSize: 13, color: C.gold },
  countdownText: { fontFamily: F.sb, fontSize: 26, color: C.gold, marginBottom: S.md },
  countdownSub: { fontSize: 20, fontFamily: F.r },
  btnGold: { backgroundColor: C.goldMuted, alignSelf: 'flex-start', paddingHorizontal: S.lg, paddingVertical: 10, borderRadius: R.md, flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnGoldText: { fontFamily: F.m, fontSize: 13, color: C.t1 },
  cardDecoIcon: { position: 'absolute', right: -10, bottom: -10, transform: [{ rotate: '-15deg' }] },

  rowSpace: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontFamily: F.sb, fontSize: 15, color: C.t1 },
  progressRatio: { fontFamily: F.b, fontSize: 14, color: C.gold },
  progressCircle: { width: 80, height: 80, borderRadius: 40, borderWidth: 6, borderColor: C.goldMuted, borderLeftColor: C.gold, borderTopColor: C.gold, alignItems: 'center', justifyContent: 'center' },
  progressCircleText: { fontFamily: F.sb, fontSize: 20, color: C.t1 },
  checkText: { fontFamily: F.m, fontSize: 12, color: C.t1, flexShrink: 1 },
  checkTextDone: { color: C.t2, textDecorationLine: 'line-through' },

  viewPlan: { fontFamily: F.m, fontSize: 12, color: C.gold },
  focusText: { fontFamily: F.sb, fontSize: 14, color: C.t1, marginBottom: 4 },
  focusSub: { fontFamily: F.r, fontSize: 12, color: C.t2 },
  divider: { height: 1, backgroundColor: '#F0F0F0', marginVertical: S.md },
  nextActionText: { fontFamily: F.m, fontSize: 13, color: C.t1 },
  playBtn: { width: 24, height: 24, borderRadius: 12, backgroundColor: C.goldMuted, alignItems: 'center', justifyContent: 'center' },

  carryPill: { borderWidth: 1, borderColor: '#F0F0F0', paddingHorizontal: 16, paddingVertical: 8, borderRadius: R.full, marginRight: S.sm },
  carryText: { fontFamily: F.m, fontSize: 12, color: C.t1 },
});
