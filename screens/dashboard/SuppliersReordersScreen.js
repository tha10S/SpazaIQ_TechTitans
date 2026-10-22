import { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../config/ThemeContext";
import { getAuthenticatedStoreId } from "../../services/firestore/paths";
import { subscribeProducts } from "../../services/firestore/productsRepository";
import {
  createOrder,
  createSupplier,
  deleteSupplier,
  markOrderDelivered,
  subscribeOrders,
  subscribeSuppliers,
  updateSupplierItems,
} from "../../services/firestore/suppliersRepository";
import { normalizePhoneNumber, parseNonNegativeNumber } from "../../services/validation";
import { openWhatsApp, supplierOrderMessage } from "../../services/whatsapp";

import { KEYBOARD_BEHAVIOR } from "../../components/keyboard";
const BRAND_GREEN = "#004B49"; // solid buttons keep brand green in both themes
const WHATSAPP_GREEN = "#25D366";

const CATEGORIES = ["Groceries", "Beverages", "Bakery", "Snacks"];

// Badge colors are built from the theme so they work in light and dark mode
function getCategoryColors(colors) {
  return {
    Groceries: { bg: colors.primaryLight, text: colors.primary },
    Beverages: { bg: "rgba(59, 130, 246, 0.15)", text: "#3B82F6" },
    Bakery: { bg: "rgba(245, 158, 11, 0.15)", text: "#F59E0B" },
    Snacks: { bg: "rgba(220, 38, 38, 0.15)", text: colors.danger },
  };
}

function getStatusColors(colors) {
  return {
    Delivered: { bg: colors.primaryLight, text: colors.primary },
    Pending: { bg: "rgba(245, 158, 11, 0.15)", text: "#F59E0B" },
  };
}

const formatR = (value) => `R${Number(value || 0).toFixed(2)}`;

// Small helper so every component below gets theme colors + styles
function useThemedStyles() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return { colors, styles };
}

function isOfflineError(error) {
  return String(error?.code).includes("unavailable") || /offline|network/i.test(error?.message || "");
}

