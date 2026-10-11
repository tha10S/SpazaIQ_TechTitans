import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { subscribeOfflineOperations } from '../services/offline/posCreditQueue';

const OPERATION_LABELS = {
  recordSale: 'POS sale',
  addCreditTransaction: 'credit entry',
  makePayment: 'credit payment',
};

export function OfflineSyncNotice({ storeId }) {
  const [operations, setOperations] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => subscribeOfflineOperations(
    storeId,
    setOperations,
    (loadError) => setError(loadError.message || 'Offline sync status could not be loaded.')
  ), [storeId]);

  const waiting = operations.filter((operation) =>
    operation.status === 'pending' || operation.status === 'syncing'
  );
  const failed = operations.filter((operation) => operation.status === 'failed');
  if (!waiting.length && !failed.length && !error) return null;

  return (
    <View accessibilityRole="alert" style={[styles.notice, failed.length > 0 && styles.failedNotice]}>
      {error ? <Text style={styles.message}>{error}</Text> : null}
      {waiting.length > 0 ? (
        <Text style={styles.message}>
          {waiting.length} saved {waiting.length === 1 ? 'change is' : 'changes are'} waiting to sync.
          The server will validate them when the device reconnects.
        </Text>
      ) : null}
      {failed.map((operation) => (
        <Text key={operation.id} style={styles.message}>
          {OPERATION_LABELS[operation.type] || 'Offline operation'} was not accepted: {operation.error}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    marginBottom: 14,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#FEF3C7',
  },
  failedNotice: {
    backgroundColor: '#FEE2E2',
  },
  message: {
    color: '#7C2D12',
    fontSize: 13,
    lineHeight: 18,
  },
});
