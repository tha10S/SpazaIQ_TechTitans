import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCart } from '../hooks/useCart';
import { fetchProducts } from '../services/salesService';

const PAYMENT_METHODS = [
  { id: 'Cash', label: 'Cash', icon: 'cash-outline' },
  { id: 'Card', label: 'Card', icon: 'card-outline' },
  { id: 'Credit', label: 'Credit', icon: 'wallet-outline' },
];

const formatR = (n) => `R ${Number(n || 0).toFixed(2)}`;

export default function NewSaleScreen({ storeId }) {
  const {
    search,
    setSearch,
    products,
    cart,
    addToCart,
    updateQty,
    subtotal,
    loading,
    submitting,
    completeSale,
  } = useCart(storeId);

  const [payment, setPayment] = useState('Cash');
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scanError, setScanError] = useState('');

  const totalItemsCount = cart.reduce((sum, item) => sum + item.qty, 0);

  const handleBarcodeScanned = async (value) => {
    setScannerVisible(false);
    setScanError('');

    let productCode = value.trim();
    try {
      const payload = JSON.parse(productCode);
      productCode = payload.productId || payload.product_id || payload.sku || payload.barcode || payload.id;
    } catch (err) {}

    if (!productCode) {
      setScanError('Invalid QR code format.');
      return;
    }

    try {
      const allProducts = await fetchProducts(storeId);
      const product = allProducts.find((item) =>
        [item.id, item.sku, item.barcode, item.product_code]
          .filter(Boolean)
          .some((identifier) => String(identifier).toLowerCase() === String(productCode).toLowerCase())
      );

      if (!product) {
        setScanError(`No product matches code "${productCode}".`);
        return;
      }

      addToCart(product);
    } catch (err) {
      setScanError(err.message || 'Lookup failed.');
    }
  };

  const handleCompleteSale = async () => {
    if (cart.length === 0) {
      Alert.alert('Cart Empty', 'Add at least one item to proceed.');
      return;
    }
    try {
      await completeSale(payment.toLowerCase());
      Alert.alert('Success', `Sale of ${formatR(subtotal)} completed.`);
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>New Sale</Text>
            <Text style={styles.subtitle}>Checkout & Point of Sale</Text>
          </View>
          <View style={styles.badgeContainer}>
            <Ionicons name="cart-outline" size={15} color={COLORS.primary} />
            <Text style={styles.badgeText}>{totalItemsCount} {totalItemsCount === 1 ? 'item' : 'items'}</Text>
          </View>
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchInputWrap}>
            <Ionicons name="search-outline" size={18} color={COLORS.textMuted} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search products or SKU..."
              placeholderTextColor={COLORS.textMuted}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={styles.scanButton}
            activeOpacity={0.8}
            onPress={() => {
              setScanError('');
              setScannerVisible(true);
            }}
          >
            <Ionicons name="qr-code-outline" size={20} color="#FFFFFF" />
            <Text style={styles.scanButtonText}>Scan</Text>
          </TouchableOpacity>
        </View>

        {!!scanError && (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle" size={16} color={COLORS.danger} />
            <Text style={styles.scanErrorText}>{scanError}</Text>
            <TouchableOpacity onPress={() => setScanError('')}>
              <Ionicons name="close" size={16} color={COLORS.danger} />
            </TouchableOpacity>
          </View>
        )}

        {search.length > 0 && (
          <View style={styles.resultsCard}>
            {loading ? (
              <ActivityIndicator style={{ padding: 16 }} color={COLORS.primary} />
            ) : products.length === 0 ? (
              <Text style={styles.emptyResultsText}>No products matched search.</Text>
            ) : (
              products.map((product) => (
                <TouchableOpacity
                  key={product.id}
                  style={styles.resultRow}
                  activeOpacity={0.7}
                  onPress={() => {
                    addToCart(product);
                    setSearch('');
                  }}
                >
                  <View style={styles.resultInfo}>
                    <Text style={styles.resultName}>{product.name}</Text>
                    {!!product.sku && <Text style={styles.resultSku}>SKU: {product.sku}</Text>}
                  </View>
                  <Text style={styles.resultPrice}>{formatR(product.unit_price)}</Text>
                  <Ionicons name="add-circle" size={22} color={COLORS.primary} style={styles.addIcon} />
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        <Text style={styles.sectionTitle}>ITEMS IN CART</Text>
        <View style={styles.cartCard}>
          {cart.length === 0 ? (
            <View style={styles.emptyCartContainer}>
              <Ionicons name="basket-outline" size={36} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>Cart is currently empty</Text>
              <Text style={styles.emptySubtext}>Scan barcode or search items above</Text>
            </View>
          ) : (
            cart.map((item, index) => (
              <View
                key={item.id}
                style={[styles.cartRow, index !== cart.length - 1 && styles.cartRowDivider]}
              >
                <View style={styles.cartItemDetails}>
                  <Text style={styles.cartItemName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.cartItemUnitPrice}>{formatR(item.unitPrice)} / unit</Text>
                </View>

                <View style={styles.qtyContainer}>
                  <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(item.id, -1)}>
                    <Ionicons name="remove" size={14} color={COLORS.textDark} />
                  </TouchableOpacity>
                  <Text style={styles.qtyText}>{item.qty}</Text>
                  <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(item.id, 1)}>
                    <Ionicons name="add" size={14} color={COLORS.textDark} />
                  </TouchableOpacity>
                </View>

                <View style={styles.cartItemTotalWrap}>
                  <Text style={styles.cartItemTotalText}>{formatR(item.unitPrice * item.qty)}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        <Text style={styles.sectionTitle}>SUMMARY</Text>
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summarySubtotalValue}>{formatR(subtotal)}</Text>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryRow}>
            <View style={styles.summaryTotalLabelGroup}>
              <Text style={styles.summaryTotalLabel}>Total Amount</Text>
              <Text style={styles.taxInclusiveText}>Tax included</Text>
            </View>
            <Text style={styles.summaryTotalValue}>{formatR(subtotal)}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>PAYMENT METHOD</Text>
        <View style={styles.paymentGrid}>
          {PAYMENT_METHODS.map((method) => {
            const isSelected = payment === method.id;
            return (
              <TouchableOpacity
                key={method.id}
                style={[styles.paymentCard, isSelected && styles.paymentCardSelected]}
                onPress={() => setPayment(method.id)}
                activeOpacity={0.85}
              >
                <Ionicons
                  name={method.icon}
                  size={18}
                  color={isSelected ? COLORS.primary : COLORS.textMuted}
                />
                <Text style={[styles.paymentCardLabel, isSelected && styles.paymentCardLabelSelected]}>
                  {method.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.completeCta, cart.length === 0 && styles.disabledCta]}
          onPress={handleCompleteSale}
          activeOpacity={0.88}
          disabled={submitting || cart.length === 0}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <View style={styles.ctaContent}>
              <View style={styles.ctaLeft}>
                <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                <Text style={styles.ctaText}>Complete Sale</Text>
              </View>
              <View style={styles.ctaBadge}>
                <Text style={styles.ctaBadgeText}>{formatR(subtotal)}</Text>
              </View>
            </View>
          )}
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={scannerVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setScannerVisible(false)}
      >
        <SafeAreaView style={styles.scannerModalContainer}>
          <View style={styles.scannerHeader}>
            <Text style={styles.scannerHeaderTitle}>Scan Barcode / QR</Text>
            <TouchableOpacity
              style={styles.scannerCloseBtn}
              onPress={() => setScannerVisible(false)}
            >
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.scannerViewport}>
            <View style={styles.scannerOverlay}>
              <View style={styles.scannerFinder}>
                <View style={[styles.corner, styles.topLeft]} />
                <View style={[styles.corner, styles.topRight]} />
                <View style={[styles.corner, styles.bottomLeft]} />
                <View style={[styles.corner, styles.bottomRight]} />
              </View>
            </View>
          </View>

          <View style={styles.scannerFooter}>
            <Ionicons name="information-circle-outline" size={18} color="#94A3B8" />
            <Text style={styles.scannerFooterText}>Position the barcode within the frame to scan</Text>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const COLORS = {
  primary: '#004B49',
  primaryBg: '#E6F4F1',
  bg: '#F9FAFB',
  cardBg: '#FFFFFF',
  textDark: '#111827',
  textMuted: '#6B7280',
  border: '#E5E7EB',
  danger: '#DC2626',
  dangerBg: '#FEE2E2',
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  container: {
    padding: 16,
    paddingBottom: 32,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textDark,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryBg,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
    marginLeft: 5,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textDark,
  },
  scanButton: {
    height: 46,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  scanButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.dangerBg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    gap: 8,
  },
  scanErrorText: {
    color: COLORS.danger,
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  resultsCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  resultInfo: {
    flex: 1,
  },
  resultName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textDark,
  },
  resultSku: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  resultPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textDark,
    marginRight: 8,
  },
  addIcon: {
    marginLeft: 4,
  },
  emptyResultsText: {
    padding: 16,
    textAlign: 'center',
    fontSize: 13,
    color: COLORS.textMuted,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 6,
  },
  cartCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 14,
    paddingHorizontal: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyCartContainer: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textDark,
    marginTop: 8,
  },
  emptySubtext: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  cartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  cartRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  cartItemDetails: {
    flex: 1,
    paddingRight: 8,
  },
  cartItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textDark,
  },
  cartItemUnitPrice: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  qtyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    borderRadius: 8,
    padding: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 12,
  },
  qtyBtn: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: COLORS.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    width: 28,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  cartItemTotalWrap: {
    minWidth: 65,
    alignItems: 'flex-end',
  },
  cartItemTotalText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  summaryCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textMuted,
    flex: 1,
    marginRight: 16,
  },
  summarySubtotalValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textDark,
    textAlign: 'right',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 12,
  },
  summaryTotalLabelGroup: {
    flex: 1,
    marginRight: 16,
  },
  summaryTotalLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  taxInclusiveText: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  summaryTotalValue: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.primary,
    textAlign: 'right',
  },
  paymentGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  paymentCard: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.cardBg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  paymentCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryBg,
  },
  paymentCardLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  paymentCardLabelSelected: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  completeCta: {
    height: 52,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 5 },
      android: { elevation: 3 },
    }),
  },
  disabledCta: {
    backgroundColor: '#94A3B8',
    elevation: 0,
    shadowOpacity: 0,
  },
  ctaContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ctaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ctaText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  ctaBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  ctaBadgeText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  scannerModalContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  scannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  scannerHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  scannerCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannerViewport: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerOverlay: {
    width: 240,
    height: 240,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerFinder: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: COLORS.primary,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  scannerFooter: {
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  scannerFooterText: {
    fontSize: 13,
    color: '#94A3B8',
  },
});