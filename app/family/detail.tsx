import { AppHeader, Button, Card, Divider } from "@/src/ui/components";
import { colors, layout, radii, spacing, typography } from "@/src/ui/theme";
import { familyCopy } from "@/src/i18n/copy/familyCopy";
import React, { useState, useCallback } from "react";
import { View, Text, ScrollView, Image, StyleSheet, StatusBar, ActivityIndicator } from "react-native";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import { doc, getDoc, collection, getDocs, query } from "firebase/firestore";
import { db } from "@/firebase/firebaseConfig";
import { useAuthContext } from "@/src/auth/AuthProvider";
import {
  ensureFirestoreTranslations,
  PRESCRIPTION_ITEM_TRANSLATION_SPECS,
} from "@/src/i18n/dynamicTranslation";
import { pickLocalizedString, translations } from "@/src/i18n/translations";
import { useLanguage } from "@/src/store/LanguageContext";
import { Ionicons } from "@expo/vector-icons";
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

export default function FamilyDetailScreen() {
  const bottomInset = useScreenBottomInset();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { ready } = useAuthContext();
  const { language } = useLanguage();
  const t = translations[language];
  const [p, setP] = useState<any | null>(null);

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      const presRef = doc(db, "prescriptions", id);
      const presSnap = await getDoc(presRef);
      
      if (presSnap.exists()) {
        const data = presSnap.data() as any;

        // 1. 抓取子集合資料
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
            return { raw: { ...raw, ...translated } };
          })
        );
        const mappedItems = translatedItems.map((d) => {
          const raw = d.raw;
          const it = {
            ...raw,
            drug_name: pickLocalizedString(raw, "drug_name", language, raw.name ?? ""),
            dosage: raw.dose ?? raw.dosage ?? "",
            usage_zh: pickLocalizedString(raw, "usage", language),
            memo: pickLocalizedString(raw, "note", language),
          };
          return {
            raw,
            name: it.drug_name ?? it.name ?? t.unknownMedicine,
            dosage: it.dosage ?? it.dose ?? "",
            usage_zh: it.usage_zh ?? it.usage ?? "",
            memo: it.memo ?? it.note_zh ?? it.note ?? "",
          };
        });
        setP({ 
          ...data, 
          prescriptionId: presSnap.id, 
          items: mappedItems 
        });
      }
    } catch (error) {
      console.error("讀取詳情失敗:", error);
    }
  }, [id, language, t.unknownMedicine]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const fc = familyCopy[language];
  const sep = language === "zh" ? "：" : ": ";

  if (!ready || !p) {
    return (
      <View style={styles.container}>
        <AppHeader title={t.prescriptionDetail} fallbackHref="/family/list" />
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>{t.loading}</Text>
        </View>
      </View>
    );
  }

  const clinicName = String(
    p.clinic_name ?? p.clinicName ?? ""
  );

  const department = String(
    p.department ?? ""
  );

  const prescriptionMemo =
    formatPrescriptionMemo(p.memo);

  const openEdit = () => router.push({
    pathname: "/family/edit",
    params: { id: p.prescriptionId, itemsJson: JSON.stringify(p.items) }
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <AppHeader
        title={t.prescriptionDetail}
        fallbackHref="/family/list"
        right={<Button label={t.edit} icon="create-outline" variant="ghost" onPress={openEdit} />}
      />

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: spacing.xxxl + bottomInset }]}>
        <View style={styles.titleBlock}>
          <Text style={styles.mainTitle}>{p.title || t.prescriptionDetail}</Text>
          <Text style={styles.subInfo}>
            {t.recordDate}{sep}{p.createdAt?.seconds ? new Date(p.createdAt.seconds * 1000).toLocaleDateString() : t.unknown}
          </Text>
          <Text style={styles.subInfo}>
            {fc.clinicLabel}{sep}{clinicName || t.notSet}
          </Text>
          <Text style={styles.subInfo}>
            {fc.departmentLabel}{sep}{department || t.notSet}
          </Text>
        </View>

        {p.sourceImageUrl ? (
          <Image
            source={{ uri: p.sourceImageUrl }}
            style={styles.img}
            resizeMode="contain"
          />
        ) : (
          <View style={[styles.img, styles.imgEmpty]}>
            <Ionicons name="image-outline" size={40} color={colors.textDisabled} />
            <Text style={styles.imgEmptyText}>{t.noPrescriptionImage}</Text>
          </View>
        )}

        <Card tone="sunken" style={styles.noteCard}>
          <Text style={styles.noteLabel}>{t.prescriptionNote}</Text>
          <Text style={prescriptionMemo ? styles.noteValue : styles.emptyNoteValue}>
            {prescriptionMemo || t.none}
          </Text>
        </Card>

        <Text style={styles.sectionTitle} accessibilityRole="header">{t.medicineContent}</Text>

        {p.items?.map((it: any, idx: number) => {
          // 💡 邏輯：將 usage_zh 以逗號拆分為「用法」與「時段」
          const usageString = it.usage_zh || "";
          const parts = usageString
            .split(/[，,]/)
            .map((part: string) => part.trim())
            .filter(Boolean);
          const method = parts[0] || t.notSet;
          const timeDetail =
            parts.slice(1).join("，") ||
            t.asDirectedUsage;

          return (
            <Card key={idx} style={styles.itemCard}>
              <Text style={styles.itemName}>{it.name}</Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{t.dosage}</Text>
                <Text style={styles.infoValue}>{it.dosage}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{t.method}</Text>
                <Text style={styles.infoValue}>{method}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{t.usageTime}</Text>
                <Text style={styles.infoValue}>{timeDetail}</Text>
              </View>
              <Divider style={styles.itemDivider} />
              <Text style={it.memo ? styles.noteText : styles.emptyItemNote}>
                {t.medicineNote}{sep}{it.memo || t.none}
              </Text>
            </Card>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: spacing.md },
  loadingText: { ...typography.bodySmall },
  scrollContent: {
    padding: layout.screenPaddingX,
    paddingBottom: spacing.xxxl,
    width: "100%",
    maxWidth: layout.maxContentWidth,
    alignSelf: "center",
  },
  titleBlock: { marginBottom: spacing.lg, gap: 2 },
  mainTitle: { ...typography.title, marginBottom: spacing.xs },
  subInfo: { ...typography.bodySmall, color: colors.textMuted },
  img: {
    width: "100%",
    height: 300,
    borderRadius: radii.card,
    backgroundColor: colors.surfaceSunken,
    marginBottom: spacing.lg,
  },
  imgEmpty: { justifyContent: "center", alignItems: "center", gap: spacing.sm },
  imgEmptyText: { ...typography.bodySmall, color: colors.textMuted },
  noteCard: { marginBottom: spacing.lg },
  noteLabel: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.xs },
  noteValue: { ...typography.body },
  emptyNoteValue: { ...typography.body, color: colors.textMuted },
  sectionTitle: { ...typography.header, marginBottom: spacing.md },
  itemCard: { marginBottom: spacing.md },
  itemName: { ...typography.header, fontSize: 19, marginBottom: spacing.sm },
  infoRow: { flexDirection: "row", marginBottom: spacing.xs, alignItems: "flex-start", gap: spacing.sm },
  infoLabel: { ...typography.bodySmall, color: colors.textMuted, width: 96 },
  infoValue: { ...typography.body, flex: 1 },
  itemDivider: { marginVertical: spacing.sm },
  noteText: { ...typography.bodySmall },
  emptyItemNote: { ...typography.bodySmall, color: colors.textMuted },
});
