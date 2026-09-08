import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useTheme } from '../ThemeContext';


const suppliers = [
  {
    id: 's1',
    name: 'Manzini Wholesalers',
    location: 'Manzini Industrial Sites',
    products: ['Maize Meal 5kg', 'Cooking Oil 2L', 'Sugar 2kg'],
  },
  {
    id: 's2',
    name: 'Green Valley Distributors',
    location: 'Matsapha',
    products: ['White Bread', 'Fresh Milk 1L', 'Eggs (tray)'],
  },
  {
    id: 's3',
    name: 'Eswatini Beverages Co.',
    location: 'Manzini',
    products: ['Cool Drinks (case)', 'Bottled Water 500ml'],
  },
  {
    id: 's4',
    name: 'Thabo Farm Produce',
    location: 'Ka-Phunga',
    products: ['Tomatoes (box)', 'Onions (bag)', 'Cabbage'],
  },
];

const orders = [
  {
    id: 'o1',
    supplier: 'Manzini Wholesalers',
    items: 'Maize Meal 5kg x10, Cooking Oil 2L x6',
    date: '2026-09-02',
    total: 'E 1,240',
    status: 'delivered',
  },
  {
    id: 'o2',
    supplier: 'Green Valley Distributors',
    items: 'White Bread x20, Fresh Milk 1L x12',
    date: '2026-09-04',
    total: 'E 640',
    status: 'pending',
  },
  {
    id: 'o3',
    supplier: 'Eswatini Beverages Co.',
    items: 'Cool Drinks (case) x8',
    date: '2026-08-29',
    total: 'E 960',
    status: 'delivered',
  },
  {
    id: 'o4',
    supplier: 'Thabo Farm Produce',
    items: 'Tomatoes (box) x3, Onions (bag) x5',
    date: '2026-09-05',
    total: 'E 380',
    status: 'cancelled',
  },
];

function getStatusMeta(colors) {
  return {
    delivered: { label: 'Delivered', color: colors.success, bg: colors.successBg },
    pending: { label: 'Pending', color: colors.pending, bg: colors.pendingBg },
    cancelled: { label: 'Cancelled', color: colors.danger, bg: colors.dangerBg },
  };
}

export default function SuppliersOrdersScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { colors, spacing, radius, typography } = useTheme();
  const styles = makeStyles(colors, typography, spacing, radius);
  const STATUS_META = getStatusMeta(colors);

  const initialTab = route.params?.initialTab === 'orders' ? 'orders' : 'suppliers';

  const [tab, setTab] = useState(initialTab);
  const [query, setQuery] = useState('');

  const filteredSuppliers = useMemo(() => {
    if (!query.trim()) return suppliers;
    const q = query.toLowerCase();
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.products.some((p) => p.toLowerCase().includes(q))
    );
  }, [query]);

  const handleReorder = (order) => {
    Alert.alert('Reorder placed', `Reordered from ${order.supplier}: ${order.items}`);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Suppliers & Orders</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Tab toggle */}
      <View style={styles.toggleWrap}>
        <TouchableOpacity
          style={[styles.toggleBtn, tab === 'suppliers' && styles.toggleBtnActive]}
          onPress={() => setTab('suppliers')}
        >
          <Text style={[styles.toggleLabel, tab === 'suppliers' && styles.toggleLabelActive]}>
            Suppliers
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, tab === 'orders' && styles.toggleBtnActive]}
          onPress={() => setTab('orders')}
        >
          <Text style={[styles.toggleLabel, tab === 'orders' && styles.toggleLabelActive]}>
            Orders
          </Text>
        </TouchableOpacity>
      </View>

      {tab === 'suppliers' ? (
        <>
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={18} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search suppliers or products"
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={setQuery}
            />
          </View>
          <FlatList
            data={filteredSuppliers}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No suppliers match your search.</Text>
            }
            renderItem={({ item }) => (
              <View style={styles.supplierCard}>
                <View style={styles.supplierHeaderRow}>
                  <Ionicons name="business" size={18} color={colors.primary} />
                  <Text style={styles.supplierName}>{item.name}</Text>
                </View>
                <Text style={styles.supplierLocation}>{item.location}</Text>
                <View style={styles.productsRow}>
                  {item.products.map((p) => (
                    <View key={p} style={styles.productPill}>
                      <Text style={styles.productPillText}>{p}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          />
        </>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const meta = STATUS_META[item.status];
            return (
              <View style={styles.orderCard}>
                <View style={styles.orderHeaderRow}>
                  <Text style={styles.orderSupplier}>{item.supplier}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
                    <Text style={[styles.statusBadgeText, { color: meta.color }]}>
                      {meta.label}
                    </Text>
                  </View>
                </View>
                <Text style={styles.orderItems}>{item.items}</Text>
                <View style={styles.orderFooterRow}>
                  <Text style={styles.orderDate}>{item.date}</Text>
                  <Text style={styles.orderTotal}>{item.total}</Text>
                </View>
                <TouchableOpacity
                  style={styles.reorderBtn}
                  onPress={() => handleReorder(item)}
                >
                  <Ionicons name="repeat" size={16} color={colors.card} />
                  <Text style={styles.reorderBtnText}>Reorder Same</Text>
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

function makeStyles(colors, typography, spacing, radius) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    backButton: { padding: spacing.xs },
    headerTitle: { ...typography.h2 },
    toggleWrap: {
      flexDirection: 'row',
      backgroundColor: colors.card,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.md,
      padding: 4,
    },
    toggleBtn: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.pill, alignItems: 'center' },
    toggleBtnActive: { backgroundColor: colors.primary },
    toggleLabel: { ...typography.body, fontWeight: '600', color: colors.textSecondary },
    toggleLabelActive: { color: colors.card },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.md,
      paddingHorizontal: spacing.md,
      gap: spacing.sm,
    },
    searchInput: { flex: 1, paddingVertical: spacing.sm, ...typography.body },
    listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl * 2 },
    emptyText: { ...typography.label, textAlign: 'center', marginTop: spacing.xl },
    supplierCard: {
      backgroundColor: colors.card,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    supplierHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    supplierName: { ...typography.h2, fontSize: 16 },
    supplierLocation: { ...typography.small, marginTop: spacing.xs, marginBottom: spacing.sm },
    productsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
    productPill: {
      backgroundColor: colors.primaryLight,
      borderRadius: radius.pill,
      paddingVertical: 4,
      paddingHorizontal: spacing.sm,
    },
    productPillText: { ...typography.small, color: colors.primaryDark, fontWeight: '600' },
    orderCard: {
      backgroundColor: colors.card,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    orderHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.xs,
    },
    orderSupplier: { ...typography.h2, fontSize: 16 },
    statusBadge: { borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: spacing.sm },
    statusBadgeText: { ...typography.small, fontWeight: '700' },
    orderItems: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.sm },
    orderFooterRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md },
    orderDate: { ...typography.small },
    orderTotal: { ...typography.body, fontWeight: '700' },
    reorderBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      backgroundColor: colors.primary,
      borderRadius: radius.sm,
      paddingVertical: spacing.sm,
    },
    reorderBtnText: { ...typography.body, color: colors.card, fontWeight: '700' },
  });
}