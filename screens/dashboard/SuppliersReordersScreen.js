import React, { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
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

// An item from Stock is identified by its productId. An item typed in by hand has no productId,
// so it is identified by its name instead.
const nameKey = (value) => String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
const itemKey = (item) => item.productId || `name:${nameKey(item.name)}`;

// Small helper so every component below gets theme colors + styles
function useThemedStyles() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return { colors, styles };
}

function isOfflineError(error) {
  return String(error?.code).includes("unavailable") || /offline|network/i.test(error?.message || "");
}

function parseExpiryInput(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date();
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatExpiryInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

  // Add-item form: the item name is typed in. Stock items that match are offered as shortcuts.
  const [addItemFor, setAddItemFor] = useState(null);
  const [itemName, setItemName] = useState("");
  const [pickedProduct, setPickedProduct] = useState(null);
  const [newItemQty, setNewItemQty] = useState("");
  const [newItemSelling, setNewItemSelling] = useState("");
  const [newItemCost, setNewItemCost] = useState("");
  const [newItemReorder, setNewItemReorder] = useState("10");

  const [busySupplierId, setBusySupplierId] = useState(null);

  const filtered = suppliers.filter((s) =>
    s.name.toLowerCase().includes(query.toLowerCase()),
  );

  const nameTerm = itemName.trim().toLowerCase();
  const productMatches = !pickedProduct && nameTerm
    ? products
      .filter((product) => String(product.name || "").toLowerCase().includes(nameTerm))
      .slice(0, 5)
    : [];

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

  function resetItemForm() {
    setItemName("");
    setPickedProduct(null);
    setNewItemQty("");
    setNewItemSelling("");
    setNewItemCost("");
    setNewItemReorder("10");
  }

  function openAddItem(supplier) {
    setAddItemFor((current) => (current === supplier.id ? null : supplier.id));
    resetItemForm();
  }

  // Typing after picking a Stock item turns it back into a typed-in item
  function changeItemName(value) {
    setItemName(value);
    if (pickedProduct && value.trim() !== pickedProduct.name) setPickedProduct(null);
  }

  function pickProduct(product) {
    setPickedProduct(product);
    setItemName(product.name);
  }

  async function submitItem(supplier) {
    const name = itemName.trim();
    if (!name) {
      setNotice({ type: "error", text: "Enter the item name." });
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

    // Link to Stock when the item was picked from Stock, or the typed name matches a Stock product exactly
    const stockProduct = pickedProduct
      || products.find((product) => nameKey(product.name) === nameKey(name))
      || null;

    let unitCost = 0;
    let sellingPrice = 0;
    let reorderLevel = 10;
    if (stockProduct) {
      unitCost = Number(stockProduct.cost_price || 0);
      sellingPrice = Number(stockProduct.unit_price || 0);
      reorderLevel = Number(stockProduct.reorder_level ?? 10);
    } else {
      if (!newItemSelling.trim()) {
        setNotice({ type: "error", text: "Enter the selling price." });
        return;
      }
      try {
        sellingPrice = parseNonNegativeNumber(newItemSelling, "selling price");
        unitCost = parseNonNegativeNumber(newItemCost || "0", "cost price");
        reorderLevel = parseNonNegativeNumber(newItemReorder || "0", "low-stock threshold", { integer: true });
      } catch (error) {
        setNotice({ type: "error", text: error.message });
        return;
      }
    }

    const item = {
      productId: stockProduct?.id || "",
      name: stockProduct?.name || name,
      qty,
      unitCost,
      sellingPrice,
      reorderLevel,
      selected: true,
    };
    const others = supplier.items.filter((existing) => itemKey(existing) !== itemKey(item));
    try {
      await updateSupplierItems(storeId, supplier.id, [...others, item]);
      setAddItemFor(null);
      resetItemForm();
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
                    key={itemKey(item) || j}
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
                <Text style={styles.formLabel}>PRODUCT NAME</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. Sunflower Oil 2L"
                  placeholderTextColor={colors.textMuted}
                  value={itemName}
                  onChangeText={changeItemName}
                />

                {pickedProduct ? (
                  <Text style={[styles.itemSub, styles.formHint]}>
                    In your Stock: {pickedProduct.quantity} on hand · cost {formatR(pickedProduct.cost_price)}. Delivering this order adds to that stock.
                  </Text>
                ) : productMatches.length > 0 ? (
                  <>
                    <Text style={[styles.itemSub, styles.formHint]}>In your Stock (tap to use it):</Text>
                    {productMatches.map((product) => (
                      <Pressable
                        key={product.id}
                        style={styles.productResult}
                        onPress={() => pickProduct(product)}
                      >
                        <Text style={styles.productResultName}>{product.name}</Text>
                        <Text style={styles.itemSub}>
                          Cost {formatR(product.cost_price)} · {product.quantity} in stock
                        </Text>
                      </Pressable>
                    ))}
                  </>
                ) : null}

                {!pickedProduct && (
                  <>
                    <Text style={styles.formLabel}>SELLING PRICE (R)</Text>
                    <TextInput
                      style={styles.formInput}
                      placeholder="0.00"
                      placeholderTextColor={colors.textMuted}
                      value={newItemSelling}
                      onChangeText={(value) => {
                        if (/^\d*\.?\d{0,2}$/.test(value)) setNewItemSelling(value);
                      }}
                      keyboardType="decimal-pad"
                    />
                    <Text style={styles.formLabel}>COST PRICE (R)</Text>
                    <TextInput
                      style={styles.formInput}
                      placeholder="0.00"
                      placeholderTextColor={colors.textMuted}
                      value={newItemCost}
                      onChangeText={(value) => {
                        if (/^\d*\.?\d{0,2}$/.test(value)) setNewItemCost(value);
                      }}
                      keyboardType="decimal-pad"
                    />
                  </>
                )}

                <Text style={styles.formLabel}>QUANTITY</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Quantity to order"
                  placeholderTextColor={colors.textMuted}
                  value={newItemQty}
                  onChangeText={(value) => {
                    if (/^\d*$/.test(value)) setNewItemQty(value);
                  }}
                  keyboardType="number-pad"
                />

                {!pickedProduct && (
                  <>
                    <Text style={styles.formLabel}>LOW-STOCK THRESHOLD</Text>
                    <TextInput
                      style={styles.formInput}
                      placeholder="10"
                      placeholderTextColor={colors.textMuted}
                      value={newItemReorder}
                      onChangeText={(value) => {
                        if (/^\d*$/.test(value)) setNewItemReorder(value);
                      }}
                      keyboardType="number-pad"
                    />
                    <Text style={[styles.itemSub, styles.formHint]}>
                      Not in your Stock yet? It is added to Stock with these details when the order is delivered.
                    </Text>
                  </>
                )}

                <Pressable style={styles.formSubmit} onPress={() => submitItem(s)}>
                  <Text style={styles.formSubmitText}>Add Item</Text>
                </Pressable>
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
  const [deliveryExpiryDates, setDeliveryExpiryDates] = useState({});
  const [activeExpiryPicker, setActiveExpiryPicker] = useState(null);

  async function markDelivered(order) {
    setBusyId(order.id);
    try {
      const expiryDates = order.items.map((item, index) => deliveryExpiryDates[`${order.id}:${index}`] || "");
      const { updated, created, skipped } = await markOrderDelivered(storeId, order.id, expiryDates);
      const stockText = updated
        ? `Stock updated for ${updated} ${updated === 1 ? "item" : "items"}.`
        : created.length ? "" : "No stock was changed.";
      const createdText = created.length
        ? ` Added to Stock as new: ${created.join(", ")}.`
        : "";
      const skippedText = skipped.length
        ? ` No longer in Stock, so stock was not changed for: ${skipped.join(", ")}.`
        : "";
      setNotice({ type: "success", text: `Order ${order.orderNumber} delivered. ${stockText}${createdText}${skippedText}`.replace("delivered.  ", "delivered. ") });
      setDeliveryExpiryDates((current) => {
        const next = { ...current };
        order.items.forEach((item, index) => delete next[`${order.id}:${index}`]);
        return next;
      });
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
        const allInStock = o.items.every((item) => item.productId);
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

            {o.items.map((it, j) => {
              const inputKey = `${o.id}:${j}`;
              const expiryDate = deliveryExpiryDates[inputKey] || "";
              return (
                <View key={inputKey}>
                  <Text style={styles.receiptLine}>• {it.name} × {it.qty}</Text>
                  {o.status === "Delivered" && it.expiryDate ? (
                    <Text style={[styles.presetLabel, { marginLeft: 18, marginBottom: 6 }]}>
                      SELL BY: {it.expiryDate}
                    </Text>
                  ) : null}
                  {o.status === "Pending" && (
                    <View style={{ marginLeft: 18, marginBottom: 8 }}>
                      <Text style={[styles.presetLabel, { marginBottom: 4 }]}>SELL BY DATE (OPTIONAL)</Text>
                      {Platform.OS === "web" ? React.createElement("input", {
                        type: "date",
                        "aria-label": `${it.name} delivery sell-by date`,
                        value: expiryDate,
                        disabled: busy,
                        onChange: (event) => setDeliveryExpiryDates((current) => ({
                          ...current,
                          [inputKey]: event.target.value,
                        })),
                        style: {
                          boxSizing: "border-box",
                          width: "100%",
                          maxWidth: 280,
                          height: 40,
                          border: `1px solid ${colors.border}`,
                          borderRadius: 8,
                          padding: "0 10px",
                          backgroundColor: colors.card,
                          color: colors.textPrimary,
                          fontSize: 14,
                        },
                      }) : (
                        <>
                          <Pressable
                            style={[styles.searchInput, { maxWidth: 280 }]}
                            onPress={() => setActiveExpiryPicker(inputKey)}
                            disabled={busy}
                          >
                            <Text style={{ color: expiryDate ? colors.textPrimary : colors.textMuted }}>
                              {expiryDate || "Select sell-by date"}
                            </Text>
                          </Pressable>
                          {activeExpiryPicker === inputKey && (
                            <DateTimePicker
                              value={parseExpiryInput(expiryDate)}
                              mode="date"
                              display={Platform.OS === "ios" ? "compact" : "default"}
                              onChange={(event, date) => {
                                setActiveExpiryPicker(null);
                                if (date) setDeliveryExpiryDates((current) => ({
                                  ...current,
                                  [inputKey]: formatExpiryInput(date),
                                }));
                              }}
                            />
                          )}
                        </>
                      )}
                    </View>
                  )}
                </View>
              );
            })}

            <View style={styles.orderBottomRow}>
              <View>
                <Text style={styles.presetLabel}>TOTAL COST</Text>
                <Text style={styles.itemCost}>{formatR(o.total)}</Text>
              </View>
              {o.status === "Delivered" && (
                <Text style={styles.deliveredNote}>
                  {allInStock ? "Added to Stock" : "Delivered (some items were not added to Stock)"}
                </Text>
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
    formLabel: {
      fontSize: 10,
      color: colors.textMuted,
      fontWeight: "700",
      marginBottom: 6,
    },
    formHint: { marginTop: 0, marginBottom: 10, lineHeight: 17 },
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
    deliveredNote: { color: colors.primary, fontSize: 12, fontWeight: "700", flexShrink: 1, textAlign: "right", marginLeft: 12 },
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