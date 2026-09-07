import React from 'react';
import { router } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.shopName}>Thabo's Mini Mart</Text>
          <Text style={styles.location}>Good morning, Thabo!</Text>
        </View>
       <TouchableOpacity
  onPress={() => router.push('/notifications')}
>
  <Text>🔔</Text>
</TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Statistics */}
        <View style={styles.statsContainer}>

          <View style={styles.statCard}>
            <Text style={styles.statTitle}>Today's Sales</Text>
            <Text style={styles.statValue}>R2,450</Text>
            <Text style={styles.positive}>+12%</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statTitle}>Today's Profit</Text>
            <Text style={styles.statValue}>R680</Text>
            <Text style={styles.positive}>+8%</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statTitle}>Stock Value</Text>
            <Text style={styles.statValue}>R18,200</Text>
            <Text style={styles.positive}>Balanced</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statTitle}>Credit Owed</Text>
            <Text style={styles.statValue}>R3,100</Text>
            <Text style={styles.credit}>8 customers</Text>
          </View>

        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>

        <View style={styles.actionsContainer}>

          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionText}>⊕ Record Sale</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionText}>◇ Add Stock</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionText}>⌗ Scan Barcode</Text>
          </TouchableOpacity>

        </View>

        {/* Weekly Sales */}
        <View style={styles.salesCard}>

          <View style={styles.salesHeader}>
            <Text style={styles.salesTitle}>Weekly Sales Trend</Text>
            <Text style={styles.lastDays}>Last 7 Days</Text>
          </View>

          <View style={styles.chart}>
            <View style={[styles.bar, { height: 25 }]} />
            <View style={[styles.bar, { height: 38 }]} />
            <View style={[styles.bar, { height: 20 }]} />
            <View style={[styles.bar, { height: 45 }]} />
            <View style={[styles.bar, { height: 55 }]} />
            <View style={[styles.bar, { height: 35 }]} />
            <View style={[styles.bar, { height: 62 }]} />
          </View>

        </View>

        {/* Low Stock Warning */}
        <View style={styles.warning}>

          <Text style={styles.warningIcon}>⚠</Text>

          <View>
            <Text style={styles.warningTitle}>
              3 Items Low Stock
            </Text>

            <Text style={styles.warningText}>
              Simba Chips & Albany bread running thin.
            </Text>
          </View>

        </View>

        <View style={{ height: 100 }} />

      </ScrollView>

      {/* Floating Button */}
      <TouchableOpacity style={styles.floatingButton}>
        <Text style={styles.plus}>+</Text>
      </TouchableOpacity>

    </View>
  );
}

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: '#F5F6F8',
  },

  header: {
    paddingTop: 55,
    paddingHorizontal: 20,
    paddingBottom: 15,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  shopName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },

  location: {
    fontSize: 13,
    color: '#777777',
    marginTop: 3,
  },

  notification: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F2F3F5',
    justifyContent: 'center',
    alignItems: 'center',
  },

  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    gap: 10,
  },

  statCard: {
    width: '47.5%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 15,
    elevation: 2,
  },

  statTitle: {
    fontSize: 12,
    color: '#777777',
  },

  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginTop: 6,
  },

  positive: {
    color: '#00A86B',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },

  credit: {
    color: '#00A86B',
    fontSize: 12,
    marginTop: 4,
  },

  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#777777',
    marginHorizontal: 15,
    marginTop: 8,
    marginBottom: 8,
  },

  actionsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    gap: 7,
  },

  actionButton: {
    backgroundColor: '#E6F8F1',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 20,
  },

  actionText: {
    color: '#00A86B',
    fontSize: 11,
    fontWeight: '600',
  },

  salesCard: {
    backgroundColor: '#FFFFFF',
    margin: 12,
    padding: 15,
    borderRadius: 12,
  },

  salesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  salesTitle: {
    fontSize: 14,
    fontWeight: '600',
  },

  lastDays: {
    fontSize: 11,
    color: '#888888',
  },

  chart: {
    height: 80,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    marginTop: 15,
  },

  bar: {
    width: 6,
    backgroundColor: '#00A86B',
    borderRadius: 5,
  },

  warning: {
    marginHorizontal: 12,
    backgroundColor: '#FFF4D6',
    borderWidth: 1,
    borderColor: '#F5C542',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },

  warningIcon: {
    fontSize: 22,
    marginRight: 10,
  },

  warningTitle: {
    fontWeight: '700',
    fontSize: 13,
  },

  warningText: {
    color: '#777777',
    fontSize: 10,
    marginTop: 3,
  },

  floatingButton: {
    position: 'absolute',
    right: 20,
    bottom: 25,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#00A86B',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
  },

  plus: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '300',
  },

});
