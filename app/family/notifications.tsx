import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { router } from "expo-router";

import { db } from "@/firebase/firebaseConfig";
import { useAuth } from "@/src/auth/useAuth";
import {
  NOTIFICATIONS_COLLECTION,
  type NotificationDocument,
  type NotificationType,
} from "@/src/notifications/notificationSchema";

type NotificationRow = Omit<NotificationDocument, "type"> & {
  id: string;
  type: NotificationType;
  eventName?: string;
  personName?: string;
  location?: string;
  hour?: string;
  minute?: string;
  period?: "am" | "pm";
};

export default function FamilyNotificationsScreen() {
  const { user: currentUser } = useAuth();
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);

  useEffect(() => {
    if (!currentUser?.uid) {
      setNotifications([]);
      return;
    }

    const q = query(
      collection(db, NOTIFICATIONS_COLLECTION),
      where("recipientUid", "==", currentUser.uid),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setNotifications(
          snap.docs.map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as NotificationDocument),
          }))
        );
      },
      (error) => {
        console.log("family notifications snapshot failed:", error);
        setNotifications([]);
      }
    );

    return () => unsub();
  }, [currentUser?.uid]);

  const formatTime = (createdAt: NotificationDocument["createdAt"]) => {
    if (!createdAt) return "";
    return createdAt.toDate().toLocaleTimeString("zh-TW", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const buildDetailParams = (item: NotificationRow) => ({
    id: item.id,
    title: item.title,
    body: item.body,
    createdAt: item.createdAt ? String(item.createdAt.toMillis()) : "",
    eventName: item.eventName ?? "",
    personName: item.personName ?? "",
    location: item.location ?? "",
    hour: item.hour ?? "",
    minute: item.minute ?? "",
    period: item.period ?? "",
  });

  const pushByTypeFallback = (item: NotificationRow) => {
    switch (item.type) {
      case "chat_message":
        if (item.patientId) {
          router.push({
            pathname: "/family/chat-room",
            params: { patientId: item.patientId },
          } as any);
          return;
        }
        router.push("/family/chat-room" as any);
        return;
      case "abnormal_health":
        router.push("/family/dashboard" as any);
        return;
      case "medication_reminder":
      case "medication_done":
        router.push("/family/list" as any);
        return;
      case "calendar_event":
        router.push({
          pathname: "/family/notification-detail",
          params: buildDetailParams(item),
        } as any);
        return;
      default:
        return;
    }
  };

  const handleNotificationPress = async (item: NotificationRow) => {
    try {
      await updateDoc(doc(db, NOTIFICATIONS_COLLECTION, item.id), {
        isRead: true,
      });

      if (item.deepLink) {
        router.push(item.deepLink as any);
        return;
      }

      pushByTypeFallback(item);
    } catch (error) {
      console.log("family notification press failed:", error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header} />

      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      >
        {notifications.map((item, index) => (
          <Pressable
            key={item.id || `${item.title}-${index}`}
            style={styles.row}
            onPress={() => handleNotificationPress(item)}
          >
            <View style={styles.avatar} />

            <View style={styles.body}>
              <View style={styles.topLine}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.time}>{formatTime(item.createdAt)}</Text>
              </View>
              <Text style={styles.content}>{item.body}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    height: 112,
    backgroundColor: "#D9D4F3",
    paddingTop: 54,
    paddingHorizontal: 20,
  },
  list: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#D1D5DB",
    marginRight: 14,
    marginTop: 1,
  },
  body: {
    flex: 1,
    gap: 5,
  },
  topLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    lineHeight: 22,
  },
  time: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
  content: {
    fontSize: 15,
    color: "#4B5563",
    lineHeight: 21,
  },
});
