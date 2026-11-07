import { db } from "@/firebase/firebaseConfig";
import { useActiveCareTarget } from "@/src/care-target/useActiveCareTarget";
import { HandoverStatus } from "@/src/care-target/HandoverStatus";
import { versionOf } from "@/src/care-target/reliableWrites";
import { translations, type Language } from "@/src/i18n/translations";
import { useLanguage } from "@/src/store/LanguageContext";
import { Ionicons } from "@expo/vector-icons";
import type { Href } from "expo-router";
import { doc, onSnapshot } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppHeader, Card, Divider, EmptyState, type IconName } from "@/src/ui/components";
import { colors, layout, spacing, typography } from "@/src/ui/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type CareHandbookForm = {
  dailyRoutine: string;
  medicationNotes: string;
  dietNotes: string;
  mobilityNotes: string;
  hygieneNotes: string;
  sleepNotes: string;
  communicationNotes: string;
  emergencyNotes: string;
  otherNotes: string;
};

type CareHandbookDocument = CareHandbookForm & {
  patientId: string;
  updatedAt?: unknown;
  updatedBy: string;
};

type HandbookField = keyof CareHandbookForm;
type IoniconName = IconName;


const EMPTY_HANDBOOK: CareHandbookDocument = {
  patientId: "",
  dailyRoutine: "",
  medicationNotes: "",
  dietNotes: "",
  mobilityNotes: "",
  hygieneNotes: "",
  sleepNotes: "",
  communicationNotes: "",
  emergencyNotes: "",
  otherNotes: "",
  updatedBy: "",
};

const localeByLanguage: Record<Language, string> = {
  zh: "zh-TW",
  en: "en-US",
  vi: "vi-VN",
  id: "id-ID",
};

function safeTimestampToDate(value: unknown): Date | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as { toDate?: () => unknown };
  if (typeof candidate.toDate !== "function") return null;
  try {
    const date = candidate.toDate();
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
  } catch {
    return null;
  }
}

