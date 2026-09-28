import { useAgencyReports } from "@/src/agency/useAgencyReports";
import type {
  AgencyReport,
  AgencyReportLevel,
  AgencyReportStatus,
} from "@/src/agency/agencyReportTypes";
import { AppAlert as Alert } from "@/src/ui/AppAlert";

import { Ionicons } from "@expo/vector-icons";
import {
  router,
  useLocalSearchParams,
} from "expo-router";

import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";

type HandlingState =
  | "pending"
  | "attention"
  | "resolved";

export default function AgencyReportDetailScreen() {
  const insets = useSafeAreaInsets();

  const params = useLocalSearchParams<{
    reportId?: string | string[];
  }>();

  const reportId = Array.isArray(
    params.reportId
  )
    ? params.reportId[0]
    : params.reportId ?? "";

  const {
    reports,
    loading,
    error,
    updateReport,
  } = useAgencyReports();

  const report = useMemo(
    () =>
      reports.find(
        (item) => item.id === reportId
      ) ?? null,
    [reports, reportId]
  );

  const [
    handlingState,
    setHandlingState,
  ] = useState<HandlingState>("pending");

  const [
    handlingNote,
    setHandlingNote,
  ] = useState("");

  const [saving, setSaving] =
    useState(false);

  useEffect(() => {
    if (!report) return;

    setHandlingNote(
      report.handlingNote ?? ""
    );

    if (
      report.status === "resolved"
    ) {
      setHandlingState("resolved");
      return;
    }

    if (
      report.level === "attention"
    ) {
      setHandlingState("attention");
      return;
    }

    setHandlingState("pending");
  }, [
    report?.id,
    report?.level,
    report?.status,
    report?.handlingNote,
  ]);

  async function handleSave() {
    if (!report || saving) return;

    let nextLevel:
      AgencyReportLevel =
        report.level;

    let nextStatus:
      AgencyReportStatus =
        "open";

    if (
      handlingState === "pending"
    ) {
      nextLevel = "pending";
      nextStatus = "open";
    }

    if (
      handlingState === "attention"
    ) {
      nextLevel = "attention";
      nextStatus = "open";
    }

    if (
      handlingState === "resolved"
    ) {
      // 保留原本問題等級，
      // 只把處理狀態改成 resolved
      nextLevel =
        report.level === "normal"
          ? "normal"
          : report.level;

      nextStatus = "resolved";
    }

    try {
      setSaving(true);

      await updateReport(
        report.id,
        {
          level: nextLevel,
          status: nextStatus,
          handlingNote,
        }
      );

      Alert.alert(
        "儲存完成",
        handlingState === "resolved"
          ? "此回報已標記為已處理。"
          : "回報處理狀態已更新。",
        [
          {
            text: "確定",
            onPress: () => {
              router.replace("/agency/reports" as any);
            },
          },
        ]
      );
    } catch (saveError) {
      console.log(
        "[agency report] update failed:",
        saveError
      );

      Alert.alert(
        "儲存失敗",
        "目前無法更新回報，請稍後再試。"
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <Header insetsTop={insets.top} />

        <View
          style={styles.centerState}
        >
          <ActivityIndicator
            size="large"
            color="#4F59D5"
          />

          <Text
            style={styles.loadingText}
          >
            回報資料載入中...
          </Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Header insetsTop={insets.top} />

        <View
          style={styles.centerState}
        >
          <Ionicons
            name="alert-circle-outline"
            size={58}
            color="#DC5A5A"
          />

          <Text
            style={styles.stateTitle}
          >
            無法載入回報
          </Text>

          <Text
            style={styles.stateText}
          >
            {error}
          </Text>
        </View>
      </View>
    );
  }

  if (!report) {
    return (
      <View style={styles.container}>
        <Header insetsTop={insets.top} />

        <View
          style={styles.centerState}
        >
          <Ionicons
            name="document-text-outline"
            size={58}
            color="#8B8B9A"
          />

          <Text
            style={styles.stateTitle}
          >
            找不到這筆回報
          </Text>

          <Text
            style={styles.stateText}
          >
            這筆回報可能已不存在，
            請返回回報管理重新查看。
          </Text>
        </View>
      </View>
    );
  }

  const status =
    getReportStatus(report);

  return (
    <View style={styles.container}>
      <Header insetsTop={insets.top} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom:
              Math.max(
                40,
                insets.bottom + 30
              ),
          },
        ]}
        showsVerticalScrollIndicator={
          false
        }
        keyboardShouldPersistTaps="handled"
      >
        {/* 回報狀態 */}
        <View style={styles.topCard}>
          <View
            style={styles.statusRow}
          >
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor:
                    status.backgroundColor,
                },
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor:
                      status.color,
                  },
                ]}
              />

              <Text
                style={[
                  styles.statusText,
                  {
                    color:
                      status.color,
                  },
                ]}
              >
                {status.label}
              </Text>
            </View>

            <Text
              style={styles.timeText}
            >
              {formatReportTime(
                report.createdAt
              )}
            </Text>
          </View>

          <Text
            style={styles.reportTitle}
          >
            {report.title}
          </Text>
        </View>

        {/* 基本資訊 */}
        <Text style={styles.sectionTitle}>
          回報資訊
        </Text>

        <View style={styles.infoCard}>
          <InfoRow
            icon="person-outline"
            label="回報者"
            value={
              `${report.reporterName || "家屬"}${
                report.reporterRole ===
                "family"
                  ? "（家屬）"
                  : "（看護）"
              }`
            }
          />

          <View style={styles.rowDivider} />

          <InfoRow
            icon="people-outline"
            label="看護"
            value={
              report.caregiverName
            }
          />

          <View style={styles.rowDivider} />

          <InfoRow
            icon="heart-outline"
            label="照護對象"
            value={
              report.patientName
            }
          />
        </View>

        {/* 問題說明 */}
        <Text style={styles.sectionTitle}>
          問題說明
        </Text>

        <View
          style={styles.descriptionCard}
        >
          <Text
            style={styles.descriptionText}
          >
            {report.description ||
              "未填寫問題說明"}
          </Text>
        </View>

        {/* 處理狀態 */}
        <Text style={styles.sectionTitle}>
          處理狀態
        </Text>

        <View
          style={styles.statusOptions}
        >
          <StatusOption
            label="待處理"
            icon="alert-circle-outline"
            active={
              handlingState ===
              "pending"
            }
            color="#DC5A5A"
            backgroundColor="#FEE2E2"
            onPress={() =>
              setHandlingState(
                "pending"
              )
            }
          />

          <StatusOption
            label="需關注"
            icon="eye-outline"
            active={
              handlingState ===
              "attention"
            }
            color="#B7791F"
            backgroundColor="#FFF4D6"
            onPress={() =>
              setHandlingState(
                "attention"
              )
            }
          />

          <StatusOption
            label="已處理"
            icon="checkmark-circle-outline"
            active={
              handlingState ===
              "resolved"
            }
            color="#3F8F5F"
            backgroundColor="#E8F5EC"
            onPress={() =>
              setHandlingState(
                "resolved"
              )
            }
          />
        </View>

        {/* 處理備註 */}
        <Text style={styles.sectionTitle}>
          處理備註
        </Text>

        <TextInput
          value={handlingNote}
          onChangeText={
            setHandlingNote
          }
          placeholder="請輸入仲介的處理紀錄，例如：已與家屬及看護聯繫並完成溝通。"
          multiline
          maxLength={3000}
          textAlignVertical="top"
          style={styles.noteInput}
        />

        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={[
            styles.saveButton,
            saving &&
              styles.saveButtonDisabled,
          ]}
        >
          {saving ? (
            <ActivityIndicator
              color="#FFFFFF"
            />
          ) : (
            <>
              <Ionicons
                name="save-outline"
                size={21}
                color="#FFFFFF"
              />

              <Text
                style={
                  styles.saveButtonText
                }
              >
                儲存更新
              </Text>
            </>
          )}
        </Pressable>

        {report.status ===
          "resolved" && (
          <View
            style={styles.resolvedInfo}
          >
            <Ionicons
              name="checkmark-circle"
              size={20}
              color="#3F8F5F"
            />

            <Text
              style={
                styles.resolvedInfoText
              }
            >
              此回報已完成處理
              {report.handledAt
                ? ` · ${formatReportTime(
                    report.handledAt
                  )}`
                : ""}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function Header({
  insetsTop,
}: {
  insetsTop: number;
}) {
  return (
    <View
      style={[
        styles.header,
        {
          paddingTop:
            insetsTop + 8,
        },
      ]}
    >
      <Pressable
        style={styles.headerSide}
        onPress={() =>
          router.back()
        }
      >
        <Ionicons
          name="chevron-back"
          size={30}
          color="#111827"
        />
      </Pressable>

      <Text style={styles.headerTitle}>
        回報詳情
      </Text>

      <View style={styles.headerSide} />
    </View>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon:
    | "person-outline"
    | "people-outline"
    | "heart-outline";
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <View
        style={styles.infoIcon}
      >
        <Ionicons
          name={icon}
          size={21}
          color="#4F59D5"
        />
      </View>

      <Text style={styles.infoLabel}>
        {label}
      </Text>

      <Text style={styles.infoValue}>
        {value}
      </Text>
    </View>
  );
}

function StatusOption({
  label,
  icon,
  active,
  color,
  backgroundColor,
  onPress,
}: {
  label: string;
  icon:
    | "alert-circle-outline"
    | "eye-outline"
    | "checkmark-circle-outline";
  active: boolean;
  color: string;
  backgroundColor: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.statusOption,
        active && {
          borderColor: color,
          backgroundColor,
        },
      ]}
    >
      <Ionicons
        name={icon}
        size={22}
        color={
          active
            ? color
            : "#9CA3AF"
        }
      />

      <Text
        style={[
          styles.statusOptionText,
          active && {
            color,
          },
        ]}
      >
        {label}
      </Text>

      {active && (
        <Ionicons
          name="checkmark-circle"
          size={20}
          color={color}
        />
      )}
    </Pressable>
  );
}

