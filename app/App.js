import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, TouchableOpacity } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { ThemeProvider } from '../config/ThemeContext';
import { TechTitansAssistant } from '../components/TechTitansAssistant';

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

function withAssistant(ScreenComponent) {
  return function AssistantTab(props) {
    return (
      <View style={{ flex: 1 }}>
        <ScreenComponent {...props} />
        <TechTitansAssistant
          storeId={props.route?.params?.storeId}
          userName={props.route?.params?.userName}
          shopName={props.route?.params?.shopName}
        />
      </View>
    );
  };
}

const HomeWithAssistant = withAssistant(HomeScreen);
const StockWithAssistant = withAssistant(StockScreen);
const SellWithAssistant = withAssistant(NewSaleScreen);
const CreditWithAssistant = withAssistant(CreditLedgerScreen);
const SuppliersWithAssistant = withAssistant(SuppliersOrders);
const InsightsWithAssistant = withAssistant(Insights);

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
      <Tab.Screen name="Home" component={HomeWithAssistant} initialParams={account} />
      <Tab.Screen name="Stock" component={StockWithAssistant} initialParams={account} />
      <Tab.Screen name="Sell" component={SellWithAssistant} initialParams={account} />
      <Tab.Screen name="Credit" component={CreditWithAssistant} initialParams={account} />
      <Tab.Screen name="Suppliers" component={SuppliersWithAssistant} initialParams={account} />
      <Tab.Screen name="Insights" component={InsightsWithAssistant} initialParams={account} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const unsubscribe = watchAuth(async (u) => {
      setUser(u);
      setUserProfile(null);
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
    <ThemeProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {user ? (
            <>
              <Stack.Screen
                name="MainTabs"
                component={MainTabs}
                initialParams={{
                  storeId: userProfile?.defaultStoreId || user.uid,
                  userName: userProfile?.fullName || user.displayName || user.email,
                  shopName: userProfile?.shopName || user.displayName || 'My Shop',
                }}
              />
              <Stack.Screen name="Scanner" component={QRScannerScreen} />
              <Stack.Screen name="Notifications" component={NotificationsScreen} />
              <Stack.Screen name="Placeholder" component={PlaceholderScreen} />
              <Stack.Screen name="Profile" component={ProfileSettingsScreen} />
            </>
          ) : (
            <>
              <Stack.Screen name="Login" component={LoginScreen} />
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
    </ThemeProvider>
  );
}