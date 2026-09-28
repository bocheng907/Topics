import { useAgencyReports } from "@/src/agency/useAgencyReports";
import type {
  AgencyReport,
} from "@/src/agency/agencyReportTypes";

import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import React, {
  useMemo,
  useState,
} from "react";

import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";

type ReportFilter =
  | "all"
  | "pending"
  | "attention"
  | "resolved";

export default function AgencyReportsScreen() {
  const insets = useSafeAreaInsets();

  const {
    reports,
    pendingReports,
    attentionReports,
    resolvedReports,
    loading,
    error,
  } = useAgencyReports();

  const [filter, setFilter] =
    useState<ReportFilter>("all");

  const filteredReports = useMemo(() => {
    switch (filter) {
      case "pending":
        return pendingReports;

      case "attention":
        return attentionReports;

      case "resolved":
        return resolvedReports;

      default:
        return reports;
    }
  }, [
    filter,
    reports,
    pendingReports,
    attentionReports,
    resolvedReports,
  ]);

  const tabs: {
    key: ReportFilter;
    label: string;
    count: number;
  }[] = [
    {
      key: "all",
      label: "全部",
      count: reports.length,
    },
    {
      key: "pending",
      label: "待處理",
      count: pendingReports.length,
    },
    {
      key: "attention",
      label: "需關注",
      count: attentionReports.length,
    },
    {
      key: "resolved",
      label: "已處理",
      count: resolvedReports.length,
    },
  ];

  return (
    <View style={styles.container}>
      {/* 頂部導覽列 */}
      <View
        style={[
          styles.header,
          {
            paddingTop:
              insets.top + 8,
          },
        ]}
      >
        <Pressable
          style={styles.headerSide}
          onPress={() => router.back()}
        >
          <Ionicons
            name="chevron-back"
            size={30}
            color="#111827"
          />
        </Pressable>

        <Text style={styles.headerTitle}>
          回報管理
        </Text>

        <View style={styles.headerSide} />
      </View>

      {/* 篩選 Tabs */}
      <View style={styles.tabWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabRow}
        >
          {tabs.map((tab) => {
            const active =
              filter === tab.key;

            return (
              <Pressable
                key={tab.key}
                onPress={() =>
                  setFilter(tab.key)
                }
                style={[
                  styles.tabButton,
                  active &&
                    styles.tabButtonActive,
                ]}
              >
                <Text
                  style={[
                    styles.tabText,
                    active &&
                      styles.tabTextActive,
                  ]}
                >
                  {tab.label}
                </Text>

                <View
                  style={[
                    styles.tabCount,
                    active &&
                      styles.tabCountActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.tabCountText,
                      active &&
                        styles.tabCountTextActive,
                    ]}
                  >
                    {tab.count}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* 內容 */}
      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator
            size="large"
            color="#4F59D5"
          />

          <Text style={styles.loadingText}>
            回報載入中...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.centerState}>
          <View style={styles.errorIcon}>
            <Ionicons
              name="alert-circle-outline"
              size={42}
              color="#DC5A5A"
            />
          </View>

          <Text style={styles.emptyTitle}>
            無法載入回報
          </Text>

          <Text style={styles.emptyText}>
            {error}
          </Text>
        </View>
      ) : filteredReports.length === 0 ? (
        <EmptyState filter={filter} />
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={[
            styles.listContent,
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
        >
          {filteredReports.map(
            (report) => (
              <ReportCard
                key={report.id}
                report={report}
              />
            )
          )}
        </ScrollView>
      )}
    </View>
  );
}

function ReportCard({
  report,
}: {
  report: AgencyReport;
}) {
  const status = getReportStatus(report);

  return (
    <Pressable
      style={styles.reportCard}
      onPress={() => {
        router.push({
          pathname:
              "/agency/report-detail",
          params: {
              reportId: report.id,
          },
        } as any);
      }}
    >
      <View style={styles.reportTopRow}>
        <View style={styles.reportTitleArea}>
          <Text
            style={styles.reportTitle}
            numberOfLines={2}
          >
            {report.title}
          </Text>

          <Text style={styles.reportTime}>
            {formatReportTime(
              report.createdAt
            )}
          </Text>
        </View>

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
                color: status.color,
              },
            ]}
          >
            {status.label}
          </Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.infoRow}>
        <Ionicons
          name="person-outline"
          size={18}
          color="#6B7280"
        />

        <Text style={styles.infoLabel}>
          回報者
        </Text>

        <Text
          style={styles.infoValue}
          numberOfLines={1}
        >
          {report.reporterName || "家屬"}
          {report.reporterRole === "family"
            ? "（家屬）"
            : "（看護）"}
        </Text>
      </View>

      <View style={styles.infoRow}>
        <Ionicons
          name="people-outline"
          size={18}
          color="#6B7280"
        />

        <Text style={styles.infoLabel}>
          看護
        </Text>

        <Text
          style={styles.infoValue}
          numberOfLines={1}
        >
          {report.caregiverName}
        </Text>
      </View>

      <View style={styles.infoRow}>
        <Ionicons
          name="heart-outline"
          size={18}
          color="#6B7280"
        />

        <Text style={styles.infoLabel}>
          照護對象
        </Text>

        <Text
          style={styles.infoValue}
          numberOfLines={1}
        >
          {report.patientName}
        </Text>
      </View>

      {!!report.description && (
        <View style={styles.descriptionBox}>
          <Text
            style={styles.descriptionText}
            numberOfLines={2}
          >
            {report.description}
          </Text>
        </View>
      )}

      <View style={styles.cardFooter}>
        <Text style={styles.viewDetailText}>
          查看詳情
        </Text>

        <Ionicons
          name="chevron-forward"
          size={20}
          color="#9CA3AF"
        />
      </View>
    </Pressable>
  );
}

