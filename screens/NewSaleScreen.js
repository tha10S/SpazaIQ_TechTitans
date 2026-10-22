import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNetworkState } from 'expo-network';
import QRScannerScreen from './QRScannerScreen';
import { useTheme } from '../config/ThemeContext';
import { useCart } from '../hooks/useCart';
import { fetchProducts } from '../services/salesService';
import { getAuthenticatedStoreId } from '../services/firestore/paths';
import { subscribeCustomers } from '../services/firestore/customersRepository';
import { OfflineSyncNotice } from '../components/OfflineSyncNotice';
import { isValidDecimalInput, parseNonNegativeNumber } from '../services/validation';

const PAYMENT_METHODS = [
  { id: 'Cash', label: 'Cash', icon: 'cash-outline' },
  { id: 'Card', label: 'Card', icon: 'card-outline' },
  { id: 'Credit', label: 'Credit', icon: 'wallet-outline' },
  { id: 'Split', label: 'Split', icon: 'git-compare-outline' },
];

const SPLIT_METHODS = PAYMENT_METHODS.filter((method) => method.id !== 'Split');
const SPLIT_ORDER = SPLIT_METHODS.map((method) => method.id);

const BRAND_GREEN = '#004B49'; // solid buttons keep brand green in both themes

const formatR = (n) => `R ${Number(n || 0).toFixed(2)}`;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Compares a scanned code with a stored product code. Ignores upper/lower case, and for all-digit
// codes ignores leading zeros, because some phones drop the first zero of a barcode when scanning.
const sameCode = (stored, scanned) => {
  const left = String(stored).trim().toLowerCase();
  const right = String(scanned).trim().toLowerCase();
  if (left === right) return true;
  return /^\d+$/.test(left) && /^\d+$/.test(right) && left.replace(/^0+/, '') === right.replace(/^0+/, '');
};