export default function CaregiverHandbookScreen() {
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();
  const t = translations[language];
  const { ready, activePatient, activePatientId } = useActiveCareTarget();
  const [handbook, setHandbook] = useState<CareHandbookDocument>(EMPTY_HANDBOOK);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [revision, setRevision] = useState('');
  const scope = `${ready}/${activePatientId}`;
  const [previousScope, setPreviousScope] = useState<string | null>(null);
  if (previousScope !== scope) {
    setPreviousScope(scope); setHandbook(EMPTY_HANDBOOK); setLoadError(false);
    setRevision(''); setLoading(Boolean(ready && activePatientId));
  }

  const categories: { key: HandbookField; label: string; icon: IoniconName }[] = [
    { key: "dailyRoutine", label: t.dailyRoutine, icon: "time-outline" },
    { key: "medicationNotes", label: t.medicationNotes, icon: "medkit-outline" },
    { key: "dietNotes", label: t.dietNotes, icon: "restaurant-outline" },
    { key: "mobilityNotes", label: t.mobilityNotes, icon: "walk-outline" },
    { key: "hygieneNotes", label: t.hygieneNotes, icon: "water-outline" },
    { key: "sleepNotes", label: t.sleepNotes, icon: "moon-outline" },
    { key: "communicationNotes", label: t.communicationNotes, icon: "chatbubbles-outline" },
    { key: "emergencyNotes", label: t.emergencyNotes, icon: "alert-circle-outline" },
    { key: "otherNotes", label: t.otherNotes, icon: "information-circle-outline" },
  ];

  useEffect(() => {

    if (!ready || !activePatientId) {
      return;
    }

    const unsubscribe = onSnapshot(
      doc(db, "patients", activePatientId, "care_handbook", "main"),
      (snapshot) => {
        setRevision(versionOf(snapshot.data()));
        if (!snapshot.exists()) {
          setHandbook({ ...EMPTY_HANDBOOK, patientId: activePatientId });
        } else {
          const data = snapshot.data();
          setHandbook({
            patientId: typeof data.patientId === "string" ? data.patientId : activePatientId,
            dailyRoutine: typeof data.dailyRoutine === "string" ? data.dailyRoutine : "",
            medicationNotes: typeof data.medicationNotes === "string" ? data.medicationNotes : "",
            dietNotes: typeof data.dietNotes === "string" ? data.dietNotes : "",
            mobilityNotes: typeof data.mobilityNotes === "string" ? data.mobilityNotes : "",
            hygieneNotes: typeof data.hygieneNotes === "string" ? data.hygieneNotes : "",
            sleepNotes: typeof data.sleepNotes === "string" ? data.sleepNotes : "",
            communicationNotes: typeof data.communicationNotes === "string" ? data.communicationNotes : "",
            emergencyNotes: typeof data.emergencyNotes === "string" ? data.emergencyNotes : "",
            otherNotes: typeof data.otherNotes === "string" ? data.otherNotes : "",
            updatedAt: data.updatedAt,
            updatedBy: typeof data.updatedBy === "string" ? data.updatedBy : "",
          });
        }
        setLoadError(false);
        setLoading(false);
      },
      (error) => {
        console.error("Failed to listen to care handbook:", error);
        setLoadError(true);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [activePatientId, ready]);

  const visibleCategories = categories.filter(({ key }) => handbook[key].trim().length > 0);
  const updatedDate = safeTimestampToDate(handbook.updatedAt);

  return (
    <View style={styles.screen}>
      <AppHeader title={t.handbook} left="back" fallbackHref={"/caregiver" as Href} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxxl }]}>
        <Card style={styles.introCard}>
          <View style={styles.iconCircle}>
            <Ionicons name="book-outline" size={22} color={colors.primary} />
          </View>
          <View style={styles.introText}>
            <Text style={styles.patientName} numberOfLines={2}>{activePatient?.name ?? "—"}</Text>
            <Text style={styles.description}>{t.handbookCaregiverDescription}</Text>
          </View>
        </Card>

        {!ready || loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
        ) : loadError ? (
          <Card><EmptyState icon="cloud-offline-outline" title={t.handbookLoadFailed} /></Card>
        ) : !activePatientId ? (
          <Card><EmptyState icon="people-outline" title={t.resultNoPatient} /></Card>
        ) : visibleCategories.length === 0 ? (
          <Card><EmptyState icon="book-outline" title={t.handbookEmptyTitle} body={t.handbookEmptyMessage} /></Card>
        ) : (
          <>
            <Card padding={0}>
              {visibleCategories.map(({ key, label, icon }, index) => (
                <View key={key}>
                  {index > 0 ? <Divider inset={spacing.lg + 40 + spacing.md} /> : null}
                  <View style={styles.category}>
                    <View style={styles.iconCircle}>
                      <Ionicons name={icon} size={22} color={colors.primary} />
                    </View>
                    <View style={styles.categoryText}>
                      <Text style={styles.categoryTitle} accessibilityRole="header">{label}</Text>
                      <Text style={styles.categoryContent} selectable>{handbook[key]}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </Card>
            {updatedDate && (
              <Text style={styles.updatedText}>
                {t.lastUpdated}: {updatedDate.toLocaleString(localeByLanguage[language])}
              </Text>
            )}
          </>
        )}
        {ready && !loading && !loadError && activePatientId &&
          <HandoverStatus key={activePatientId} patientId={activePatientId} revision={revision} canAcknowledge />}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: {
    padding: layout.screenPaddingX,
    gap: spacing.lg,
    width: "100%",
    maxWidth: layout.maxContentWidth,
    alignSelf: "center",
  },
  introCard: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  introText: { flex: 1, minWidth: 0, gap: spacing.xs },
  patientName: { ...typography.title },
  description: { ...typography.bodySmall },
  loader: { marginVertical: spacing.xxxl },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  category: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, padding: spacing.lg },
  categoryText: { flex: 1, minWidth: 0, gap: spacing.xs },
  categoryTitle: { ...typography.bodyStrong, color: colors.textSecondary },
  categoryContent: { ...typography.body },
  updatedText: { ...typography.caption, textAlign: "center" },
});
