import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase/firebaseConfig';

const STORAGE_PREFIX = 'spazaiq:pos-credit-queue:v1:';
const SNAPSHOT_PREFIX = 'spazaiq:pos-credit-cache:v1:';
const handlers = new Map();
const listeners = new Map();
const storageLocks = new Map();
const snapshotWrites = new Map();
const syncPromises = new Map();

function storageKey(storeId) {
  return `${STORAGE_PREFIX}${encodeURIComponent(storeId)}`;
}

function snapshotKey(storeId, name) {
  return `${SNAPSHOT_PREFIX}${encodeURIComponent(storeId)}:${name}`;
}

export async function readPosCreditSnapshot(storeId, name) {
  const key = snapshotKey(storeId, name);
  await snapshotWrites.get(key);
  const serialized = await AsyncStorage.getItem(key);
  return serialized ? JSON.parse(serialized) : null;
}

export function savePosCreditSnapshot(storeId, name, value) {
  const key = snapshotKey(storeId, name);
  const previous = snapshotWrites.get(key) || Promise.resolve();
  const write = previous.then(() => AsyncStorage.setItem(key, JSON.stringify(value)));
  snapshotWrites.set(key, write.catch(() => undefined));
  return write;
}

async function readOperations(storeId) {
  const serialized = await AsyncStorage.getItem(storageKey(storeId));
  if (!serialized) return [];
  const operations = JSON.parse(serialized);
  if (!Array.isArray(operations)) throw new Error('The saved offline POS queue is invalid.');
  return operations;
}

function publish(storeId, operations) {
  for (const listener of listeners.get(storeId) || []) {
    try {
      listener(operations);
    } catch (error) {
      console.error('Could not update offline POS and credit status.', error);
    }
  }
}

function updateOperations(storeId, updater) {
  const previous = storageLocks.get(storeId) || Promise.resolve();
  const next = previous.then(async () => {
    const operations = await readOperations(storeId);
    const updated = updater(operations);
    await AsyncStorage.setItem(storageKey(storeId), JSON.stringify(updated));
    publish(storeId, updated);
    return updated;
  });
  storageLocks.set(storeId, next.catch(() => undefined));
  return next;
}

export function isNetworkError(error) {
  return ['unavailable', 'deadline-exceeded', 'network-request-failed'].includes(error?.code);
}

export async function isDeviceOffline() {
  const state = await Network.getNetworkStateAsync();
  return state.isConnected === false || state.isInternetReachable === false;
}

export function registerOfflineOperationHandler(type, handler) {
  if (typeof handler !== 'function') throw new Error('An offline operation handler must be a function.');
  handlers.set(type, handler);
}

export async function getOfflineOperations(storeId) {
  return readOperations(storeId);
}

export function subscribeOfflineOperations(storeId, onData, onError) {
  let active = true;
  const storeListeners = listeners.get(storeId) || new Set();
  storeListeners.add(onData);
  listeners.set(storeId, storeListeners);
  readOperations(storeId).then((operations) => {
    if (active) onData(operations);
  }).catch((error) => {
    if (active) onError?.(error);
  });

  return () => {
    active = false;
    storeListeners.delete(onData);
    if (storeListeners.size === 0) listeners.delete(storeId);
  };
}

export async function enqueueOfflineOperation(storeId, type, payload) {
  if (!handlers.has(type)) throw new Error(`No sync handler is registered for ${type}.`);
  const key = payload.idempotencyKey;
  if (!key) throw new Error('Offline POS and credit operations require an idempotency key.');
  const operation = {
    id: key,
    type,
    payload,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  const updated = await updateOperations(storeId, (operations) => {
    const existing = operations.find((item) => item.id === key);
    if (existing) {
      if (existing.type !== type || JSON.stringify(existing.payload) !== JSON.stringify(payload)) {
        throw new Error('This idempotency key is already used for a different offline operation.');
      }
      return operations;
    }
    return [...operations, operation];
  });
  syncPendingOfflineOperations(storeId).catch((error) => {
    console.error('Could not start syncing offline POS and credit operations.', error);
  });
  return updated.find((item) => item.id === key);
}

async function syncOperations(storeId) {
  if (auth.currentUser?.uid !== storeId) return;
  if (await isDeviceOffline()) return;
  let operations = await readOperations(storeId);
  if (operations.some((operation) => operation.status === 'syncing')) {
    operations = await updateOperations(storeId, (current) =>
      current.map((operation) => operation.status === 'syncing'
        ? { ...operation, status: 'pending' }
        : operation)
    );
  }

  for (const operation of operations) {
    if (auth.currentUser?.uid !== storeId) return;
    if (operation.status !== 'pending') continue;
    const handler = handlers.get(operation.type);
    if (!handler) throw new Error(`No sync handler is registered for ${operation.type}.`);

    await updateOperations(storeId, (current) =>
      current.map((item) => item.id === operation.id ? { ...item, status: 'syncing' } : item)
    );
    try {
      await handler(operation.payload);
      await updateOperations(storeId, (current) =>
        current.filter((item) => item.id !== operation.id)
      );
    } catch (error) {
      const status = isNetworkError(error) ? 'pending' : 'failed';
      await updateOperations(storeId, (current) =>
        current.map((item) => item.id === operation.id
          ? { ...item, status, error: error?.message || 'The server rejected this operation.' }
          : item)
      );
      if (status === 'pending') break;
    }
  }
}

export function syncPendingOfflineOperations(storeId) {
  if (syncPromises.has(storeId)) return syncPromises.get(storeId);
  const syncPromise = syncOperations(storeId).finally(() => syncPromises.delete(storeId));
  syncPromises.set(storeId, syncPromise);
  return syncPromise;
}

export function startPosCreditOfflineSync() {
  const syncForUser = (user) => {
    if (!user) return;
    syncPendingOfflineOperations(user.uid).catch((error) => {
      console.error('Could not sync offline POS and credit operations.', error);
    });
  };
  const authSubscription = onAuthStateChanged(auth, syncForUser);
  const networkSubscription = Network.addNetworkStateListener((state) => {
    if (state.isConnected === false || state.isInternetReachable === false) return;
    syncForUser(auth.currentUser);
  });
  return () => {
    authSubscription();
    networkSubscription.remove();
  };
}

startPosCreditOfflineSync();
