import { initializeApp, getApps, getApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence, getAuth } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDAalvkuyEskTZ-XWUAfhFNAbGRMv0gtkA",
  authDomain: "spazaiq.firebaseapp.com",
  projectId: "spazaiq",
  storageBucket: "spazaiq.firebasestorage.app",
  messagingSenderId: "570116438935",
  appId: "1:570116438935:web:9e3f9b8dea4659d5e5e2d2",
  measurementId: "G-7ELPF31VMG"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch (e) {
  auth = getAuth(app); // already initialized (happens on fast refresh)
}

export { app, auth };
let db;
try {
  db = Platform.OS === 'web'
    ? initializeFirestore(app, {
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      })
    : getFirestore(app);
} catch (e) {
  db = getFirestore(app);
}

export { db };