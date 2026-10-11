import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useTheme } from "../../config/ThemeContext";
import { normalizePhoneNumber, parseNonNegativeNumber } from "../../services/validation";

const BRAND_GREEN = "#004B49"; // solid buttons keep brand green in both themes
const STORAGE_KEY = "@spazaiq/suppliers-reorders/v1";

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

const initialSuppliers = [
  {
    name: "Sizwe Wholesalers",
    category: "Groceries",
    phone: "082 345 6712",
    items: [
      { name: "Maize Meal 5kg", qty: 1, selected: true },
      { name: "Sugar 2.5kg", qty: 1, selected: true },
      { name: "Cooking Oil 750ml", qty: 1, selected: true },
    ],
  },
  {
    name: "Cape Cold Drinks Co.",
    category: "Beverages",
    phone: "071 902 4483",
    items: [
      { name: "Coca-Cola 500ml", qty: 1, selected: true },
      { name: "Sprite 500ml", qty: 1, selected: true },
    ],
  },
  {
    name: "Fresh Bake Distributors",
    category: "Bakery",
    phone: "083 221 0099",
    items: [{ name: "Albany White Bread", qty: 1, selected: true }],
  },
];

const initialOrders = [
  {
    id: "ORD-1042",
    date: "28 Aug 2026",
    supplier: "Fresh Bake Distributors",
    items: [{ name: "Albany White Bread", qty: 40 }],
    total: 640,
    status: "Delivered",
  },
  {
    id: "ORD-1039",
    date: "24 Aug 2026",
    supplier: "Cape Cold Drinks Co.",
    items: [{ name: "Coca-Cola 500ml", qty: 96 }],
    total: 1152,
    status: "Delivered",
  },
  {
    id: "ORD-1031",
    date: "15 Aug 2026",
    supplier: "Sizwe Wholesalers",
    items: [
      { name: "Maize Meal 5kg", qty: 20 },
      { name: "Sugar 2.5kg", qty: 15 },
    ],
    total: 890,
    status: "Pending",
  },
];

// Small helper so every component below gets theme colors + styles
function useThemedStyles() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return { colors, styles };
}

export default function SuppliersAndReorders() {
  const { styles } = useThemedStyles();
  const [tab, setTab] = useState("Suppliers");
  const [query, setQuery] = useState("");
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [orders, setOrders] = useState(initialOrders);
  const [isLoaded, setIsLoaded] = useState(false);
  const [storageError, setStorageError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadSavedData() {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) {
          const data = JSON.parse(saved);
          if (!Array.isArray(data.suppliers) || !Array.isArray(data.orders)) {
            throw new Error("Saved supplier and order data is invalid.");
          }
          if (active) {
            setSuppliers(data.suppliers);
            setOrders(data.orders);
          }
        } else {
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({
            suppliers: initialSuppliers,
            orders: initialOrders,
          }));
        }
      } catch (error) {
        if (active) setStorageError(error.message || "Could not load saved supplier data.");
      } finally {
        if (active) setIsLoaded(true);
      }
    }
    loadSavedData();
    return () => { active = false; };
  }, []);

  async function saveSuppliers(nextSuppliers) {
    if (!isLoaded) throw new Error("Supplier data is still loading.");
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ suppliers: nextSuppliers, orders }));
      setSuppliers(nextSuppliers);
      setStorageError("");
    } catch (error) {
      setStorageError("Could not save supplier changes. Please try again.");
      throw error;
    }
  }

  async function saveOrders(nextOrders) {
    if (!isLoaded) throw new Error("Supplier data is still loading.");
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ suppliers, orders: nextOrders }));
      setOrders(nextOrders);
      setStorageError("");
    } catch (error) {
      setStorageError("Could not save order changes. Please try again.");
      throw error;
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Suppliers</Text>
      {!isLoaded ? <Text style={{ color: "#6B7280", marginBottom: 12 }}>Loading saved suppliers...</Text> : null}
      {storageError ? <Text style={{ color: "#B91C1C", marginBottom: 12 }}>{storageError}</Text> : null}

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
          saveSuppliers={saveSuppliers}
          isLoaded={isLoaded}
        />
      ) : (
        <OrdersTab orders={orders} saveOrders={saveOrders} isLoaded={isLoaded} />
      )}
    </ScrollView>
  );
}

