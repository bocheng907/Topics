import { AppHeader, Chip, EmptyState } from "@/src/ui/components";
import { colors, layout, radii, spacing, typography } from "@/src/ui/theme";
import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  collection,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { db } from "@/firebase/firebaseConfig";
import { useAuth } from "@/src/auth/useAuth";
import { useActiveCareTarget } from "@/src/care-target/useActiveCareTarget";
import { translations } from "@/src/i18n/translations";
import { getNotificationText } from "@/src/notifications/notificationText";
import {
  NOTIFICATIONS_COLLECTION,
  type NotificationDocument,
} from "@/src/notifications/notificationSchema";
import { useLanguage } from "@/src/store/LanguageContext";
import {
  CATEGORY_EMPTY_KEY,
  CATEGORY_LABEL_KEY,
  NOTIFICATION_CATEGORY_IDS,
  getNotificationCategory,
  getNotificationVisual,
  type NotificationCategoryId,
} from "@/src/notifications/notificationCategories";
import {
  formatDateGroupLabel,
  formatNotificationDateTime,
  getDateGroupKey,
} from "@/src/notifications/formatNotificationDateTime";

type NotificationRow = NotificationDocument & Record<string, any> & { id: string };

type Props = {
  detailRoute: string;
};

export function NotificationListView({ detailRoute }: Props) {
  const { user: currentUser } = useAuth();
  const { language } = useLanguage();
  const t = translations[language];
  const { linkedCareTargets } = useActiveCareTarget();
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [category, setCategory] = useState<NotificationCategoryId>("all");
  const [patientFilter, setPatientFilter] = useState<string>("all");
  const [previousUid, setPreviousUid] = useState(currentUser?.uid);
  if (previousUid !== currentUser?.uid) {
    setPreviousUid(currentUser?.uid); setNotifications([]); setPatientFilter("all");
  }

  const patientNameById = useMemo(
    () => new Map(linkedCareTargets.map((patient) => [patient.id, patient.name])),
    [linkedCareTargets]
  );

  useEffect(() => {
    if (!currentUser?.uid) {
      return;
    }

    const q = query(
      collection(db, NOTIFICATIONS_COLLECTION),
      where("recipientUid", "==", currentUser.uid)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setNotifications(
          [...snap.docs]
            .sort((a, b) => ((b.data() as any).createdAt?.toMillis?.() ?? 0) - ((a.data() as any).createdAt?.toMillis?.() ?? 0))
            .map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as NotificationDocument),
          })) as NotificationRow[]
        );
      },
      (error) => {
        console.log("notifications snapshot failed:", error);
        setNotifications([]);
      }
    );

    return () => unsub();
  }, [currentUser?.uid]);

  const unreadCount = useMemo(
    () => notifications.filter((item) => item.isRead !== true).length,
    [notifications]
  );

  const filtered = useMemo(() => {
    return notifications.filter((item) => {
      const matchesCategory = category === "all" || getNotificationCategory(item.type) === category;
      const matchesPatient = patientFilter === "all" || item.patientId === patientFilter;
      return matchesCategory && matchesPatient;
    });
  }, [notifications, category, patientFilter]);

  const sections = useMemo(() => {
    const groups = new Map<string, NotificationRow[]>();
    const order: string[] = [];

    filtered.forEach((item) => {
      const key = getDateGroupKey(item.createdAt);
      if (!groups.has(key)) {
        groups.set(key, []);
        order.push(key);
      }
      groups.get(key)!.push(item);
    });

    return order.map((key) => ({
      key,
      title: formatDateGroupLabel(key, t, language),
      data: groups.get(key) || [],
    }));
  }, [filtered, t, language]);

  const handlePress = async (item: NotificationRow) => {
    try {
      await updateDoc(doc(db, NOTIFICATIONS_COLLECTION, item.id), {
        isRead: true,
      });
    } catch (error) {
      console.log("notification mark-as-read failed:", error);
    }

    router.push({
      pathname: detailRoute,
      params: { id: item.id },
    } as any);
  };

  return (
    <View style={styles.container}>
      <AppHeader
        title={t.notification}
        left="menu"
        right={
          unreadCount > 0 ? (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
            </View>
          ) : undefined
        }
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
        style={styles.chipsWrap}
      >
        {NOTIFICATION_CATEGORY_IDS.map((id) => (
          <Chip
            key={id}
            label={t[CATEGORY_LABEL_KEY[id]]}
            selected={id === category}
            onPress={() => setCategory(id)}
          />
        ))}
      </ScrollView>

      {linkedCareTargets.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
          style={styles.chipsWrap}
        >
          <Chip
            label={t.notificationFilterAllPatients}
            selected={patientFilter === "all"}
            onPress={() => setPatientFilter("all")}
          />
          {linkedCareTargets.map((patient) => (
            <Chip
              key={patient.id}
              icon="person-outline"
              label={patient.name || t.unknown}
              selected={patient.id === patientFilter}
              onPress={() => setPatientFilter(patient.id)}
            />
          ))}
        </ScrollView>
      )}

      <SectionList
        style={styles.listFlex}
        sections={sections}
        keyExtractor={(item, index) => item.id || `${item.title}-${index}`}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader} accessibilityRole="header">{section.title}</Text>
        )}
        ListEmptyComponent={
          <EmptyState icon="notifications-off-outline" title={t[CATEGORY_EMPTY_KEY[category]]} />
        }
        renderItem={({ item }) => {
          const isUnread = item.isRead !== true;
          const { title, body } = getNotificationText(item, t);
          const visual = getNotificationVisual(item);
          const timeText = formatNotificationDateTime(item.createdAt, t, language);
          const patientName =
            linkedCareTargets.length > 1 ? patientNameById.get(item.patientId ?? "") : undefined;

          return (
            <Pressable
              style={({ pressed }) => [styles.card, isUnread && styles.cardUnread, pressed && styles.cardPressed]}
              onPress={() => handlePress(item)}
              accessibilityRole="button"
              accessibilityLabel={`${title}. ${body}. ${timeText}`}
            >
              <View style={[styles.avatar, { backgroundColor: visual.tintSoft }]}>
                <Ionicons name={visual.icon} size={20} color={visual.tint} />
              </View>

              <View style={styles.body}>
                <View style={styles.topLine}>
                  <Text
                    style={[styles.title, isUnread ? styles.unreadTitle : styles.readTitle]}
                    numberOfLines={2}
                  >
                    {title}
                  </Text>
                  <View style={styles.timeCol}>
                    <Text style={styles.time}>{timeText}</Text>
                    {isUnread ? <View style={styles.unreadDot} /> : null}
                  </View>
                </View>

                <Text style={styles.content} numberOfLines={2}>
                  {body}
                </Text>

                <View style={styles.tagRow}>
                  <View style={[styles.tag, { backgroundColor: visual.tintSoft }]}>
                    <Text style={[styles.tagText, { color: visual.tint }]}>
                      {t[CATEGORY_LABEL_KEY[visual.category]]}
                    </Text>
                  </View>
                  {visual.level ? (
                    <View style={[styles.tag, { backgroundColor: visual.tintSoft }]}>
                      <Text style={[styles.tagText, { color: visual.tint }]}>
                        {visual.level === "critical"
                          ? t.notificationLevelCritical
                          : t.notificationLevelWarning}
                      </Text>
                    </View>
                  ) : null}
                  {patientName ? (
                    <View style={[styles.tag, styles.patientTag]}>
                      <Text style={[styles.tagText, styles.patientTagText]}>{patientName}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  unreadBadge: {
    minWidth: 26,
    minHeight: 26,
    paddingHorizontal: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  unreadBadgeText: { fontSize: 13, lineHeight: 18, fontWeight: "700", color: colors.onPrimary },
  chipsWrap: {
    flexGrow: 0,
    flexShrink: 0,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  chipsRow: {
    flexGrow: 0,
    paddingHorizontal: layout.screenPaddingX,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  listFlex: { flex: 1 },
  list: {
    paddingHorizontal: layout.screenPaddingX,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xl,
    flexGrow: 1,
    width: "100%",
    maxWidth: layout.maxContentWidth,
    alignSelf: "center",
  },
  sectionHeader: {
    ...typography.overline,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.card,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardUnread: { borderColor: colors.primaryBorder },
  cardPressed: { backgroundColor: colors.surfaceSunken },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1, minWidth: 0, gap: spacing.xs },
  topLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  title: { ...typography.body, flex: 1 },
  unreadTitle: { fontWeight: "700", color: colors.text },
  readTitle: { fontWeight: "500", color: colors.textSecondary },
  timeCol: { alignItems: "flex-end", gap: 6, paddingTop: 2 },
  time: { ...typography.caption },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  content: { ...typography.bodySmall },
  tagRow: { flexDirection: "row", gap: 6, marginTop: 2, flexWrap: "wrap" },
  tag: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radii.pill, maxWidth: "100%" },
  tagText: { fontSize: 13, lineHeight: 18, fontWeight: "600" },
  patientTag: { backgroundColor: colors.surfaceSunken },
  patientTagText: { color: colors.textSecondary },
});
