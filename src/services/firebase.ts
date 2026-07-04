import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, Auth, GoogleAuthProvider, OAuthProvider, linkWithCredential, signInWithCredential, AuthCredential } from 'firebase/auth';
import { Firestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, getFirestore } from 'firebase/firestore';
import { getDatabase, Database } from 'firebase/database';

// ─── POLYFILLS FOR FIREBASE WEB SDK ON NATIVE MOBILE (HERMES ENGINE) ────────
if (typeof TextEncoder === 'undefined') {
  (globalThis as any).TextEncoder = class TextEncoder {
    encode(str: string) {
      const utf8 = unescape(encodeURIComponent(str));
      const arr = new Uint8Array(utf8.length);
      for (let i = 0; i < utf8.length; i++) {
        arr[i] = utf8.charCodeAt(i);
      }
      return arr;
    }
  };
}

if (typeof TextDecoder === 'undefined') {
  (globalThis as any).TextDecoder = class TextDecoder {
    decode(arr: Uint8Array) {
      let str = '';
      for (let i = 0; i < arr.length; i++) {
        str += String.fromCharCode(arr[i]);
      }
      return decodeURIComponent(escape(str));
    }
  };
}

if (typeof btoa === 'undefined') {
  (globalThis as any).btoa = function (str: string) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let result = '';
    let i = 0;
    while (i < str.length) {
      const c1 = str.charCodeAt(i++) || 0;
      const c2 = str.charCodeAt(i++) || 0;
      const c3 = str.charCodeAt(i++) || 0;
      
      const byte1 = c1 >> 2;
      const byte2 = ((c1 & 3) << 4) | (c2 >> 4);
      const byte3 = ((c2 & 15) << 2) | (c3 >> 6);
      const byte4 = c3 & 63;
      
      const p3 = i - 1 > str.length ? '=' : chars.charAt(byte3);
      const p4 = i > str.length ? '=' : chars.charAt(byte4);
      
      result += chars.charAt(byte1) + chars.charAt(byte2) + p3 + p4;
    }
    return result;
  };
}

if (typeof atob === 'undefined') {
  (globalThis as any).atob = function (str: string) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let result = '';
    let i = 0;
    const cleanStr = str.replace(/=/g, '');
    while (i < cleanStr.length) {
      const c1 = chars.indexOf(cleanStr.charAt(i++) || '');
      const c2 = chars.indexOf(cleanStr.charAt(i++) || '');
      const c3 = i - 1 < cleanStr.length ? chars.indexOf(cleanStr.charAt(i++) || '') : -1;
      const c4 = i < cleanStr.length ? chars.indexOf(cleanStr.charAt(i++) || '') : -1;
      
      const byte1 = (c1 << 2) | (c2 >> 4);
      result += String.fromCharCode(byte1);
      
      if (c3 !== -1) {
        const byte2 = ((c2 & 15) << 4) | (c3 >> 2);
        result += String.fromCharCode(byte2);
      }
      if (c4 !== -1) {
        const byte3 = ((c3 & 3) << 6) | c4;
        result += String.fromCharCode(byte3);
      }
    }
    return result;
  };
}

if (typeof crypto === 'undefined') {
  (globalThis as any).crypto = {
    getRandomValues: function (arr: any) {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    }
  };
}
// ────────────────────────────────────────────────────────────────────────────

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
    
    if (Platform.OS === 'web') {
      db = initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      });
    } else {
      db = getFirestore(app);
    }
    
    rtdb = getDatabase(app);
  } catch (e) {
    console.warn('Firebase initialization failed:', e);
  }
}

export { auth, db, rtdb, isConfigured, GoogleAuthProvider, OAuthProvider, linkWithCredential, signInWithCredential, AuthCredential };
