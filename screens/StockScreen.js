import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../ThemeContext';

const initialProducts = [
  {
    id: '1',
    name: 'Simba Fruit Chutney Chips 120g',
    emoji: '🥔',
    quantity: 4,
    price: 'R 12.00',
    status: 'Low Stock',
    statusType: 'low',
  },
  {
    id: '2',
    name: 'White Star Maize Meal 2.5kg',
    emoji: '🌽',
    quantity: 28,
    price: 'R 38.50',
    status: 'In Stock',
    statusType: 'stock',
  },
  {
    id: '3',
    name: 'Coca-Cola Original 500ml',
    emoji: '🥤',
    quantity: 45,
    price: 'R 18.00',
    status: 'In Stock',
    statusType: 'stock',
  },
  {
    id: '4',
    name: 'Sunlight Laundry Soap 500g',
    emoji: '🧼',
    quantity: 0,
    price: 'R 22.00',
    status: 'Out of Stock',
    statusType: 'out',
  },
  {
    id: '5',
    name: 'Albany Superior White Bread',
    emoji: '🍞',
    quantity: 2,
    price: 'R 16.00',
    status: 'Low Stock',
    statusType: 'low',
  },
];

export default function StockScreen({ navigation }) {
  const { colors, spacing, radius, typography } = useTheme();
  const styles = makeStyles(colors, typography, spacing, radius);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredProducts = initialProducts.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />

      <View style={styles.container}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <Text style={styles.pageTitle}>Stock Management</Text>
          </View>

          {/* Search & Scan Row */}
          <View style={styles.searchRow}>
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={18} color="#9CA3AF" />
              <TextInput
                placeholder="Search stock catalog..."
                placeholderTextColor="#9CA3AF"
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity 
              style={styles.scanButton}
              onPress={() => navigation?.navigate('Scanner')}
              activeOpacity={0.85}
            >
              <Ionicons name="scan" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Summary Cards */}
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <View style={[styles.statIconBadge, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="cube" size={16} color="#2563EB" />
              </View>
              <Text style={styles.summaryLabel}>Total Items</Text>
              <Text style={styles.summaryValue}>148</Text>
            </View>

            <View style={styles.summaryCard}>
              <View style={[styles.statIconBadge, { backgroundColor: '#FEE2E2' }]}>
                <Ionicons name="warning" size={16} color="#DC2626" />
              </View>
              <Text style={styles.summaryLabel}>Low Stock</Text>
              <Text style={[styles.summaryValue, { color: '#DC2626' }]}>3</Text>
            </View>

            <View style={styles.summaryCard}>
              <View style={[styles.statIconBadge, { backgroundColor: '#FFFBEB' }]}>
                <Ionicons name="time" size={16} color="#D97706" />
              </View>
              <Text style={styles.summaryLabel}>Expiring</Text>
              <Text style={[styles.summaryValue, { color: '#D97706' }]}>5</Text>
            </View>
          </View>

          {/* Quick Action Navigation */}
          <View style={styles.actionRow}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => navigation?.navigate('Suppliers')}
              activeOpacity={0.85}
            >
              <Ionicons name="people-outline" size={16} color="#004B49" style={{ marginRight: 6 }} />
              <Text style={styles.actionText}>Suppliers</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => navigation?.navigate('Suppliers', { screen: 'Reorder' })}
              activeOpacity={0.85}
            >
              <Ionicons name="refresh-outline" size={16} color="#004B49" style={{ marginRight: 6 }} />
              <Text style={styles.actionText}>Reorders</Text>
            </TouchableOpacity>
          </View>

          {/* Catalog Header with Separated Title & Count Badge */}
          <View style={styles.catalogHeader}>
            <Text style={styles.catalogTitle}>PRODUCT CATALOG</Text>
            <View style={styles.countBadge}>
              <Text style={styles.catalogCount}>{filteredProducts.length} items</Text>
            </View>
          </View>

          {/* Product List */}
          <View style={styles.productList}>
            {filteredProducts.map((product) => (
              <TouchableOpacity
                key={product.id}
                style={styles.productCard}
                activeOpacity={0.7}
              >
                <View style={styles.productInformation}>
                  <Text style={styles.productName} numberOfLines={1}>
                    {product.statusType === 'low' ? '‼️ ' : ''}{product.emoji} {product.name}
                  </Text>
                  <View style={styles.detailsRow}>
                    <Text style={styles.productPrice}>{product.price}</Text>
                    <Text style={styles.dotSeparator}>•</Text>
                    <Text style={styles.productQty}>
                      Qty: <Text style={styles.qtyBold}>{product.quantity}</Text>
                    </Text>
                  </View>
                </View>

                <View
                  style={[
                    styles.statusBadge,
                    product.statusType === 'low' && styles.lowBadge,
                    product.statusType === 'stock' && styles.stockBadge,
                    product.statusType === 'out' && styles.outBadge,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      product.statusType === 'low' && styles.lowText,
                      product.statusType === 'stock' && styles.stockText,
                      product.statusType === 'out' && styles.outText,
                    ]}
                  >
                    {product.status}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Floating Action Buttons */}
        <TouchableOpacity 
          style={styles.addButton}
          activeOpacity={0.9}
        >
          <Ionicons name="add" size={26} color="#FFFFFF" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.chatButton}
          onPress={() => navigation?.navigate('Chatbot')}
          activeOpacity={0.9}
        >
          <Ionicons name="chatbubble-ellipses" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function makeStyles(colors, typography, spacing, radius) {
  const emeraldPrimary = '#004B49';

  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#F9FAFB' },
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    scrollContent: { padding: spacing.lg, paddingBottom: 120 },

    /* Header */
    headerRow: { marginBottom: spacing.md },
    pageTitle: { fontSize: 24, fontWeight: '800', color: '#111827' },

    /* Search Bar */
    searchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
    searchContainer: {
      flex: 1,
      height: 44,
      backgroundColor: '#FFFFFF',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#E5E7EB',
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
    },
    searchInput: { flex: 1, height: 44, marginLeft: 8, fontSize: 14, color: '#111827' },
    scanButton: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: emeraldPrimary,
      marginLeft: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },

    /* Summary Stat Cards */
    summaryRow: { flexDirection: 'row', gap: 10, marginBottom: spacing.md },
    summaryCard: {
      flex: 1,
      backgroundColor: '#FFFFFF',
      borderRadius: 14,
      padding: 12,
      borderWidth: 1,
      borderColor: '#E5E7EB',
    },
    statIconBadge: {
      width: 28,
      height: 28,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 6,
    },
    summaryLabel: { fontSize: 11, color: '#6B7280', fontWeight: '600' },
    summaryValue: { fontSize: 18, fontWeight: '800', color: '#111827', marginTop: 2 },

    /* Action Buttons */
    actionRow: { flexDirection: 'row', gap: 10, marginBottom: spacing.md },
    actionButton: {
      flex: 1,
      height: 40,
      borderRadius: 12,
      backgroundColor: '#E6F4F1',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionText: { color: emeraldPrimary, fontSize: 13, fontWeight: '700' },

    /* Catalog Section Header */
    catalogHeader: {
      width: '100%',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: spacing.xs,
      marginBottom: spacing.sm,
    },
    catalogTitle: {
      flex: 1,
      fontSize: 12,
      fontWeight: '800',
      color: '#6B7280',
      letterSpacing: 0.5,
      marginRight: 8,
    },
    countBadge: {
      backgroundColor: '#E5E7EB',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    catalogCount: { fontSize: 11, color: '#374151', fontWeight: '700' },

    /* Product Items */
    productList: { gap: spacing.xs },
    productCard: {
      backgroundColor: '#FFFFFF',
      borderRadius: 14,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: '#E5E7EB',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    productInformation: { flex: 1, marginRight: spacing.sm },
    productName: { fontSize: 14, fontWeight: '700', color: '#111827' },
    detailsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    productPrice: { fontSize: 13, fontWeight: '700', color: emeraldPrimary },
    dotSeparator: { marginHorizontal: 6, color: '#9CA3AF' },
    productQty: { fontSize: 12, color: '#6B7280' },
    qtyBold: { fontWeight: '800', color: '#111827' },

    /* Badges */
    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    statusText: { fontSize: 11, fontWeight: '800' },
    lowBadge: { backgroundColor: '#FEE2E2' },
    lowText: { color: '#DC2626' },
    stockBadge: { backgroundColor: '#ECFDF5' },
    stockText: { color: '#059669' },
    outBadge: { backgroundColor: '#F3F4F6' },
    outText: { color: '#6B7280' },

    /* Floating Buttons */
    addButton: {
      position: 'absolute',
      right: 16,
      bottom: 72,
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: emeraldPrimary,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 5,
      shadowColor: '#000',
      shadowOpacity: 0.15,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
    },
    chatButton: {
      position: 'absolute',
      right: 16,
      bottom: 16,
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: emeraldPrimary,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 5,
      shadowColor: '#000',
      shadowOpacity: 0.15,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
    },
  });
}