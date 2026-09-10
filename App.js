import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { ThemeProvider } from './ThemeContext';
import { TouchableOpacity } from 'react-native';

// User authentication
import LoginScreen from './LoginScreen';
import SignupScreen from './SignupScreen';

import Insights from './insights';
import SuppliersOrders from './suppliers_reorders';

// team member files
import HomeScreen from './screens/HomeScreen';
import StockScreen from './screens/StockScreen';
import NewSaleScreen from './screens/NewSaleScreen';
import CreditLedgerScreen from './screens/CreditLedgerScreen';
import ChatbotScreen from './screens/ChatbotScreen';
import ProfileSettingsScreen from './screens/ProfileSettingsScreen';
import QRScannerScreen from './screens/QRScannerScreen';
import PlaceholderScreen from './screens/PlaceholderScreen';
import NotificationsScreen from './screens/NotificationsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const GREEN = '#06ad40';

const icons = {
  Home: 'home',
  Stock: 'cube',
  Sell: 'cart',
  Credit: 'card',
  Insights: 'stats-chart',
  Chatbot: 'chatbubble-ellipses',
  Profile: 'person',
  Scanner: 'scan',
  Notifications: 'notifications',
  Suppliers: 'people',
};

function MainTabs() {
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
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Stock" component={StockScreen} />
      <Tab.Screen name="Sell" component={NewSaleScreen} />
      <Tab.Screen name="Credit" component={CreditLedgerScreen} />
      <Tab.Screen name="Suppliers" component={SuppliersOrders} />
      <Tab.Screen name="Insights" component={Insights} />
      <Tab.Screen name="Chatbot" component={ChatbotScreen} />
    </Tab.Navigator>
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
          <Stack.Screen name="Scanner" component={QRScannerScreen} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
          <Stack.Screen name="Placeholder" component={PlaceholderScreen} />
          <Stack.Screen name="Profile" component={ProfileSettingsScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </ThemeProvider>
  );
}