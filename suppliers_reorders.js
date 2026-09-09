import { useState } from "react";
import {Pressable, ScrollView, StyleSheet, Text, TextInput, View} from "react-native";

const GREEN = "#06ad40";
const LIGHT_GREEN = "#E6F6ED";

const categoryColors = {
  Groceries: { bg: "#3bff90", text: "#ffffff" },
  Beverages: { bg: "#0963ff", text: "#ffffff" },
  Bakery: { bg: "#ffa928", text: "#ffffff" },
  Snacks: { bg: "#ff009082", text: "#ffffff" },
};

const statusColors = {
  Delivered: { bg: "#E6F6ED", text: GREEN },
  Pending: { bg: "#FDF3DC", text: "#B8860B" },
};

const CATEGORIES = Object.keys(categoryColors);

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

export default function SuppliersAndReorders() {
  const [tab, setTab] = useState("Suppliers");
  const [query, setQuery] = useState("");
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [orders, setOrders] = useState(initialOrders);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Suppliers</Text>

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
          setSuppliers={setSuppliers}
        />
      ) : (
        <OrdersTab orders={orders} setOrders={setOrders} />
      )}
    </ScrollView>
  );
}

function SuppliersTab({ query, setQuery, suppliers, setSuppliers }) {
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState(CATEGORIES[0]);
  const [newPhone, setNewPhone] = useState("");

  const [addItemFor, setAddItemFor] = useState(null); // supplier name, or null
  const [newItemName, setNewItemName] = useState("");
  const [newItemQty, setNewItemQty] = useState("");

  const filtered = suppliers.filter((s) =>
    s.name.toLowerCase().includes(query.toLowerCase()),
  );

  function submitSupplier() {
    if (!newName.trim()) return;
    setSuppliers((prev) => [
      ...prev,
      { name: newName.trim(), category: newCategory, phone: newPhone.trim(), items: [] },
    ]);
    setNewName("");
    setNewPhone("");
    setNewCategory(CATEGORIES[0]);
    setShowAddSupplier(false);
  }

  function submitItem(supplierName) {
    if (!newItemName.trim()) return;
    setSuppliers((prev) =>
      prev.map((s) =>
        s.name === supplierName
          ? {
              ...s,
              items: [
                ...s.items,
                {
                  name: newItemName.trim(),
                  qty: Number(newItemQty) || 1,
                  selected: true,
                },
              ],
            }
          : s,
      ),
    );
    setNewItemName("");
    setNewItemQty("");
    setAddItemFor(null);
  }

  function toggleItem(supplierName, itemIndex) {
    setSuppliers((prev) =>
      prev.map((s) =>
        s.name === supplierName
          ? {
              ...s,
              items: s.items.map((it, j) =>
                j === itemIndex ? { ...it, selected: !it.selected } : it,
              ),
            }
          : s,
      ),
    );
  }

  function removeSupplier(supplierName) {
    setSuppliers((prev) => prev.filter((s) => s.name !== supplierName));
  }

  return (
    <>
      <TextInput
        style={styles.searchInput}
        placeholder="Search suppliers..."
        placeholderTextColor="#999"
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
            placeholderTextColor="#999"
            value={newName}
            onChangeText={setNewName}
          />
          <TextInput
            style={styles.formInput}
            placeholder="Phone number"
            placeholderTextColor="#999"
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
          <Pressable style={styles.formSubmit} onPress={submitSupplier}>
            <Text style={styles.formSubmitText}>Save Supplier</Text>
          </Pressable>
        </View>
      )}

      {filtered.map((s, i) => {
        const catStyle = categoryColors[s.category] ?? {
          bg: "#EEE",
          text: "#666",
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

            <Text style={styles.phoneText}>📞 {s.phone}</Text>

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
                <TextInput
                  style={styles.formInput}
                  placeholder="Item name"
                  placeholderTextColor="#999"
                  value={newItemName}
                  onChangeText={setNewItemName}
                />
                <TextInput
                  style={styles.formInput}
                  placeholder="Quantity"
                  placeholderTextColor="#999"
                  value={newItemQty}
                  onChangeText={setNewItemQty}
                  keyboardType="number-pad"
                />
                <Pressable
                  style={styles.formSubmit}
                  onPress={() => submitItem(s.name)}
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
                🛒 New Order from {s.name.split(" ")[0]}
              </Text>
            </Pressable>
          </View>
        );
      })}
    </>
  );
}

function OrdersTab({ orders, setOrders }) {
  function markDelivered(orderId) {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: "Delivered" } : o)),
    );
  }

  return (
    <>
      {orders.map((o, i) => {
        const statusStyle = statusColors[o.status] ?? {
          bg: "#EEE",
          text: "#666",
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F2F2F2" },
  content: { padding: 20, paddingBottom: 40 },
  header: { fontSize: 24, fontWeight: "700", marginBottom: 16 },
  segmentWrap: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 4,
    marginBottom: 16,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: "center",
  },
  segmentActive: { backgroundColor: GREEN },
  segmentText: { color: "#888", fontWeight: "600" },
  segmentTextActive: { color: "#fff" },
  searchInput: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 10,
  },
  addButton: {
    backgroundColor: GREEN,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    marginBottom: 16,
  },
  addButtonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  formCard: {
    backgroundColor: "#FAFAFA",
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#EEE",
  },
  formInput: {
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  formSubmit: {
    backgroundColor: GREEN,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 4,
  },
  formSubmitText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  categoryPickOption: {
    borderWidth: 1,
    borderColor: "#E5E5E5",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 6,
    marginBottom: 6,
  },
  categoryPickSelected: { backgroundColor: GREEN, borderColor: GREEN },
  categoryPickText: { color: "#666", fontSize: 12, fontWeight: "600" },
  categoryPickTextSelected: { color: "#fff" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  itemTitle: { fontWeight: "700", fontSize: 15 },
  itemSub: { color: "#888", fontSize: 12, marginTop: 2 },
  itemCost: { fontWeight: "700", fontSize: 16, color: "#000" },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 11, fontWeight: "600" },
  phoneText: { color: "#555", fontSize: 13, marginTop: 8 },
  removeText: { color: "#D64545", fontSize: 12, fontWeight: "600" },
  addItemText: { color: GREEN, fontSize: 12, fontWeight: "600" },
  presetLabel: {
    fontSize: 10,
    color: "#999",
    fontWeight: "600",
    marginTop: 14,
    marginBottom: 8,
  },
  tagRow: { flexDirection: "row", flexWrap: "wrap" },
  tag: {
    backgroundColor: LIGHT_GREEN,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 6,
    marginBottom: 6,
  },
  tagUnselected: { backgroundColor: "#EDEDED" },
  tagText: { color: GREEN, fontSize: 12, fontWeight: "600" },
  tagTextUnselected: { color: "#999" },
  cardBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  newOrderButton: {
    backgroundColor: GREEN,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 12,
  },
  newOrderButtonText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  receiptLine: { color: "#555", fontSize: 13, marginTop: 6 },
  orderBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  reorderButton: {
    backgroundColor: LIGHT_GREEN,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  reorderButtonText: { color: GREEN, fontWeight: "700", fontSize: 13 },
  deliverButton: {
    backgroundColor: GREEN,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  deliverButtonText: { color: "#fff", fontWeight: "700", fontSize: 13 },
});