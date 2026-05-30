import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  collection,
  doc,
  onSnapshot,
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
} from "@/src/notifications/notificationSchema";

type NotificationRow = NotificationDocument & {
  id: string;
  type?: string;
  title?: string;
  body?: string;
  isRead?: boolean;
  createdAt?: any;
};

function getNotificationLabel(type?: string) {
  switch (type) {
    case "medication_reminder":
      return "用藥提醒";
    case "abnormal_health":
      return "健康異常";
    case "medication_done":
      return "用藥完成";
    case "chat_message":
      return "聊天訊息";
    case "calendar_event":
      return "行事曆通知";
    case "calendar_event_completed":
      return "行程完成";
    case "daily_checklist_completed":
      return "每日清單";
    case "health_report_missing":
      return "健康紀錄提醒";
    default:
      return "通知";
  }
}

function getNotificationIcon(type?: string) {
  switch (type) {
    case "medication_reminder":
      return "medical-outline";
    case "abnormal_health":
      return "warning-outline";
    case "medication_done":
      return "checkmark-circle-outline";
    case "chat_message":
      return "chatbubble-ellipses-outline";
    case "calendar_event":
      return "calendar-outline";
    case "calendar_event_completed":
      return "calendar-number-outline";
    case "daily_checklist_completed":
      return "checkbox-outline";
    case "health_report_missing":
      return "pulse-outline";
    default:
      return "notifications-outline";
  }
}

function getCreatedTime(createdAt: any) {
  if (!createdAt) return 0;

  if (typeof createdAt.toMillis === "function") {
    return createdAt.toMillis();
  }

  if (typeof createdAt.toDate === "function") {
    return createdAt.toDate().getTime();
  }

  if (createdAt instanceof Date) {
    return createdAt.getTime();
  }

  return 0;
}

function formatTime(createdAt: any) {
  if (!createdAt) return "";

  const date =
    typeof createdAt.toDate === "function"
      ? createdAt.toDate()
      : createdAt instanceof Date
      ? createdAt
      : null;

  if (!date) return "";

  return date.toLocaleString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function FamilyNotificationsScreen() {
  const { user: currentUser } = useAuth();

  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!currentUser?.uid) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    console.log("[family notifications] current uid =", currentUser.uid);

    setLoading(true);
    setLoadError("");

    const q = query(
      collection(db, NOTIFICATIONS_COLLECTION),
      where("recipientUid", "==", currentUser.uid)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as NotificationDocument),
        })) as NotificationRow[];

        console.log("[family notifications] rows =", rows);

        setNotifications(rows);
        setLoading(false);
      },
      (error) => {
        console.log("family notifications snapshot failed:", error);
        setLoadError("目前無法讀取通知，請稍後再試");
        setNotifications([]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [currentUser?.uid]);

  const sortedNotifications = useMemo(() => {
    return [...notifications].sort((a, b) => {
      return getCreatedTime(b.createdAt) - getCreatedTime(a.createdAt);
    });
  }, [notifications]);

  const handleNotificationPress = async (item: NotificationRow) => {
    try {
      await updateDoc(doc(db, NOTIFICATIONS_COLLECTION, item.id), {
        isRead: true,
      });

      router.push({
        pathname: "/family/notification-detail",
        params: { id: item.id },
      } as any);
    } catch (error) {
      console.log("family notification press failed:", error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>通知</Text>
        <Text style={styles.headerSubtitle}>查看照護更新與提醒</Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.list,
          sortedNotifications.length === 0 && styles.emptyList,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.emptyBox}>
            <Ionicons name="notifications-outline" size={42} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>通知讀取中...</Text>
          </View>
        ) : loadError ? (
          <View style={styles.emptyBox}>
            <Ionicons name="warning-outline" size={42} color="#EF4444" />
            <Text style={styles.emptyTitle}>讀取失敗</Text>
            <Text style={styles.emptyText}>{loadError}</Text>
          </View>
        ) : sortedNotifications.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="notifications-off-outline" size={42} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>目前沒有通知</Text>
            <Text style={styles.emptyText}>
              看護完成每日清單、用藥或新增行程後，通知會顯示在這裡。
            </Text>
          </View>
        ) : (
          sortedNotifications.map((item, index) => {
            const isUnread = item.isRead !== true;
            const label = getNotificationLabel(item.type);
            const iconName = getNotificationIcon(item.type);

            return (
              <Pressable
                key={item.id || `${item.title}-${index}`}
                style={[
                  styles.row,
                  isUnread ? styles.unreadRow : styles.readRow,
                ]}
                onPress={() => handleNotificationPress(item)}
              >
                {isUnread ? <View style={styles.unreadDot} /> : null}

                <View
                  style={[
                    styles.avatar,
                    item.type === "daily_checklist_completed" &&
                      styles.dailyChecklistAvatar,
                  ]}
                >
                  <Ionicons
                    name={iconName as any}
                    size={25}
                    color={
                      item.type === "daily_checklist_completed"
                        ? "#F67578"
                        : "#7C6BB8"
                    }
                  />
                </View>

                <View style={styles.body}>
                  <View style={styles.topLine}>
                    <View style={styles.titleGroup}>
                      <Text style={styles.typeText}>{label}</Text>
                      <Text
                        style={[
                          styles.title,
                          isUnread ? styles.unreadTitle : styles.readTitle,
                        ]}
                        numberOfLines={1}
                      >
                        {item.title || "通知"}
                      </Text>
                    </View>

                    <Text
                      style={[
                        styles.time,
                        isUnread ? styles.unreadTime : styles.readTime,
                      ]}
                    >
                      {formatTime(item.createdAt)}
                    </Text>
                  </View>

                  <Text
                    style={[
                      styles.content,
                      isUnread ? styles.unreadContent : styles.readContent,
                    ]}
                    numberOfLines={2}
                  >
                    {item.body || "你有一則新的照護通知"}
                  </Text>
                </View>
              </Pressable>
            );
          })
        )}
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
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#111827",
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: "700",
    color: "#4B5563",
  },
  list: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 120,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: "center",
  },
  emptyBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingVertical: 50,
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 20,
    fontWeight: "900",
    color: "#111827",
    textAlign: "center",
  },
  emptyText: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: "600",
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 22,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    position: "relative",
    paddingVertical: 16,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    marginBottom: 8,
  },
  unreadRow: {
    backgroundColor: "#F1EDFF",
  },
  readRow: {
    backgroundColor: "#FFFFFF",
  },
  unreadDot: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EF4444",
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#EDE9FE",
    marginRight: 14,
    marginTop: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dailyChecklistAvatar: {
    backgroundColor: "#FFF1E6",
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
  titleGroup: {
    flex: 1,
  },
  typeText: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "900",
    color: "#7C6BB8",
    marginBottom: 3,
  },
  title: {
    fontSize: 18,
    lineHeight: 22,
  },
  unreadTitle: {
    fontWeight: "700",
    color: "#111827",
  },
  readTitle: {
    fontWeight: "600",
    color: "#4B5563",
  },
  time: {
    fontSize: 13,
    lineHeight: 17,
    minWidth: 56,
    textAlign: "right",
  },
  unreadTime: {
    fontWeight: "700",
    color: "#4B5563",
  },
  readTime: {
    fontWeight: "500",
    color: "#9CA3AF",
  },
  content: {
    fontSize: 15,
    lineHeight: 21,
  },
  unreadContent: {
    fontWeight: "600",
    color: "#374151",
  },
  readContent: {
    fontWeight: "500",
    color: "#9CA3AF",
  },
});