// app/family/medication-detail.tsx
import React, { useLayoutEffect, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  StatusBar,
} from "react-native";
import { router, useLocalSearchParams, useNavigation, } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

type MedicationRecord = {
  prescriptionId: string;
  prescriptionTitle: string;
  title?: string;
  createdAt: any;
  dosage?: string;
  usage?: string;
  memo?: string;
};

function safeParseArray(value?: string) {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatDate(createdAt: any) {
  if (!createdAt) return "未知";
  if (typeof createdAt === "string") return createdAt;
  if (createdAt?.seconds) {
    return new Date(createdAt.seconds * 1000).toLocaleDateString();
  }
  return "未知";
}

function splitUsage(usage?: string) {
  const parts = String(usage ?? "")
    .split(/[，,]/)
    .map((part) => part.trim())
    .filter(Boolean);

  return {
    method: parts[0] || "未提供",
    time: parts.slice(1).join("，") || "未提供",
  };
}

export default function FamilyMedicationDetailScreen() {
    const navigation = useNavigation();
    useLayoutEffect(() => {
      navigation.setOptions({
        headerShown: false,
      });
    }, [navigation]);

  const { name, recordsJson, purposesJson, sourceLabel } =
    useLocalSearchParams<{
      name?: string;
      recordsJson?: string;
      purposesJson?: string;
      sourceLabel?: string;
    }>();

  const records = useMemo(
    () => safeParseArray(recordsJson) as MedicationRecord[],
    [recordsJson]
  );

  const purposes = useMemo(
    () => safeParseArray(purposesJson) as string[],
    [purposesJson]
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={30} color="#111" />
          <Text style={styles.backText}>返回</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.summaryCard}>
          <View style={styles.summaryTopRow}>
            <Ionicons name="documents-outline" size={54} color="#2F80ED" />
            <Text style={styles.summaryCount}>
              共 <Text style={styles.redText}>{records.length}</Text> 筆用藥紀錄
            </Text>
          </View>

          <View style={styles.summaryContent}>
            <Text style={styles.drugName}>{name || "藥品名稱"}</Text>

            <View style={styles.purposeRow}>
              <Text style={styles.purposeLabel}>常見用途</Text>

              {purposes.length > 0 ? (
                purposes.slice(0, 3).map((purpose) => (
                  <View key={purpose} style={styles.purposeTag}>
                    <Text style={styles.purposeTagText}>{purpose}</Text>
                  </View>
                ))
              ) : (
                <View style={styles.emptyTag}>
                  <Text style={styles.emptyTagText}>無</Text>
                </View>
              )}
            </View>

            <Text style={styles.sourceText}>
              資料來源：{sourceLabel || "藥單資料"}
            </Text>
          </View>
        </View>

        {records.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="document-text-outline" size={56} color="#CCC" />
            <Text style={styles.emptyText}>目前沒有用藥紀錄</Text>
          </View>
        ) : (
          records.map((record, index) => {
            const usage = splitUsage(record.usage);

            return (
              <Pressable
                key={`${record.prescriptionId}-${index}`}
                style={styles.recordCard}
                onPress={() =>
                  router.push({
                    pathname: "/family/detail",
                    params: { id: record.prescriptionId },
                  })
                }
              >
                <View style={styles.recordHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recordTitle}>
                      {record.prescriptionTitle || record.title || "藥單名稱"}
                    </Text>
                    <Text style={styles.recordDate}>
                      日期：{formatDate(record.createdAt)}
                    </Text>
                  </View>

                  <Ionicons name="chevron-forward" size={30} color="#111" />
                </View>

                <View style={styles.divider} />

                <View style={styles.infoBlock}>
                  <Text style={styles.infoText}>
                    <Text style={styles.infoLabel}>用法劑量：</Text>
                    {record.dosage || "未提供"}
                  </Text>

                  <Text style={styles.infoText}>
                    <Text style={styles.infoLabel}>使用方式：</Text>
                    {usage.method}
                  </Text>

                  <Text style={styles.infoText}>
                    <Text style={styles.infoLabel}>服用時段：</Text>
                    {usage.time}
                  </Text>

                  <Text style={styles.noteText}>
                    備註：{record.memo || "無"}
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
    backgroundColor: "#fff",
  },
  header: {
    backgroundColor: "#F4E770",
    height: 100,
    paddingTop: 50,
    paddingHorizontal: 15,
    justifyContent: "center",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    height: 44,
  },
  backText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginLeft: 2,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 140,
  },
  summaryCard: {
    borderWidth: 2,
    borderColor: "#DCCF00",
    backgroundColor: "#FFFDEB",
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  summaryTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  summaryContent: {
    marginLeft: 18,
  },
  summaryCount: {
    flex: 1,
    fontSize: 28,
    fontWeight: "900",
    color: "#111",
    lineHeight: 34,
  },
  redText: {
    color: "#E53935",
  },
  drugName: {
    fontSize: 26,
    fontWeight: "900",
    color: "#111",
    marginBottom: 10,
  },
  purposeRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },
  purposeLabel: {
    fontSize: 19,
    fontWeight: "900",
    color: "#777",
    marginRight: 4,
  },
  purposeTag: {
    backgroundColor: "#FFF3A8",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  purposeTagText: {
    fontSize: 18,
    fontWeight: "900",
    color: "#555",
  },
  emptyTag: {
    backgroundColor: "#EEE",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  emptyTagText: {
    fontSize: 18,
    fontWeight: "900",
    color: "#777",
  },
  sourceText: {
    fontSize: 16,
    color: "#777",
    fontWeight: "800",
  },
  recordCard: {
    borderWidth: 2,
    borderColor: "#A9A1A1",
    borderRadius: 14,
    backgroundColor: "#fff",
    marginBottom: 16,
    overflow: "hidden",
  },
  recordHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 12,
  },
  recordTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#111",
    marginBottom: 4,
  },
  recordDate: {
    fontSize: 17,
    color: "#777",
    fontWeight: "700",
  },
  divider: {
    height: 1,
    backgroundColor: "#D8D8D8",
  },
  infoBlock: {
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  infoText: {
    fontSize: 18,
    color: "#111",
    fontWeight: "800",
    marginBottom: 4,
  },
  infoLabel: {
    fontWeight: "900",
  },
  noteText: {
    fontSize: 18,
    color: "#777",
    fontWeight: "800",
    marginTop: 4,
  },
  emptyBox: {
    marginTop: 90,
    alignItems: "center",
    gap: 10,
  },
  emptyText: {
    fontSize: 18,
    color: "#777",
    fontWeight: "800",
  },
});
