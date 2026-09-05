import React, { useState, useEffect, useContext } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Dimensions, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as AuthSession from 'expo-auth-session';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
import { C, F, R, S, card, softShadow } from '../components/theme';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const { login } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [request, response, promptAsync] = Google.useAuthRequest({
    iosClientId: '818439802211-h71rgar9kb1u33g46o3jmtq715nkr90u.apps.googleusercontent.com',
    androidClientId: '818439802211-h71rgar9kb1u33g46o3jmtq715nkr90u.apps.googleusercontent.com',
    clientId: '818439802211-h71rgar9kb1u33g46o3jmtq715nkr90u.apps.googleusercontent.com',
    scopes: ['profile', 'email'],
    redirectUri: AuthSession.makeRedirectUri({ native: 'com.placementtracker.app:/' }),
  });

  useEffect(() => {
    if (response?.type === 'success' && response.authentication) {
      setLoading(true);
      login(response.authentication.accessToken).catch(e => {
        Alert.alert('Error', e.message || 'Failed'); setLoading(false);
      });
    } else if (response?.type === 'error') {
      Alert.alert('Login Failed', response.error?.message || 'Auth error'); setLoading(false);
    }
  }, [response]);

  return (
    <SafeAreaView style={s.root}>
      
      {/* ── Header ── */}
      <Animated.View entering={FadeInDown.duration(600).delay(100)} style={s.header}>
        <Image source={require('../assets/logo.png')} style={s.logoImg} resizeMode="contain" />
        <Text style={s.title}>PlaceTrack</Text>
        <Text style={s.sub}>IIITD Placement Intelligence</Text>
      </Animated.View>

      {/* ── Feature Cards (Neumorphic) ── */}
      <Animated.View entering={FadeInDown.duration(600).delay(200)} style={s.features}>
        {[
          { title: 'Active Offers', val: '1.2k', sub: '+12.4%', subColor: C.green, icon: 'cash-outline' },
          { title: 'Companies', val: '142', sub: 'Hiring now', subColor: C.gold, icon: 'business-outline' },
        ].map(f => (
          <View key={f.title} style={s.card}>
            <View style={s.iconWrap}>
              <Ionicons name={f.icon as any} size={16} color={C.navy} />
            </View>
            <Text style={s.cardTitle}>{f.title}</Text>
            <Text style={s.cardVal}>{f.val}</Text>
            <Text style={[s.cardSub, { color: f.subColor }]}>{f.sub}</Text>
          </View>
        ))}
      </Animated.View>

      {/* ── Text List ── */}
      <Animated.View entering={FadeInDown.duration(600).delay(300)} style={s.list}>
        <Text style={s.listHead}>Key Features</Text>
        {[
          { t: 'Daily personalized AI briefings' },
          { t: 'Track your shortlists and interviews' },
          { t: 'Historical placement analytics' },
        ].map(item => (
          <View key={item.t} style={s.listItem}>
            <Ionicons name="checkmark-circle" size={18} color={C.navy} style={{ marginRight: 12 }} />
            <Text style={s.listText}>{item.t}</Text>
          </View>
        ))}
      </Animated.View>

      {/* ── CTA ── */}
      <Animated.View entering={FadeInUp.duration(600).delay(400)} style={s.footer}>
        <TouchableOpacity
          style={[s.btn, (!request || loading) && { opacity: 0.6 }]}
          onPress={() => { setLoading(true); promptAsync(); }}
          disabled={!request || loading}
          activeOpacity={0.8}
        >
          {loading ? <ActivityIndicator color={C.bg} /> : (
            <>
              <Ionicons name="logo-google" size={18} color={C.bg} style={{ marginRight: 10 }} />
              <Text style={s.btnText}>Sign in with Google</Text>
            </>
          )}
        </TouchableOpacity>
        <Text style={s.fine}>IIITD Google accounts only</Text>
      </Animated.View>
      
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, paddingHorizontal: S.xl },
  
  header: { alignItems: 'center', marginTop: S.xl * 2, marginBottom: S.xl },
  logoImg: { width: 90, height: 90, marginBottom: S.lg },
  logoBox: {
    width: 60, height: 60, borderRadius: R.lg,
    backgroundColor: C.s1, alignItems: 'center', justifyContent: 'center',
    marginBottom: S.lg,
    ...softShadow,
  },
  title: { fontFamily: F.sb, fontSize: 32, color: C.t1, marginBottom: 4 },
  sub: { fontFamily: F.r, fontSize: 14, color: C.t2 },

  features: { flexDirection: 'row', gap: S.md, marginBottom: S.xl },
  card: { ...card, flex: 1, padding: S.lg },
  iconWrap: {
    width: 32, height: 32, borderRadius: R.md, backgroundColor: C.bg,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: S.md,
  },
  cardTitle: { fontFamily: F.m, fontSize: 13, color: C.t1, marginBottom: 8 },
  cardVal: { fontFamily: F.b, fontSize: 28, color: C.t1, letterSpacing: -0.5, marginBottom: 6 },
  cardSub: { fontFamily: F.m, fontSize: 13 },

  list: { ...card, padding: S.lg, marginBottom: S.xl },
  listHead: { fontFamily: F.sb, fontSize: 16, color: C.t1, marginBottom: S.md },
  listItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  listText: { fontFamily: F.r, fontSize: 14, color: C.t1 },

  footer: { flex: 1, justifyContent: 'flex-end', paddingBottom: S.xl },
  btn: {
    backgroundColor: C.navy, borderRadius: R.full,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 18,
    ...softShadow,
  },
  btnText: { fontFamily: F.m, fontSize: 16, color: C.bg },
  fine: { fontFamily: F.r, fontSize: 12, color: C.t2, textAlign: 'center', marginTop: S.md },
});