export default function SuppliersAndReorders({ route }) {
  const { colors, styles } = useThemedStyles();
  const insets = useSafeAreaInsets();
  const storeId = route?.params?.storeId || getAuthenticatedStoreId();
  const shopName = route?.params?.shopName;

  const [tab, setTab] = useState("Suppliers");
  const [query, setQuery] = useState("");
  const [suppliers, setSuppliers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [loaded, setLoaded] = useState({ suppliers: false, orders: false });
  // { type: 'success' | 'error', text }. Shown inline because Alert.alert shows nothing on web.
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    if (!storeId) return undefined;
    const fail = (what) => (error) =>
      setNotice({ type: "error", text: `Could not load ${what}: ${error?.message || "unknown error"}` });
    const subscriptions = [
      subscribeSuppliers(storeId, (data) => {
        setSuppliers(data);
        setLoaded((current) => ({ ...current, suppliers: true }));
      }, fail("suppliers")),
      subscribeOrders(storeId, (data) => {
        setOrders(data);
        setLoaded((current) => ({ ...current, orders: true }));
      }, fail("orders")),
      subscribeProducts(storeId, "", setProducts, (error) => console.warn("Suppliers products subscription failed", error?.code)),
    ];
    return () => subscriptions.forEach((unsubscribe) => unsubscribe());
  }, [storeId]);

  // Success messages clear themselves after a few seconds
  useEffect(() => {
    if (notice?.type !== "success") return undefined;
    const timer = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={KEYBOARD_BEHAVIOR}>
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.header}>Suppliers</Text>

      {notice && (
        <View style={[styles.noticeCard, notice.type === "error" ? styles.noticeError : styles.noticeSuccess]}>
          <Ionicons
            name={notice.type === "error" ? "alert-circle" : "checkmark-circle"}
            size={18}
            color={notice.type === "error" ? colors.danger : colors.primary}
          />
          <Text style={[styles.noticeText, { color: notice.type === "error" ? colors.danger : colors.primary }]}>
            {notice.text}
          </Text>
          <Pressable onPress={() => setNotice(null)} accessibilityLabel="Dismiss message">
            <Ionicons name="close" size={16} color={notice.type === "error" ? colors.danger : colors.primary} />
          </Pressable>
        </View>
      )}

      <View style={styles.segmentWrap}>
        {["Suppliers", "Orders"].map((label) => (
          <Pressable
            key={label}
            onPress={() => setTab(label)}
            style={[styles.segment, tab === label && styles.segmentActive]}
          >
            <Text
              style={[
                styles.segmentText,
                tab === label && styles.segmentTextActive,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === "Suppliers" ? (
        <SuppliersTab
          query={query}
          setQuery={setQuery}
          suppliers={suppliers}
          products={products}
          loaded={loaded.suppliers}
          storeId={storeId}
          shopName={shopName}
          setNotice={setNotice}
          goToOrders={() => setTab("Orders")}
        />
      ) : (
        <OrdersTab
          orders={orders}
          suppliers={suppliers}
          loaded={loaded.orders}
          storeId={storeId}
          shopName={shopName}
          setNotice={setNotice}
        />
      )}
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SuppliersTab({ query, setQuery, suppliers, products, loaded, storeId, shopName, setNotice, goToOrders }) {
  const { colors, styles } = useThemedStyles();
  const categoryColors = useMemo(() => getCategoryColors(colors), [colors]);

  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState(CATEGORIES[0]);
  const [newPhone, setNewPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const [addItemFor, setAddItemFor] = useState(null);
  const [productSearch, setProductSearch] = useState("");
  const [pickedProduct, setPickedProduct] = useState(null);
  const [newItemQty, setNewItemQty] = useState("");

  const [busySupplierId, setBusySupplierId] = useState(null);

  const filtered = suppliers.filter((s) =>
    s.name.toLowerCase().includes(query.toLowerCase()),
  );

  const productMatches = products
    .filter((product) => product.name.toLowerCase().includes(productSearch.trim().toLowerCase()))
    .slice(0, 5);

  const selectedItems = (supplier) => supplier.items.filter((item) => item.selected !== false);

  async function submitSupplier() {
    if (!newName.trim()) {
      setNotice({ type: "error", text: "Enter the supplier name." });
      return;
    }
    if (suppliers.some((supplier) => supplier.name.trim().toLowerCase() === newName.trim().toLowerCase())) {
      setNotice({ type: "error", text: "A supplier with that name already exists." });
      return;
    }
    let phone;
    try {
      phone = normalizePhoneNumber(newPhone);
    } catch (error) {
      setNotice({ type: "error", text: error.message });
      return;
    }
    setSaving(true);
    try {
      await createSupplier(storeId, { name: newName, category: newCategory, phone });
      setNotice({ type: "success", text: `${newName.trim()} added.` });
      setNewName("");
      setNewPhone("");
      setNewCategory(CATEGORIES[0]);
      setShowAddSupplier(false);
    } catch (error) {
      setNotice({ type: "error", text: error.message || "Could not save the supplier." });
    } finally {
      setSaving(false);
    }
  }

  function openAddItem(supplier) {
    setAddItemFor((current) => (current === supplier.id ? null : supplier.id));
    setProductSearch("");
    setPickedProduct(null);
    setNewItemQty("");
  }

  async function submitItem(supplier) {
    if (!pickedProduct) {
      setNotice({ type: "error", text: "Pick a product from your stock first." });
      return;
    }
    let qty;
    try {
      qty = parseNonNegativeNumber(newItemQty, "quantity", { integer: true });
    } catch (error) {
      setNotice({ type: "error", text: error.message });
      return;
    }
    if (qty < 1) {
      setNotice({ type: "error", text: "Enter a whole number quantity of 1 or more." });
      return;
    }
    const item = {
      productId: pickedProduct.id,
      name: pickedProduct.name,
      qty,
      unitCost: pickedProduct.cost_price || 0,
      selected: true,
    };
    const others = supplier.items.filter((existing) => existing.productId !== item.productId);
    try {
      await updateSupplierItems(storeId, supplier.id, [...others, item]);
      setAddItemFor(null);
      setPickedProduct(null);
      setProductSearch("");
      setNewItemQty("");
    } catch (error) {
      setNotice({ type: "error", text: error.message || "Could not add the item." });
    }
  }

  async function toggleItem(supplier, itemIndex) {
    const items = supplier.items.map((item, index) =>
      index === itemIndex ? { ...item, selected: item.selected === false } : item,
    );
    try {
      await updateSupplierItems(storeId, supplier.id, items);
    } catch (error) {
      setNotice({ type: "error", text: error.message || "Could not update the item." });
    }
  }

  async function removeSupplier(supplier) {
    try {
      await deleteSupplier(storeId, supplier.id);
      setNotice({ type: "success", text: `${supplier.name} removed.` });
    } catch (error) {
      setNotice({ type: "error", text: error.message || "Could not remove the supplier." });
    }
  }

  async function newOrder(supplier) {
    const items = selectedItems(supplier);
    if (!items.length) {
      setNotice({ type: "error", text: "Tick at least one preset item, or add one, before ordering." });
      return;
    }
    setBusySupplierId(supplier.id);
    try {
      const { orderNumber } = await createOrder(storeId, supplier, items);
      setNotice({ type: "success", text: `Order ${orderNumber} created for ${supplier.name}. Send it on WhatsApp from here.` });
      goToOrders();
    } catch (error) {
      setNotice({ type: "error", text: error.message || "Could not create the order." });
    } finally {
      setBusySupplierId(null);
    }
  }

  // Opens WhatsApp straight from the tap. Don't put an await before this call.
  function whatsAppSupplier(supplier) {
    if (!supplier.phone) {
      setNotice({ type: "error", text: `${supplier.name} has no phone number saved. Remove the supplier and add them again with a number.` });
      return;
    }
    const message = supplierOrderMessage({ supplierName: supplier.name, items: selectedItems(supplier), shopName });
    openWhatsApp(supplier.phone, message).then((result) => {
      if (!result.ok) setNotice({ type: "error", text: result.error });
    });
  }

  return (
    <>
      <TextInput
        style={styles.searchInput}
        placeholder="Search suppliers..."
        placeholderTextColor={colors.textMuted}
        value={query}
        onChangeText={setQuery}
      />

      <Pressable
        style={styles.addButton}
        onPress={() => setShowAddSupplier((v) => !v)}
      >
        <Text style={styles.addButtonText}>
          {showAddSupplier ? "Cancel" : "+ Add Supplier"}
        </Text>
      </Pressable>

      {showAddSupplier && (
        <View style={styles.formCard}>
          <TextInput
            style={styles.formInput}
            placeholder="Supplier name"
            placeholderTextColor={colors.textMuted}
            value={newName}
            onChangeText={setNewName}
          />
          <TextInput
            style={styles.formInput}
            placeholder="Phone number (used for WhatsApp)"
            placeholderTextColor={colors.textMuted}
            value={newPhone}
            onChangeText={setNewPhone}
            keyboardType="phone-pad"
          />
          <Text style={styles.presetLabel}>CATEGORY</Text>
          <View style={styles.tagRow}>
            {CATEGORIES.map((cat) => (
              <Pressable
                key={cat}
                onPress={() => setNewCategory(cat)}
                style={[
                  styles.categoryPickOption,
                  newCategory === cat && styles.categoryPickSelected,
                ]}
              >
                <Text
                  style={[
                    styles.categoryPickText,
                    newCategory === cat && styles.categoryPickTextSelected,
                  ]}
                >
                  {cat}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={styles.formSubmit} onPress={submitSupplier} disabled={saving}>
            <Text style={styles.formSubmitText}>{saving ? "Saving..." : "Save Supplier"}</Text>
          </Pressable>
        </View>
      )}

      {!loaded ? (
        <Text style={styles.emptyText}>Loading suppliers...</Text>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>{suppliers.length === 0 ? "No suppliers yet" : "No suppliers match your search"}</Text>
          {suppliers.length === 0 && (
            <Text style={styles.emptyText}>Add your first supplier, then list the products you buy from them.</Text>
          )}
        </View>
      ) : null}

      {filtered.map((s) => {
        const catStyle = categoryColors[s.category] ?? {
          bg: colors.border,
          text: colors.textMuted,
        };
        const presetTotal = selectedItems(s).reduce((sum, item) => sum + item.qty * (item.unitCost || 0), 0);
        return (
          <View key={s.id} style={styles.card}>
            <View style={styles.cardTopRow}>
              <Text style={styles.itemTitle}>{s.name}</Text>
              <View style={[styles.badge, { backgroundColor: catStyle.bg }]}>
                <Text style={[styles.badgeText, { color: catStyle.text }]}>
                  {s.category}
                </Text>
              </View>
            </View>

            <Text style={styles.phoneText}>{s.phone || "No phone number"}</Text>

            <Text style={styles.presetLabel}>PRESET ITEMS</Text>
            {s.items.length === 0 ? (
              <Text style={styles.emptyText}>No items yet. Add products you buy from this supplier.</Text>
            ) : (
              <View style={styles.tagRow}>
                {s.items.map((item, j) => (
                  <Pressable
                    key={item.productId || j}
                    onPress={() => toggleItem(s, j)}
                    style={[styles.tag, item.selected === false && styles.tagUnselected]}
                  >
                    <Text
                      style={[
                        styles.tagText,
                        item.selected === false && styles.tagTextUnselected,
                      ]}
                    >
                      {item.name} × {item.qty}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
            {presetTotal > 0 && (
              <Text style={styles.itemSub}>Selected items cost about {formatR(presetTotal)}</Text>
            )}

            {addItemFor === s.id && (
              <View style={[styles.formCard, styles.addItemForm]}>
                {products.length === 0 ? (
                  <Text style={styles.emptyText}>
                    Your Stock is empty. Add the product in Stock first (quantity 0 is fine), then add it here.
                  </Text>
                ) : (
                  <>
                    {pickedProduct ? (
                      <Pressable style={styles.pickedChip} onPress={() => setPickedProduct(null)}>
                        <Text style={styles.pickedChipText}>{pickedProduct.name}</Text>
                        <Ionicons name="close-circle" size={16} color={colors.primary} />
                      </Pressable>
                    ) : (
                      <>
                        <TextInput
                          style={styles.formInput}
                          placeholder="Search your stock..."
                          placeholderTextColor={colors.textMuted}
                          value={productSearch}
                          onChangeText={setProductSearch}
                        />
                        {productMatches.map((product) => (
                          <Pressable
                            key={product.id}
                            style={styles.productResult}
                            onPress={() => setPickedProduct(product)}
                          >
                            <Text style={styles.productResultName}>{product.name}</Text>
                            <Text style={styles.itemSub}>
                              Cost {formatR(product.cost_price)} · {product.quantity} in stock
                            </Text>
                          </Pressable>
                        ))}
                        {productMatches.length === 0 && (
                          <Text style={styles.emptyText}>No product in your Stock matches that.</Text>
                        )}
                      </>
                    )}
                    <TextInput
                      style={[styles.formInput, styles.qtyInput]}
                      placeholder="Quantity to order"
                      placeholderTextColor={colors.textMuted}
                      value={newItemQty}
                      onChangeText={setNewItemQty}
                      keyboardType="number-pad"
                    />
                    <Pressable style={styles.formSubmit} onPress={() => submitItem(s)}>
                      <Text style={styles.formSubmitText}>Add Item</Text>
                    </Pressable>
                  </>
                )}
              </View>
            )}

            <View style={styles.cardBottomRow}>
              <Pressable onPress={() => openAddItem(s)}>
                <Text style={styles.addItemText}>
                  {addItemFor === s.id ? "Cancel" : "+ Add Item"}
                </Text>
              </Pressable>
              <Pressable onPress={() => removeSupplier(s)}>
                <Text style={styles.removeText}>Remove Supplier</Text>
              </Pressable>
            </View>

            <View style={styles.supplierActions}>
              <Pressable
                style={[styles.newOrderButton, styles.newOrderGrow]}
                onPress={() => newOrder(s)}
                disabled={busySupplierId === s.id}
              >
                <Text style={styles.newOrderButtonText}>
                  {busySupplierId === s.id ? "Creating..." : `New Order from ${s.name.split(" ")[0]}`}
                </Text>
              </Pressable>
              <Pressable
                style={styles.whatsappButton}
                onPress={() => whatsAppSupplier(s)}
                accessibilityRole="button"
                accessibilityLabel={`WhatsApp ${s.name}`}
              >
                <Ionicons name="logo-whatsapp" size={18} color={WHATSAPP_GREEN} />
                <Text style={styles.whatsappButtonText}>WhatsApp</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </>
  );
}

function OrdersTab({ orders, suppliers, loaded, storeId, shopName, setNotice }) {
  const { colors, styles } = useThemedStyles();
  const statusColors = useMemo(() => getStatusColors(colors), [colors]);
  const [busyId, setBusyId] = useState(null);

  async function markDelivered(order) {
    setBusyId(order.id);
    try {
      const { updated, skipped } = await markOrderDelivered(storeId, order.id);
      const stockText = updated
        ? `Stock updated for ${updated} ${updated === 1 ? "item" : "items"}.`
        : "No stock was changed.";
      const skippedText = skipped.length
        ? ` Not in Stock any more, so skipped: ${skipped.join(", ")}.`
        : "";
      setNotice({ type: "success", text: `Order ${order.orderNumber} delivered. ${stockText}${skippedText}` });
    } catch (error) {
      setNotice({
        type: "error",
        text: isOfflineError(error)
          ? "Marking an order delivered needs an internet connection, so stock stays correct. Try again when you're online."
          : error.message || "Could not mark the order delivered.",
      });
    } finally {
      setBusyId(null);
    }
  }

  // Opens WhatsApp straight from the tap. Don't put an await before this call.
  function sendWhatsApp(order) {
    const phone = order.supplierPhone || suppliers.find((supplier) => supplier.id === order.supplierId)?.phone;
    if (!phone) {
      setNotice({ type: "error", text: `${order.supplier} has no phone number saved.` });
      return;
    }
    const message = supplierOrderMessage({ supplierName: order.supplier, items: order.items, shopName });
    openWhatsApp(phone, message).then((result) => {
      if (!result.ok) setNotice({ type: "error", text: result.error });
    });
  }

  async function reorderSame(order) {
    setBusyId(order.id);
    try {
      const supplier = suppliers.find((item) => item.id === order.supplierId)
        || { id: order.supplierId, name: order.supplier, phone: order.supplierPhone };
      const { orderNumber } = await createOrder(storeId, supplier, order.items);
      setNotice({ type: "success", text: `Order ${orderNumber} created with the same items.` });
    } catch (error) {
      setNotice({ type: "error", text: error.message || "Could not create the order." });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      {!loaded ? (
        <Text style={styles.emptyText}>Loading orders...</Text>
      ) : orders.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No orders yet</Text>
          <Text style={styles.emptyText}>Open a supplier and tap New Order to create one.</Text>
        </View>
      ) : null}

      {orders.map((o) => {
        const statusStyle = statusColors[o.status] ?? {
          bg: colors.border,
          text: colors.textMuted,
        };
        const busy = busyId === o.id;
        return (
          <View key={o.id} style={styles.card}>
            <View style={styles.cardTopRow}>
              <View>
                <Text style={styles.itemTitle}>{o.supplier}</Text>
                <Text style={styles.itemSub}>
                  #{o.orderNumber} · {o.date}
                </Text>
              </View>
              <View style={[styles.badge, { backgroundColor: statusStyle.bg }]}>
                <Text style={[styles.badgeText, { color: statusStyle.text }]}>
                  {o.status}
                </Text>
              </View>
            </View>

            {o.items.map((it, j) => (
              <Text key={j} style={styles.receiptLine}>
                • {it.name} × {it.qty}
              </Text>
            ))}

            <View style={styles.orderBottomRow}>
              <View>
                <Text style={styles.presetLabel}>TOTAL COST</Text>
                <Text style={styles.itemCost}>{formatR(o.total)}</Text>
              </View>
              {o.status === "Delivered" && (
                <Text style={styles.deliveredNote}>Added to Stock</Text>
              )}
            </View>

            <View style={styles.orderActions}>
              {o.status === "Pending" && (
                <Pressable style={styles.whatsappButton} onPress={() => sendWhatsApp(o)} disabled={busy}>
                  <Ionicons name="logo-whatsapp" size={18} color={WHATSAPP_GREEN} />
                  <Text style={styles.whatsappButtonText}>Send on WhatsApp</Text>
                </Pressable>
              )}
              {o.status === "Pending" && (
                <Pressable style={styles.deliverButton} onPress={() => markDelivered(o)} disabled={busy}>
                  <Text style={styles.deliverButtonText}>{busy ? "Updating..." : "Mark Delivered"}</Text>
                </Pressable>
              )}
              <Pressable style={styles.reorderButton} onPress={() => reorderSame(o)} disabled={busy}>
                <Text style={styles.reorderButtonText}>↻ Reorder Same</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { padding: 20, paddingBottom: 40 },
    header: { fontSize: 24, fontWeight: "800", marginBottom: 16, color: colors.textPrimary },

    /* Inline result message */
    noticeCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 10,
      marginBottom: 12,
      borderWidth: 1,
    },
    noticeSuccess: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
    noticeError: { backgroundColor: "rgba(220, 38, 38, 0.15)", borderColor: "rgba(220, 38, 38, 0.4)" },
    noticeText: { flex: 1, fontSize: 13, fontWeight: "600", lineHeight: 18 },

    segmentWrap: {
      flexDirection: "row",
      backgroundColor: colors.card,
      borderRadius: 24,
      padding: 4,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    segment: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 20,
      alignItems: "center",
    },
    segmentActive: { backgroundColor: BRAND_GREEN },
    segmentText: { color: colors.textMuted, fontWeight: "600" },
    segmentTextActive: { color: "#FFFFFF" },
    searchInput: {
      backgroundColor: colors.card,
      color: colors.textPrimary,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 15,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    addButton: {
      backgroundColor: BRAND_GREEN,
      borderRadius: 12,
      paddingVertical: 10,
      alignItems: "center",
      marginBottom: 16,
    },
    addButtonText: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
    formCard: {
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: 14,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    addItemForm: { marginTop: 10 },
    formInput: {
      backgroundColor: colors.card,
      color: colors.textPrimary,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    qtyInput: { marginTop: 4 },
    formSubmit: {
      backgroundColor: BRAND_GREEN,
      borderRadius: 10,
      paddingVertical: 10,
      alignItems: "center",
      marginTop: 4,
    },
    formSubmitText: { color: "#FFFFFF", fontWeight: "700", fontSize: 13 },
    productResult: {
      backgroundColor: colors.card,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginBottom: 6,
      borderWidth: 1,
      borderColor: colors.border,
    },
    productResultName: { fontSize: 14, fontWeight: "600", color: colors.textPrimary },
    pickedChip: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      gap: 6,
      backgroundColor: colors.primaryLight,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 6,
      marginBottom: 10,
    },
    pickedChipText: { color: colors.primary, fontSize: 13, fontWeight: "700" },
    categoryPickOption: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 10,
      paddingVertical: 6,
      marginRight: 6,
      marginBottom: 6,
    },
    categoryPickSelected: { backgroundColor: BRAND_GREEN, borderColor: BRAND_GREEN },
    categoryPickText: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
    categoryPickTextSelected: { color: "#FFFFFF" },
    emptyCard: {
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 20,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
    },
    emptyTitle: { fontSize: 15, fontWeight: "700", color: colors.textPrimary },
    emptyText: { fontSize: 13, color: colors.textMuted, marginTop: 4, lineHeight: 18 },
    card: {
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 16,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardTopRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },
    itemTitle: { fontWeight: "700", fontSize: 15, color: colors.textPrimary },
    itemSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
    itemCost: { fontWeight: "800", fontSize: 16, color: colors.textPrimary },
    badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    badgeText: { fontSize: 11, fontWeight: "700" },
    phoneText: { color: colors.textMuted, fontSize: 13, marginTop: 8 },
    removeText: { color: colors.danger, fontSize: 12, fontWeight: "600" },
    addItemText: { color: colors.primary, fontSize: 12, fontWeight: "600" },
    presetLabel: {
      fontSize: 10,
      color: colors.textMuted,
      fontWeight: "700",
      marginTop: 14,
      marginBottom: 8,
    },
    tagRow: { flexDirection: "row", flexWrap: "wrap" },
    tag: {
      backgroundColor: colors.primaryLight,
      borderRadius: 14,
      paddingHorizontal: 10,
      paddingVertical: 6,
      marginRight: 6,
      marginBottom: 6,
    },
    tagUnselected: { backgroundColor: colors.border },
    tagText: { color: colors.primary, fontSize: 12, fontWeight: "600" },
    tagTextUnselected: { color: colors.textMuted },
    cardBottomRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 8,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    supplierActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 12,
    },
    newOrderButton: {
      backgroundColor: BRAND_GREEN,
      borderRadius: 10,
      paddingVertical: 10,
      alignItems: "center",
    },
    newOrderGrow: { flex: 1 },
    newOrderButtonText: { color: "#FFFFFF", fontWeight: "700", fontSize: 13 },
    whatsappButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderWidth: 1,
      borderColor: WHATSAPP_GREEN,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },
    whatsappButtonText: { color: colors.textPrimary, fontWeight: "700", fontSize: 13 },
    receiptLine: { color: colors.textSecondary, fontSize: 13, marginTop: 6 },
    orderBottomRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    deliveredNote: { color: colors.primary, fontSize: 12, fontWeight: "700" },
    orderActions: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 12,
    },
    reorderButton: {
      backgroundColor: colors.primaryLight,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    reorderButtonText: { color: colors.primary, fontWeight: "700", fontSize: 13 },
    deliverButton: {
      backgroundColor: BRAND_GREEN,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    deliverButtonText: { color: "#FFFFFF", fontWeight: "700", fontSize: 13 },
  });