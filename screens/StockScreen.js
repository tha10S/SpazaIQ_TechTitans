import React from 'react';

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
} from 'react-native';

import {
  Ionicons,
  MaterialCommunityIcons,
} from '@expo/vector-icons';

import { SafeAreaView } from 'react-native-safe-area-context';

import mockData from '../services/mockData.json';


// Turn raw stock records from mockData into what the UI needs to display
const products = mockData.stock.map((item) => {
  let statusType = 'stock';
  let status = 'In Stock';

  if (item.quantity === 0) {
    statusType = 'out';
    status = 'Out of Stock';
  } else if (item.atRisk && item.riskReason === 'low-stock') {
    statusType = 'low';
    status = 'Low Stock';
  }

  return {
    name: item.name,
    quantity: item.quantity,
    price: `R${item.sellPrice.toFixed(2)}`,
    status,
    statusType,
    expiryDate: item.expiryDate,
    nearExpiry: item.atRisk && item.riskReason === 'near-expiry',
  };
});

const totalItems = products.length;
const lowStockCount = products.filter((p) => p.statusType === 'low').length;
const expiringSoonCount = products.filter((p) => p.nearExpiry).length;


export default function StockScreen() {

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>

      <StatusBar
        barStyle="dark-content"
        backgroundColor="#F5F7F8"
      />

      <View style={styles.container}>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >

          {/* =========================================
              HEADER
          ========================================= */}

          <Text style={styles.pageTitle}>
            Stock Management
          </Text>


          {/* =========================================
              SEARCH
          ========================================= */}

          <View style={styles.searchRow}>

            <View style={styles.searchContainer}>

              <Ionicons
                name="search-outline"
                size={17}
                color="#A5AFBA"
              />

              <TextInput
                placeholder="Search stock..."
                placeholderTextColor="#A5AFBA"
                style={styles.searchInput}
              />

            </View>


            <TouchableOpacity style={styles.scanButton}>

              <Ionicons
                name="scan-outline"
                size={20}
                color="#FFFFFF"
              />

            </TouchableOpacity>

          </View>


          {/* =========================================
              STOCK SUMMARY
          ========================================= */}

          <View style={styles.summaryRow}>

            <View style={styles.summaryCard}>

              <Text style={styles.summaryLabel}>
                Total Items
              </Text>

              <Text style={styles.summaryValue}>
                {totalItems}
              </Text>

            </View>


            <View style={styles.summaryCard}>

              <Text style={styles.summaryLabel}>
                Low Stock
              </Text>

              <Text style={[styles.summaryValue, styles.orangeText]}>
                {lowStockCount}
              </Text>

            </View>


            <View style={styles.summaryCard}>

              <Text style={styles.summaryLabel}>
                Expiring Soon
              </Text>

              <Text style={[styles.summaryValue, styles.orangeText]}>
                {expiringSoonCount}
              </Text>

            </View>

          </View>


          {/* =========================================
              SUPPLIERS / REORDERS
          ========================================= */}

          <View style={styles.actionRow}>

            <TouchableOpacity style={styles.actionButton}>
              <Text style={styles.actionText}>
                Suppliers
              </Text>
            </TouchableOpacity>


            <TouchableOpacity style={styles.actionButton}>
              <Text style={styles.actionText}>
                Reorders
              </Text>
            </TouchableOpacity>

          </View>


          {/* =========================================
              PRODUCT CATALOG
          ========================================= */}

          <Text style={styles.catalogTitle}>
            PRODUCT CATALOG
          </Text>


          <View>

            {products.map((product, index) => (

              <TouchableOpacity
                key={index}
                style={styles.productCard}
                activeOpacity={0.8}
              >

                <View style={styles.productInformation}>

                  <Text
                    style={styles.productName}
                    numberOfLines={1}
                  >
                    {product.name}
                  </Text>

                  <Text style={styles.productDetails}>
                    Qty: {product.quantity}   •   Price: {product.price}
                  </Text>

                </View>


                <View
                  style={[
                    styles.statusBadge,
                    product.statusType === 'low' && styles.lowBadge,
                    product.statusType === 'stock' && styles.stockBadge,
                    product.statusType === 'out' && styles.outBadge,
                  ]}
                >

                  <Text
                    style={[
                      styles.statusText,
                      product.statusType === 'low' && styles.lowText,
                      product.statusType === 'stock' && styles.stockText,
                      product.statusType === 'out' && styles.outText,
                    ]}
                  >
                    {product.status}
                  </Text>

                </View>

              </TouchableOpacity>

            ))}

          </View>

        </ScrollView>


        {/* =========================================
            ADD STOCK FLOATING BUTTON
        ========================================= */}

        <TouchableOpacity style={styles.addButton}>

          <Ionicons
            name="add"
            size={27}
            color="#FFFFFF"
          />

        </TouchableOpacity>


        {/* =========================================
            CHAT BUTTON
        ========================================= */}

        <TouchableOpacity style={styles.chatButton}>

          <Ionicons
            name="chatbubble-outline"
            size={23}
            color="#FFFFFF"
          />

        </TouchableOpacity>

      </View>

    </SafeAreaView>
  );
}


