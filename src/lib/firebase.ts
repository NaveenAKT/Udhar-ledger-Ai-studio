/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

let app: any = null;
let db: any = null;
let auth: any = null;
let isFirebaseActive = false;

// Dynamically construct Firebase configuration, favoring environment variables for external deployment
// (like Vercel, Netlify, or Github Pages) with the auto-generated workspace config as a fallback.
const metaEnv = (import.meta as any).env || {};
const resolvedConfig = {
  apiKey: metaEnv.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey,
  authDomain: metaEnv.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfig.authDomain,
  projectId: metaEnv.VITE_FIREBASE_PROJECT_ID || firebaseConfig.projectId,
  storageBucket: metaEnv.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfig.storageBucket,
  messagingSenderId: metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfig.messagingSenderId,
  appId: metaEnv.VITE_FIREBASE_APP_ID || firebaseConfig.appId,
  measurementId: metaEnv.VITE_FIREBASE_MEASUREMENT_ID || firebaseConfig.measurementId,
  firestoreDatabaseId: metaEnv.VITE_FIREBASE_FIRESTORE_DATABASE_ID || firebaseConfig.firestoreDatabaseId,
};

// Check if firebase configuration has been set up with actual values
const hasConfig = resolvedConfig && resolvedConfig.apiKey && resolvedConfig.apiKey !== '' && !resolvedConfig.apiKey.includes('MY_GEMINI_API_KEY');

if (hasConfig) {
  try {
    if (getApps().length === 0) {
      app = initializeApp(resolvedConfig);
    } else {
      app = getApps()[0];
    }
    
    // Support either custom Firestore database instances or the default database instance
    if (resolvedConfig.firestoreDatabaseId && resolvedConfig.firestoreDatabaseId !== "" && resolvedConfig.firestoreDatabaseId !== "(default)") {
      db = getFirestore(app, resolvedConfig.firestoreDatabaseId);
    } else {
      db = getFirestore(app);
    }
    
    auth = getAuth(app);
    isFirebaseActive = true;
    console.log('Firebase initialized successfully connection verified!');
  } catch (error) {
    console.warn('Failed to initialize Firebase with current config, falling back to offline mode:', error);
  }
} else {
  console.log('No Firebase Config found or using defaults. Running in Resilient Client-Side Offline Mode.');
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const currentAuth = auth;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentAuth?.currentUser?.uid || null,
      email: currentAuth?.currentUser?.email || null,
      emailVerified: currentAuth?.currentUser?.emailVerified || null,
      isAnonymous: currentAuth?.currentUser?.isAnonymous || null,
      tenantId: currentAuth?.currentUser?.tenantId || null,
      providerInfo: currentAuth?.currentUser?.providerData?.map((provider: any) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error Payload: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export { app, db, auth, isFirebaseActive };
export { GoogleAuthProvider, signInWithPopup, signOut };
