import { AppHeader, Button, Card, EmptyState, SectionHeader } from "@/src/ui/components";
import { colors, layout, radii, spacing, typography } from "@/src/ui/theme";
import { AppAlert as Alert } from "@/src/ui/AppAlert";
import { caregiverCopy } from "@/src/i18n/copy/caregiverCopy";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, View, Text, ScrollView, Image, StyleSheet, StatusBar } from "react-native";
import { router, useLocalSearchParams, useFocusEffect, type Href } from "expo-router";
import { collection, doc, getDoc, getDocs, query } from "firebase/firestore";
import { db } from "@/firebase/firebaseConfig";
import {
  ensureFirestoreTranslations,
  PRESCRIPTION_ITEM_TRANSLATION_SPECS,
} from "@/src/i18n/dynamicTranslation";
import { pickLocalizedString, translations } from "@/src/i18n/translations";
import { useLanguage } from "@/src/store/LanguageContext";
import { useScreenBottomInset } from "@/src/ui/BottomInsetContext";

function formatPrescriptionMemo(value: any): string {
  if (typeof value === "string") {
    return value;
  }

  if (!value || typeof value !== "object") {
    return "";
  }

  return [
    value.doctor_instructions,
    value.precautions,
    value.refill_info,
    value.other,
  ]
    .filter(
      (item): item is string =>
        typeof item === "string" && item.trim().length > 0
    )
    .join("；");
}

export default function CaregiverDetailScreen() {
  const bottomInset = useScreenBottomInset();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { language } = useLanguage();
  const t = translations[language];
  const c = caregiverCopy[language];
  const [p, setP] = useState<any | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);

  const fetchData = useCallback(async () => {
    if (!id) {
      setLoaded(true);
      return;
    }

    try {
      const presRef = doc(db, "prescriptions", id);
      const presSnap = await getDoc(presRef);
      if (!presSnap.exists()) {
        setLoaded(true);
        return;
      }

      const data = presSnap.data() as any;
      setP({ prescriptionId: presSnap.id, ...data });

      const itemsSnap = await getDocs(query(collection(db, "prescriptions", id, "items")));
      const translatedItems = await Promise.all(
        itemsSnap.docs.map(async (d) => {
          const raw = d.data() as any;
          const translated = await ensureFirestoreTranslations(
            doc(db, "prescriptions", id, "items", d.id),
            raw,
            language,
            PRESCRIPTION_ITEM_TRANSLATION_SPECS
          );
          return { id: d.id, data: { ...raw, ...translated } };
        })
      );
      const list = translatedItems.map((d) => {
        const it = d.data as any;
        return {
          itemId: d.id,
          drug_name: pickLocalizedString(it, "drug_name", language),
          dosage: it.dose ?? it.dosage ?? "",
          usage_zh: pickLocalizedString(it, "usage", language, it.time_of_day ?? it.time ?? ""),
          memo: pickLocalizedString(it, "note", language),
        };
      });
      setItems(list);
      setLoaded(true);
    } catch {
      setLoaded(true);
      Alert.alert(t.resultReadFailedTitle, t.resultReadFailedMessage);
    }
  }, [id, language, t]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const header = <AppHeader title={t.prescriptionDetail} fallbackHref={"/caregiver/list" as Href} />;

  if (!loaded) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.centerText}>{t.reading}</Text>
        </View>
      </View>
    );
  }
  if (!id || !p) {
    return (
      <View style={styles.container}>
        {header}
        <EmptyState icon="document-outline" title={t.resultNotFound} style={styles.center} />
      </View>
    );
  }

  const clinicName = String(p.clinic_name ?? p.clinicName ?? "");
  const department = String(p.department ?? "");
  const prescriptionMemo = formatPrescriptionMemo(p.memo);
  const sep = language === "zh" ? "：" : ": ";

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <AppHeader
        title={t.prescriptionDetail}
        fallbackHref={"/caregiver/list" as Href}
        right={
          <Button
            label={t.edit}
            variant="ghost"
            icon="create-outline"
            onPress={() => router.push({
              pathname: "/caregiver/edit",
              params: { id: p.prescriptionId, itemsJson: JSON.stringify(items) },
            })}
          />
        }
      />

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: spacing.xxl + bottomInset }]}>
        <View style={styles.titleBlock}>
          <Text style={styles.mainTitle}>{p.title || t.prescriptionDetail}</Text>
          <Text style={styles.subInfo}>
            {t.recordDate}{sep}{
              typeof p.createdAt === "string"
                ? p.createdAt
                : (p.createdAt?.seconds
                    ? new Date(p.createdAt.seconds * 1000).toLocaleDateString()
                    : t.unknown)
            }
          </Text>
          <Text style={styles.subInfo}>{c.clinicLabel}{sep}{clinicName || t.notSet}</Text>
          <Text style={styles.subInfo}>{c.departmentLabel}{sep}{department || t.notSet}</Text>
        </View>

        {p.sourceImageUrl && (
          <Image source={{ uri: p.sourceImageUrl }} style={styles.img} resizeMode="contain" />
        )}

        <Card tone="sunken">
          <Text style={styles.prescriptionNoteLabel}>{t.prescriptionNote}</Text>
          <Text style={prescriptionMemo ? styles.prescriptionNoteValue : styles.emptyNoteValue}>
            {prescriptionMemo || t.none}
          </Text>
        </Card>

        <SectionHeader title={t.medicineDetails} />
        <View style={styles.itemList}>
          {items.map((it, idx) => {
            const usageParts = String(it.usage_zh ?? "")
              .split(/[，,]/)
              .map((part: string) => part.trim())
              .filter(Boolean);

            const method = usageParts[0] || t.notSet;
            const timeDetail = usageParts.slice(1).join("，") || t.asDirectedUsage;

            return (
              <Card key={it.itemId ?? idx}>
                <Text style={styles.itemName}>{it.drug_name}</Text>
                <InfoRow label={t.dosage} value={it.dosage} />
                <InfoRow label={t.method} value={method} />
                <InfoRow label={t.usageTime} value={timeDetail} />
                <Text style={it.memo ? styles.itemNote : styles.emptyItemNote}>
                  {t.medicineNote}{sep}{it.memo || t.none}
                </Text>
              </Card>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: spacing.md },
  centerText: { ...typography.body, color: colors.textSecondary },
  scrollContent: {
    padding: layout.screenPaddingX,
    paddingBottom: spacing.xxl,
    width: "100%",
    maxWidth: layout.maxContentWidth,
    alignSelf: "center",
  },
  titleBlock: { marginBottom: spacing.lg, gap: 2 },
  mainTitle: { ...typography.title, marginBottom: spacing.xs },
  subInfo: { ...typography.bodySmall },
  img: {
    width: "100%",
    height: 300,
    borderRadius: radii.card,
    backgroundColor: colors.surfaceSunken,
    marginBottom: spacing.lg,
  },
  prescriptionNoteLabel: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.xs },
  prescriptionNoteValue: { ...typography.body },
  emptyNoteValue: { ...typography.body, color: colors.textMuted },
  itemList: { gap: spacing.md },
  itemName: { ...typography.header, color: colors.primary, marginBottom: spacing.sm },
  infoRow: { flexDirection: "row", gap: spacing.md, paddingVertical: 3 },
  infoLabel: { ...typography.bodySmall, color: colors.textMuted, width: 96 },
  infoValue: { ...typography.bodyStrong, flex: 1 },
  itemNote: { ...typography.bodySmall, marginTop: spacing.sm },
  emptyItemNote: { ...typography.bodySmall, color: colors.textMuted, marginTop: spacing.sm },
});