export default function NewSaleScreen({ route, navigation }) {
  const { colors } = useTheme();

  // Same names as the old static COLORS object, now driven by the theme
  const COLORS = useMemo(
    () => ({
      primary: colors.primary,
      primaryBg: colors.primaryLight,
      bg: colors.background,
      cardBg: colors.card,
      textDark: colors.textPrimary,
      textMuted: colors.textMuted,
      border: colors.border,
      danger: colors.danger,
      dangerBg: 'rgba(220, 38, 38, 0.15)',
      dangerBorder: 'rgba(220, 38, 38, 0.4)',
    }),
    [colors]
  );
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

  const storeId = route?.params?.storeId || getAuthenticatedStoreId();
  const {
    search,
    setSearch,
    products,
    cart,
    addToCart,
    updateQty,
    subtotal,
    loading,
    error,
    submitting,
    completeSale,
  } = useCart(storeId);

  const networkState = useNetworkState();
  const isOffline = networkState.isConnected === false || networkState.isInternetReachable === false;

  const [payment, setPayment] = useState('Cash');
  const [customers, setCustomers] = useState([]);
  const [splitMethods, setSplitMethods] = useState(['Cash', 'Credit']);
  const [splitPaidAmount, setSplitPaidAmount] = useState('');
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scanError, setScanError] = useState('');
  // { type: 'success' | 'error', text }. Shown inline because Alert.alert shows nothing on web.
  const [notice, setNotice] = useState(null);
  // null | { phase: 'processing' | 'approved' | 'failed', total, message, note }
  const [cardState, setCardState] = useState(null);

  useEffect(() => {
    return subscribeCustomers(storeId, setCustomers, (error) => setScanError(error.message));
  }, [storeId]);

  // Success messages clear themselves after a few seconds
  useEffect(() => {
    if (notice?.type !== 'success') return undefined;
    const timer = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  const totalItemsCount = cart.reduce((sum, item) => sum + item.qty, 0);

  // Split: exactly two of Cash, Card and Credit, always kept in that order.
  // The amount typed is for the first method; the second method gets whatever is left.
  const isSplit = payment === 'Split';
  const splitPair = SPLIT_ORDER.filter((id) => splitMethods.includes(id));
  const firstMethod = splitPair[0];
  const secondMethod = splitPair[1];
  const firstAmount = Number(splitPaidAmount || 0);
  const secondAmount = Math.max(0, subtotal - firstAmount);
  const splitHasCard = isSplit && splitPair.includes('Card');
  const splitHasCredit = isSplit && splitPair.includes('Credit');
  // A split needs exactly two methods chosen before amounts make sense
  const splitReady = isSplit && splitPair.length === 2;

  const creditAmount = payment === 'Credit'
    ? subtotal
    : splitHasCredit
      ? secondAmount
      : 0;
  const cardAmount = payment === 'Card'
    ? subtotal
    : splitHasCard
      ? (firstMethod === 'Card' ? firstAmount : secondAmount)
      : 0;
  const cashAmount = payment === 'Cash'
    ? subtotal
    : isSplit && splitPair.includes('Cash')
      ? firstAmount
      : 0;
  const paidAmount = subtotal - creditAmount;

  const amountByMethod = { Cash: cashAmount, Card: cardAmount, Credit: creditAmount };

  const toggleSplitMethod = (id) => {
    setSplitMethods((current) => {
      if (current.includes(id)) return current.filter((method) => method !== id); // tap again to un-select
      if (current.length >= 2) return current; // two already chosen, the others are greyed out
      return [...current, id];
    });
    setSplitPaidAmount('');
  };

  const handleBarcodeScanned = async (value) => {
    setScannerVisible(false);
    setScanError('');

    let productCode = String(value ?? '').trim();
    try {
      const payload = JSON.parse(productCode);
      // A plain number such as 6009218004040 is valid JSON too, so only unwrap real JSON objects
      // (QR codes that carry a product payload). Plain barcodes stay exactly as scanned.
      if (payload && typeof payload === 'object') {
        productCode = String(
          payload.productId || payload.product_id || payload.sku || payload.barcode || payload.id || ''
        ).trim();
      }
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
          .some((identifier) => sameCode(identifier, productCode))
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

  // Home's scan button sends the scanned code here
  const scannedCode = route?.params?.scannedCode;
  useEffect(() => {
    if (!scannedCode) return;
    navigation?.setParams({ scannedCode: undefined });
    handleBarcodeScanned(String(scannedCode));
  }, [scannedCode]);

  const openCreditLedger = () => {
    navigation.navigate('Credit', {
      saleDraft: {
        creditAmount,
        total: subtotal,
        itemCount: totalItemsCount,
        paymentMethod: payment,
        paidAmount,
      },
    });
  };

  // Simulated card payment for a sale with no credit part: processing, then approved, then the sale is
  // recorded as fully paid. The sale is saved while the "processing" screen shows, so a stock problem is
  // reported as a failed payment. For a split, the card amount is charged and the rest was paid in cash.
  const payByCard = async () => {
    const total = subtotal;
    const charged = cardAmount;
    const cashPart = cashAmount;
    const wasSplit = isSplit;
    setCardState({ phase: 'processing', total: charged, note: 'Recording your sale.' });
    try {
      const [result] = await Promise.all([
        completeSale({ paymentMethod: wasSplit ? 'split' : 'card', paidAmount: total, creditAmount: 0 }),
        wait(2200),
      ]);
      setCardState({ phase: 'approved', total: charged, note: 'Recording your sale.' });
      await wait(1300);
      setCardState(null);
      setSplitPaidAmount('');
      const detail = wasSplit
        ? `Split sale of ${formatR(total)} recorded. Cash ${formatR(cashPart)} and card ${formatR(charged)} received.`
        : `Card payment of ${formatR(total)} approved. Sale recorded.`;
      setNotice({
        type: 'success',
        text: result?.pendingSync
          ? `${wasSplit ? 'Split' : 'Card'} sale of ${formatR(total)} saved on this device. It will sync when you're back online.`
          : detail,
      });
    } catch (err) {
      setCardState({ phase: 'failed', total: charged, message: err.message || 'The payment could not be completed.' });
    }
  };

  // Card plus credit: charge the card part first, then open the credit ledger for the remainder.
  // The sale itself is recorded once the customer and repayment plan are chosen.
  const chargeCardThenOpenCredit = async () => {
    const charged = cardAmount;
    setCardState({ phase: 'processing', total: charged, note: 'Opening the credit ledger for the remainder.' });
    await wait(2200);
    setCardState({ phase: 'approved', total: charged, note: 'Opening the credit ledger for the remainder.' });
    await wait(1300);
    setCardState(null);
    openCreditLedger();
  };

  // The Credit screen hands back the customer and repayment plan, then the sale is recorded here
  // in one go: sale, stock, credit ledger and repayment schedule.
  const finishCreditSale = async ({ customerId, dueDate, schedule }) => {
    const total = subtotal;
    const customer = customers.find((item) => item.id === customerId);
    const paidParts = [];
    if (isSplit && cardAmount > 0) paidParts.push(`${formatR(cardAmount)} paid by card`);
    if (isSplit && cashAmount > 0) paidParts.push(`${formatR(cashAmount)} paid in cash`);
    const paidText = paidParts.length ? ` ${paidParts.join(', ')}.` : '';
    try {
      const result = await completeSale({
        paymentMethod: payment.toLowerCase(),
        paidAmount,
        creditAmount,
        customerId,
        dueDate,
        schedule,
      });
      setSplitPaidAmount('');
      setNotice({
        type: 'success',
        text: result?.pendingSync
          ? `Credit sale of ${formatR(total)} saved on this device. It will sync when you're back online.`
          : `Sale of ${formatR(total)} recorded.${paidText} ${formatR(creditAmount)} is on credit${customer ? ` for ${customer.name}` : ''}.`,
      });
    } catch (err) {
      setNotice({ type: 'error', text: err.message || 'The credit sale could not be recorded.' });
    }
  };

  const creditSelection = route?.params?.creditSelection;
  useEffect(() => {
    if (!creditSelection) return;
    navigation?.setParams({ creditSelection: undefined });
    if (cart.length === 0) {
      setNotice({ type: 'error', text: 'The cart is empty, so there is no credit sale to record.' });
      return;
    }
    finishCreditSale(creditSelection);
  }, [creditSelection]);

  const handleCompleteSale = async () => {
    setNotice(null);
    if (cart.length === 0) {
      setNotice({ type: 'error', text: 'Add at least one item to the cart first.' });
      return;
    }
    if (isSplit && !splitReady) {
      setNotice({ type: 'error', text: 'Pick two payment methods for the split first.' });
      return;
    }
    if (isSplit) {
      try {
        parseNonNegativeNumber(splitPaidAmount, 'paid amount');
      } catch (error) {
        setNotice({ type: 'error', text: 'Enter a valid split amount with no more than 2 decimal places.' });
        return;
      }
      if (!(firstAmount > 0 && firstAmount < subtotal)) {
        setNotice({
          type: 'error',
          text: `For a split payment, enter an amount for ${firstMethod.toLowerCase()} that is more than R 0.00 and less than the total.`,
        });
        return;
      }
    }

    if (cardAmount > 0 && isOffline) {
      setNotice({ type: 'error', text: 'Card payments need an internet connection. Use cash or credit instead.' });
      return;
    }

    if (cardAmount > 0 && creditAmount > 0) {
      chargeCardThenOpenCredit();
      return;
    }

    if (cardAmount > 0) {
      payByCard();
      return;
    }

    if (creditAmount > 0) {
      // Credit and cash-plus-credit sales are finished on the Credit screen, where the customer and plan are chosen
      openCreditLedger();
      return;
    }

    const total = subtotal;
    try {
      const result = await completeSale({ paymentMethod: 'cash', paidAmount: total, creditAmount: 0 });
      setNotice({
        type: 'success',
        text: result?.pendingSync
          ? `Sale of ${formatR(total)} saved on this device. It will sync when you're back online.`
          : `Sale of ${formatR(total)} recorded.`,
      });
    } catch (err) {
      setNotice({ type: 'error', text: err.message || 'The sale could not be recorded.' });
    }
  };

  const goesToCredit = creditAmount > 0 || payment === 'Credit';
  const ctaLabel = payment === 'Card'
    ? 'Pay by Card'
    : goesToCredit
      ? 'Continue to Credit'
      : isSplit
        ? 'Complete Split Sale'
        : 'Complete Sale';
  const ctaIcon = goesToCredit ? 'arrow-forward-circle' : 'checkmark-circle';

  const splitHint = (() => {
    if (!isSplit) return '';
    if (splitHasCredit && splitHasCard) {
      return 'The card amount counts as paid. The remainder opens the Credit ledger, where you pick the customer and repayment plan.';
    }
    if (splitHasCredit) {
      return 'The cash amount counts as paid. The remainder opens the Credit ledger, where you pick the customer and repayment plan.';
    }
    return 'Both amounts are received now, so the full total counts as paid.';
  })();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <OfflineSyncNotice storeId={storeId} />
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

        {notice && (
          <View style={[styles.noticeCard, notice.type === 'error' ? styles.noticeError : styles.noticeSuccess]}>
            <Ionicons
              name={notice.type === 'error' ? 'alert-circle' : 'checkmark-circle'}
              size={18}
              color={notice.type === 'error' ? COLORS.danger : COLORS.primary}
            />
            <Text style={[styles.noticeText, { color: notice.type === 'error' ? COLORS.danger : COLORS.primary }]}>
              {notice.text}
            </Text>
            <TouchableOpacity onPress={() => setNotice(null)} accessibilityLabel="Dismiss message">
              <Ionicons name="close" size={16} color={notice.type === 'error' ? COLORS.danger : COLORS.primary} />
            </TouchableOpacity>
          </View>
        )}

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

        {!!error && (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle" size={16} color={COLORS.danger} />
            <Text style={styles.scanErrorText}>
              {error.code === 'permission-denied'
                ? 'Firestore denied access to products. Deploy firestore.rules and sign in again.'
                : error.message || 'Products could not be loaded.'}
            </Text>
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

        {payment === 'Card' && (
          <View style={styles.infoCard}>
            <Ionicons name="information-circle-outline" size={18} color={COLORS.primary} />
            <Text style={styles.infoText}>
              {isOffline
                ? 'Card payments need an internet connection. Use cash or credit while offline.'
                : 'Card payments are simulated. No real card is charged.'}
            </Text>
          </View>
        )}

        {payment === 'Credit' && (
          <View style={styles.creditOptionsCard}>
            <View style={styles.infoRow}>
              <Ionicons name="wallet-outline" size={18} color={COLORS.primary} />
              <Text style={styles.infoText}>
                {formatR(creditAmount)} goes on credit. You'll choose the customer and repayment plan on the Credit screen.
              </Text>
            </View>
          </View>
        )}

        {isSplit && (
          <View style={styles.creditOptionsCard}>
            <View style={styles.splitHeaderRow}>
              <Text style={styles.creditOptionsLabel}>SPLIT BETWEEN (PICK TWO)</Text>
              <Text style={styles.splitCounter}>{splitMethods.length} of 2 chosen</Text>
            </View>
            <View style={styles.splitChipRow}>
              {SPLIT_METHODS.map((method) => {
                const selected = splitMethods.includes(method.id);
                // Once two are chosen, the third is greyed out. Tap a chosen one to un-select it and swap.
                const unavailable = !selected && splitMethods.length >= 2;
                return (
                  <TouchableOpacity
                    key={method.id}
                    style={[
                      styles.splitChip,
                      selected && styles.splitChipSelected,
                      unavailable && styles.splitChipDisabled,
                    ]}
                    onPress={() => toggleSplitMethod(method.id)}
                    disabled={unavailable}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityState={{ selected, disabled: unavailable }}
                  >
                    <Ionicons
                      name={selected ? 'checkmark-circle' : method.icon}
                      size={16}
                      color={selected ? COLORS.primary : COLORS.textMuted}
                    />
                    <Text style={[styles.splitChipText, selected && styles.splitChipTextSelected]}>
                      {method.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {!splitReady ? (
              <View style={styles.infoRow}>
                <Ionicons name="information-circle-outline" size={18} color={COLORS.primary} />
                <Text style={styles.infoText}>
                  Pick two payment methods. Once two are chosen the third is greyed out. Tap a chosen one again to swap it.
                </Text>
              </View>
            ) : (
              <>
                <Text style={styles.creditOptionsLabel}>{`${firstMethod.toUpperCase()} AMOUNT (R)`}</Text>
                <TextInput
                  style={styles.creditTextInput}
                  placeholder="0.00"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="decimal-pad"
                  value={splitPaidAmount}
                  onChangeText={(value) => {
                    if (isValidDecimalInput(value)) setSplitPaidAmount(value);
                  }}
                />
                <TouchableOpacity
                  style={styles.splitQuick}
                  onPress={() => setSplitPaidAmount((subtotal / 2).toFixed(2))}
                  disabled={subtotal <= 0}
                  accessibilityRole="button"
                >
                  <Text style={styles.splitQuickText}>Split 50 / 50</Text>
                </TouchableOpacity>

                <View style={styles.splitSummary}>
                  <View style={styles.splitSummaryRow}>
                    <Text style={styles.splitSummaryLabel}>{firstMethod}</Text>
                    <Text style={styles.splitSummaryValue}>{formatR(amountByMethod[firstMethod])}</Text>
                  </View>
                  <View style={styles.splitSummaryRow}>
                    <Text style={styles.splitSummaryLabel}>{`${secondMethod} (remainder)`}</Text>
                    <Text style={styles.splitSummaryValue}>{formatR(amountByMethod[secondMethod])}</Text>
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <Ionicons
                    name={splitHasCredit ? 'wallet-outline' : 'information-circle-outline'}
                    size={18}
                    color={COLORS.primary}
                  />
                  <Text style={styles.infoText}>
                    {splitHasCard && isOffline
                      ? 'Card payments need an internet connection. Pick cash and credit while offline.'
                      : `${splitHint}${splitHasCard ? ' Card payments are simulated. No real card is charged.' : ''}`}
                  </Text>
                </View>
              </>
            )}
          </View>
        )}

        <TouchableOpacity
          style={[styles.completeCta, (cart.length === 0 || (isSplit && !splitReady)) && styles.disabledCta]}
          onPress={handleCompleteSale}
          activeOpacity={0.88}
          disabled={submitting || !!cardState || cart.length === 0 || (isSplit && !splitReady)}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <View style={styles.ctaContent}>
              <View style={styles.ctaLeft}>
                <Ionicons name={ctaIcon} size={20} color="#FFFFFF" />
                <Text style={styles.ctaText}>{ctaLabel}</Text>
              </View>
              <View style={styles.ctaBadge}>
                <Text style={styles.ctaBadgeText}>{formatR(subtotal)}</Text>
              </View>
            </View>
          )}
        </TouchableOpacity>
      </ScrollView>

      <QRScannerScreen
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScanned={handleBarcodeScanned}
      />

      {/* Simulated card payment */}
      <Modal
        visible={!!cardState}
        transparent
        animationType="fade"
        onRequestClose={() => cardState?.phase === 'failed' && setCardState(null)}
      >
        <View style={styles.cardOverlay}>
          <View style={styles.cardModal}>
            {cardState?.phase === 'processing' && (
              <>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.cardModalTitle}>Processing card payment</Text>
                <Text style={styles.cardModalAmount}>{formatR(cardState.total)}</Text>
                <Text style={styles.cardModalText}>Please wait. This only takes a moment.</Text>
              </>
            )}
            {cardState?.phase === 'approved' && (
              <>
                <Ionicons name="checkmark-circle" size={72} color="#10B981" />
                <Text style={styles.cardModalTitle}>Payment approved</Text>
                <Text style={styles.cardModalAmount}>{formatR(cardState.total)}</Text>
                <Text style={styles.cardModalText}>{cardState.note || 'Recording your sale.'}</Text>
              </>
            )}
            {cardState?.phase === 'failed' && (
              <>
                <Ionicons name="close-circle" size={72} color={COLORS.danger} />
                <Text style={styles.cardModalTitle}>Payment not completed</Text>
                <Text style={styles.cardModalText}>{cardState.message}</Text>
                <View style={styles.cardModalActions}>
                  <TouchableOpacity
                    style={[styles.cardModalBtn, styles.cardModalBtnSecondary]}
                    onPress={() => setCardState(null)}
                  >
                    <Text style={styles.cardModalBtnSecondaryText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.cardModalBtn, styles.cardModalBtnPrimary]} onPress={payByCard}>
                    <Text style={styles.cardModalBtnPrimaryText}>Try again</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
            <Text style={styles.cardModalFooter}>Test mode. No real card is charged.</Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = (COLORS) =>
  StyleSheet.create({
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

    /* Inline result message */
    noticeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 10,
      marginBottom: 12,
      borderWidth: 1,
      gap: 8,
    },
    noticeSuccess: {
      backgroundColor: COLORS.primaryBg,
      borderColor: COLORS.primary,
    },
    noticeError: {
      backgroundColor: COLORS.dangerBg,
      borderColor: COLORS.dangerBorder,
    },
    noticeText: {
      flex: 1,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 18,
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
      backgroundColor: BRAND_GREEN,
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
      borderColor: COLORS.dangerBorder,
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

    /* Card and credit notes under the payment methods */
    infoCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: COLORS.primaryBg,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 20,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: COLORS.primaryBg,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    infoText: {
      flex: 1,
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 17,
      color: COLORS.primary,
    },
    creditOptionsCard: {
      backgroundColor: COLORS.cardBg,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 14,
      padding: 14,
      marginBottom: 20,
    },
    creditOptionsLabel: {
      fontSize: 10,
      fontWeight: '800',
      color: COLORS.textMuted,
      marginBottom: 6,
      marginTop: 4,
    },
    creditTextInput: {
      height: 44,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.bg,
      borderRadius: 10,
      paddingHorizontal: 12,
      fontSize: 14,
      color: COLORS.textDark,
      marginBottom: 10,
    },

    /* Split payment */
    splitChipRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 12,
    },
    splitChip: {
      flex: 1,
      height: 40,
      borderRadius: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.bg,
    },
    splitChipSelected: {
      borderColor: COLORS.primary,
      backgroundColor: COLORS.primaryBg,
    },
    splitChipDisabled: {
      opacity: 0.35,
    },
    splitHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    splitCounter: {
      fontSize: 11,
      fontWeight: '700',
      color: COLORS.textMuted,
      marginTop: 4,
    },
    splitQuick: {
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: COLORS.primary,
      marginBottom: 12,
    },
    splitQuickText: {
      fontSize: 12,
      fontWeight: '700',
      color: COLORS.primary,
    },
    splitChipText: {
      fontSize: 13,
      fontWeight: '600',
      color: COLORS.textMuted,
    },
    splitChipTextSelected: {
      color: COLORS.primary,
      fontWeight: '700',
    },
    splitSummary: {
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginBottom: 10,
    },
    splitSummaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 4,
    },
    splitSummaryLabel: {
      fontSize: 13,
      fontWeight: '500',
      color: COLORS.textMuted,
    },
    splitSummaryValue: {
      fontSize: 14,
      fontWeight: '700',
      color: COLORS.textDark,
    },

    completeCta: {
      height: 52,
      borderRadius: 14,
      backgroundColor: BRAND_GREEN,
      paddingHorizontal: 16,
      justifyContent: 'center',
      ...Platform.select({
        ios: { shadowColor: BRAND_GREEN, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 5 },
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

    /* Simulated card payment */
    cardOverlay: {
      flex: 1,
      backgroundColor: 'rgba(15, 23, 42, 0.6)',
      justifyContent: 'center',
      padding: 24,
    },
    cardModal: {
      backgroundColor: COLORS.cardBg,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: COLORS.border,
      paddingVertical: 28,
      paddingHorizontal: 22,
      alignItems: 'center',
      gap: 8,
      width: '100%',
      maxWidth: 380,
      alignSelf: 'center',
    },
    cardModalTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: COLORS.textDark,
      marginTop: 8,
      textAlign: 'center',
    },
    cardModalAmount: {
      fontSize: 28,
      fontWeight: '800',
      color: COLORS.primary,
    },
    cardModalText: {
      fontSize: 13,
      lineHeight: 19,
      color: COLORS.textMuted,
      textAlign: 'center',
    },
    cardModalFooter: {
      fontSize: 11,
      color: COLORS.textMuted,
      marginTop: 12,
    },
    cardModalActions: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 12,
      width: '100%',
    },
    cardModalBtn: {
      flex: 1,
      height: 46,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardModalBtnSecondary: {
      backgroundColor: COLORS.bg,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    cardModalBtnSecondaryText: {
      fontSize: 14,
      fontWeight: '700',
      color: COLORS.textMuted,
    },
    cardModalBtnPrimary: {
      backgroundColor: BRAND_GREEN,
    },
    cardModalBtnPrimaryText: {
      fontSize: 14,
      fontWeight: '800',
      color: '#FFFFFF',
    },
  });