import React from 'react';

import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import HomeScreen from './screens/HomeScreen';
import StockScreen from './screens/StockScreen';
import NotificationsScreen from './screens/NotificationsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();


// --------------------------------------------------
// Placeholder screens
// These will be replaced when you build those pages.
// --------------------------------------------------

function SellScreen() {
  return null;
}

function CreditScreen() {
  return null;
}

function InsightsScreen() {
  return null;
}


// --------------------------------------------------
// Main bottom navigation
// --------------------------------------------------

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,

        tabBarActiveTintColor: '#00A86B',
        tabBarInactiveTintColor: '#A8B0BB',

        tabBarStyle: {
          height: 74,
          paddingTop: 8,
          paddingBottom: 10,
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E9EDF1',
          elevation: 0,
        },

        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '500',
          marginTop: 2,
        },

        tabBarIcon: ({ color, focused }) => {

          if (route.name === 'Home') {
            return (
              <Ionicons
                name={focused ? 'home' : 'home-outline'}
                size={20}
                color={color}
              />
            );
          }

          if (route.name === 'Stock') {
            return (
              <MaterialCommunityIcons
                name="archive-outline"
                size={21}
                color={color}
              />
            );
          }

          if (route.name === 'Sell') {
            return (
              <Ionicons
                name="cart-outline"
                size={21}
                color={color}
              />
            );
          }

          if (route.name === 'Credit') {
            return (
              <Ionicons
                name="people-outline"
                size={21}
                color={color}
              />
            );
          }

          if (route.name === 'Insights') {
            return (
              <Ionicons
                name="bar-chart-outline"
                size={21}
                color={color}
              />
            );
          }
        },
      })}
    >

      <Tab.Screen
        name="Home"
        component={HomeScreen}
      />

      <Tab.Screen
        name="Stock"
        component={StockScreen}
      />

      <Tab.Screen
        name="Sell"
        component={SellScreen}
      />

      <Tab.Screen
        name="Credit"
        component={CreditScreen}
      />

      <Tab.Screen
        name="Insights"
        component={InsightsScreen}
      />

    </Tab.Navigator>
  );
}


// --------------------------------------------------
// App navigation
// --------------------------------------------------

export default function App() {
  return (
    <NavigationContainer>

      <Stack.Navigator
        screenOptions={{
          headerShown: false,
        }}
      >

        <Stack.Screen
          name="Main"
          component={MainTabs}
        />

        <Stack.Screen
          name="Notifications"
          component={NotificationsScreen}
        />

      </Stack.Navigator>

    </NavigationContainer>
  );
}