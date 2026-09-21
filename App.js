import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { ThemeProvider } from './ThemeContext';
<<<<<<< HEAD
=======
import { TouchableOpacity, View } from 'react-native';
import { TechTitansAssistant } from './components/TechTitansAssistant';
>>>>>>> 5d0f884411c03a1c0e076f514903c3d6024851e5

// User authentication
import LoginScreen from './LoginScreen';
import SignupScreen from './SignupScreen';

import Insights from './insights';
import SuppliersOrders from './suppliers_reorders';

// Team member files
import HomeScreen from './screens/HomeScreen';
import StockScreen from './screens/StockScreen';
import NewSaleScreen from './screens/NewSaleScreen';
import CreditLedgerScreen from './screens/CreditLedgerScreen';
import ProfileSettingsScreen from './screens/ProfileSettingsScreen';
import QRScannerScreen from './screens/QRScannerScreen';
import PlaceholderScreen from './screens/PlaceholderScreen';
import NotificationsScreen from './screens/NotificationsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const GREEN = '#004B49';

const icons = {
  Home: 'home',
  Stock: 'cube',
  Sell: 'cart',
  Credit: 'card',
<<<<<<< HEAD
=======
  Insights: 'stats-chart',
  Profile: 'person',
  Scanner: 'scan',
  Notifications: 'notifications',
>>>>>>> 5d0f884411c03a1c0e076f514903c3d6024851e5
  Suppliers: 'people',
  Insights: 'stats-chart',
};

<<<<<<< HEAD
function ChatFAB() {
  const navigation = useNavigation();
  return (
    <TouchableOpacity
      style={styles.fab}
      onPress={() => navigation.navigate('Chatbot')}
      accessibilityLabel="Open chat assistant"
    >
      <Ionicons name="chatbubble-ellipses" size={26} color="#FFFFFF" />
    </TouchableOpacity>
  );
}

function MainTabs() {
  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: GREEN,
          tabBarInactiveTintColor: '#888',
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={icons[route.name]} size={size} color={color} />
          ),
        })}
      >
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Stock" component={StockScreen} />
        <Tab.Screen name="Sell" component={NewSaleScreen} />
        <Tab.Screen name="Credit" component={CreditLedgerScreen} />
        <Tab.Screen name="Suppliers" component={SuppliersOrders} />
        <Tab.Screen name="Insights" component={Insights} />
      </Tab.Navigator>
      <ChatFAB />
    </View>
=======
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
>>>>>>> 5d0f884411c03a1c0e076f514903c3d6024851e5
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Signup" component={SignupScreen} />
          <Stack.Screen name="MainTabs" component={MainTabs} />
          <Stack.Screen name="Chatbot" component={ChatbotScreen} options={{ presentation: 'modal' }} />
          <Stack.Screen name="Scanner" component={QRScannerScreen} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
          <Stack.Screen name="Placeholder" component={PlaceholderScreen} />
          <Stack.Screen name="Profile" component={ProfileSettingsScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 90,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#004B49',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
});