const styles = StyleSheet.create({

  safeArea: {
    flex: 1,
    backgroundColor: '#F5F7F8',
  },

  container: {
    flex: 1,
    backgroundColor: '#F5F7F8',
  },

  scrollContent: {
    paddingHorizontal: 13,
    paddingTop: 10,
    paddingBottom: 100,
  },


  // HEADER

  pageTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#20252B',
    marginBottom: 9,
  },


  // SEARCH

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  searchContainer: {
    flex: 1,
    height: 33,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E1E6EA',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
  },

  searchInput: {
    flex: 1,
    height: 33,
    marginLeft: 6,
    fontSize: 10,
    color: '#20252B',
  },

  scanButton: {
    width: 33,
    height: 33,
    borderRadius: 8,
    backgroundColor: '#00A86B',
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },


  // SUMMARY

  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },

  summaryCard: {
    width: '31.8%',
    height: 47,
    backgroundColor: '#FFFFFF',
    borderRadius: 9,
    paddingHorizontal: 8,
    paddingTop: 7,
  },

  summaryLabel: {
    fontSize: 7.5,
    color: '#89929D',
  },

  summaryValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#252A30',
    marginTop: 2,
  },

  orangeText: {
    color: '#F59E0B',
  },


  // ACTIONS

  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 5,
  },

  actionButton: {
    width: '49%',
    height: 29,
    borderRadius: 9,
    backgroundColor: '#E5F8F1',
    alignItems: 'center',
    justifyContent: 'center',
  },

  actionText: {
    color: '#00A86B',
    fontSize: 9,
    fontWeight: '700',
  },


  // CATALOG

  catalogTitle: {
    fontSize: 9,
    fontWeight: '800',
    color: '#7B858F',
    marginTop: 11,
    marginBottom: 6,
  },


  // PRODUCT CARD

  productCard: {
    minHeight: 48,
    backgroundColor: '#FFFFFF',
    borderRadius: 9,
    marginBottom: 7,
    paddingHorizontal: 10,
    paddingVertical: 7,

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  productInformation: {
    flex: 1,
    paddingRight: 6,
  },

  productName: {
    fontSize: 10,
    fontWeight: '800',
    color: '#252A30',
  },

  productDetails: {
    fontSize: 8,
    color: '#89929D',
    marginTop: 3,
  },


  // STATUS

  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 5,
  },

  statusText: {
    fontSize: 7,
    fontWeight: '700',
  },

  lowBadge: {
    backgroundColor: '#FFF1C9',
  },

  lowText: {
    color: '#F59E0B',
  },

  stockBadge: {
    backgroundColor: '#E4F8EF',
  },

  stockText: {
    color: '#00A86B',
  },

  outBadge: {
    backgroundColor: '#FFE4E4',
  },

  outText: {
    color: '#EF5350',
  },


  // FLOATING ADD

  addButton: {
    position: 'absolute',

    right: 13,
    bottom: 60,

    width: 40,
    height: 40,

    borderRadius: 20,

    backgroundColor: '#00A86B',

    alignItems: 'center',
    justifyContent: 'center',

    elevation: 6,

    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: {
      width: 0,
      height: 2,
    },
  },


  // CHAT

  chatButton: {
    position: 'absolute',

    right: 13,
    bottom: 11,

    width: 40,
    height: 40,

    borderRadius: 20,

    backgroundColor: '#00A86B',

    alignItems: 'center',
    justifyContent: 'center',

    elevation: 6,

    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: {
      width: 0,
      height: 2,
    },
  },

});