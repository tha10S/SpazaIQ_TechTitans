import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';

import { router } from 'expo-router';


// ---------------------------------------------------------
// SAMPLE NOTIFICATIONS
// Later these can come from your database/backend.
// ---------------------------------------------------------

const notifications = [
  {
    id: 1,
    type: 'warning',
    title: 'Low Stock Alert',
    message: 'White Bread is running low. Only 8 units remaining.',
    time: '10 minutes ago',
    unread: true,
  },
  {
    id: 2,
    type: 'stock',
    title: 'Stock Added',
    message: '20 units of Coca-Cola 500ml were added to your stock.',
    time: '1 hour ago',
    unread: true,
  },
  {
    id: 3,
    type: 'sale',
    title: 'Sale Recorded',
    message: 'A sale of R150.00 was successfully recorded.',
    time: '2 hours ago',
    unread: false,
  },
  {
    id: 4,
    type: 'warning',
    title: 'Expiring Soon',
    message: '3 products are approaching their expiry date.',
    time: 'Yesterday',
    unread: false,
  },
];


// ---------------------------------------------------------
// NOTIFICATIONS SCREEN
// ---------------------------------------------------------

export default function NotificationsScreen() {

  return (
    <View style={styles.container}>

      {/* -------------------------------------------------
          HEADER
      ------------------------------------------------- */}

      <View style={styles.header}>

        {/* Back button */}

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>


        {/* Title */}

        <Text style={styles.title}>
          Notifications
        </Text>


        {/* Empty space keeps title centered */}

        <View style={styles.headerSpacer} />

      </View>


      {/* -------------------------------------------------
          NOTIFICATION LIST
      ------------------------------------------------- */}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >

        {/* Section heading */}

        <View style={styles.sectionHeader}>

          <Text style={styles.sectionTitle}>
            Recent
          </Text>

          <TouchableOpacity>
            <Text style={styles.markRead}>
              Mark all as read
            </Text>
          </TouchableOpacity>

        </View>


        {/* Notifications */}

        {notifications.map((notification) => (

          <TouchableOpacity
            key={notification.id}
            style={[
              styles.notificationCard,

              // Give unread notifications a slightly
              // different background.
              notification.unread && styles.unreadCard,
            ]}
          >

            {/* -------------------------------------------------
                NOTIFICATION ICON
            ------------------------------------------------- */}

            <View
              style={[
                styles.iconContainer,

                notification.type === 'warning' &&
                  styles.warningIcon,

                notification.type === 'stock' &&
                  styles.stockIcon,

                notification.type === 'sale' &&
                  styles.saleIcon,
              ]}
            >

              <Text style={styles.notificationIcon}>

                {notification.type === 'warning'
                  ? '⚠'
                  : notification.type === 'stock'
                  ? '📦'
                  : '💰'}

              </Text>

            </View>


            {/* -------------------------------------------------
                NOTIFICATION CONTENT
            ------------------------------------------------- */}

            <View style={styles.notificationContent}>

              <View style={styles.titleRow}>

                <Text style={styles.notificationTitle}>
                  {notification.title}
                </Text>


                {/* Unread indicator */}

                {notification.unread && (
                  <View style={styles.unreadDot} />
                )}

              </View>


              <Text style={styles.notificationMessage}>
                {notification.message}
              </Text>


              <Text style={styles.notificationTime}>
                {notification.time}
              </Text>

            </View>

          </TouchableOpacity>

        ))}


        {/* -------------------------------------------------
            EMPTY SPACE / END MESSAGE
        ------------------------------------------------- */}

        <View style={styles.endMessage}>

          <Text style={styles.endIcon}>
            ✓
          </Text>

          <Text style={styles.endText}>
            You're all caught up
          </Text>

        </View>

      </ScrollView>

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


  // -------------------------------------------------------
  // HEADER
  // -------------------------------------------------------

  header: {
    height: 100,

    paddingTop: 45,
    paddingHorizontal: 20,

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',

    backgroundColor: '#FFFFFF',

    borderBottomWidth: 1,
    borderBottomColor: '#EAEAEA',
  },

  backButton: {
    width: 40,
    height: 40,

    borderRadius: 20,

    backgroundColor: '#F2F3F5',

    alignItems: 'center',
    justifyContent: 'center',
  },

  backIcon: {
    fontSize: 32,
    color: '#222',

    marginTop: -4,
  },

  title: {
    fontSize: 21,
    fontWeight: '700',
    color: '#171717',
  },

  headerSpacer: {
    width: 40,
  },


  // -------------------------------------------------------
  // CONTENT
  // -------------------------------------------------------

  content: {
    paddingHorizontal: 20,
    paddingTop: 25,
    paddingBottom: 40,
  },


  // -------------------------------------------------------
  // SECTION HEADER
  // -------------------------------------------------------

  sectionHeader: {
    flexDirection: 'row',

    justifyContent: 'space-between',
    alignItems: 'center',

    marginBottom: 15,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#171717',
  },

  markRead: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F7A4D',
  },


  // -------------------------------------------------------
  // NOTIFICATION CARD
  // -------------------------------------------------------

  notificationCard: {
    backgroundColor: '#FFFFFF',

    borderRadius: 14,

    padding: 15,

    marginBottom: 12,

    flexDirection: 'row',

    borderWidth: 1,
    borderColor: '#EAEAEA',
  },

  unreadCard: {
    backgroundColor: '#F0F8F4',
    borderColor: '#D9EDE2',
  },


  // -------------------------------------------------------
  // ICON
  // -------------------------------------------------------

  iconContainer: {
    width: 48,
    height: 48,

    borderRadius: 24,

    alignItems: 'center',
    justifyContent: 'center',

    marginRight: 13,
  },

  warningIcon: {
    backgroundColor: '#FFF1E5',
  },

  stockIcon: {
    backgroundColor: '#EAF3FF',
  },

  saleIcon: {
    backgroundColor: '#E8F7ED',
  },

  notificationIcon: {
    fontSize: 20,
  },


  // -------------------------------------------------------
  // NOTIFICATION CONTENT
  // -------------------------------------------------------

  notificationContent: {
    flex: 1,
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',

    marginBottom: 5,
  },

  notificationTitle: {
    fontSize: 15,
    fontWeight: '700',

    color: '#202020',

    flex: 1,
  },

  unreadDot: {
    width: 8,
    height: 8,

    borderRadius: 4,

    backgroundColor: '#1F7A4D',

    marginLeft: 8,
  },

  notificationMessage: {
    fontSize: 13,

    lineHeight: 19,

    color: '#666',

    marginBottom: 7,
  },

  notificationTime: {
    fontSize: 11,

    color: '#999',
  },


  // -------------------------------------------------------
  // END MESSAGE
  // -------------------------------------------------------

  endMessage: {
    alignItems: 'center',

    paddingTop: 30,
    paddingBottom: 20,
  },

  endIcon: {
    width: 34,
    height: 34,

    borderRadius: 17,

    backgroundColor: '#E8F7ED',

    color: '#1F7A4D',

    textAlign: 'center',

    lineHeight: 34,

    fontSize: 18,

    marginBottom: 8,
  },

  endText: {
    fontSize: 13,
    color: '#999',
  },

});