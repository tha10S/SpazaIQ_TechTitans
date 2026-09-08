import React from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

import HomeScreen from './screens/HomeScreen';
import SuppliersOrdersScreen from './screens/SuppliersOrdersScreen';
import ProfileSettingsScreen from './screens/ProfileSettingsScreen';
import PlaceholderScreen from './screens/PlaceholderScreen';
import { ThemeProvider, useTheme } from './ThemeContext';

const Tab = createBottomTabNavigator();
const HomeStack = createNativeStackNavigator();

function HomeStackNavigator() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="HomeMain" component={HomeScreen} />
      <HomeStack.Screen name="SuppliersOrders" component={SuppliersOrdersScreen} />
      <HomeStack.Screen name="ProfileSettings" component={ProfileSettingsScreen} />
    </HomeStack.Navigator>
  );
}

const TAB_ICONS = {
  Home: 'home',
  Stock: 'cube',
  Sell: 'pricetag',
  Credit: 'people',
  Insights: 'trending-up',
};

function AppNavigator() {
  const { colors, isDark } = useTheme();


  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      background: colors.background,
      card: colors.card,
      border: colors.border,
      text: colors.textPrimary,
      primary: colors.primary,
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? TAB_ICONS[route.name] : `${TAB_ICONS[route.name]}-outline`}
              size={size}
              color={color}
            />
          ),
        })}
      >
        <Tab.Screen name="Home" component={HomeStackNavigator} />
        <Tab.Screen name="Stock" component={PlaceholderScreen} />
        <Tab.Screen name="Sell" component={PlaceholderScreen} />
        <Tab.Screen name="Credit" component={PlaceholderScreen} />
        <Tab.Screen name="Insights" component={PlaceholderScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppNavigator />
    </ThemeProvider>
  );
}