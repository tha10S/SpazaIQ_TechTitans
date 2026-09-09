import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import NewSaleScreen from './screens/NewSaleScreen';
import CreditLedgerScreen from './screens/CreditLedgerScreen';
import ChatbotScreen from './screens/ChatbotScreen';

// While there's no auth/Supabase yet, the mock backend ignores this —
// it's just here so the screens already expect a real storeId later.
const STORE_ID = 'mock-store-1';

const TABS = [
  { key: 'sale', label: 'New Sale', icon: 'cart-outline', Component: NewSaleScreen },
  { key: 'credit', label: 'Credit Ledger', icon: 'wallet-outline', Component: CreditLedgerScreen },
  { key: 'assistant', label: 'Assistant', icon: 'chatbubble-ellipses-outline', Component: ChatbotScreen },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('sale');
  const ActiveScreen = TABS.find((t) => t.key === activeTab).Component;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.screenArea}>
        <ActiveScreen storeId={STORE_ID} />
      </View>

      <View style={styles.tabBar}>
        {TABS.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.tabButton}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={tab.icon}
                size={22}
                color={isActive ? '#0F9D58' : '#9CA3AF'}
              />
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  screenArea: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    paddingBottom: 6,
    paddingTop: 8,
  },
  tabButton: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabLabel: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  tabLabelActive: { color: '#0F9D58', fontWeight: '600' },
});