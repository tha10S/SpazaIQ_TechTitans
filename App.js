import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import LoginScreen from './screens/LoginScreen';
import NewSaleScreen from './screens/NewSaleScreen';
import CreditLedgerScreen from './screens/CreditLedgerScreen';
import ChatbotScreen from './screens/ChatbotScreen';

const DEFAULT_STORE_ID = 'mock-store-1';

const TABS = [
  { key: 'sale', label: 'New Sale', icon: 'cart-outline', Component: NewSaleScreen },
  { key: 'credit', label: 'Credit Ledger', icon: 'wallet-outline', Component: CreditLedgerScreen },
  { key: 'assistant', label: 'Assistant', icon: 'chatbubble-ellipses-outline', Component: ChatbotScreen },
];

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [storeId, setStoreId] = useState(DEFAULT_STORE_ID);
  const [activeTab, setActiveTab] = useState('assistant');

  const ActiveScreen = TABS.find((t) => t.key === activeTab).Component;

  if (!isLoggedIn) {
    return <LoginScreen onLogin={(nextStoreId) => {
      setStoreId(nextStoreId || DEFAULT_STORE_ID);
      setIsLoggedIn(true);
    }} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.screenArea}>
        <ActiveScreen storeId={storeId} />
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
    boxShadow: '0px -4px 10px rgba(15, 23, 42, 0.08)',
    elevation: 8,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  tabLabel: { fontSize: 12, color: '#9CA3AF', marginTop: 2, fontWeight: '600' },
  tabLabelActive: { color: '#0F9D58', fontWeight: '700' },
});