function getReportStatus(
  report: AgencyReport
) {
  if (
    report.status === "resolved"
  ) {
    return {
      label: "已處理",
      color: "#3F8F5F",
      backgroundColor: "#E8F5EC",
    };
  }

  if (
    report.level === "attention"
  ) {
    return {
      label: "需關注",
      color: "#B7791F",
      backgroundColor: "#FFF4D6",
    };
  }

  return {
    label: "待處理",
    color: "#DC5A5A",
    backgroundColor: "#FEE2E2",
  };
}

function formatReportTime(
  timestamp: any
) {
  if (!timestamp) return "";

  try {
    const date =
      typeof timestamp.toDate ===
      "function"
        ? timestamp.toDate()
        : new Date(timestamp);

    return new Intl.DateTimeFormat(
      "zh-TW",
      {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }
    ).format(date);
  } catch {
    return "";
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FC",
  },

  header: {
    minHeight: 70,
    paddingBottom: 12,
    paddingHorizontal: 12,
    backgroundColor: "#E1E9FF",
    borderBottomWidth: 1,
    borderBottomColor: "#D8DFF5",
    flexDirection: "row",
    alignItems: "flex-end",
  },

  headerSide: {
    width: 46,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },

  headerTitle: {
    flex: 1,
    textAlign: "center",
    paddingBottom: 10,
    color: "#111827",
    fontSize: 21,
    fontWeight: "900",
  },

  scrollView: {
    flex: 1,
  },

  content: {
    padding: 18,
  },

  topCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E7E8ED",
  },

  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent:
      "space-between",
    gap: 10,
  },

  statusBadge: {
    minHeight: 32,
    paddingHorizontal: 11,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },

  statusText: {
    fontSize: 13,
    fontWeight: "900",
  },

  timeText: {
    color: "#9CA3AF",
    fontSize: 13,
    fontWeight: "600",
  },

  reportTitle: {
    marginTop: 16,
    color: "#111827",
    fontSize: 21,
    lineHeight: 30,
    fontWeight: "900",
  },

  sectionTitle: {
    marginTop: 24,
    marginBottom: 10,
    color: "#111827",
    fontSize: 17,
    fontWeight: "900",
  },

  infoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#E7E8ED",
  },

  infoRow: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
  },

  infoIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#EEF0FF",
    alignItems: "center",
    justifyContent: "center",
  },

  infoLabel: {
    width: 82,
    marginLeft: 11,
    color: "#6B7280",
    fontSize: 14,
    fontWeight: "700",
  },

  infoValue: {
    flex: 1,
    color: "#111827",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "right",
  },

  rowDivider: {
    height: 1,
    marginLeft: 49,
    backgroundColor: "#EEF0F4",
  },

  descriptionCard: {
    minHeight: 120,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 17,
    borderWidth: 1,
    borderColor: "#E7E8ED",
  },

  descriptionText: {
    color: "#374151",
    fontSize: 15,
    lineHeight: 24,
  },

  statusOptions: {
    gap: 10,
  },

  statusOption: {
    minHeight: 58,
    paddingHorizontal: 15,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#E3E5EB",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  statusOptionText: {
    flex: 1,
    color: "#6B7280",
    fontSize: 15,
    fontWeight: "800",
  },

  noteInput: {
    minHeight: 145,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E1E3E8",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#111827",
    fontSize: 15,
    lineHeight: 23,
  },

  saveButton: {
    height: 58,
    marginTop: 24,
    borderRadius: 16,
    backgroundColor: "#4F59D5",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  saveButtonDisabled: {
    opacity: 0.6,
  },

  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "900",
  },

  resolvedInfo: {
    marginTop: 14,
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: "#E8F5EC",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },

  resolvedInfoText: {
    color: "#3F8F5F",
    fontSize: 14,
    fontWeight: "800",
  },

  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 34,
  },

  loadingText: {
    marginTop: 12,
    color: "#6B7280",
    fontSize: 15,
    fontWeight: "700",
  },

  stateTitle: {
    marginTop: 14,
    color: "#111827",
    fontSize: 19,
    fontWeight: "900",
    textAlign: "center",
  },

  stateText: {
    maxWidth: 330,
    marginTop: 7,
    color: "#7B7B85",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
});