import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";

import { db } from "@/firebase/firebaseConfig";
import { useAuth } from "@/src/auth/useAuth";
import {
  NOTIFICATIONS_COLLECTION,
  type NotificationDocument,
} from "@/src/notifications/notificationSchema";

type NotificationRow = NotificationDocument & { id: string };

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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        <Pressable hitSlop={12} style={styles.menuButton} onPress={() => {}}>
          <View style={styles.menuLine} />
          <View style={styles.menuLine} />
          <View style={styles.menuLine} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      >
        {notifications.map((item, index) => (
          <View key={item.id || `${item.title}-${index}`} style={styles.row}>
            <View style={styles.avatar} />

            <View style={styles.body}>
              <View style={styles.topLine}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.time}>{formatTime(item.createdAt)}</Text>
              </View>
              <Text style={styles.content}>{item.body}</Text>
            </View>
          </View>
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingTop: 54,
    paddingHorizontal: 20,
  },
  headerSpacer: {
    width: 32,
    height: 32,
  },
  menuButton: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
  },
  menuLine: {
    width: 18,
    height: 2,
    borderRadius: 999,
    backgroundColor: "#374151",
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
