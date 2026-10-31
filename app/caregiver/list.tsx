import { AppHeader, Button, Card, Divider, EmptyState, StatusBadge } from "@/src/ui/components";
import { colors, layout, radii, spacing, typography } from "@/src/ui/theme";
import { caregiverCopy, sourceLabelText } from "@/src/i18n/copy/caregiverCopy";
import { SegmentedTabBar, SegmentedTabs } from "@/src/caregiver/SegmentedTabs";
import { AppAlert as Alert } from "@/src/ui/AppAlert";
// app/caregiver/list.tsx
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
import { router, type Href } from "expo-router";
import {
  collection,
  onSnapshot,
  query,
  where,
  doc,
  getDocs,
  getDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/firebase/firebaseConfig";
import { canDeletePrescription } from "@/src/care-target/permissions";
import { useActiveCareTarget } from "@/src/care-target/useActiveCareTarget";
import { useAuth } from "@/src/auth/useAuth";
import { translations } from "@/src/i18n/translations";
import { useLanguage } from "@/src/store/LanguageContext";
import { Ionicons } from "@expo/vector-icons";

type TabType = "records" | "meds";

type PrescriptionRow = {
  prescriptionId: string;
  title: string;
  createdAt: any;
  sourceImageUrl: string;
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

  return String(
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
      ""
  );
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
  if (!await canDeletePrescription(prescriptionId)) throw new Error("Prescription management permission required");
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

export default function CaregiverListScreen() {
  const { activePatientId } = useActiveCareTarget();
  const { user } = useAuth();
  const { language } = useLanguage();
  const t = translations[language];
  const c = caregiverCopy[language];
  const sep = language === "zh" ? "：" : ": ";

  const [tab, setTab] = useState<TabType>("records");
  const [list, setList] = useState<PrescriptionRow[]>([]);
  const [medications, setMedications] = useState<MedicationGroup[]>([]);
  const [ready, setReady] = useState(false);
  const scope = activePatientId ?? '';
  const [previousScope, setPreviousScope] = useState<string | null>(null);
  if (previousScope !== scope) {
    setPreviousScope(scope); setList([]); setMedications([]); setReady(!scope);
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
              title: data.title ?? t.cameraDefaultDraftTitle,
              createdAt: data.createdAt,
              sourceImageUrl: data.sourceImageUrl ?? "",
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
              const normalizedName =
                item.normalize_name ??
                raw.normalize_name ??
                normalizeDrugKey(name) ??
                "";
              const key = normalizedName || `${prescription.prescriptionId}-${itemDocument.id}`;

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
              const memo = getMemoText(
                item.memo ??
                  item.note_zh ??
                  item.note ??
                  raw.memo ??
                  raw.note_zh ??
                  raw.note
              );
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
          setReady(true);
        } catch (error) {
          console.log("caregiver medication list error:", error);
          setMedications([]);
          setReady(true);
        }
      },
      (error) => {
        console.log("caregiver prescription list error:", error);
        setReady(true);
      }
    );

    return unsubscribe;
  }, [activePatientId, user?.uid, t.cameraDefaultDraftTitle]);

  const confirmDelete = (id: string) => {
    Alert.alert(t.deletePrescriptionTitle, t.deletePrescriptionMessage, [
      { text: t.cancel, style: "cancel" },
      {
        text: t.deleteConfirm,
        style: "destructive",
        onPress: async () => {
          try {
            await deletePrescriptionCascade(id);
          } catch (error) {
            console.log("delete prescription error:", error);
            Alert.alert(t.resultErrorTitle, t.deleteFailedShort);
          }
        },
      },
    ]);
  };

  const openMedicationRecords = (medication: MedicationGroup) => {
    router.push({
      pathname: "/caregiver/medication-detail" as any,
      params: {
        name: medication.name,
        recordsJson: JSON.stringify(medication.records),
        purposesJson: JSON.stringify(medication.purposes),
        sourceLabel: medication.sourceLabel || "藥單資料",
      },
    });
  };

  const header = <AppHeader title={t.prescriptionBook} fallbackHref={"/caregiver" as Href} />;

  if (!ready) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.centerText}>{t.loading}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      {header}

      <SegmentedTabBar>
        <SegmentedTabs
          options={[
            { key: "records", label: t.prescriptionRecords },
            { key: "meds", label: t.medicationList },
          ]}
          value={tab}
          onChange={setTab}
        />
      </SegmentedTabBar>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {tab === "records" ? (
          <>
            {list.length === 0 ? (
              <EmptyState
                icon="document-text-outline"
                title={t.noPrescriptionRecords}
                body={t.goHomeScanPrescription}
              />
            ) : (
              list.map((prescription) => (
                <Card key={prescription.prescriptionId} padding={0}>
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: "/caregiver/detail",
                        params: { id: prescription.prescriptionId },
                      })
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`${prescription.title || t.cameraDefaultDraftTitle}, ${t.viewDetails}`}
                    style={({ pressed }) => [styles.recordBody, pressed && styles.pressed]}
                  >
                    <View style={styles.recordIcon}>
                      <Ionicons name="document-text-outline" size={24} color={colors.primary} />
                    </View>
                    <View style={styles.recordTextBox}>
                      <Text style={styles.recordTitle}>
                        {prescription.title || t.cameraDefaultDraftTitle}
                      </Text>
                      <Text style={styles.recordDate}>
                        {t.date}{sep}{formatDate(prescription.createdAt, t.unknown)}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={22} color={colors.textMuted} />
                  </Pressable>

                  <Divider />

                  <View style={styles.recordFooter}>
                    <Button
                      label={t.viewDetails}
                      variant="ghost"
                      icon="eye-outline"
                      onPress={() =>
                        router.push({
                          pathname: "/caregiver/detail",
                          params: { id: prescription.prescriptionId },
                        })
                      }
                    />
                    <Pressable
                      onPress={() => confirmDelete(prescription.prescriptionId)}
                      accessibilityRole="button"
                      accessibilityLabel={`${t.delete} ${prescription.title || ""}`.trim()}
                      style={({ pressed }) => [styles.deleteBtn, pressed && { backgroundColor: colors.dangerSoft }]}
                    >
                      <Ionicons name="trash-outline" size={20} color={colors.danger} />
                      <Text style={styles.deleteText}>{t.delete}</Text>
                    </Pressable>
                  </View>
                </Card>
              ))
            )}
          </>
        ) : (
          <>
            <Card tone="selected" style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>{t.currentMedications}</Text>
              <Text style={styles.summaryCount}>
                {t.medicationCountPrefix} <Text style={styles.summaryNumber}>{medications.length}</Text>{" "}
                {t.medicationCountSuffix}
              </Text>
            </Card>

            <View style={styles.warningBox} accessibilityRole="alert">
              <Ionicons name="warning-outline" size={24} color={colors.warning} />
              <Text style={styles.warningText}>{t.medicationDisclaimer}</Text>
            </View>

            {medications.length === 0 ? (
              <EmptyState icon="medical-outline" title={t.noMedicationData} />
            ) : (
              medications.map((medication) => (
                <Card
                  key={medication.key}
                  padding={0}
                  onPress={() => openMedicationRecords(medication)}
                  accessibilityLabel={getDisplayDrugName(medication.name)}
                >
                  <View style={styles.medContent}>
                    <View style={styles.recordIcon}>
                      <Ionicons name="medkit-outline" size={24} color={colors.primary} />
                    </View>

                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.medName}>
                        {getDisplayDrugName(medication.name) === "未命名藥品"
                          ? c.unnamedDrug
                          : getDisplayDrugName(medication.name)}
                      </Text>

                      <View style={styles.purposeRow}>
                        <Text style={styles.purposeLabel}>{t.commonUses}</Text>
                        {medication.purposes.length > 0 ? (
                          medication.purposes.slice(0, 2).map((purpose) => (
                            <StatusBadge key={purpose} label={purpose} tone="primary" style={styles.purposeTag} />
                          ))
                        ) : (
                          <StatusBadge label={t.none} tone="neutral" style={styles.purposeTag} />
                        )}
                      </View>

                      <Text style={styles.sourceText}>
                        {t.dataSource}{sep}{medication.sourceLabel ? sourceLabelText(medication.sourceLabel, language) : t.prescriptionRecognition}
                      </Text>

                      {medication.sourceLabel === "AI 補充" ? (
                        <Text style={styles.aiHint}>{t.aiMedicationHint}</Text>
                      ) : null}
                    </View>
                  </View>

                  <Divider />

                  <View style={styles.medFooter}>
                    <Text style={styles.recordCount}>
                      {t.recordsCountPrefix} {medication.count} {t.recordsCountSuffix}
                    </Text>
                    <Ionicons name="chevron-forward" size={22} color={colors.textMuted} />
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
  centerText: { ...typography.body, color: colors.textSecondary },

  scrollContent: {
    padding: layout.screenPaddingX,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
    width: "100%",
    maxWidth: layout.maxContentWidth,
    alignSelf: "center",
  },
  pressed: { backgroundColor: colors.surfaceSunken },

  recordBody: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  recordIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  recordTextBox: { flex: 1, minWidth: 0 },
  recordTitle: { ...typography.bodyStrong, fontSize: 18, marginBottom: 2 },
  recordDate: { ...typography.bodySmall },
  recordFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  deleteBtn: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.control,
  },
  deleteText: { ...typography.label, fontSize: 17, color: colors.danger },

  summaryCard: { gap: 2 },
  summaryLabel: { ...typography.label, color: colors.textSecondary },
  summaryCount: { ...typography.title, flexShrink: 1 },
  summaryNumber: { color: colors.primary, fontSize: 30 },
  warningBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    backgroundColor: colors.warningSoft,
    borderRadius: radii.card,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  warningText: { ...typography.body, flex: 1, color: colors.text },

  medContent: { flexDirection: "row", alignItems: "flex-start", padding: spacing.lg, gap: spacing.md },
  medName: { ...typography.header, marginBottom: spacing.sm, flexShrink: 1 },
  purposeRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.sm },
  purposeLabel: { ...typography.label, color: colors.textSecondary },
  purposeTag: { alignSelf: "auto", maxWidth: "100%" },
  sourceText: { ...typography.bodySmall },
  aiHint: { ...typography.caption, marginTop: spacing.xs },
  medFooter: {
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
  },
  recordCount: { ...typography.bodyStrong, flex: 1, flexShrink: 1 },
});
