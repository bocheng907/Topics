// app/family/list.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  StatusBar,
  Alert,
} from "react-native";
import { router } from "expo-router";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  doc,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/firebase/firebaseConfig";
import { useActiveCareTarget } from "@/src/care-target/useActiveCareTarget";
import { useAuthContext } from "@/src/auth/AuthProvider";
import { translations } from "@/src/i18n/translations";
import { useLanguage } from "@/src/store/LanguageContext";
import { Ionicons } from "@expo/vector-icons";

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
  const batch = writeBatch(db);

  const itemsSnap = await getDocs(
    collection(db, "prescriptions", prescriptionId, "items")
  );
  itemsSnap.docs.forEach((docSnap) => {
    batch.delete(docSnap.ref);
  });

  const remindersSnap = await getDocs(
    query(
      collection(db, "medication_reminders"),
      where("prescriptionId", "==", prescriptionId)
    )
  );
  remindersSnap.docs.forEach((docSnap) => {
    batch.delete(docSnap.ref);
  });

  const logsSnap = await getDocs(
    query(
      collection(db, "medication_logs"),
      where("prescriptionId", "==", prescriptionId)
    )
  );
  logsSnap.docs.forEach((docSnap) => {
    batch.delete(docSnap.ref);
  });

  batch.delete(doc(db, "prescriptions", prescriptionId));
  await batch.commit();
}

