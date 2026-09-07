import React from 'react';

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';

import {
  Ionicons,
  MaterialCommunityIcons,
} from '@expo/vector-icons';

import { SafeAreaView } from 'react-native-safe-area-context';


export default function HomeScreen({ navigation }) {

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>

      <StatusBar
        barStyle="dark-content"
        backgroundColor="#FFFFFF"
      />

      <View style={styles.container}>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >

          {/* =========================================
              HEADER
          ========================================= */}

          <View style={styles.header}>

            <View style={styles.storeInformation}>

              <View style={styles.storeAvatar}>
                <Text style={styles.storeAvatarText}>
                  T
                </Text>
              </View>

              <View>
                <Text style={styles.storeName}>
                  Thabo's Mini Mart
                </Text>

                <Text style={styles.storeLocation}>
                  Soweto, Johannesburg
                </Text>
              </View>

            </View>


            <TouchableOpacity
              style={styles.notificationButton}
              onPress={() => navigation.navigate('Notifications')}
            >
              <Ionicons
                name="notifications-outline"
                size={19}
                color="#263238"
              />
            </TouchableOpacity>

          </View>


          {/* =========================================
              OVERVIEW
          ========================================= */}

          <View style={styles.overviewGrid}>

            {/* Today's Sales */}

            <View style={styles.statCard}>

              <Text style={styles.statTitle}>
                Today's Sales
              </Text>

              <Text style={styles.statValue}>
                R2,450
              </Text>

              <Text style={styles.positiveChange}>
                +12%
              </Text>

            </View>


            {/* Today's Profit */}

            <View style={styles.statCard}>

              <Text style={styles.statTitle}>
                Today's Profit
              </Text>

              <Text style={styles.statValue}>
                R680
              </Text>

              <Text style={styles.positiveChange}>
                +8%
              </Text>

            </View>


            {/* Stock Value */}

            <View style={styles.statCard}>

              <Text style={styles.statTitle}>
                Stock Value
              </Text>

              <Text style={styles.statValue}>
                R18,200
              </Text>

              <Text style={styles.balancedText}>
                Balanced
              </Text>

            </View>


            {/* Credit Owed */}

            <View style={styles.statCard}>

              <Text style={styles.statTitle}>
                Credit Owed
              </Text>

              <Text style={styles.statValue}>
                R3,100
              </Text>

              <Text style={styles.creditText}>
                8 custom.
              </Text>

            </View>

          </View>


          {/* =========================================
              QUICK ACTIONS
          ========================================= */}

          <View style={styles.section}>

            <Text style={styles.sectionTitle}>
              QUICK ACTIONS
            </Text>


            <View style={styles.quickActionsRow}>

              <TouchableOpacity style={styles.actionButton}>

                <Ionicons
                  name="add-circle-outline"
                  size={16}
                  color="#00A86B"
                />

                <Text style={styles.actionText}>
                  Record Sale
                </Text>

              </TouchableOpacity>


              <TouchableOpacity style={styles.actionButton}>

                <Ionicons
                  name="cube-outline"
                  size={16}
                  color="#00A86B"
                />

                <Text style={styles.actionText}>
                  Add Stock
                </Text>

              </TouchableOpacity>


              <TouchableOpacity style={styles.actionButton}>

                <Ionicons
                  name="scan-outline"
                  size={16}
                  color="#00A86B"
                />

                <Text style={styles.actionText}>
                  Scan Barcode
                </Text>

              </TouchableOpacity>

            </View>


            {/* Suppliers / Reorders */}

            <View style={styles.secondaryActions}>

              <TouchableOpacity style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>
                  Suppliers
                </Text>
              </TouchableOpacity>


              <TouchableOpacity style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>
                  Reorders
                </Text>
              </TouchableOpacity>

            </View>

          </View>


          {/* =========================================
              WEEKLY SALES TREND
          ========================================= */}

          <View style={styles.salesCard}>

            <View style={styles.salesHeader}>

              <Text style={styles.salesTitle}>
                Weekly Sales Trend
              </Text>

              <Text style={styles.lastSevenDays}>
                Last 7 Days
              </Text>

            </View>


            <View style={styles.chart}>

              <View style={[styles.bar, { height: 16 }]} />
              <View style={[styles.bar, { height: 21 }]} />
              <View style={[styles.bar, { height: 13 }]} />
              <View style={[styles.bar, { height: 27 }]} />
              <View style={[styles.bar, { height: 34 }]} />
              <View style={[styles.bar, { height: 24 }]} />
              <View style={[styles.bar, { height: 40 }]} />

            </View>

          </View>


          {/* =========================================
              LOW STOCK ALERT
          ========================================= */}

          <View style={styles.warningCard}>

            <View style={styles.warningIcon}>
              <Ionicons
                name="warning-outline"
                size={17}
                color="#F59E0B"
              />
            </View>

            <View style={styles.warningInformation}>

              <Text style={styles.warningTitle}>
                3 Items Low Stock
              </Text>

              <Text style={styles.warningDescription}>
                Simba Chips & Albany Bread running thin.
              </Text>

            </View>

          </View>

        </ScrollView>


        {/* =========================================
            FLOATING CHAT BUTTON
        ========================================= */}

        <TouchableOpacity style={styles.chatButton}>

          <Ionicons
            name="chatbubble-outline"
            size={24}
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
    paddingHorizontal: 12,
    paddingBottom: 90,
  },


  // HEADER

  header: {
    height: 59,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 13,
    marginHorizontal: -12,
    paddingLeft: 13,
    paddingRight: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#E9EDF1',
  },

  storeInformation: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  storeAvatar: {
    width: 31,
    height: 31,
    borderRadius: 16,
    backgroundColor: '#00A86B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },

  storeAvatarText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  storeName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#20252B',
  },

  storeLocation: {
    fontSize: 9,
    color: '#89929D',
    marginTop: 1,
  },

  notificationButton: {
    width: 31,
    height: 31,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E7EBEF',
  },


  // STATISTICS

  overviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 7,
  },

  statCard: {
    width: '48.8%',
    height: 76,
    backgroundColor: '#FFFFFF',
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingTop: 10,
    marginBottom: 7,

    shadowColor: '#000',
    shadowOpacity: 0.025,
    shadowRadius: 3,
    shadowOffset: {
      width: 0,
      height: 1,
    },

    elevation: 1,
  },

  statTitle: {
    fontSize: 9,
    color: '#89929D',
    marginBottom: 4,
  },

  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#20252B',
  },

  positiveChange: {
    fontSize: 9,
    color: '#00A86B',
    fontWeight: '700',
    marginTop: 2,
  },

  balancedText: {
    fontSize: 9,
    color: '#00A86B',
    fontWeight: '600',
    marginTop: 2,
  },

  creditText: {
    fontSize: 9,
    color: '#00A86B',
    fontWeight: '600',
    marginTop: 2,
  },


  // QUICK ACTIONS

  section: {
    marginTop: 5,
  },

  sectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#707A84',
    marginBottom: 7,
  },

  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  actionButton: {
    height: 32,
    backgroundColor: '#E5F8F1',
    borderRadius: 15,
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  actionText: {
    color: '#00A86B',
    fontSize: 9,
    fontWeight: '700',
    marginLeft: 4,
  },

  secondaryActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 7,
  },

  secondaryButton: {
    width: '49%',
    height: 29,
    borderRadius: 13,
    backgroundColor: '#E5F8F1',
    alignItems: 'center',
    justifyContent: 'center',
  },

  secondaryButtonText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#00A86B',
  },


  // SALES

  salesCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 11,
    marginTop: 13,
    paddingHorizontal: 12,
    paddingTop: 11,
    paddingBottom: 10,
  },

  salesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  salesTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#20252B',
  },

  lastSevenDays: {
    fontSize: 8,
    color: '#89929D',
  },

  chart: {
    height: 48,
    marginTop: 7,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    paddingHorizontal: 3,
  },

  bar: {
    width: 5,
    backgroundColor: '#00A86B',
    borderRadius: 3,
  },


  // WARNING

  warningCard: {
    height: 48,
    marginTop: 10,
    borderRadius: 9,
    backgroundColor: '#FFF5D9',
    borderWidth: 1,
    borderColor: '#F4BD45',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
  },

  warningIcon: {
    marginRight: 7,
  },

  warningInformation: {
    flex: 1,
  },

  warningTitle: {
    fontSize: 9,
    fontWeight: '800',
    color: '#333333',
  },

  warningDescription: {
    fontSize: 8,
    color: '#8B7A4C',
    marginTop: 2,
  },


  // CHAT

  chatButton: {
    position: 'absolute',
    right: 13,
    bottom: 9,

    width: 40,
    height: 40,

    borderRadius: 20,

    backgroundColor: '#00A86B',

    alignItems: 'center',
    justifyContent: 'center',

    elevation: 5,

    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: {
      width: 0,
      height: 2,
    },
  },

});