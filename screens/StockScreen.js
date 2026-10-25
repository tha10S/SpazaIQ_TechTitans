import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../config/ThemeContext';
import { useProducts } from '../hooks/useProducts';
import { getAuthenticatedStoreId } from '../services/firestore/paths';
import { deleteProduct, saveNewProduct, updateProduct } from '../services/firestore/productsRepository';
import { isValidDecimalInput, isValidIsoDate } from '../services/validation';

import { KEYBOARD_BEHAVIOR } from '../components/keyboard';
const EMPTY_PRODUCT = {
  name: '',
  sku: '',
  barcode: '',
  unitPrice: '',
  costPrice: '',
  quantity: '0',
  reorderLevel: '0',
  category: 'General',
  expiryDate: '',
};

function parseIsoDate(value) {
  if (!isValidIsoDate(value)) return new Date();
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function StockScreen({ navigation, route }) {
  const { colors, spacing, radius, typography } = useTheme();
  const styles = useMemo(
    () => makeStyles(colors, typography, spacing, radius),
    [colors, typography, spacing, radius]
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [productFormVisible, setProductFormVisible] = useState(false);
  const [expiryPickerVisible, setExpiryPickerVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState(EMPTY_PRODUCT);
  const [productError, setProductError] = useState('');
  const [savingProduct, setSavingProduct] = useState(false);
  // Removing a product asks for a second tap, because Alert.alert shows nothing on web
  const [confirmRemove, setConfirmRemove] = useState(false);
  // Inline message on the page, for example when a new product was merged into an existing one
  const [notice, setNotice] = useState('');
  const storeId = route?.params?.storeId || getAuthenticatedStoreId();
  const { products, loading, error } = useProducts(storeId, searchQuery);

  const lowStockCount = products.filter((product) => product.quantity <= product.reorder_level).length;
  const totalQuantity = products.reduce((total, product) => total + product.quantity, 0);
  const expiringCount = products.filter((product) => {
    const batches = Array.isArray(product.stock_batches)
      ? product.stock_batches
      : [{ quantity: product.quantity, expiry_date: product.expiry_date || product.expiryDate }];
    return batches.some((batch) => {
      if (Number(batch.quantity) <= 0 || !batch.expiry_date || !isValidIsoDate(String(batch.expiry_date).slice(0, 10))) return false;
      const date = parseIsoDate(String(batch.expiry_date).slice(0, 10));
      const today = new Date();
      const daysUntilExpiry = (
        Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
        - Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
      ) / 86400000;
      return daysUntilExpiry >= 0 && daysUntilExpiry <= 7;
    });
  }).length;

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
      expiryDate: String(product.expiry_date || product.expiryDate || '').slice(0, 10),
    } : EMPTY_PRODUCT);
    setExpiryPickerVisible(false);
    setConfirmRemove(false);
    setNotice('');
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
        const result = await saveNewProduct(storeId, productForm);
        if (result.merged) {
          setNotice(`${result.name} is already in Stock, so ${result.added} was added to it. It now has ${result.quantity}.`);
        }
      }
      setProductFormVisible(false);
    } catch (error) {
      setProductError(error.message || 'Could not save this product.');
    } finally {
      setSavingProduct(false);
    }
  };

  const removeProduct = async () => {
    if (!editingProduct) return;
    setSavingProduct(true);
    setProductError('');
    try {
      await deleteProduct(storeId, editingProduct.id);
      setConfirmRemove(false);
      setProductFormVisible(false);
    } catch (error) {
      setProductError(error.message || 'Could not remove this product.');
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

          {notice ? (
            <TouchableOpacity
              style={styles.noticeCard}
              onPress={() => setNotice('')}
              accessibilityRole="button"
              accessibilityLabel="Dismiss message"
            >
              <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
              <Text style={styles.noticeText}>{notice}</Text>
              <Ionicons name="close" size={16} color={colors.primary} />
            </TouchableOpacity>
          ) : null}

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
              <Text style={styles.summaryLabel}>Sell By Soon</Text>
              <Text style={[styles.summaryValue, { color: '#F59E0B' }]}>{expiringCount}</Text>
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
            {loading ? <Text style={styles.emptyText}>Loading products...</Text> : error ? <Text style={styles.emptyText}>{error.message}</Text> : products.length === 0 ? <Text style={styles.emptyText}>{searchQuery ? 'No products match your search.' : 'No products yet. Tap + to add your first product.'}</Text> : products.map((product) => {
              const statusType = product.quantity === 0 ? 'out' : product.quantity <= product.reorder_level ? 'low' : 'stock';
              const status = statusType === 'out' ? 'Out of Stock' : statusType === 'low' ? 'Low Stock' : 'In Stock';
              const batchExpirySummary = (product.stock_batches || [])
                .filter((batch) => batch.quantity > 0 && batch.expiry_date)
                .map((batch) => `${batch.quantity} × ${batch.expiry_date}`)
                .join(' · ');
              return (
              <TouchableOpacity
                key={product.id}
                style={styles.productCard}
                activeOpacity={0.7}
                onPress={() => openProductForm(product)}
              >
                <View style={styles.productInformation}>
                  <View style={styles.productNameRow}>
                    {statusType === 'low' ? (
                      <Ionicons name="alert-circle-outline" size={15} color={colors.warning} />
                    ) : null}
                    <Text style={styles.productName} numberOfLines={1}>{product.name}</Text>
                  </View>
                  <View style={styles.detailsRow}>
                    <Text style={styles.productPrice}>R {product.unit_price.toFixed(2)}</Text>
                    <Text style={styles.dotSeparator}>•</Text>
                    <Text style={styles.productQty}>
                      Qty: <Text style={styles.qtyBold}>{product.quantity}</Text>
                    </Text>
                  </View>
                  {batchExpirySummary ? (
                    <Text style={styles.batchExpiryText} numberOfLines={2}>Sell-by batches: {batchExpirySummary}</Text>
                  ) : null}
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
          statusBarTranslucent
          animationType="fade"
          onRequestClose={() => setProductFormVisible(false)}
        >
          <KeyboardAvoidingView style={styles.formOverlay} behavior={KEYBOARD_BEHAVIOR}>
            <ScrollView
              contentContainerStyle={styles.formScroll}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
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
                      onChangeText={(value) => {
                        const isNumeric = ['unitPrice', 'costPrice', 'quantity', 'reorderLevel'].includes(key);
                        const validNumeric = ['quantity', 'reorderLevel'].includes(key)
                          ? /^\d*$/.test(value)
                          : isValidDecimalInput(value);
                        if (!isNumeric || validNumeric) {
                          setProductForm((current) => ({ ...current, [key]: value }));
                        }
                      }}
                      keyboardType={['unitPrice', 'costPrice', 'quantity', 'reorderLevel'].includes(key) ? 'decimal-pad' : 'default'}
                      autoCapitalize={key === 'sku' || key === 'barcode' ? 'characters' : 'sentences'}
                      placeholderTextColor={colors.textMuted}
                      editable={!savingProduct}
                    />
                  </View>
                ))}
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Sell by date (optional)</Text>
                  {Platform.OS === 'web' ? (
                    <View style={styles.expiryInputRow}>
                      {React.createElement('input', {
                        type: 'date',
                        'aria-label': 'Product sell by date',
                        value: productForm.expiryDate,
                        onChange: (event) => setProductForm((current) => ({
                          ...current,
                          expiryDate: event.target.value,
                        })),
                        disabled: savingProduct,
                        style: {
                          flex: 1,
                          minWidth: 0,
                          height: 40,
                          border: `1px solid ${colors.border}`,
                          borderRadius: 8,
                          padding: '0 10px',
                          backgroundColor: colors.background,
                          color: colors.textPrimary,
                          fontSize: 14,
                        },
                      })}
                      {productForm.expiryDate ? (
                        <TouchableOpacity
                          style={styles.clearExpiryButton}
                          onPress={() => setProductForm((current) => ({ ...current, expiryDate: '' }))}
                          disabled={savingProduct}
                          accessibilityRole="button"
                          accessibilityLabel="Clear sell by date"
                        >
                          <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  ) : (
                    <>
                      <View style={styles.expiryInputRow}>
                        <TouchableOpacity
                          style={styles.expiryDateButton}
                          onPress={() => setExpiryPickerVisible(true)}
                          disabled={savingProduct}
                          accessibilityRole="button"
                          accessibilityLabel={productForm.expiryDate
                            ? `Sell by date ${productForm.expiryDate}`
                            : 'Select sell by date'}
                        >
                          <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
                          <Text style={[
                            styles.expiryDateText,
                            !productForm.expiryDate && styles.expiryDatePlaceholder,
                          ]}>
                            {productForm.expiryDate || 'Select sell by date'}
                          </Text>
                        </TouchableOpacity>
                        {productForm.expiryDate ? (
                          <TouchableOpacity
                            style={styles.clearExpiryButton}
                            onPress={() => setProductForm((current) => ({ ...current, expiryDate: '' }))}
                            disabled={savingProduct}
                            accessibilityRole="button"
                            accessibilityLabel="Clear sell by date"
                          >
                            <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                          </TouchableOpacity>
                        ) : null}
                      </View>
                      {expiryPickerVisible ? (
                        <DateTimePicker
                          value={parseIsoDate(productForm.expiryDate)}
                          mode="date"
                          display={Platform.OS === 'ios' ? 'compact' : 'default'}
                          onChange={(event, date) => {
                            if (Platform.OS !== 'ios' || event.type === 'dismissed') {
                              setExpiryPickerVisible(false);
                            }
                            if (date) {
                              setProductForm((current) => ({
                                ...current,
                                expiryDate: formatIsoDate(date),
                              }));
                            }
                          }}
                        />
                      ) : null}
                    </>
                  )}
                </View>
                {editingProduct?.stock_batches?.length > 1 ? (
                  <Text style={styles.batchExpiryText}>
                    Separate sell-by batches are tracked. With no quantity change, this date edits the earliest batch or batches; record supplier deliveries in Suppliers to add another dated batch.
                  </Text>
                ) : null}
                {productError ? <Text style={styles.formError}>{productError}</Text> : null}

                {editingProduct ? (
                  confirmRemove ? (
                    <View style={styles.removeConfirmBox}>
                      <Text style={styles.removeConfirmText}>
                        Remove {editingProduct.name} from Stock? This cannot be undone.
                      </Text>
                      <View style={styles.removeConfirmActions}>
                        <TouchableOpacity
                          style={styles.formSecondaryButton}
                          onPress={() => setConfirmRemove(false)}
                          disabled={savingProduct}
                        >
                          <Text style={styles.formSecondaryText}>Keep</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.removeConfirmButton}
                          onPress={removeProduct}
                          disabled={savingProduct}
                          accessibilityRole="button"
                        >
                          <Text style={styles.removeConfirmButtonText}>{savingProduct ? 'Removing...' : 'Yes, remove'}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => setConfirmRemove(true)}
                      disabled={savingProduct}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${editingProduct.name} from Stock`}
                    >
                      <Ionicons name="trash-outline" size={16} color={colors.danger} />
                      <Text style={styles.removeButtonText}>Remove Product</Text>
                    </TouchableOpacity>
                  )
                ) : null}

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
          </KeyboardAvoidingView>
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

    /* Inline message */
    noticeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.primaryLight,
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: spacing.md,
    },
    noticeText: { flex: 1, color: colors.primary, fontSize: 13, fontWeight: '600', lineHeight: 18 },

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
    productNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    productName: { flexShrink: 1, fontSize: 14, fontWeight: '700', color: colors.textPrimary },
    detailsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    batchExpiryText: { color: colors.textMuted, fontSize: 11, marginTop: 4 },
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
    formScroll: { flexGrow: 1, justifyContent: 'center', paddingVertical: 12 },
    formCard: {
      width: '100%',
      maxWidth: 520,
      alignSelf: 'center',
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
    expiryInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    expiryDateButton: {
      flex: 1,
      minHeight: 40,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      borderRadius: 8,
      paddingHorizontal: 10,
    },
    expiryDateText: { color: colors.textPrimary, fontSize: 14 },
    expiryDatePlaceholder: { color: colors.textMuted },
    clearExpiryButton: { padding: 8 },
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

    /* Remove product */
    removeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: 14,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: colors.danger,
      borderRadius: 8,
    },
    removeButtonText: { color: colors.danger, fontWeight: '700', fontSize: 13 },
    removeConfirmBox: {
      marginTop: 14,
      padding: 12,
      borderWidth: 1,
      borderColor: 'rgba(220, 38, 38, 0.4)',
      backgroundColor: 'rgba(220, 38, 38, 0.1)',
      borderRadius: 8,
    },
    removeConfirmText: { color: colors.danger, fontSize: 13, fontWeight: '600', lineHeight: 18 },
    removeConfirmActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 },
    removeConfirmButton: {
      minWidth: 120,
      paddingVertical: 11,
      backgroundColor: colors.danger,
      borderRadius: 8,
      alignItems: 'center',
    },
    removeConfirmButtonText: { color: '#FFFFFF', fontWeight: '700' },
  });
}