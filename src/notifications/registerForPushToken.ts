import { db } from "@/firebase/firebaseConfig";
import * as Device from "expo-device";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import {
  collection,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
  doc,
} from "firebase/firestore";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function getUserDocIdByUid(uid: string) {
  const q = query(
    collection(db, "users"),
    where("uid", "==", uid),
    limit(1)
  );

  const snap = await getDocs(q);

  if (snap.empty) {
    return null;
  }

  return snap.docs[0].id;
}

export async function registerForPushToken(uid: string) {
  if (Device.osName === "Android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  if (!Device.isDevice) {
    console.log("[push] 真機才能拿推播 token");
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("[push] 使用者未授權通知");
    return null;
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  if (!projectId) {
    console.log("[push] 找不到 EAS projectId");
    return null;
  }

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;

  const userDocId = await getUserDocIdByUid(uid);

  if (!userDocId) {
    console.log("[push] 找不到對應的 users 文件，無法儲存 token");
    return null;
  }

  const deviceId = `${uid}_${Device.osName ?? "unknown"}`;

  await setDoc(
    doc(db, "users", userDocId, "devices", deviceId),
    {
      expoPushToken: token,
      platform: Device.osName ?? "unknown",
      enabled: true,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  console.log("[push] token saved =", token);
  return token;
}