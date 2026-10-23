import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { useNetworkState } from 'expo-network';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeProvider, useTheme } from '../config/ThemeContext';
import { TechTitansAssistant } from '../components/TechTitansAssistant';
import { consumeAccountCreationPending, watchAuth } from '../services/auth/firebaseAuth';
import { ensureStoreSeed } from '../services/firestore/seedRepository';
import { getUserProfile } from '../services/firestore/usersRepository';
import { isAdminUser } from '../services/admin/adminRepository';
import LoginScreen from '../screens/auth/LoginScreen';
import SignupScreen from '../screens/auth/SignupScreen';
import AdminLoginScreen from '../screens/admin/AdminLoginScreen';
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import Insights from '../screens/dashboard/InsightsScreen';
import SuppliersOrders from '../screens/dashboard/SuppliersReordersScreen';
import HomeScreen from '../screens/HomeScreen';
import StockScreen from '../screens/StockScreen';
import NewSaleScreen from '../screens/NewSaleScreen';
import CreditLedgerScreen from '../screens/CreditLedgerScreen';
import RepaymentTrackerScreen from '../screens/RepaymentTrackerScreen';
import ProfileSettingsScreen from '../screens/ProfileSettingsScreen';
import QRScannerScreen from '../screens/QRScannerScreen';
import PlaceholderScreen from '../screens/PlaceholderScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import FirebaseTestScreen from '../screens/FirebaseTestScreen';
import WelcomeScreen from '../screens/WelcomeScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const icons = {
  Home: 'home',
  Stock: 'cube',
  Sell: 'cart',
  Credit: 'card',
  Suppliers: 'people',
  Insights: 'stats-chart',
};

function OfflineDemoScreen() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 28, backgroundColor: colors.background }}>
      <Text style={{ fontSize: 28, fontWeight: '700', color: colors.primary, marginBottom: 12 }}>SpazaIQ Offline Demo</Text>
      <Text style={{ fontSize: 16, textAlign: 'center', color: colors.textMuted, lineHeight: 24 }}>
        Your local shop assistant is ready. Open the chat button to ask about sales, stock, customer credit, products, or how to use the app.
      </Text>
    </View>
  );
}

function MainTabs({ route }) {
  const account = route?.params || {};
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route: screenRoute }) => ({
  headerShown: false,
  tabBarStyle: {
    backgroundColor: colors.card,
    borderTopColor: colors.border,
  },
  tabBarActiveTintColor: colors.primary,
  tabBarInactiveTintColor: colors.textMuted,
  tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
  tabBarIcon: ({ color, size }) => (
    <Ionicons name={icons[screenRoute.name]} size={size} color={color} />
  ),
})}
    >
      <Tab.Screen name="Home" component={HomeScreen} initialParams={account} />
      <Tab.Screen name="Stock" component={StockScreen} initialParams={account} />
      <Tab.Screen name="Sell" component={NewSaleScreen} initialParams={account} />
      <Tab.Screen name="Credit" component={CreditLedgerScreen} initialParams={account} />
      <Tab.Screen name="Suppliers" component={SuppliersOrders} initialParams={account} />
      <Tab.Screen name="Insights" component={Insights} initialParams={account} />
    </Tab.Navigator>
  );
}