function EmptyState({
  filter,
}: {
  filter: ReportFilter;
}) {
  let title =
    "目前沒有問題回報";

  let description =
    "家屬提出需要仲介協助的問題後，會顯示在這裡。";

  if (filter === "pending") {
    title = "目前沒有待處理回報";
    description =
      "新的家屬回報會出現在這個分類。";
  }

  if (filter === "attention") {
    title = "目前沒有需關注回報";
    description =
      "標記為需持續追蹤的回報會出現在這裡。";
  }

  if (filter === "resolved") {
    title = "目前沒有已處理回報";
    description =
      "完成處理的回報會保留在這裡供後續查看。";
  }

  return (
    <View style={styles.centerState}>
      <View style={styles.emptyIcon}>
        <Ionicons
          name="chatbubbles-outline"
          size={38}
          color="#8B8B9A"
        />
      </View>

      <Text style={styles.emptyTitle}>
        {title}
      </Text>

      <Text style={styles.emptyText}>
        {description}
      </Text>
    </View>
  );
}

function getReportStatus(
  report: AgencyReport
) {
  if (report.status === "resolved") {
    return {
      label: "已處理",
      color: "#3F8F5F",
      backgroundColor: "#E8F5EC",
    };
  }

  if (report.level === "attention") {
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
  if (!timestamp) {
    return "";
  }

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

  tabWrapper: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#ECEEF4",
  },

  tabRow: {
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 9,
  },

  tabButton: {
    minHeight: 42,
    paddingHorizontal: 15,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: "#E1E4EC",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },

  tabButtonActive: {
    borderColor: "#4F59D5",
    backgroundColor: "#EEF0FF",
  },

  tabText: {
    color: "#6B7280",
    fontSize: 14,
    fontWeight: "800",
  },

  tabTextActive: {
    color: "#4F59D5",
  },

  tabCount: {
    minWidth: 23,
    height: 23,
    paddingHorizontal: 6,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F2F6",
  },

  tabCountActive: {
    backgroundColor: "#4F59D5",
  },

  tabCountText: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "900",
  },

  tabCountTextActive: {
    color: "#FFFFFF",
  },

  list: {
    flex: 1,
  },

  listContent: {
    padding: 18,
    gap: 13,
  },

  reportCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 17,
    borderWidth: 1,
    borderColor: "#E7E8ED",

    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },

  reportTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },

  reportTitleArea: {
    flex: 1,
  },

  reportTitle: {
    color: "#111827",
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "900",
  },

  reportTime: {
    marginTop: 5,
    color: "#9CA3AF",
    fontSize: 13,
    fontWeight: "600",
  },

  statusBadge: {
    minHeight: 31,
    paddingHorizontal: 10,
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

  divider: {
    height: 1,
    backgroundColor: "#EEF0F4",
    marginVertical: 14,
  },

  infoRow: {
    minHeight: 29,
    flexDirection: "row",
    alignItems: "center",
  },

  infoLabel: {
    width: 72,
    marginLeft: 8,
    color: "#6B7280",
    fontSize: 14,
    fontWeight: "700",
  },

  infoValue: {
    flex: 1,
    color: "#1F2937",
    fontSize: 14,
    fontWeight: "800",
  },

  descriptionBox: {
    marginTop: 11,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 13,
    backgroundColor: "#F8F9FC",
  },

  descriptionText: {
    color: "#6B7280",
    fontSize: 14,
    lineHeight: 21,
  },

  cardFooter: {
    marginTop: 13,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F0F1F4",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },

  viewDetailText: {
    color: "#4F59D5",
    fontSize: 14,
    fontWeight: "800",
    marginRight: 3,
  },

  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },

  loadingText: {
    marginTop: 12,
    color: "#6B7280",
    fontSize: 15,
    fontWeight: "700",
  },

  emptyIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEEFF4",
  },

  errorIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEE2E2",
  },

  emptyTitle: {
    marginTop: 15,
    color: "#111827",
    fontSize: 19,
    fontWeight: "900",
    textAlign: "center",
  },

  emptyText: {
    marginTop: 7,
    maxWidth: 330,
    color: "#7B7B85",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
});