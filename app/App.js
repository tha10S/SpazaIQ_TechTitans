import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, TouchableOpacity } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useTheme } from '../config/ThemeContext';
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

const icons = {
  Home: 'home',
  Stock: 'cube',
  Sell: 'cart',
  Credit: 'card',
  Suppliers: 'people',
  Insights: 'stats-chart',
};

function MainTabs({ route }) {
  const account = route?.params || {};
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route, navigation }) => ({
        headerShown: true,
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.textPrimary,
        headerRight: () => (
          <TouchableOpacity
            onPress={() => navigation.navigate('Profile')}
            style={{ marginRight: 16 }}
          >
            <Ionicons name="person-circle" size={32} color={colors.primary} />
          </TouchableOpacity>
        ),
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
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

function AppContent() {
  const { isDark, colors } = useTheme();
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

  // Navigation theme built from the app's own colors
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

  if (loading) {
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
      <NavigationContainer theme={navTheme}>
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
      {user && (
        <TechTitansAssistant
          storeId={userProfile?.defaultStoreId || user.uid}
          userName={userProfile?.fullName || user.displayName || user.email}
          shopName={userProfile?.shopName || user.displayName || 'My Shop'}
        />
      )}
    </View>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}