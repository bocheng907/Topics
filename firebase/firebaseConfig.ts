// firebase/firebaseConfig.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { initializeAuth, getAuth, connectAuthEmulator } from "firebase/auth";
import * as FirebaseAuth from "firebase/auth";
import type { Persistence } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getStorage, connectStorageEmulator } from "firebase/storage";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

// Explicit opt-in for isolated browser walkthroughs. Never fall back to live
// Firebase if this mode is requested from an unsupported origin.
const walkthrough = process.env.EXPO_PUBLIC_LOCAL_WALKTHROUGH === "1";
if (walkthrough && typeof document !== "undefined" && typeof window !== "undefined" &&
  !["localhost", "127.0.0.1"].includes(window.location.hostname)) {
  throw new Error("Local walkthrough requires a loopback browser origin.");
}

const firebaseConfig = {
  apiKey: "AIzaSyD_b1MdgnUrwLf8mnii8JCzTOv8DatD_tQ",
  authDomain: "smart-care-system-1a41e.firebaseapp.com",
  projectId: "smart-care-system-1a41e",
  storageBucket: "smart-care-system-1a41e.firebasestorage.app",
  messagingSenderId: "531785115214",
  appId: "1:531785115214:web:d7add711b42e2c16b4851f",
};

const app = getApps().length === 0 ? initializeApp(walkthrough ? {
  apiKey: "local-walkthrough-only",
  authDomain: "demo-care-walkthrough.firebaseapp.com",
  projectId: "demo-care-walkthrough",
  storageBucket: "demo-care-walkthrough.appspot.com",
  appId: "local-walkthrough",
} : firebaseConfig) : getApp();

let authInstance;

try {
  // Metro resolves the native export; the browser export does not include it.
  const { getReactNativePersistence } = FirebaseAuth as typeof FirebaseAuth & {
    getReactNativePersistence?: (storage: typeof AsyncStorage) => Persistence;
  };
  authInstance = getReactNativePersistence ? initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  }) : getAuth(app);
} catch (error) {
  console.log("[firebase auth] RN persistence unavailable, fallback to getAuth:", error);
  authInstance = getAuth(app);
}

export const auth = authInstance;
export const storage = getStorage(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, "us-central1");

if (walkthrough) {
  connectAuthEmulator(auth, "http://127.0.0.1:19099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 18298);
  connectStorageEmulator(storage, "127.0.0.1", 19398);
  connectFunctionsEmulator(functions, "127.0.0.1", 15001);
}

export default app;