function SuppliersTab({ query, setQuery, suppliers, saveSuppliers, isLoaded }) {
  const { colors, styles } = useThemedStyles();
  const categoryColors = useMemo(() => getCategoryColors(colors), [colors]);

  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState(CATEGORIES[0]);
  const [newPhone, setNewPhone] = useState("");
  const [formError, setFormError] = useState("");

  const [addItemFor, setAddItemFor] = useState(null);
  const [newItemName, setNewItemName] = useState("");
  const [newItemQty, setNewItemQty] = useState("");

  const filtered = suppliers.filter((s) =>
    s.name.toLowerCase().includes(query.toLowerCase()),
  );

  async function submitSupplier() {
    if (!newName.trim()) {
      setFormError("Enter a supplier name.");
      return;
    }
    if (suppliers.some((supplier) => supplier.name.toLowerCase() === newName.trim().toLowerCase())) {
      setFormError("A supplier with that name already exists.");
      return;
    }
    let phone;
    try {
      phone = normalizePhoneNumber(newPhone);
    } catch (error) {
      setFormError(error.message);
      return;
    }
    try {
      await saveSuppliers([
        ...suppliers,
        { name: newName.trim(), category: newCategory, phone, items: [] },
      ]);
      setFormError("");
      setNewName("");
      setNewPhone("");
      setNewCategory(CATEGORIES[0]);
      setShowAddSupplier(false);
    } catch (error) {
      setFormError(error.message || "Could not save supplier.");
    }
  }

  async function submitItem(supplierName) {
    const name = newItemName.trim();
    if (!name) {
      setFormError("Enter an item name.");
      return;
    }
    let quantity;
    try {
      quantity = parseNonNegativeNumber(newItemQty, "quantity", { integer: true });
      if (quantity < 1) throw new Error("Quantity must be a whole number greater than zero.");
    } catch (error) {
      setFormError(error.message);
      return;
    }
    try {
      const nextSuppliers = suppliers.map((supplier) =>
        supplier.name === supplierName
          ? { ...supplier, items: [...supplier.items, { name, qty: quantity, selected: true }] }
          : supplier,
      );
      await saveSuppliers(nextSuppliers);
      setFormError("");
      setNewItemName("");
      setNewItemQty("");
      setAddItemFor(null);
    } catch (error) {
      setFormError(error.message || "Could not save item.");
    }
  }

  async function toggleItem(supplierName, itemIndex) {
    const nextSuppliers = suppliers.map((supplier) =>
      supplier.name === supplierName
        ? {
            ...supplier,
            items: supplier.items.map((item, index) =>
              index === itemIndex ? { ...item, selected: !item.selected } : item,
            ),
          }
        : supplier,
    );
    try {
      await saveSuppliers(nextSuppliers);
    } catch (error) {
      setFormError(error.message || "Could not save item changes.");
    }
  }

  async function removeSupplier(supplierName) {
    try {
      await saveSuppliers(suppliers.filter((supplier) => supplier.name !== supplierName));
    } catch (error) {
      setFormError(error.message || "Could not remove supplier.");
    }
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
            placeholder="10-digit phone (optional)"
            placeholderTextColor={colors.textMuted}
            value={newPhone}
            onChangeText={(value) => setNewPhone(value.replace(/\D/g, "").slice(0, 10))}
            keyboardType="phone-pad"
            maxLength={10}
          />
          {formError ? <Text style={{ color: colors.danger, marginBottom: 8 }}>{formError}</Text> : null}
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
          <Pressable style={styles.formSubmit} onPress={submitSupplier} disabled={!isLoaded}>
            <Text style={styles.formSubmitText}>Save Supplier</Text>
          </Pressable>
        </View>
      )}

      {filtered.map((s, i) => {
        const catStyle = categoryColors[s.category] ?? {
          bg: colors.border,
          text: colors.textMuted,
        };
        return (
          <View key={i} style={styles.card}>
            <View style={styles.cardTopRow}>
              <Text style={styles.itemTitle}>{s.name}</Text>
              <View style={[styles.badge, { backgroundColor: catStyle.bg }]}>
                <Text style={[styles.badgeText, { color: catStyle.text }]}>
                  {s.category}
                </Text>
              </View>
            </View>

            <Text style={styles.phoneText}>{s.phone}</Text>

            <Text style={styles.presetLabel}>PRESET ITEMS</Text>
            <View style={styles.tagRow}>
              {s.items.map((item, j) => (
                <Pressable
                  key={j}
                  onPress={() => toggleItem(s.name, j)}
                  style={[styles.tag, !item.selected && styles.tagUnselected]}
                >
                  <Text
                    style={[
                      styles.tagText,
                      !item.selected && styles.tagTextUnselected,
                    ]}
                  >
                    {item.name}
                  </Text>
                </Pressable>
              ))}
            </View>

            {addItemFor === s.name && (
              <View style={styles.formCard}>
                {formError ? <Text style={{ color: colors.danger, marginBottom: 8 }}>{formError}</Text> : null}
                <TextInput
                  style={styles.formInput}
                  placeholder="Item name"
                  placeholderTextColor={colors.textMuted}
                  value={newItemName}
                  onChangeText={setNewItemName}
                />
                <TextInput
                  style={styles.formInput}
                  placeholder="Quantity"
                  placeholderTextColor={colors.textMuted}
                  value={newItemQty}
                  onChangeText={(value) => {
                    if (/^\d*$/.test(value)) setNewItemQty(value);
                  }}
                  keyboardType="number-pad"
                  maxLength={6}
                />
                <Pressable
                  style={styles.formSubmit}
                  onPress={() => submitItem(s.name)}
                  disabled={!isLoaded}
                >
                  <Text style={styles.formSubmitText}>Add Item</Text>
                </Pressable>
              </View>
            )}

            <View style={styles.cardBottomRow}>
              <Pressable
                onPress={() =>
                  setAddItemFor((cur) => (cur === s.name ? null : s.name))
                }
              >
                <Text style={styles.addItemText}>
                  {addItemFor === s.name ? "Cancel" : "+ Add Item"}
                </Text>
              </Pressable>
              <Pressable onPress={() => removeSupplier(s.name)}>
                <Text style={styles.removeText}>Remove Supplier</Text>
              </Pressable>
            </View>

            <Pressable style={styles.newOrderButton}>
              <Text style={styles.newOrderButtonText}>
                New Order from {s.name.split(" ")[0]}
              </Text>
            </Pressable>
          </View>
        );
      })}
    </>
  );
}