function AppContent() {
  const { isDark, colors } = useTheme();
  const networkState = useNetworkState();
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [offlineDemo, setOfflineDemo] = useState(false);
  const [loading, setLoading] = useState(true);
  // true when the signed-in account has a document in the admins collection
  const [isAdmin, setIsAdmin] = useState(false);

  // Welcome screen: shown once per account, remembered on this device
  const [welcome, setWelcome] = useState({ uid: null, seen: false });
  const uid = user?.uid;
  useEffect(() => {
    if (!uid || (welcome.uid === uid && welcome.seen)) return undefined;
    let active = true;
    AsyncStorage.getItem(`welcomeSeen:${uid}`)
      .then((value) => active && setWelcome({ uid, seen: value === '1' }))
      .catch(() => active && setWelcome({ uid, seen: true }));
    return () => {
      active = false;
    };
  }, [uid, welcome.uid, welcome.seen]);
  const welcomeReady = Boolean(uid) && welcome.uid === uid;
  // An admin never sees the shop welcome screen
  const showWelcome = welcomeReady && !welcome.seen && !isAdmin;
  const finishWelcome = () => {
    setWelcome({ uid, seen: true });
    AsyncStorage.setItem(`welcomeSeen:${uid}`, '1').catch(() => {});
  };

  const isOffline = networkState.isConnected === false || networkState.isInternetReachable === false;

  useEffect(() => {
    let active = true;
    const unsubscribe = watchAuth(async (authenticatedUser) => {
      if (!active) return;
      if (authenticatedUser && consumeAccountCreationPending()) {
        setWelcome({ uid: authenticatedUser.uid, seen: true });
        AsyncStorage.setItem(`welcomeSeen:${authenticatedUser.uid}`, '1')
          .catch((error) => console.warn('Could not save signup welcome state', error));
      }
      setUser(authenticatedUser);
      setUserProfile(null);
      setIsAdmin(false);
      setOfflineDemo(false);
      if (!authenticatedUser) {
        setLoading(false);
        return;
      }
      setLoading(true);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    let active = true;
    if (isOffline) {
      setLoading(false);
      return () => {
        active = false;
      };
    }

    async function loadProfile() {
      try {
        // Admin accounts are checked FIRST. An admin has no shop, so no store or profile is created for it.
        if (await isAdminUser(user.uid)) {
          if (active) setIsAdmin(true);
          return;
        }
        await ensureStoreSeed(user.uid, {
          email: user.email,
          displayName: user.displayName,
        });
        const profile = await getUserProfile(user.uid);
        if (active) setUserProfile(profile);
      } catch (error) {
        console.warn('Could not load authenticated store profile', error);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadProfile();
    return () => {
      active = false;
    };
  }, [user, isOffline]);

  const baseTheme = isDark ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.card,
      text: colors.textPrimary,
      border: colors.border,
    },
  };
  const storeId = offlineDemo ? 'mock-store-1' : userProfile?.defaultStoreId || user?.uid;
  const userName = offlineDemo ? 'Demo Shopkeeper' : userProfile?.fullName || user?.displayName || user?.email;
  const shopName = offlineDemo ? 'SpazaIQ Offline Demo' : userProfile?.shopName || user?.displayName || 'My Shop';

  if (loading || (user && !welcomeReady)) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {isOffline ? (
        <View style={{ paddingVertical: 7, paddingHorizontal: 12, backgroundColor: colors.warningBg }}>
          <Text style={{ color: colors.warning, textAlign: 'center', fontSize: 12, fontWeight: '600' }}>
            Offline — saved POS and credit changes will sync when you reconnect.
          </Text>
        </View>
      ) : null}
      <NavigationContainer theme={navTheme}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {offlineDemo ? (
            <Stack.Screen name="OfflineDemo" component={OfflineDemoScreen} />
          ) : user && isAdmin ? (
            <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
          ) : user && showWelcome ? (
            <Stack.Screen name="Welcome">
              {() => <WelcomeScreen userName={userName} shopName={shopName} onStart={finishWelcome} />}
            </Stack.Screen>
          ) : user ? (
            <>
              <Stack.Screen
                name="MainTabs"
                component={MainTabs}
                initialParams={{ storeId, userName, shopName }}
              />
              <Stack.Screen name="Scanner" component={QRScannerScreen} />
              <Stack.Screen name="Notifications" component={NotificationsScreen} />
              <Stack.Screen name="Placeholder" component={PlaceholderScreen} />
              <Stack.Screen name="Profile" component={ProfileSettingsScreen} />
              <Stack.Screen
                name="RepaymentTracker"
                component={RepaymentTrackerScreen}
                options={{ headerShown: true, title: 'Repayment Tracker' }}
              />
            </>
          ) : (
            <>
              <Stack.Screen
                name="Login"
                children={(props) => (
                  <LoginScreen {...props} onOfflineDemo={() => setOfflineDemo(true)} />
                )}
              />
              <Stack.Screen name="Signup" component={SignupScreen} />
              <Stack.Screen name="AdminLogin" component={AdminLoginScreen} />
            </>
          )}
          <Stack.Screen
            name="FirebaseTest"
            component={FirebaseTestScreen}
            options={{ headerShown: true, title: 'Firebase Test' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
      {((user && !isAdmin && welcomeReady && !showWelcome) || offlineDemo) && (
        <TechTitansAssistant storeId={storeId} userName={userName} shopName={shopName} />
      )}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}