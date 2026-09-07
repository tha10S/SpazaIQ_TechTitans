import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from 'react-native';

// ---------------------------------------------------------
// SAMPLE STOCK DATA
// Later, this can come from your database/backend.
// ---------------------------------------------------------

const products = [
  {
    id: 1,
    name: 'Coca-Cola 500ml',
    quantity: 24,
    price: 15.0,
    status: 'In Stock',
  },
  {
    id: 2,
    name: 'White Bread',
    quantity: 8,
    price: 18.0,
    status: 'Low Stock',
  },
  {
    id: 3,
    name: 'Aromat 75g',
    quantity: 15,
    price: 22.0,
    status: 'In Stock',
  },
  {
    id: 4,
    name: 'Milk 1L',
    quantity: 4,
    price: 20.0,
    status: 'Low Stock',
  },
  {
    id: 5,
    name: 'Simba Chips',
    quantity: 32,
    price: 12.0,
    status: 'In Stock',
  },
];

// ---------------------------------------------------------
// STOCK SCREEN
// ---------------------------------------------------------

export default function StockScreen() {

  // Stores whatever the user types into the search box
  const [searchText, setSearchText] = useState('');

  // Filter products based on search
  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(searchText.toLowerCase())
  );

  return (
    <View style={styles.container}>

      {/* ---------------------------------------------------
          MAIN SCROLLABLE CONTENT
      --------------------------------------------------- */}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >

        {/* -------------------------------------------------
            HEADER
        ------------------------------------------------- */}

        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Stock Management</Text>
            <Text style={styles.subtitle}>
              Manage your products and inventory
            </Text>
          </View>

          {/* Scan button */}
          <TouchableOpacity style={styles.scanButton}>
            <Text style={styles.scanIcon}>▣</Text>
            <Text style={styles.scanText}>Scan</Text>
          </TouchableOpacity>
        </View>


        {/* -------------------------------------------------
            SEARCH BAR
        ------------------------------------------------- */}

        <View style={styles.searchContainer}>

          <Text style={styles.searchIcon}>⌕</Text>

          <TextInput
            style={styles.searchInput}
            placeholder="Search stock..."
            placeholderTextColor="#999"
            value={searchText}
            onChangeText={setSearchText}
          />

        </View>


        {/* -------------------------------------------------
            STOCK SUMMARY
        ------------------------------------------------- */}

        <View style={styles.summaryRow}>

          {/* Total Items */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryIcon}>📦</Text>

            <Text style={styles.summaryNumber}>
              83
            </Text>

            <Text style={styles.summaryLabel}>
              Total Items
            </Text>
          </View>


          {/* Low Stock */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryIcon}>⚠</Text>

            <Text style={styles.summaryNumber}>
              12
            </Text>

            <Text style={styles.summaryLabel}>
              Low Stock
            </Text>
          </View>


          {/* Expiring Soon */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryIcon}>⏱</Text>

            <Text style={styles.summaryNumber}>
              3
            </Text>

            <Text style={styles.summaryLabel}>
              Expiring Soon
            </Text>
          </View>

        </View>


        {/* -------------------------------------------------
            PRODUCT SECTION HEADER
        ------------------------------------------------- */}

        <View style={styles.sectionHeader}>

          <Text style={styles.sectionTitle}>
            Products
          </Text>

          <Text style={styles.productCount}>
            {filteredProducts.length} items
          </Text>

        </View>


        {/* -------------------------------------------------
            PRODUCT LIST
        ------------------------------------------------- */}

        {filteredProducts.map((product) => (

          <TouchableOpacity
            key={product.id}
            style={styles.productCard}
            activeOpacity={0.7}
          >

            {/* Product icon */}
            <View style={styles.productImage}>
              <Text style={styles.productEmoji}>📦</Text>
            </View>


            {/* Product information */}
            <View style={styles.productInfo}>

              <Text style={styles.productName}>
                {product.name}
              </Text>

              <Text style={styles.productPrice}>
                R{product.price.toFixed(2)}
              </Text>

              <Text style={styles.quantity}>
                {product.quantity} units
              </Text>

            </View>


            {/* Stock status */}
            <View
              style={[
                styles.statusBadge,
                product.status === 'Low Stock'
                  ? styles.lowStockBadge
                  : styles.inStockBadge,
              ]}
            >

              <Text
                style={[
                  styles.statusText,
                  product.status === 'Low Stock'
                    ? styles.lowStockText
                    : styles.inStockText,
                ]}
              >
                {product.status}
              </Text>

            </View>

          </TouchableOpacity>

        ))}


        {/* Empty search result */}
        {filteredProducts.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📦</Text>

            <Text style={styles.emptyTitle}>
              No products found
            </Text>

            <Text style={styles.emptyText}>
              Try searching for a different product.
            </Text>
          </View>
        )}

      </ScrollView>


      {/* ---------------------------------------------------
          FLOATING ADD BUTTON
      --------------------------------------------------- */}

      <TouchableOpacity
        style={styles.addButton}
        activeOpacity={0.8}
      >
        <Text style={styles.addButtonText}>+</Text>
      </TouchableOpacity>

    </View>
  );
}


