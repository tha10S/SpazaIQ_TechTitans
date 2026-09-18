import React, { useState } from 'react';
import {View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCart } from '../hooks/useCart';
import { fetchProducts } from '../services/salesService';
import QRScannerScreen from './QRScannerScreen';

const PAYMENT_METHODS = ['Cash', 'Card', "Credit"];
const formatR = (n) => `R${Number(n).toFixed(2).replace(/\.00$/, '')}`;

// storeId would normally come from auth context / a store-selection screen
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

  const handleBarcodeScanned = async (value) => {
    setScannerVisible(false);
    setScanError('');

    let productCode = value.trim();
    try {
      const payload = JSON.parse(productCode);
      productCode = payload.productId || payload.product_id || payload.sku || payload.barcode || payload.id;
    } catch (err) {
      // Plain text QR values are supported too, for example: p1.
    }

    if (!productCode) {
      setScanError('This QR code does not contain a product identifier.');
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
        setScanError(`No product matches QR value "${productCode}".`);
        return;
      }

      addToCart(product);
    } catch (err) {
      setScanError(err.message || 'Could not look up the scanned product.');
    }
  };

  const handleCompleteSale = async () => {
    if (cart.length === 0) {
      Alert.alert('Cart is empty', 'Add at least one item before completing the sale.');
      return;
    }
    try {
      await completeSale(payment.toLowerCase());
      Alert.alert('Sale complete', `${formatR(subtotal)} recorded.`);
    } catch (err) {
      Alert.alert('Could not complete sale', err.message);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>New Sale (POS)</Text>

        <View style={styles.searchRow}>
          <View style={styles.searchInputWrap}>
            <Ionicons name="search" size={18} color="#9CA3AF" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search or scan product..."
              placeholderTextColor="#9CA3AF"
              value={search}
              onChangeText={setSearch}
            />
          </View>
          <TouchableOpacity
            style={styles.scanButton}
            activeOpacity={0.8}
            onPress={() => {
              setScanError('');
              setScannerVisible(true);
            }}
          >
            <Ionicons name="scan-outline" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {!!scanError && <Text style={styles.scanError}>{scanError}</Text>}

        {/* Search results — tap to add to cart */}
        {search.length > 0 && (
          <View style={styles.resultsCard}>
            {loading ? (
              <ActivityIndicator style={{ padding: 16 }} color="#0F9D58" />
            ) : products.length === 0 ? (
              <Text style={styles.emptyText}>No products found.</Text>
            ) : (
              products.map((product) => (
                <TouchableOpacity
                  key={product.id}
                  style={styles.resultRow}
                  onPress={() => addToCart(product)}
                >
                  <Text style={styles.resultName}>{product.name}</Text>
                  <Text style={styles.resultPrice}>{formatR(product.unit_price)}</Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        <Text style={styles.sectionLabel}>SHOPPING CART</Text>

        <View style={styles.cartCard}>
          {cart.length === 0 && (
            <Text style={styles.emptyText}>Search above to add items.</Text>
          )}
          {cart.map((item, index) => (
            <View
              key={item.id}
              style={[styles.cartRow, index !== cart.length - 1 && styles.cartRowDivider]}
            >
              <View style={styles.cartItemInfo}>
                <Text style={styles.cartItemName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.cartItemUnit}>{formatR(item.unitPrice)} each</Text>
              </View>

              <View style={styles.qtyControl}>
                <TouchableOpacity style={styles.qtyButton} onPress={() => updateQty(item.id, -1)}>
                  <Ionicons name="remove" size={16} color="#374151" />
                </TouchableOpacity>
                <Text style={styles.qtyText}>{item.qty}</Text>
                <TouchableOpacity style={styles.qtyButton} onPress={() => updateQty(item.id, 1)}>
                  <Ionicons name="add" size={16} color="#374151" />
                </TouchableOpacity>
              </View>

              <Text style={styles.cartItemTotal}>{formatR(item.unitPrice * item.qty)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totalsCard}>
          <View style={styles.totalsRow}>
            <Text style={styles.subtotalLabel}>Subtotal</Text>
            <Text style={styles.subtotalValue}>{formatR(subtotal)}</Text>
          </View>
          <View style={styles.totalsDivider} />
          <View style={styles.totalsRow}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalValue}>{formatR(subtotal)}</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>PAYMENT METHOD</Text>
        <View style={styles.paymentRow}>
          {PAYMENT_METHODS.map((method) => {
            const selected = payment === method;
            return (
              <TouchableOpacity
                key={method}
                style={[styles.paymentButton, selected && styles.paymentButtonSelected]}
                onPress={() => setPayment(method)}
                activeOpacity={0.85}
              >
                <Text style={[styles.paymentButtonText, selected && styles.paymentButtonTextSelected]}>
                  {method}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={styles.completeButton}
          onPress={handleCompleteSale}
          activeOpacity={0.9}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.completeButtonText}>Complete Sale ({formatR(subtotal)})</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {scannerVisible && (
        <QRScannerScreen
          onClose={() => setScannerVisible(false)}
          onScanned={handleBarcodeScanned}
        />
      )}
    </SafeAreaView>
  );
}

const GREEN = '#0F9D58';

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F3F4F6' },
  container: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '700', color: '#111827', marginBottom: 16 },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    marginRight: 10,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, color: '#111827' },
  scanButton: { width: 48, height: 48, borderRadius: 12, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center' },
  scanError: { color: '#B42318', fontSize: 13, marginBottom: 12 },
  resultsCard: { backgroundColor: '#FFFFFF', borderRadius: 12, marginBottom: 16, overflow: 'hidden' },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 14, borderBottomWidth: 1, borderBottomColor: '#F1F2F4' },
  resultName: { fontSize: 14, color: '#111827', flex: 1, marginRight: 8 },
  resultPrice: { fontSize: 14, fontWeight: '600', color: '#111827' },
  emptyText: { fontSize: 13, color: '#9CA3AF', padding: 16, textAlign: 'center' },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#6B7280', letterSpacing: 0.5, marginBottom: 10 },
  cartCard: { backgroundColor: '#FFFFFF', borderRadius: 14, marginBottom: 16, paddingHorizontal: 16 },
  cartRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16 },
  cartRowDivider: { borderBottomWidth: 1, borderBottomColor: '#F1F2F4' },
  cartItemInfo: { flex: 1.4, marginRight: 8 },
  cartItemName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  cartItemUnit: { fontSize: 13, color: '#9CA3AF', marginTop: 2 },
  qtyControl: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, marginRight: 12 },
  qtyButton: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  qtyText: { minWidth: 20, textAlign: 'center', fontSize: 15, fontWeight: '600', color: '#111827' },
  cartItemTotal: { fontSize: 15, fontWeight: '700', color: '#111827', minWidth: 44, textAlign: 'right' },
  totalsCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 18, marginBottom: 20 },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subtotalLabel: { fontSize: 14, color: '#9CA3AF' },
  subtotalValue: { fontSize: 14, color: '#374151', fontWeight: '600' },
  totalsDivider: { height: 1, backgroundColor: '#F1F2F4', marginVertical: 12 },
  totalLabel: { fontSize: 17, fontWeight: '700', color: '#111827' },
  totalValue: { fontSize: 22, fontWeight: '800', color: GREEN },
  paymentRow: { flexDirection: 'row', marginBottom: 20 },
  paymentButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  paymentButtonSelected: { backgroundColor: GREEN, borderColor: GREEN },
  paymentButtonText: { fontSize: 15, fontWeight: '600', color: '#374151' },
  paymentButtonTextSelected: { color: '#FFFFFF' },
  completeButton: { height: 56, borderRadius: 14, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center' },
  completeButtonText: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
});