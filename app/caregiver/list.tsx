// app/caregiver/list.tsx
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

export default function CaregiverListScreen() {
  const { activePatientId } = useActiveCareTarget();
  const { user } = useAuth();
  const { language } = useLanguage();
  const t = translations[language];

  const [tab, setTab] = useState<TabType>("records");
  const [list, setList] = useState<PrescriptionRow[]>([]);
  const [medications, setMedications] = useState<MedicationGroup[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!activePatientId) {
      setList([]);
      setMedications([]);
      setReady(true);
      return;
    }

    setReady(false);

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

  if (!ready) {
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
        <Pressable
          onPress={() => router.replace("/caregiver")}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={28} color="#333" />
          <Text style={styles.backText}>{t.back}</Text>
        </Pressable>

        <View style={styles.tabContainer}>
          <Pressable
            onPress={() => setTab("records")}
            style={[styles.tab, tab === "records" && styles.activeTab]}
          >
            <Text style={styles.tabText}>藥單紀錄</Text>
          </Pressable>

          <Pressable
            onPress={() => setTab("meds")}
            style={[styles.tab, tab === "meds" && styles.activeTab]}
          >
            <Text style={styles.tabText}>用藥列表</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {tab === "records" ? (
          <>
            <Text style={styles.pageTitle}>{t.prescriptionBook}</Text>

            {list.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons
                  name="document-text-outline"
                  size={60}
                  color="#CCC"
                />
                <Text style={styles.emptyText}>{t.noPrescriptionRecords}</Text>
                <Text style={styles.emptySubText}>
                  {t.goHomeScanPrescription}
                </Text>
              </View>
            ) : (
              list.map((prescription) => (
                <View
                  key={prescription.prescriptionId}
                  style={styles.recordCard}
                >
                  <Text style={styles.recordTitle}>
                    {prescription.title || t.cameraDefaultDraftTitle}
                  </Text>

                  <Text style={styles.recordDate}>
                    {t.date}：
                    {formatDate(prescription.createdAt, t.unknown)}
                  </Text>

                  <View style={styles.recordFooter}>
                    <Pressable
                      onPress={() =>
                        router.push({
                          pathname: "/caregiver/detail",
                          params: { id: prescription.prescriptionId },
                        })
                      }
                    >
                      <Text style={styles.detailText}>{t.viewDetails}</Text>
                    </Pressable>

                    <Pressable
                      onPress={() =>
                        confirmDelete(prescription.prescriptionId)
                      }
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
                  <Text style={styles.summaryLabel}>目前持續服用中</Text>
                  <Text style={styles.summaryCount}>
                    共 <Text style={styles.summaryNumber}>{medications.length}</Text>{" "}
                    種藥物
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.warningBox}>
              <Ionicons name="warning" size={40} color="#ebb120" />
              <Text style={styles.warningText}>
                用藥資訊僅供參考，請以醫師或藥師指示為準
              </Text>
            </View>

            {medications.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="medical-outline" size={60} color="#CCC" />
                <Text style={styles.emptyText}>目前尚無用藥資料</Text>
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
                        <Text style={styles.purposeLabel}>常見用途</Text>

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
                            <Text style={styles.noPurposeText}>無</Text>
                          </View>
                        )}
                      </View>

                      <Text style={styles.sourceText}>
                        資料來源：{medication.sourceLabel || "藥單辨識"}
                      </Text>

                      {medication.sourceLabel === "AI 補充" ? (
                        <Text style={styles.aiHint}>
                          ※ 此資訊僅供參考，請勿自行停藥或更改用藥
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  <View style={styles.medDivider} />

                  <View style={styles.medFooter}>
                    <Text style={styles.recordCount}>
                      共 {medication.count} 筆紀錄
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
    height: 60,
  },
  backText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginLeft: -5,
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
    color: "#222",
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 140,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: "900",
    marginBottom: 10,
    color: "#333",
  },
  emptyContainer: {
    marginTop: 80,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#666",
  },
  emptySubText: {
    fontSize: 14,
    color: "#999",
  },
  recordCard: {
    padding: 18,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    backgroundColor: "#fff",
    marginBottom: 15,
  },
  recordTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  recordDate: {
    fontSize: 14,
    color: "#999",
  },
  recordFooter: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#EEE",
    paddingTop: 10,
    marginTop: 10,
    gap: 20,
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
    backgroundColor: "#FFFDEB",
    borderRadius: 14,
    padding: 18,
    marginBottom: 10,
  },
  summaryTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  summaryLabel: {
    fontSize: 18,
    color: "#777",
    fontWeight: "900",
    marginBottom: 4,
  },
  summaryCount: {
    fontSize: 30,
    color: "#111",
    fontWeight: "900",
    lineHeight: 38,
  },
  summaryNumber: {
    color: "#E53935",
    fontSize: 34,
    fontWeight: "900",
  },
  warningBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#FFF4A8",
    borderColor: "#DCCF00",
    borderWidth: 2,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 18,
  },
  warningText: {
    flex: 1,
    fontSize: 16,
    color: "#111",
    fontWeight: "900",
    lineHeight: 22,
  },
  medCard: {
    borderWidth: 2,
    borderColor: "#A9A1A1",
    borderRadius: 14,
    backgroundColor: "#fff",
    marginBottom: 14,
    overflow: "hidden",
  },
  medContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 16,
    gap: 12,
  },
  pillIconWrap: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  pillIcon: {
    fontSize: 44,
  },
  medName: {
    fontSize: 24,
    fontWeight: "900",
    color: "#111",
    marginBottom: 8,
  },
  purposeRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 6,
  },
  purposeLabel: {
    fontSize: 17,
    fontWeight: "900",
    color: "#777",
    marginRight: 4,
  },
  purposeTag: {
    backgroundColor: "#FFF3A8",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  purposeTagText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#555",
  },
  noPurposeTag: {
    backgroundColor: "#E5E5E5",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  noPurposeText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#777",
  },
  sourceText: {
    fontSize: 15,
    color: "#777",
    fontWeight: "800",
  },
  aiHint: {
    marginTop: 8,
    fontSize: 13,
    color: "#777",
    fontWeight: "700",
  },
  medDivider: {
    height: 1,
    backgroundColor: "#D8D8D8",
  },
  medFooter: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  recordCount: {
    fontSize: 24,
    fontWeight: "900",
    color: "#111",
  },
});
