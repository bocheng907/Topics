import { doc, getDoc } from "firebase/firestore";
import { useLocalSearchParams, type Href } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { AppHeader, Card, Divider, EmptyState, StatusBadge } from "@/src/ui/components";
import { colors, layout, spacing, typography } from "@/src/ui/theme";


import { db } from "@/firebase/firebaseConfig";
import { useAuth } from "@/src/auth/useAuth";
import { useActiveCareTarget } from "@/src/care-target/useActiveCareTarget";
import {
  NOTIFICATIONS_COLLECTION,
  type NotificationDocument,
} from "@/src/notifications/notificationSchema";
import { translations } from "@/src/i18n/translations";
import {
  buildNotificationBody,
  getNotificationTitle,
  pickText,
} from "@/src/notifications/notificationText";
import { useLanguage } from "@/src/store/LanguageContext";
import {
  CATEGORY_LABEL_KEY,
  getNotificationVisual,
  getSourceLabel,
} from "@/src/notifications/notificationCategories";
import { formatNotificationDateTime } from "@/src/notifications/formatNotificationDateTime";
import { useScreenBottomInset } from "@/src/ui/BottomInsetContext";

type NotificationDetail = NotificationDocument & Record<string, any>;
type TranslationSet = (typeof translations)[keyof typeof translations];

function firstValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function buildDetailBody(data: NotificationDetail | null) {
  if (!data) return "";

  const eventTime = pickText(data, ["time", "scheduleTime", "eventTime"]);
  const patientName = pickText(data, ["patientName", "name", "personName"]);
  const eventTitle = pickText(data, ["eventTitle", "medicineName", "eventName"]);
  const location = pickText(data, ["location", "place"]);
  const summary = [patientName, eventTitle, location].filter(Boolean).join("  ");

  if (eventTime || summary) {
    return [eventTime, summary].filter(Boolean).join("\n");
  }

  return data.body ?? "";
}

function buildInfoRows(
  data: NotificationDetail | null,
  t: TranslationSet,
  patientNameById: Map<string, string>
) {
  if (!data) return [];

  const rows: { label: string; value: string }[] = [];

  const patientName =
    patientNameById.get(data.patientId ?? "") ||
    pickText(data, ["patientName", "name", "personName"]);
  if (patientName) rows.push({ label: t.notificationFieldPatientName, value: patientName });

  const eventTitle = pickText(data, ["eventTitle", "medicineName", "eventName", "itemTitle"]);
  if (eventTitle) rows.push({ label: t.notificationFieldEventTitle, value: eventTitle });

  const eventDate = pickText(data, ["eventDate"]);
  if (eventDate) rows.push({ label: t.notificationFieldEventDate, value: eventDate });

  const eventTime = pickText(data, ["time", "scheduleTime", "eventTime"]);
  if (eventTime) rows.push({ label: t.notificationFieldEventTime, value: eventTime });

  const location = pickText(data, ["location", "place"]);
  if (location) rows.push({ label: t.notificationFieldLocation, value: location });

  const sourceLabel = getSourceLabel(data.sourceCollection, t);
  if (sourceLabel) rows.push({ label: t.notificationFieldSource, value: sourceLabel });

  return rows;
}

