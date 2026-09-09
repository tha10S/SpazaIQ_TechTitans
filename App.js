import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Insights from './insights';
import SuppliersReorders from './suppliers_reorders';

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Tab.Navigator screenOptions={{ headerShown: false }}>
        <Tab.Screen name="Insights" component={Insights} />
        <Tab.Screen name="Suppliers/Reorders" component={SuppliersReorders} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}