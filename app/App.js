import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, TouchableOpacity, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { ThemeProvider } from '../config/ThemeContext';
import { TechTitansAssistant } from '../components/TechTitansAssistant';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Firebase auth
import { watchAuth } from '../services/auth/firebaseAuth';
import { ensureStoreSeed } from '../services/firestore/seedRepository';
import { getUserProfile } from '../services/firestore/usersRepository';

// User authentication
import LoginScreen from '../screens/auth/LoginScreen';
import SignupScreen from '../screens/auth/SignupScreen';

import Insights from '../screens/dashboard/InsightsScreen';
import SuppliersOrders from '../screens/dashboard/SuppliersReordersScreen';

// Team member files
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

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const GREEN = '#004B49';

const icons = {
  Home: 'home',
  Stock: 'cube',
  Sell: 'cart',
  Credit: 'card',
  Suppliers: 'people',
  Insights: 'stats-chart',
};

function OfflineDemoScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 28, backgroundColor: '#F2F2F2' }}>
      <Text style={{ fontSize: 28, fontWeight: '700', color: GREEN, marginBottom: 12 }}>SpazaIQ Offline Demo</Text>
      <Text style={{ fontSize: 16, textAlign: 'center', color: '#475569', lineHeight: 24 }}>
        Your local shop assistant is ready. Open the chat button to ask about sales, stock, customer credit, products, or how to use the app.
      </Text>
    </View>
  );
}

function MainTabs({ route }) {
  const account = route?.params || {};

  return (
    <Tab.Navigator
      screenOptions={({ route, navigation }) => ({
        headerShown: true,
        headerRight: () => (
          <TouchableOpacity
            onPress={() => navigation.navigate('Profile')}
            style={{ marginRight: 16 }}
          >
            <Ionicons name="person-circle" size={32} color={GREEN} />
          </TouchableOpacity>
        ),
        tabBarActiveTintColor: GREEN,
        tabBarInactiveTintColor: '#888',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={icons[route.name]} size={size} color={color} />
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

export default function App() {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [offlineDemo, setOfflineDemo] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const unsubscribe = watchAuth(async (u) => {
      setUser(u);
      setUserProfile(null);
      setOfflineDemo(false);
      if (!u) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        await ensureStoreSeed(u.uid, {
          email: u.email,
          displayName: u.displayName,
        });
        const profile = await getUserProfile(u.uid);
        if (active) setUserProfile(profile);
      } catch (error) {
        console.warn('Could not load authenticated store profile', error);
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={GREEN} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <View style={{ flex: 1 }}>
          <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
            {offlineDemo ? (
              <Stack.Screen name="OfflineDemo" component={OfflineDemoScreen} />
            ) : user ? (
              <>
                <Stack.Screen
                  name="MainTabs"
                  component={MainTabs}
                  initialParams={{
                    storeId: offlineDemo ? 'mock-store-1' : userProfile?.defaultStoreId || user.uid,
                    userName: offlineDemo ? 'Demo Shopkeeper' : userProfile?.fullName || user.displayName || user.email,
                    shopName: offlineDemo ? 'SpazaIQ Offline Demo' : userProfile?.shopName || user.displayName || 'My Shop',
                  }}
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
                  children={(props) => <LoginScreen {...props} onOfflineDemo={() => setOfflineDemo(true)} />}
                />
                <Stack.Screen name="Signup" component={SignupScreen} />
              </>
            )}
            <Stack.Screen
              name="FirebaseTest"
              component={FirebaseTestScreen}
              options={{ headerShown: true, title: 'Firebase Test' }}
            />
            </Stack.Navigator>
          </NavigationContainer>
          {(user || offlineDemo) && (
            <TechTitansAssistant
              storeId={offlineDemo ? 'mock-store-1' : userProfile?.defaultStoreId || user.uid}
              userName={offlineDemo ? 'Demo Shopkeeper' : userProfile?.fullName || user.displayName || user.email}
              shopName={offlineDemo ? 'SpazaIQ Offline Demo' : userProfile?.shopName || user.displayName || 'My Shop'}
            />
          )}
        </View>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}