export function NotificationDetailView() {
  const bottomInset = useScreenBottomInset();
  const params = useLocalSearchParams<Record<string, string | string[]>>();
  const { user: currentUser } = useAuth();
  const { language } = useLanguage();
  const t = translations[language];
  const { linkedCareTargets } = useActiveCareTarget();
  const notificationId = firstValue(params.id);
  const [notification, setNotification] = useState<NotificationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    let alive = true;

    async function loadNotification() {
      if (!notificationId) {
        setErrorText(t.notFoundNotification);
        setLoading(false);
        return;
      }

      if (!currentUser?.uid) return;

      try {
        setLoading(true);
        setErrorText("");

        const snap = await getDoc(doc(db, NOTIFICATIONS_COLLECTION, notificationId));
        if (!alive) return;

        if (!snap.exists()) {
          setNotification(null);
          setErrorText(t.notFoundNotification);
          return;
        }

        const data = snap.data() as NotificationDetail;
        if (data.recipientUid !== currentUser.uid) {
          setNotification(null);
          setErrorText(t.noPermissionNotification);
          return;
        }

        if (!alive) return;
        setNotification(data);
      } catch (error) {
        console.log("notification detail load failed:", error);
        if (alive) {
          setNotification(null);
          setErrorText(t.notificationReadFailed);
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadNotification();

    return () => {
      alive = false;
    };
  }, [currentUser?.uid, notificationId, language, t]);

  const displayBody = useMemo(() => buildDetailBody(notification), [notification]);
  const displayTitle = getNotificationTitle(notification, t);
  const localizedBody = buildNotificationBody(notification, t) || displayBody;
  const displayDateTime = formatNotificationDateTime(notification?.createdAt, t, language);
  const patientNameById = useMemo(
    () => new Map(linkedCareTargets.map((patient) => [patient.id, patient.name])),
    [linkedCareTargets]
  );
  const infoRows = useMemo(
    () => buildInfoRows(notification, t, patientNameById),
    [notification, t, patientNameById]
  );
  const visual = getNotificationVisual(notification);

  return (
    <View style={styles.container}>
      <AppHeader
        title={t.notification}
        left="back"
        fallbackHref={(currentUser?.role === "caregiver" ? "/caregiver/notifications" : "/family/notifications") as Href}
      />

      <SafeAreaView style={styles.flex} edges={["left", "right"]}>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: spacing.xxl + bottomInset }]} showsVerticalScrollIndicator={false}>
          {loading ? (
            <ActivityIndicator color={colors.primary} style={styles.loader} accessibilityLabel={t.reading} />
          ) : errorText ? (
            <Card>
              <EmptyState icon="notifications-off-outline" title={errorText} />
            </Card>
          ) : (
            <>
              <Card style={styles.headCard}>
                <View style={styles.headRow}>
                  {/* Same category glyph and tint as the notification list, so the item is recognisable. */}
                  <View style={[styles.iconCircle, { backgroundColor: visual.tintSoft }]}>
                    <Ionicons name={visual.icon} size={22} color={visual.tint} />
                  </View>
                  <Text style={styles.title} accessibilityRole="header">{displayTitle}</Text>
                </View>

                <View style={styles.tagRow}>
                  <StatusBadge label={t[CATEGORY_LABEL_KEY[visual.category]]} tone="neutral" />
                  {visual.level ? (
                    <StatusBadge
                      label={visual.level === "critical" ? t.notificationLevelCritical : t.notificationLevelWarning}
                      tone={visual.level === "critical" ? "danger" : "warning"}
                      icon={visual.level === "critical" ? "alert-circle" : "warning"}
                    />
                  ) : null}
                </View>

                {!!displayDateTime && (
                  <View style={styles.dateRow}>
                    <Ionicons name="time-outline" size={18} color={colors.textMuted} />
                    <Text style={styles.dateTime}>{displayDateTime}</Text>
                  </View>
                )}
              </Card>

              {!!localizedBody && (
                <Card>
                  <Text style={styles.body} selectable>{localizedBody}</Text>
                </Card>
              )}

              {infoRows.length > 0 && (
                <Card padding={0}>
                  {infoRows.map((row, index) => (
                    <View key={row.label}>
                      {index > 0 ? <Divider inset={spacing.lg} /> : null}
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>{row.label}</Text>
                        <Text style={styles.infoValue} selectable>{row.value}</Text>
                      </View>
                    </View>
                  ))}
                </Card>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    padding: layout.screenPaddingX,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
    width: "100%",
    maxWidth: layout.maxContentWidth,
    alignSelf: "center",
  },
  loader: { marginVertical: spacing.xxxl },
  headCard: { gap: spacing.md },
  headRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  iconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  title: { ...typography.title, flex: 1, minWidth: 0 },
  tagRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  dateRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  dateTime: { ...typography.bodySmall, color: colors.textMuted },
  body: { ...typography.body, fontSize: 18, lineHeight: 28 },
  infoRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: 2 },
  infoLabel: { ...typography.caption },
  infoValue: { ...typography.bodyStrong },
});
