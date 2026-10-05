import React from 'react';

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { SafeAreaView } from 'react-native-safe-area-context';


export default function NotificationsScreen({ navigation }) {

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>

      <StatusBar
        barStyle="dark-content"
        backgroundColor="#F5F7F8"
      />

      <View style={styles.container}>

        {/* Header */}

        <View style={styles.header}>

          {/* Back Button */}

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >

            <Ionicons
              name="arrow-back"
              size={22}
              color="#20252B"
            />

          </TouchableOpacity>


          {/* Title */}

          <Text style={styles.title}>
            Notifications
          </Text>


          {/* Empty space to keep title centered */}

          <View style={styles.headerSpacer} />

        </View>


        {/* Empty notification area */}

        <View style={styles.emptyContainer}>

          <Ionicons
            name="notifications-outline"
            size={42}
            color="#C5CDD4"
          />

          <Text style={styles.emptyTitle}>
            No notifications
          </Text>

          <Text style={styles.emptyText}>
            You're all caught up.
          </Text>

        </View>

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


  // -----------------------------
  // HEADER
  // -----------------------------

  header: {
    height: 56,

    backgroundColor: '#FFFFFF',

    flexDirection: 'row',
    alignItems: 'center',

    justifyContent: 'space-between',

    paddingHorizontal: 13,

    borderBottomWidth: 1,
    borderBottomColor: '#E9EDF1',
  },

  backButton: {
    width: 34,
    height: 34,

    alignItems: 'center',
    justifyContent: 'center',

    borderRadius: 17,
  },

  title: {
    fontSize: 17,
    fontWeight: '800',
    color: '#20252B',
  },

  headerSpacer: {
    width: 34,
  },


  // -----------------------------
  // EMPTY STATE
  // -----------------------------

  emptyContainer: {
    flex: 1,

    alignItems: 'center',
    justifyContent: 'center',

    paddingBottom: 80,
  },

  emptyTitle: {
    marginTop: 12,

    fontSize: 15,
    fontWeight: '700',

    color: '#505A64',
  },

  emptyText: {
    marginTop: 4,

    fontSize: 11,

    color: '#9AA3AC',
  },

});