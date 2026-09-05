import React, { useContext } from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActivityIndicator, View } from 'react-native';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { Ionicons } from '@expo/vector-icons';

import { AuthProvider, AuthContext } from './context/AuthContext';
import LoginScreen    from './screens/LoginScreen';
import CopilotScreen  from './screens/CopilotScreen';
import CalendarScreen from './screens/CalendarScreen';
import AnalyticsScreen from './screens/AnalyticsScreen';
import HubScreen      from './screens/HubScreen';
import { C, F } from './components/theme';
import { registerForPushNotificationsAsync } from './utils/notifications';

const Tab = createBottomTabNavigator();

const NavTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: C.bg, card: C.s1, text: C.t1, primary: C.gold, border: 'transparent' },
};

function RootNavigator() {
  const { user, isLoading } = useContext(AuthContext);
  if (isLoading) return <View style={{flex:1,justifyContent:'center',alignItems:'center',backgroundColor:C.bg}}><ActivityIndicator color={C.gold} size="large" /></View>;

  return (
    <NavigationContainer theme={NavTheme}>
      {user ? (
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarIcon: ({ focused, color, size }) => {
              const icons: Record<string,[string,string]> = {
                Copilot:   ['sparkles','sparkles-outline'],
                Calendar:  ['calendar','calendar-outline'],
                Analytics: ['bar-chart','bar-chart-outline'],
                Hub:       ['briefcase','briefcase-outline'],
              };
              const [on, off] = icons[route.name] || ['help-circle','help-circle-outline'];
              return <Ionicons name={(focused ? on : off) as any} size={22} color={color} />;
            },
            tabBarActiveTintColor: C.gold,
            tabBarInactiveTintColor: C.t3,
            tabBarStyle: {
              backgroundColor: C.s1,
              borderTopWidth: 0,
              elevation: 20,
              shadowColor: '#000',
              shadowOpacity: 0.05,
              shadowRadius: 10,
              height: 80,
              paddingBottom: 16,
              paddingTop: 8,
            },
            tabBarLabelStyle: { fontFamily: F.m, fontSize: 10, letterSpacing: 0.2 },
          })}
        >
          <Tab.Screen name="Copilot"   component={CopilotScreen} />
          <Tab.Screen name="Calendar"  component={CalendarScreen} />
          <Tab.Screen name="Analytics" component={AnalyticsScreen} />
          <Tab.Screen name="Hub"       component={HubScreen} />
        </Tab.Navigator>
      ) : <LoginScreen />}
    </NavigationContainer>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  
  React.useEffect(() => {
    registerForPushNotificationsAsync();
  }, []);

  if (!fontsLoaded) return <View style={{flex:1,justifyContent:'center',alignItems:'center',backgroundColor:C.bg}}><ActivityIndicator color={C.navy} size="large" /></View>;
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