// =========================================================
// STYLES
// =========================================================

const styles = StyleSheet.create({

  // -------------------------------------------------------
  // MAIN CONTAINER
  // -------------------------------------------------------

  container: {
    flex: 1,
    backgroundColor: '#F7F8FA',
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 55,

    // Gives the content space above the native bottom tabs
    paddingBottom: 130,
  },


  // -------------------------------------------------------
  // HEADER
  // -------------------------------------------------------

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 22,
  },

  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#171717',
  },

  subtitle: {
    fontSize: 14,
    color: '#777',
    marginTop: 5,
  },


  // -------------------------------------------------------
  // SCAN BUTTON
  // -------------------------------------------------------

  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 10,

    borderWidth: 1,
    borderColor: '#E5E5E5',
  },

  scanIcon: {
    fontSize: 16,
    marginRight: 5,
  },

  scanText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#222',
  },


  // -------------------------------------------------------
  // SEARCH
  // -------------------------------------------------------

  searchContainer: {
    height: 50,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,

    flexDirection: 'row',
    alignItems: 'center',

    paddingHorizontal: 15,

    borderWidth: 1,
    borderColor: '#E7E7E7',

    marginBottom: 20,
  },

  searchIcon: {
    fontSize: 25,
    color: '#777',
    marginRight: 8,
  },

  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#222',
  },


  // -------------------------------------------------------
  // SUMMARY CARDS
  // -------------------------------------------------------

  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 28,
  },

  summaryCard: {
    width: '31.5%',
    backgroundColor: '#FFFFFF',

    borderRadius: 14,

    paddingVertical: 15,
    paddingHorizontal: 8,

    alignItems: 'center',

    borderWidth: 1,
    borderColor: '#EAEAEA',
  },

  summaryIcon: {
    fontSize: 20,
    marginBottom: 7,
  },

  summaryNumber: {
    fontSize: 21,
    fontWeight: '700',
    color: '#171717',
  },

  summaryLabel: {
    fontSize: 11,
    color: '#777',
    marginTop: 4,
    textAlign: 'center',
  },


  // -------------------------------------------------------
  // PRODUCTS HEADER
  // -------------------------------------------------------

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',

    marginBottom: 12,
  },

  sectionTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#171717',
  },

  productCount: {
    fontSize: 13,
    color: '#777',
  },


  // -------------------------------------------------------
  // PRODUCT CARD
  // -------------------------------------------------------

  productCard: {
    backgroundColor: '#FFFFFF',

    borderRadius: 14,

    padding: 14,

    marginBottom: 12,

    flexDirection: 'row',
    alignItems: 'center',

    borderWidth: 1,
    borderColor: '#EAEAEA',
  },

  productImage: {
    width: 54,
    height: 54,

    borderRadius: 12,

    backgroundColor: '#F1F2F4',

    justifyContent: 'center',
    alignItems: 'center',

    marginRight: 13,
  },

  productEmoji: {
    fontSize: 25,
  },

  productInfo: {
    flex: 1,
  },

  productName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#202020',

    marginBottom: 4,
  },

  productPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#222',
  },

  quantity: {
    fontSize: 12,
    color: '#888',
    marginTop: 3,
  },


  // -------------------------------------------------------
  // STOCK STATUS
  // -------------------------------------------------------

  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 5,

    borderRadius: 20,
  },

  inStockBadge: {
    backgroundColor: '#E8F7ED',
  },

  lowStockBadge: {
    backgroundColor: '#FFF1E5',
  },

  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },

  inStockText: {
    color: '#2D8A4E',
  },

  lowStockText: {
    color: '#D66A00',
  },


  // -------------------------------------------------------
  // EMPTY SEARCH
  // -------------------------------------------------------

  emptyContainer: {
    alignItems: 'center',
    paddingTop: 50,
  },

  emptyIcon: {
    fontSize: 40,
    marginBottom: 10,
  },

  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
  },

  emptyText: {
    fontSize: 13,
    color: '#888',
    marginTop: 5,
  },


  // -------------------------------------------------------
  // FLOATING ADD BUTTON
  // -------------------------------------------------------

  addButton: {
    position: 'absolute',

    right: 22,

    // Positioned above the NativeTabs navigation
    bottom: 90,

    width: 58,
    height: 58,

    borderRadius: 29,

    backgroundColor: '#1F7A4D',

    justifyContent: 'center',
    alignItems: 'center',

    elevation: 6,

    shadowOffset: {
      width: 0,
      height: 3,
    },

    shadowOpacity: 0.25,

    shadowRadius: 5,
  },

  addButtonText: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '300',

    lineHeight: 34,
  },

});




