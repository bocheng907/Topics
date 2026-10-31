import { AppHeader, Button, Card, Divider, EmptyState } from "@/src/ui/components";
import { colors, layout, radii, spacing, typography } from "@/src/ui/theme";
import { familyCopy } from "@/src/i18n/copy/familyCopy";
import { SegmentedTabs } from "@/src/family/SegmentedTabs";
import { AppAlert as Alert } from "@/src/ui/AppAlert";
// app/family/list.tsx
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  StatusBar,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  collection,
  onSnapshot,
  query,
  where,
  doc,
  getDocs,
  writeBatch,
 getDoc } from "firebase/firestore";
import { db } from "@/firebase/firebaseConfig";

import { canEditPrescription } from "@/src/care-target/permissions";
import { useActiveCareTarget } from "@/src/care-target/useActiveCareTarget";
import { useAuthContext } from "@/src/auth/AuthProvider";
import { translations } from "@/src/i18n/translations";
import { useLanguage } from "@/src/store/LanguageContext";

type TabType = "records" | "meds";

type PrescriptionRow = {
  prescriptionId: string;
  title: string;
  createdAt: any;
  sourceImageUrl: string;
  memo: string;
};

type MedicationRecord = {
  prescriptionId: string;
  prescriptionTitle: string;
  createdAt: any;
  dosage: string;
  usage: string;
  memo: string;
};

type MedicationGroup = {
  key: string;
  name: string;
  count: number;
  purposes: string[];
  sourceLabel: string;
  records: MedicationRecord[];
};

function formatDate(createdAt: any, unknownText: string) {
  if (!createdAt) return unknownText;
  if (typeof createdAt === "string") return createdAt;
  if (createdAt?.seconds) {
    return new Date(createdAt.seconds * 1000).toLocaleDateString();
  }
  return unknownText;
}

function getRawItem(item: any) {
  return item?.raw && typeof item.raw === "object" ? item.raw : {};
}

function getDrugName(item: any) {
  const raw = getRawItem(item);

  return String(
    item?.drug_name_zh ??
      item?.drug_name ??
      item?.name ??
      raw?.drug_name_zh ??
      raw?.drug_name ??
      raw?.name ??
      "未命名藥品"
  );
}

function normalizeDrugKey(name: string) {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/（.*?）/g, "")
    .replace(/[a-z]*[\u4e00-\u9fa5]+$/g, "")
    .replace(/\s+/g, "")
    .replace(/[，,。．.]/g, "")
    .trim();
}

function getDisplayDrugName(name: string) {
  const displayName = String(name || "")
    .split("(")[0]
    .replace(/\d+\s*(mg|g|mcg|μg|ug|ml|tab|tablet|cap|capsule).*$/i, "")
    .replace(/\s+/g, " ")
    .trim();

  return displayName || name || "未命名藥品";
}

function getPurposeText(item: any) {
  const raw = getRawItem(item);
  const purpose = item?.purpose ?? raw?.purpose;

  if (typeof purpose === "string") return purpose;
  if (typeof purpose?.text === "string") return purpose.text;

  const commonUses =
    item?.common_uses ??
    raw?.common_uses ??
    item?.common_purpose ??
    raw?.common_purpose ??
    item?.commonPurpose ??
    raw?.commonPurpose ??
    item?.indication ??
    raw?.indication ??
    item?.usage_purpose ??
    raw?.usage_purpose ??
    "";

  if (Array.isArray(commonUses)) {
    return commonUses
      .map((value) => String(value).trim())
      .filter(Boolean)
      .join("、");
  }

  return String(commonUses);
}

function getPurposeSource(item: any) {
  const raw = getRawItem(item);
  const source =
    item?.purpose?.source ??
    raw?.purpose?.source ??
    item?.purpose_source ??
    raw?.purpose_source ??
    "";

  if (source === "prescription") return "藥單辨識";
  if (source === "ai") return "AI 補充";

  // 新版 AI prompt 的 common_uses 是模型補充內容。
  if (item?.common_uses || raw?.common_uses) return "AI 補充";

  return "";
}

function getMemoText(value: any): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";

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