function OrdersTab({ orders, saveOrders, isLoaded }) {
  const { colors, styles } = useThemedStyles();
  const statusColors = useMemo(() => getStatusColors(colors), [colors]);

  async function markDelivered(orderId) {
    const nextOrders = orders.map((order) => order.id === orderId ? { ...order, status: "Delivered" } : order);
    try {
      await saveOrders(nextOrders);
    } catch (error) {
      Alert.alert("Could not save order", error.message || "Please try again.");
    }
  }

  return (
    <>
      {orders.map((o, i) => {
        const statusStyle = statusColors[o.status] ?? {
          bg: colors.border,
          text: colors.textMuted,
        };
        return (
          <View key={i} style={styles.card}>
            <View style={styles.cardTopRow}>
              <View>
                <Text style={styles.itemTitle}>{o.supplier}</Text>
                <Text style={styles.itemSub}>
                  #{o.id} · {o.date}
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
                <Text style={styles.itemCost}>R{o.total.toLocaleString()}</Text>
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {o.status === "Pending" && (
                  <Pressable
                    style={styles.deliverButton}
                    onPress={() => markDelivered(o.id)}
                    disabled={!isLoaded}
                  >
                    <Text style={styles.deliverButtonText}>Mark Delivered</Text>
                  </Pressable>
                )}
                <Pressable style={styles.reorderButton}>
                  <Text style={styles.reorderButtonText}>↻ Reorder Same</Text>
                </Pressable>
              </View>
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
    newOrderButton: {
      backgroundColor: BRAND_GREEN,
      borderRadius: 10,
      paddingVertical: 10,
      alignItems: "center",
      marginTop: 12,
    },
    newOrderButtonText: { color: "#FFFFFF", fontWeight: "700", fontSize: 13 },
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