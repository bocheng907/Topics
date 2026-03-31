// firebase/firebaseConfig.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { initializeAuth, getAuth } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getStorage } from "firebase/storage";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD_b1MdgnUrwLf8mnii8JCzTOv8DatD_tQ",
  authDomain: "smart-care-system-1a41e.firebaseapp.com",
  projectId: "smart-care-system-1a41e",
  storageBucket: "smart-care-system-1a41e.firebasestorage.app",
  messagingSenderId: "531785115214",
  appId: "1:531785115214:web:d7add711b42e2c16b4851f",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

let authInstance;

try {
  // firebase 12.x 在 Expo / RN 下常見型別匯出問題，先用 runtime 方式取用
  const { getReactNativePersistence } = require("firebase/auth");
  authInstance = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch (error) {
  console.log("[firebase auth] RN persistence unavailable, fallback to getAuth:", error);
  authInstance = getAuth(app);
}

export const auth = authInstance;
export const storage = getStorage(app);
export const db = getFirestore(app);

export default app;