export default function FamilyListScreen() {
  const { activePatientId } = useActiveCareTarget();
  const { ready: authReady } = useAuthContext();
  const { language } = useLanguage();
  const t = translations[language];
  const extraText = {
    prescriptionRecords:
      (t as any).prescriptionRecords ?? "藥單紀錄",
    medicationList: (t as any).medicationList ?? "用藥列表",
    currentMedication: (t as any).currentMedication ?? "目前持續服用中",
    totalMedicationPrefix:
      (t as any).totalMedicationPrefix ?? "共",
    medicationUnit: (t as any).medicationUnit ?? "種藥物",
    medicationWarning:
      (t as any).medicationWarning ??
      "用藥資訊僅供參考，請以醫師或藥師指示為準",
    noMedicationData:
      (t as any).noMedicationData ?? "目前尚無用藥資料",
    commonUses: (t as any).commonUses ?? "常見用途",
    none: (t as any).none ?? "無",
    dataSource: (t as any).dataSource ?? "資料來源",
    prescriptionRecognition:
      (t as any).prescriptionRecognition ?? "藥單辨識",
    medicationData: (t as any).medicationData ?? "藥單資料",
    aiSupplement: (t as any).aiSupplement ?? "AI 補充",
    aiWarning:
      (t as any).aiMedicationWarning ??
      "※ 此資訊僅供參考，請勿自行停藥或更改用藥",
    recordPrefix: (t as any).recordPrefix ?? "共",
    recordUnit: (t as any).recordUnit ?? "筆紀錄",
  };

  const [tab, setTab] = useState<TabType>("records");
  const [list, setList] = useState<PrescriptionRow[]>([]);
  const [medications, setMedications] = useState<MedicationGroup[]>([]);
  const [dataReady, setDataReady] = useState(false);

  useEffect(() => {
    if (!activePatientId) {
      setList([]);
      setMedications([]);
      setDataReady(true);
      return;
    }

    setDataReady(false);

    const prescriptionsQuery = query(
      collection(db, "prescriptions"),
      where("patientId", "==", activePatientId),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      prescriptionsQuery,
      async (snapshot) => {
        try {
          const rows: PrescriptionRow[] = snapshot.docs.map((document) => {
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
      <View style={styles.center}>
        <Text>{t.loading}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color="#333" />
          <Text style={styles.backText}>{t.back}</Text>
        </Pressable>

        <View style={styles.tabContainer}>
          <Pressable
            onPress={() => setTab("records")}
            style={[styles.tab, tab === "records" && styles.activeTab]}
          >
            <Text style={styles.tabText}>{extraText.prescriptionRecords}</Text>
          </Pressable>

          <Pressable
            onPress={() => setTab("meds")}
            style={[styles.tab, tab === "meds" && styles.activeTab]}
          >
            <Text style={styles.tabText}>{extraText.medicationList}</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {tab === "records" ? (
          <>
            {list.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons
                  name="document-text-outline"
                  size={60}
                  color="#CCC"
                />
                <Text style={styles.emptyText}>{t.noPrescriptionRecords}</Text>
              </View>
            ) : (
              list.map((prescription) => (
                <View
                  key={prescription.prescriptionId}
                  style={styles.card}
                >
                  <View style={{ gap: 4 }}>
                    <Text style={styles.cardTitle}>
                      {prescription.title || t.prescriptionName}
                    </Text>
                    <Text style={styles.cardDate}>
                      {t.date}：
                      {formatDate(prescription.createdAt, t.unknown)}
                    </Text>
                  </View>

                  <View style={styles.cardFooter}>
                    <Pressable
                      onPress={() =>
                        router.push({
                          pathname: "/family/detail",
                          params: { id: prescription.prescriptionId },
                        })
                      }
                    >
                      <Text style={styles.detailText}>{t.viewDetails}</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => handleDelete(prescription.prescriptionId)}
                    >
                      <Text style={styles.deleteText}>{t.delete}</Text>
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </>
        ) : (
          <>
            <View style={styles.summaryCard}>
              <View style={styles.summaryTop}>
                <Ionicons
                  name="documents-outline"
                  size={54}
                  color="#2F80ED"
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.summaryLabel}>
                    {extraText.currentMedication}
                  </Text>
                  <Text style={styles.summaryCount}>
                    {extraText.totalMedicationPrefix}{" "}
                    <Text style={styles.summaryNumber}>
                      {medications.length}
                    </Text>{" "}
                    {extraText.medicationUnit}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.warningBox}>
              <Ionicons name="warning" size={40} color="#ebb120" />
              <Text style={styles.warningText}>
                {extraText.medicationWarning}
              </Text>
            </View>

            {medications.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="medical-outline" size={60} color="#CCC" />
                <Text style={styles.emptyText}>
                  {extraText.noMedicationData}
                </Text>
              </View>
            ) : (
              medications.map((medication) => (
                <Pressable
                  key={medication.key}
                  style={styles.medCard}
                  onPress={() => openMedicationRecords(medication)}
                >
                  <View style={styles.medContent}>
                    <View style={styles.pillIconWrap}>
                      <Text style={styles.pillIcon}>💊</Text>
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.medName}>
                        {getDisplayDrugName(medication.name)}
                      </Text>

                      <View style={styles.purposeRow}>
                        <Text style={styles.purposeLabel}>
                          {extraText.commonUses}
                        </Text>

                        {medication.purposes.length > 0 ? (
                          medication.purposes.slice(0, 2).map((purpose) => (
                            <View key={purpose} style={styles.purposeTag}>
                              <Text style={styles.purposeTagText}>
                                {purpose}
                              </Text>
                            </View>
                          ))
                        ) : (
                          <View style={styles.noPurposeTag}>
                            <Text style={styles.noPurposeText}>
                              {extraText.none}
                            </Text>
                          </View>
                        )}
                      </View>

                      <Text style={styles.sourceText}>
                        {extraText.dataSource}：
                        {medication.sourceLabel ||
                          extraText.prescriptionRecognition}
                      </Text>

                      {medication.sourceLabel === "AI 補充" ? (
                        <Text style={styles.aiHint}>{extraText.aiWarning}</Text>
                      ) : null}
                    </View>
                  </View>

                  <View style={styles.medDivider} />

                  <View style={styles.medFooter}>
                    <Text style={styles.recordCount}>
                      {extraText.recordPrefix} {medication.count}{" "}
                      {extraText.recordUnit}
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={32}
                      color="#111"
                    />
                  </View>
                </Pressable>
              ))
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    backgroundColor: "#F4E770",
    paddingTop: 50,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    height: 50,
  },
  backText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#000",
    marginLeft: 2,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#F4E770",
  },
  tab: {
    flex: 1,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  activeTab: {
    backgroundColor: "#DCCF00",
  },
  tabText: {
    fontSize: 20,
    fontWeight: "900",
    color: "#111",
  },
  scrollContent: {
    padding: 20,
    gap: 15,
    paddingBottom: 140,
  },
  emptyContainer: {
    marginTop: 100,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#666",
  },
  card: {
    padding: 18,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    backgroundColor: "#fff",
    gap: 12,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  cardDate: {
    fontSize: 14,
    color: "#999",
  },
  cardFooter: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#EEE",
    paddingTop: 10,
    gap: 15,
  },
  detailText: {
    color: "#007AFF",
    fontWeight: "bold",
    fontSize: 16,
  },
  deleteText: {
    color: "#FF3B30",
    fontWeight: "bold",
    fontSize: 16,
  },
  summaryCard: {
    borderWidth: 2,
    borderColor: "#DCCF00",
    borderRadius: 15,
    backgroundColor: "#FFFDEB",
    padding: 18,
  },
  summaryTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  summaryLabel: {
    fontSize: 18,
    fontWeight: "800",
    color: "#777",
  },
  summaryCount: {
    marginTop: 3,
    fontSize: 25,
    fontWeight: "900",
    color: "#111",
  },
  summaryNumber: {
    color: "#E53935",
  },
  warningBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    backgroundColor: "#FFF8D8",
    padding: 16,
  },
  warningText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 23,
    fontWeight: "700",
    color: "#6A5700",
  },
  medCard: {
    borderWidth: 2,
    borderColor: "#B8B0B0",
    borderRadius: 15,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  medContent: {
    flexDirection: "row",
    gap: 14,
    padding: 18,
  },
  pillIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#FFF7B2",
    alignItems: "center",
    justifyContent: "center",
  },
  pillIcon: {
    fontSize: 29,
  },
  medName: {
    fontSize: 22,
    fontWeight: "900",
    color: "#111",
    marginBottom: 10,
  },
  purposeRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  purposeLabel: {
    fontSize: 15,
    fontWeight: "800",
    color: "#777",
    marginRight: 3,
  },
  purposeTag: {
    backgroundColor: "#FFF3A8",
    borderRadius: 11,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  purposeTagText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#6B5900",
  },
  noPurposeTag: {
    borderRadius: 11,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "#EFEFEF",
  },
  noPurposeText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#777",
  },
  sourceText: {
    marginTop: 10,
    fontSize: 14,
    color: "#777",
  },
  aiHint: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    color: "#A76400",
  },
  medDivider: {
    height: 1,
    backgroundColor: "#E8E8E8",
  },
  medFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  recordCount: {
    fontSize: 16,
    fontWeight: "800",
    color: "#555",
  },
});