async function deletePrescriptionCascade(prescriptionId: string) {
  if (!await canEditPrescription(prescriptionId)) throw new Error("Prescription management permission required");
  const parent = await getDoc(doc(db, "prescriptions", prescriptionId));
  const patientId = parent.data()?.patientId;
  if (!patientId) throw new Error("Patient unavailable");
  const batch = writeBatch(db);
  const items = await getDocs(collection(db, "prescriptions", prescriptionId, "items"));
  const reminders = await getDocs(query(collection(db, "medication_reminders"),
    where("patientId", "==", patientId), where("prescriptionId", "==", prescriptionId)));
  // Medication logs are immutable history and remain until retention cleanup.
  items.docs.forEach(item => batch.delete(item.ref));
  reminders.docs.forEach(reminder => batch.delete(reminder.ref));
  batch.delete(parent.ref);
  await batch.commit();
}

export default function FamilyListScreen() {
  const { activePatientId } = useActiveCareTarget();
  const { ready: authReady } = useAuthContext();
  const { language } = useLanguage();
  const t = translations[language];
  const fc = familyCopy[language];
  const extraText = {
    prescriptionRecords: t.prescriptionRecords,
    medicationList: t.medicationList,
    noMedicationData: t.noMedicationData,
    commonUses: t.commonUses,
    none: t.none,
    dataSource: t.dataSource,
    prescriptionRecognition: t.prescriptionRecognition,
    // 作為路由參數傳遞的資料值，保持原字串
    medicationData: "藥單資料",
  };
  // 顯示用：資料來源字串（資料值維持中文）轉為目前語系
  const sourceDisplay = (label: string) =>
    label === "AI 補充" ? fc.aiSupplement : label === "藥單辨識" ? t.prescriptionRecognition : label;

  const [tab, setTab] = useState<TabType>("records");
  const [list, setList] = useState<PrescriptionRow[]>([]);
  const [medications, setMedications] = useState<MedicationGroup[]>([]);
  const [dataReady, setDataReady] = useState(false);
  const scope = activePatientId ?? '';
  const [previousScope, setPreviousScope] = useState<string | null>(null);
  if (previousScope !== scope) {
    setPreviousScope(scope); setList([]); setMedications([]); setDataReady(!scope);
  }

  useEffect(() => {
    if (!activePatientId) {
      return;
    }


    const prescriptionsQuery = query(
      collection(db, "prescriptions"),
      where("patientId", "==", activePatientId)
    );

    const unsubscribe = onSnapshot(
      prescriptionsQuery,
      async (snapshot) => {
        try {
          const rows: PrescriptionRow[] = [...snapshot.docs]
            .sort((a, b) => (b.data().createdAt?.toMillis?.() ?? 0) - (a.data().createdAt?.toMillis?.() ?? 0))
            .map((document) => {
            const data = document.data() as any;

            return {
              prescriptionId: document.id,
              title: data.title || t.cameraDefaultDraftTitle,
              createdAt: data.createdAt,
              sourceImageUrl: data.sourceImageUrl ?? "",
              memo: getMemoText(data.memo),
            };
          });

          setList(rows);

          const itemSnapshots = await Promise.all(
            rows.map(async (prescription) => ({
              prescription,
              snapshot: await getDocs(
                collection(
                  db,
                  "prescriptions",
                  prescription.prescriptionId,
                  "items"
                )
              ),
            }))
          );

          const medicationMap = new Map<string, MedicationGroup>();

          itemSnapshots.forEach(({ prescription, snapshot: itemsSnapshot }) => {
            itemsSnapshot.docs.forEach((itemDocument) => {
              const item = itemDocument.data() as any;
              const raw = getRawItem(item);
              const name = getDrugName(item);
              const normalizedName = String(
                item.normalize_name ??
                  raw.normalize_name ??
                  normalizeDrugKey(name) ??
                  ""
              );
              const key =
                normalizedName ||
                `${prescription.prescriptionId}-${itemDocument.id}`;

              const dosage = String(
                item.dosage ?? item.dose ?? raw.dosage ?? raw.dose ?? ""
              );
              const usage = String(
                item.usage_zh ??
                  item.usage ??
                  item.time_of_day ??
                  raw.usage_zh ??
                  raw.usage ??
                  raw.time_of_day ??
                  ""
              );
              const itemMemo = getMemoText(
                item.memo ??
                  item.note_zh ??
                  item.note ??
                  raw.memo ??
                  raw.note_zh ??
                  raw.note
              );
              const memo = itemMemo || prescription.memo;
              const purposeText = getPurposeText(item).trim();
              const purposeSource = getPurposeSource(item);

              if (!medicationMap.has(key)) {
                medicationMap.set(key, {
                  key,
                  name,
                  count: 0,
                  purposes: [],
                  sourceLabel: purposeSource,
                  records: [],
                });
              }

              const group = medicationMap.get(key)!;
              group.count += 1;

              if (purposeText && !group.purposes.includes(purposeText)) {
                group.purposes.push(purposeText);
              }

              if (!group.sourceLabel && purposeSource) {
                group.sourceLabel = purposeSource;
              }

              group.records.push({
                prescriptionId: prescription.prescriptionId,
                prescriptionTitle: prescription.title,
                createdAt: prescription.createdAt,
                dosage,
                usage,
                memo,
              });
            });
          });

          const groupedMedications = Array.from(medicationMap.values()).sort(
            (a, b) => {
              if (b.count !== a.count) return b.count - a.count;
              return a.name.localeCompare(b.name);
            }
          );

          setMedications(groupedMedications);
          setDataReady(true);
        } catch (error) {
          console.log("family medication list error:", error);
          setMedications([]);
          setDataReady(true);
        }
      },
      (error) => {
        console.log("family prescription list error:", error);
        setDataReady(true);
      }
    );

    return unsubscribe;
  }, [activePatientId, t.cameraDefaultDraftTitle]);

  const handleDelete = (id: string) => {
    Alert.alert(t.deletePrescriptionTitle, t.deletePrescriptionMessage, [
      { text: t.cancel, style: "cancel" },
      {
        text: t.deleteConfirm,
        style: "destructive",
        onPress: async () => {
          try {
            await deletePrescriptionCascade(id);
          } catch (error) {
            console.log("family delete prescription error:", error);
            Alert.alert(t.resultErrorTitle, t.deleteFailed);
          }
        },
      },
    ]);
  };

  const openMedicationRecords = (medication: MedicationGroup) => {
    router.push({
      pathname: "/family/medication-detail" as any,
      params: {
        name: medication.name,
        recordsJson: JSON.stringify(medication.records),
        purposesJson: JSON.stringify(medication.purposes),
        sourceLabel: medication.sourceLabel || extraText.medicationData,
      },
    });
  };

  if (!authReady || !dataReady) {
    return (
      <View style={styles.container}>
        <AppHeader title={extraText.prescriptionRecords} fallbackHref="/family" />
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>{t.loading}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <AppHeader title={extraText.prescriptionRecords} fallbackHref="/family" />
      <SegmentedTabs
        tabs={[{ key: "records", label: extraText.prescriptionRecords }, { key: "meds", label: extraText.medicationList }] as const}
        value={tab}
        onChange={setTab}
        style={styles.tabBar}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {tab === "records" ? (
          <>
            {list.length === 0 ? (
              <EmptyState icon="document-text-outline" title={t.noPrescriptionRecords} />
            ) : (
              list.map((prescription) => (
                <Card key={prescription.prescriptionId} padding={0}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${prescription.title || t.prescriptionName}, ${t.viewDetails}`}
                    onPress={() =>
                      router.push({
                        pathname: "/family/detail",
                        params: { id: prescription.prescriptionId },
                      })
                    }
                    style={({ pressed }) => [styles.cardMain, pressed && styles.pressed]}
                  >
                    <View style={styles.cardIcon}>
                      <Ionicons name="document-text-outline" size={22} color={colors.primary} />
                    </View>
                    <View style={styles.cardText}>
                      <Text style={styles.cardTitle} numberOfLines={2}>
                        {prescription.title || t.prescriptionName}
                      </Text>
                      <Text style={styles.cardDate}>
                        {t.date}{language === "zh" ? "：" : ": "}
                        {formatDate(prescription.createdAt, t.unknown)}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                  </Pressable>
                  <Divider />
                  <View style={styles.cardFooter}>
                    <Button
                      label={t.viewDetails}
                      variant="ghost"
                      onPress={() =>
                        router.push({
                          pathname: "/family/detail",
                          params: { id: prescription.prescriptionId },
                        })
                      }
                    />
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => handleDelete(prescription.prescriptionId)}
                      style={({ pressed }) => [styles.deleteBtn, pressed && { backgroundColor: colors.dangerSoft }]}
                    >
                      <Ionicons name="trash-outline" size={18} color={colors.danger} />
                      <Text style={styles.deleteText}>{t.delete}</Text>
                    </Pressable>
                  </View>
                </Card>
              ))
            )}
          </>
        ) : (
          <>
            <Card style={styles.summaryCard}>
              <View style={styles.iconCircleLg}>
                <Ionicons name="medkit-outline" size={26} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.summaryLabel}>{fc.currentMedication}</Text>
                <Text style={styles.summaryCount}>{fc.medicationCount(medications.length)}</Text>
              </View>
            </Card>

            <View style={styles.warningBox}>
              <Ionicons name="information-circle-outline" size={22} color={colors.warning} />
              <Text style={styles.warningText}>{fc.medicationWarning}</Text>
            </View>

            {medications.length === 0 ? (
              <EmptyState icon="medical-outline" title={extraText.noMedicationData} />
            ) : (
              medications.map((medication) => (
                <Card
                  key={medication.key}
                  padding={0}
                  onPress={() => openMedicationRecords(medication)}
                  accessibilityLabel={getDisplayDrugName(medication.name)}
                >
                  <View style={styles.medContent}>
                    <View style={styles.cardIcon}>
                      <Ionicons name="medical-outline" size={22} color={colors.primary} />
                    </View>

                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.medName}>
                        {getDisplayDrugName(medication.name)}
                      </Text>

                      <View style={styles.purposeRow}>
                        <Text style={styles.purposeLabel}>{extraText.commonUses}</Text>
                        {medication.purposes.length > 0 ? (
                          medication.purposes.slice(0, 2).map((purpose) => (
                            <View key={purpose} style={styles.purposeTag}>
                              <Text style={styles.purposeTagText}>{purpose}</Text>
                            </View>
                          ))
                        ) : (
                          <View style={[styles.purposeTag, styles.noPurposeTag]}>
                            <Text style={styles.noPurposeText}>{extraText.none}</Text>
                          </View>
                        )}
                      </View>

                      <Text style={styles.sourceText}>
                        {extraText.dataSource}{language === "zh" ? "：" : ": "}
                        {sourceDisplay(medication.sourceLabel || extraText.prescriptionRecognition)}
                      </Text>

                      {medication.sourceLabel === "AI 補充" ? (
                        <Text style={styles.aiHint}>{fc.aiMedicationWarning}</Text>
                      ) : null}
                    </View>
                  </View>

                  <Divider />

                  <View style={styles.medFooter}>
                    <Text style={styles.recordCount}>{fc.recordCount(medication.count)}</Text>
                    <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                  </View>
                </Card>
              ))
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: spacing.md },
  loadingText: { ...typography.bodySmall },
  tabBar: { marginHorizontal: layout.screenPaddingX, marginTop: spacing.md },
  scrollContent: {
    padding: layout.screenPaddingX,
    gap: spacing.md,
    paddingBottom: spacing.xxxl,
    width: "100%",
    maxWidth: layout.maxContentWidth,
    alignSelf: "center",
  },
  pressed: { backgroundColor: colors.surfaceSunken },

  cardMain: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  cardText: { flex: 1, minWidth: 0, gap: 2 },
  cardTitle: { ...typography.bodyStrong, fontSize: 18 },
  cardDate: { ...typography.bodySmall, color: colors.textMuted },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: layout.minTouchTarget,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.control,
  },
  deleteText: { ...typography.label, fontSize: 17, color: colors.danger },

  summaryCard: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  iconCircleLg: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryLabel: { ...typography.bodySmall },
  summaryCount: { ...typography.title, marginTop: 2 },
  warningBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    borderRadius: radii.control,
    backgroundColor: colors.warningSoft,
    padding: spacing.lg,
  },
  warningText: { ...typography.bodySmall, flex: 1, color: colors.text },

  medContent: { flexDirection: "row", gap: spacing.md, padding: spacing.lg },
  medName: { ...typography.header, marginBottom: spacing.sm },
  purposeRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
  purposeLabel: { ...typography.label, color: colors.textSecondary, marginRight: 2 },
  purposeTag: {
    backgroundColor: colors.primarySoft,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    maxWidth: "100%",
  },
  purposeTagText: { ...typography.label, color: colors.primary },
  noPurposeTag: { backgroundColor: colors.surfaceSunken },
  noPurposeText: { ...typography.label, color: colors.textMuted },
  sourceText: { ...typography.bodySmall, color: colors.textMuted, marginTop: spacing.sm },
  aiHint: { ...typography.caption, color: colors.warning, marginTop: spacing.xs },
  medFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  recordCount: { ...typography.label, color: colors.textSecondary },
});
