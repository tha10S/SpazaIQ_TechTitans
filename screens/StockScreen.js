import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../config/ThemeContext';
import { useProducts } from '../hooks/useProducts';
import { getAuthenticatedStoreId } from '../services/firestore/paths';
import { createProduct, updateProduct } from '../services/salesService';

const EMPTY_PRODUCT = {
  name: '',
  sku: '',
  barcode: '',
  unitPrice: '',
  costPrice: '',
  quantity: '0',
  reorderLevel: '0',
  category: 'General',
};

export default function StockScreen({ navigation, route }) {
  const { colors, spacing, radius, typography } = useTheme();
  const styles = useMemo(
    () => makeStyles(colors, typography, spacing, radius),
    [colors, typography, spacing, radius]
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [productFormVisible, setProductFormVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState(EMPTY_PRODUCT);
  const [productError, setProductError] = useState('');
  const [savingProduct, setSavingProduct] = useState(false);
  const storeId = route?.params?.storeId || getAuthenticatedStoreId();
  const { products, loading, error } = useProducts(storeId, searchQuery);

  const lowStockCount = products.filter((product) => product.quantity <= product.reorder_level).length;
  const totalQuantity = products.reduce((total, product) => total + product.quantity, 0);

  const openProductForm = (product = null) => {
    setEditingProduct(product);
    setProductForm(product ? {
      name: product.name,
      sku: product.sku,
      barcode: product.barcode,
      unitPrice: String(product.unit_price),
      costPrice: String(product.cost_price),
      quantity: String(product.quantity),
      reorderLevel: String(product.reorder_level),
      category: product.category,
    } : EMPTY_PRODUCT);
    setProductError('');
    setProductFormVisible(true);
  };

  const saveProduct = async () => {
    setSavingProduct(true);
    setProductError('');
    try {
      if (editingProduct) {
        await updateProduct(storeId, editingProduct.id, productForm);
      } else {
        await createProduct(storeId, productForm);
      }
      setProductFormVisible(false);
    } catch (error) {
      setProductError(error.message || 'Could not save this product.');
    } finally {
      setSavingProduct(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Status bar is handled globally in App.js */}

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
              <Ionicons name="search" size={18} color={colors.textMuted} />
              <TextInput
                placeholder="Search stock catalog..."
                placeholderTextColor={colors.textMuted}
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color={colors.textMuted} />
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
              <View style={[styles.statIconBadge, { backgroundColor: 'rgba(59,130,246,0.15)' }]}>
                <Ionicons name="cube" size={16} color="#3B82F6" />
              </View>
              <Text style={styles.summaryLabel}>Total Items</Text>
              <Text style={styles.summaryValue}>{totalQuantity}</Text>
            </View>

            <View style={styles.summaryCard}>
              <View style={[styles.statIconBadge, { backgroundColor: 'rgba(220,38,38,0.15)' }]}>
                <Ionicons name="warning" size={16} color={colors.danger} />
              </View>
              <Text style={styles.summaryLabel}>Low Stock</Text>
              <Text style={[styles.summaryValue, { color: colors.danger }]}>{lowStockCount}</Text>
            </View>

            <View style={styles.summaryCard}>
              <View style={[styles.statIconBadge, { backgroundColor: 'rgba(245,158,11,0.15)' }]}>
                <Ionicons name="time" size={16} color="#F59E0B" />
              </View>
              <Text style={styles.summaryLabel}>Expiring</Text>
              <Text style={[styles.summaryValue, { color: '#F59E0B' }]}>5</Text>
            </View>
          </View>

          {/* Quick Action Navigation */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation?.navigate('Suppliers')}
              activeOpacity={0.85}
            >
              <Ionicons name="people-outline" size={16} color={colors.primary} style={{ marginRight: 6 }} />
              <Text style={styles.actionText}>Suppliers</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation?.navigate('Suppliers', { screen: 'Reorder' })}
              activeOpacity={0.85}
            >
              <Ionicons name="refresh-outline" size={16} color={colors.primary} style={{ marginRight: 6 }} />
              <Text style={styles.actionText}>Reorders</Text>
            </TouchableOpacity>
          </View>

          {/* Catalog Header with Separated Title & Count Badge */}
          <View style={styles.catalogHeader}>
            <Text style={styles.catalogTitle}>PRODUCT CATALOG</Text>
            <View style={styles.countBadge}>
              <Text style={styles.catalogCount}>{products.length} items</Text>
            </View>
          </View>

          {/* Product List */}
          <View style={styles.productList}>
            {loading ? <Text style={styles.emptyText}>Loading products...</Text> : error ? <Text style={styles.emptyText}>{error.message}</Text> : products.map((product) => {
              const statusType = product.quantity === 0 ? 'out' : product.quantity <= product.reorder_level ? 'low' : 'stock';
              const status = statusType === 'out' ? 'Out of Stock' : statusType === 'low' ? 'Low Stock' : 'In Stock';
              return (
              <TouchableOpacity
                key={product.id}
                style={styles.productCard}
                activeOpacity={0.7}
                onPress={() => openProductForm(product)}
              >
                <View style={styles.productInformation}>
                  <Text style={styles.productName} numberOfLines={1}>
                    {statusType === 'low' ? '‼️ ' : ''}{product.name}
                  </Text>
                  <View style={styles.detailsRow}>
                    <Text style={styles.productPrice}>R {product.unit_price.toFixed(2)}</Text>
                    <Text style={styles.dotSeparator}>•</Text>
                    <Text style={styles.productQty}>
                      Qty: <Text style={styles.qtyBold}>{product.quantity}</Text>
                    </Text>
                  </View>
                </View>

                <View
                  style={[
                    styles.statusBadge,
                    statusType === 'low' && styles.lowBadge,
                    statusType === 'stock' && styles.stockBadge,
                    statusType === 'out' && styles.outBadge,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      statusType === 'low' && styles.lowText,
                      statusType === 'stock' && styles.stockText,
                      statusType === 'out' && styles.outText,
                    ]}
                  >
                    {status}
                  </Text>
                </View>
              </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {/* Floating Action Buttons */}
        <TouchableOpacity
          style={styles.addButton}
          activeOpacity={0.9}
          onPress={() => openProductForm()}
          accessibilityLabel="Add product"
        >
          <Ionicons name="add" size={26} color="#FFFFFF" />
        </TouchableOpacity>

        <Modal
          visible={productFormVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setProductFormVisible(false)}
        >
          <View style={styles.formOverlay}>
            <ScrollView contentContainerStyle={styles.formScroll} keyboardShouldPersistTaps="handled">
              <View style={styles.formCard}>
                <Text style={styles.formTitle}>{editingProduct ? 'Edit Product' : 'Add Product'}</Text>
                {[
                  ['name', 'Product name'],
                  ['sku', 'SKU'],
                  ['barcode', 'Barcode'],
                  ['unitPrice', 'Selling price (R)'],
                  ['costPrice', 'Cost price (R)'],
                  ['quantity', 'Quantity'],
                  ['reorderLevel', 'Low-stock threshold'],
                  ['category', 'Category'],
                ].map(([key, label]) => (
                  <View key={key} style={styles.formField}>
                    <Text style={styles.formLabel}>{label}</Text>
                    <TextInput
                      style={styles.formInput}
                      value={productForm[key]}
                      onChangeText={(value) => setProductForm((current) => ({ ...current, [key]: value }))}
                      keyboardType={['unitPrice', 'costPrice', 'quantity', 'reorderLevel'].includes(key) ? 'decimal-pad' : 'default'}
                      autoCapitalize={key === 'sku' || key === 'barcode' ? 'characters' : 'sentences'}
                      placeholderTextColor={colors.textMuted}
                      editable={!savingProduct}
                    />
                  </View>
                ))}
                {productError ? <Text style={styles.formError}>{productError}</Text> : null}
                <View style={styles.formActions}>
                  <TouchableOpacity style={styles.formSecondaryButton} onPress={() => setProductFormVisible(false)} disabled={savingProduct}>
                    <Text style={styles.formSecondaryText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.formPrimaryButton} onPress={saveProduct} disabled={savingProduct}>
                    <Text style={styles.formPrimaryText}>{savingProduct ? 'Saving...' : 'Save Product'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

function makeStyles(colors, typography, spacing, radius) {
  const brandGreen = '#004B49'; // solid buttons stay brand green in both themes

  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: { padding: spacing.lg, paddingBottom: 120 },

    /* Header */
    headerRow: { marginBottom: spacing.md },
    pageTitle: { fontSize: 24, fontWeight: '800', color: colors.textPrimary },

    /* Search Bar */
    searchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
    searchContainer: {
      flex: 1,
      height: 44,
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
    },
    searchInput: { flex: 1, height: 44, marginLeft: 8, fontSize: 14, color: colors.textPrimary },
    scanButton: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: brandGreen,
      marginLeft: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },

    /* Summary Stat Cards */
    summaryRow: { flexDirection: 'row', gap: 10, marginBottom: spacing.md },
    summaryCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    statIconBadge: {
      width: 28,
      height: 28,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 6,
    },
    summaryLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
    summaryValue: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, marginTop: 2 },

    /* Action Buttons */
    actionRow: { flexDirection: 'row', gap: 10, marginBottom: spacing.md },
    actionButton: {
      flex: 1,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.primaryLight,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionText: { color: colors.primary, fontSize: 13, fontWeight: '700' },

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
      color: colors.textMuted,
      letterSpacing: 0.5,
      marginRight: 8,
    },
    countBadge: {
      backgroundColor: colors.border,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    catalogCount: { fontSize: 11, color: colors.textPrimary, fontWeight: '700' },

    /* Product Items */
    productList: { gap: spacing.xs },
    emptyText: { fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.md },
    productCard: {
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    productInformation: { flex: 1, marginRight: spacing.sm },
    productName: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
    detailsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    productPrice: { fontSize: 13, fontWeight: '700', color: colors.primary },
    dotSeparator: { marginHorizontal: 6, color: colors.textMuted },
    productQty: { fontSize: 12, color: colors.textMuted },
    qtyBold: { fontWeight: '800', color: colors.textPrimary },

    /* Badges */
    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    statusText: { fontSize: 11, fontWeight: '800' },
    lowBadge: { backgroundColor: 'rgba(220,38,38,0.15)' },
    lowText: { color: colors.danger },
    stockBadge: { backgroundColor: 'rgba(16,185,129,0.15)' },
    stockText: { color: '#10B981' },
    outBadge: { backgroundColor: colors.border },
    outText: { color: colors.textMuted },

    /* Floating Buttons */
    addButton: {
      position: 'absolute',
      right: 16,
      bottom: 72,
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: brandGreen,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 5,
      shadowColor: '#000',
      shadowOpacity: 0.15,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
    },

    /* Product form modal */
    formOverlay: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(17, 24, 39, 0.55)', padding: 18 },
    formScroll: { flexGrow: 1, justifyContent: 'center' },
    formCard: {
      width: '100%',
      maxWidth: 520,
      alignSelf: 'center',
      maxHeight: '90%',
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 18,
    },
    formTitle: { fontSize: 19, fontWeight: '800', color: colors.textPrimary, marginBottom: 14 },
    formField: { marginBottom: 10 },
    formLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 4 },
    formInput: {
      height: 40,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      borderRadius: 8,
      paddingHorizontal: 10,
      color: colors.textPrimary,
    },
    formError: { color: colors.danger, fontSize: 12, marginTop: 4 },
    formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 12 },
    formSecondaryButton: {
      minWidth: 94,
      paddingVertical: 11,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      alignItems: 'center',
    },
    formSecondaryText: { color: colors.textPrimary, fontWeight: '700' },
    formPrimaryButton: { minWidth: 120, paddingVertical: 11, backgroundColor: brandGreen, borderRadius: 8, alignItems: 'center' },
    formPrimaryText: { color: '#FFFFFF', fontWeight: '700' },
  });
}