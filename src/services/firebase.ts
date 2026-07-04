import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, Auth, GoogleAuthProvider, OAuthProvider, linkWithCredential, signInWithCredential, AuthCredential } from 'firebase/auth';
import { Firestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getDatabase, Database } from 'firebase/database';

import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL || `https://${process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com`,
};

const isConfigured = !!firebaseConfig.projectId;

let app;
let auth: Auth | null = null;
let db: Firestore | null = null;
let rtdb: Database | null = null;

if (isConfigured) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    db = initializeFirestore(app, {
      localCache: persistentLocalCache(
        Platform.OS === 'web'
          ? { tabManager: persistentMultipleTabManager() }
          : {}
      ),
    });
    rtdb = getDatabase(app);
  } catch (e) {
    console.warn('Firebase initialization failed:', e);
  }
}

export { auth, db, rtdb, isConfigured, GoogleAuthProvider, OAuthProvider, linkWithCredential, signInWithCredential, AuthCredential };
