import { useAgencyCaregivers } from "@/src/agency/useAgencyCaregivers";
import { useAgencyReports } from "@/src/agency/useAgencyReports";
import type {
  AgencyReport,
  AgencyReportCategory,
} from "@/src/agency/agencyReportTypes";

import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";

import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";

const CATEGORY_LABELS: Record<
  AgencyReportCategory,
  string
> = {
  communication: "溝通協調",
  schedule: "排班／出勤",
  service: "服務內容",
  other: "其他",
};

const CATEGORY_ORDER: AgencyReportCategory[] = [
  "communication",
  "schedule",
  "service",
  "other",
];

export default function AgencyAnalyticsScreen() {
  const insets = useSafeAreaInsets();

  const {
    reports,
    loading: reportLoading,
  } = useAgencyReports();

  const {
    caregivers,
    loading: caregiverLoading,
  } = useAgencyCaregivers();

  const totalReports = reports.length;

  const openCount = reports.filter(
    (report) => report.status === "open"
  ).length;

  const resolvedCount = reports.filter(
    (report) => report.status === "resolved"
  ).length;

  const categoryStats = useMemo(() => {
    return CATEGORY_ORDER.map((category) => ({
      category,
      label: CATEGORY_LABELS[category],
      count: reports.filter(
        (report) => report.category === category
      ).length,
    }));
  }, [reports]);

  const uncategorizedCount = useMemo(
    () =>
      reports.filter((report) => {
        const category = (
          report as AgencyReport & {
            category?: string;
          }
        ).category;

        return !CATEGORY_ORDER.includes(
          category as AgencyReportCategory
        );
      }).length,
    [reports]
  );

  const caregiverStats = useMemo(() => {
    return caregivers
        .map((caregiver) => {
        const caregiverReports = reports.filter(
            (report) =>
            report.caregiverUid ===
            caregiver.caregiverUid
        );

        const categories = CATEGORY_ORDER.map(
            (category) => ({
            category,
            label: CATEGORY_LABELS[category],
            count: caregiverReports.filter(
                (report) =>
                report.category === category
            ).length,
            })
        );

        const uncategorizedCount =
            caregiverReports.filter(
            (report) =>
                !report.category ||
                !CATEGORY_ORDER.includes(
                report.category
                )
            ).length;

        return {
            caregiverUid:
            caregiver.caregiverUid,
            name:
            caregiver.displayName ||
            caregiver.caregiverEmail ||
            "未命名看護",
            total: caregiverReports.length,
            categories,
            uncategorizedCount,
        };
        })
        .sort((a, b) => b.total - a.total);
    }, [caregivers, reports]);

    const [
    selectedCaregiverUid,
    setSelectedCaregiverUid,
    ] = useState("");

    const [
    caregiverDropdownOpen,
    setCaregiverDropdownOpen,
    ] = useState(false);

    const selectedCaregiverStat = useMemo(() => {
    if (caregiverStats.length === 0) {
        return null;
    }

    return (
        caregiverStats.find(
        (item) =>
            item.caregiverUid ===
            selectedCaregiverUid
        ) ?? caregiverStats[0]
    );
    }, [
    caregiverStats,
    selectedCaregiverUid,
    ]);

    const selectedCaregiverMaxCount =
    selectedCaregiverStat
        ? Math.max(
            1,
            ...selectedCaregiverStat.categories.map(
            (item) => item.count
            ),
            selectedCaregiverStat.uncategorizedCount
        )
        : 1;

  const maxCategoryCount = Math.max(
    1,
    ...categoryStats.map((item) => item.count),
    uncategorizedCount
  );

  const loading =
    reportLoading || caregiverLoading;

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 8,
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
          回報統計
        </Text>

        <View style={styles.headerSide} />
      </View>

      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator
            size="large"
            color="#4F59D5"
          />

          <Text style={styles.loadingText}>
            統計資料載入中...
          </Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.content,
            {
              paddingBottom:
                Math.max(40, insets.bottom + 30),
            },
          ]}
        >
          <Text style={styles.sectionTitle}>
            回報概況
          </Text>

          <Text style={styles.sectionSubtitle}>
            根據目前累積的家庭問題回報整理
          </Text>

          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>
                總回報
              </Text>

              <Text style={styles.summaryValue}>
                {totalReports}
              </Text>

              <Text style={styles.summaryUnit}>
                件
              </Text>
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>
                待處理
              </Text>

              <Text style={styles.summaryValue}>
                {openCount}
              </Text>

              <Text style={styles.summaryUnit}>
                件
              </Text>
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>
                已處理
              </Text>

              <Text style={styles.summaryValue}>
                {resolvedCount}
              </Text>

              <Text style={styles.summaryUnit}>
                件
              </Text>
            </View>
          </View>

          <View style={styles.chartCard}>
            <View style={styles.chartHeader}>
              <View>
                <Text style={styles.chartTitle}>
                  問題類型分布
                </Text>

                <Text style={styles.chartSubtitle}>
                  哪一類問題最常需要仲介協助
                </Text>
              </View>

              <View style={styles.chartIcon}>
                <Ionicons
                  name="bar-chart-outline"
                  size={22}
                  color="#4F59D5"
                />
              </View>
            </View>

            {totalReports === 0 ? (
              <Text style={styles.emptyText}>
                尚未有可統計的問題回報
              </Text>
            ) : (
              <>
                {categoryStats.map((item) => {
                  const percent =
                    (item.count /
                      maxCategoryCount) *
                    100;

                  const width =
                    `${Math.max(
                      item.count > 0 ? 5 : 0,
                      percent
                    )}%` as `${number}%`;

                  return (
                    <View
                      key={item.category}
                      style={styles.barItem}
                    >
                      <View style={styles.barLabelRow}>
                        <Text
                          style={styles.barLabel}
                        >
                          {item.label}
                        </Text>

                        <Text
                          style={styles.barValue}
                        >
                          {item.count} 件
                        </Text>
                      </View>

                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.barFill,
                            { width },
                          ]}
                        />
                      </View>
                    </View>
                  );
                })}

                {uncategorizedCount > 0 && (
                  <View style={styles.barItem}>
                    <View
                      style={styles.barLabelRow}
                    >
                      <Text style={styles.barLabel}>
                        未分類
                      </Text>

                      <Text style={styles.barValue}>
                        {uncategorizedCount} 件
                      </Text>
                    </View>

                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFillMuted,
                          {
                            width:
                              `${Math.max(
                                5,
                                (uncategorizedCount /
                                  maxCategoryCount) *
                                  100
                              )}%` as `${number}%`,
                          },
                        ]}
                      />
                    </View>
                  </View>
                )}
              </>
            )}
          </View>

          <View style={styles.chartCard}>
            <View style={styles.chartHeader}>
              <View>
                <Text style={styles.chartTitle}>
                各看護問題類型分布
                </Text>

                <Text style={styles.chartSubtitle}>
                選擇看護，掌握較常出現的問題類型
                </Text>
              </View>

              <View style={styles.chartIcon}>
                <Ionicons
                  name="people-outline"
                  size={22}
                  color="#4F59D5"
                />
              </View>
            </View>

            {caregiverStats.length === 0 ||
            !selectedCaregiverStat ? (
            <Text style={styles.emptyText}>
                尚未有旗下看護
            </Text>
            ) : (
            <>
                <Text style={styles.selectorLabel}>
                選擇看護
                </Text>

                <Pressable
                style={styles.caregiverSelector}
                onPress={() =>
                    setCaregiverDropdownOpen(
                    (current) => !current
                    )
                }
                >
                <View style={styles.selectorTextWrap}>
                    <Text
                    style={styles.selectorName}
                    numberOfLines={1}
                    >
                    {selectedCaregiverStat.name}
                    </Text>

                    <Text style={styles.selectorCount}>
                    共 {selectedCaregiverStat.total} 件回報
                    </Text>
                </View>

                <Ionicons
                    name={
                    caregiverDropdownOpen
                        ? "chevron-up"
                        : "chevron-down"
                    }
                    size={20}
                    color="#6B7280"
                />
                </Pressable>

                {caregiverDropdownOpen && (
                <View style={styles.caregiverDropdown}>
                    {caregiverStats.map((item) => {
                    const selected =
                        item.caregiverUid ===
                        selectedCaregiverStat.caregiverUid;

                    return (
                        <Pressable
                        key={item.caregiverUid}
                        style={[
                            styles.caregiverDropdownItem,
                            selected &&
                            styles.caregiverDropdownItemSelected,
                        ]}
                        onPress={() => {
                            setSelectedCaregiverUid(
                            item.caregiverUid
                            );
                            setCaregiverDropdownOpen(false);
                        }}
                        >
                        <View style={{ flex: 1 }}>
                            <Text
                            style={[
                                styles.caregiverDropdownName,
                                selected &&
                                styles.caregiverDropdownNameSelected,
                            ]}
                            numberOfLines={1}
                            >
                            {item.name}
                            </Text>

                            <Text
                            style={
                                styles.caregiverDropdownCount
                            }
                            >
                            {item.total} 件回報
                            </Text>
                        </View>

                        {selected && (
                            <Ionicons
                            name="checkmark-circle"
                            size={21}
                            color="#4F59D5"
                            />
                        )}
                        </Pressable>
                    );
                    })}
                </View>
                )}

                <View style={styles.selectedCaregiverChart}>
                {selectedCaregiverStat.total === 0 ? (
                    <Text style={styles.noReportText}>
                    目前沒有問題回報
                    </Text>
                ) : (
                    <>
                    {selectedCaregiverStat.categories.map(
                        (item) => {
                        const percent =
                            (item.count /
                            selectedCaregiverMaxCount) *
                            100;

                        const width =
                            `${Math.max(
                            item.count > 0 ? 5 : 0,
                            percent
                            )}%` as `${number}%`;

                        return (
                            <View
                            key={item.category}
                            style={styles.barItem}
                            >
                            <View
                                style={styles.barLabelRow}
                            >
                                <Text
                                style={styles.barLabel}
                                >
                                {item.label}
                                </Text>

                                <Text
                                style={styles.barValue}
                                >
                                {item.count} 件
                                </Text>
                            </View>

                            <View style={styles.barTrack}>
                                <View
                                style={[
                                    styles.barFillSecondary,
                                    { width },
                                ]}
                                />
                            </View>
                            </View>
                        );
                        }
                    )}

                    {selectedCaregiverStat
                        .uncategorizedCount > 0 && (
                        <View style={styles.barItem}>
                        <View
                            style={styles.barLabelRow}
                        >
                            <Text style={styles.barLabel}>
                            未分類
                            </Text>

                            <Text style={styles.barValue}>
                            {
                                selectedCaregiverStat
                                .uncategorizedCount
                            }{" "}
                            件
                            </Text>
                        </View>

                        <View style={styles.barTrack}>
                            <View
                            style={[
                                styles.barFillMuted,
                                {
                                width:
                                    `${Math.max(
                                    5,
                                    (selectedCaregiverStat
                                        .uncategorizedCount /
                                        selectedCaregiverMaxCount) *
                                        100
                                    )}%` as `${number}%`,
                                },
                            ]}
                            />
                        </View>
                        </View>
                    )}
                    </>
                )}
                </View>
            </>
            )}
          </View>

          <View style={styles.noteCard}>
            <Ionicons
              name="information-circle-outline"
              size={20}
              color="#64748B"
            />

            <Text style={styles.noteText}>
              統計結果用於協助仲介掌握服務與溝通狀況，
              回報數量較多不代表看護服務品質較差，
              仍需搭配實際回報內容判斷。
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F8FC",
  },

  header: {
    minHeight: 68,
    paddingBottom: 12,
    paddingHorizontal: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#ECECF2",
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
    fontSize: 20,
    fontWeight: "900",
    color: "#111827",
    paddingBottom: 10,
  },

  content: {
    padding: 20,
  },

  sectionTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#111827",
  },

  sectionSubtitle: {
    marginTop: 5,
    fontSize: 14,
    lineHeight: 20,
    color: "#7B7B85",
  },

  summaryRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
    marginBottom: 24,
  },

  summaryCard: {
    flex: 1,
    minHeight: 110,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7E9EF",
    padding: 14,
    justifyContent: "center",
  },

  summaryLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6B7280",
  },

  summaryValue: {
    marginTop: 6,
    fontSize: 28,
    fontWeight: "900",
    color: "#4F59D5",
  },

  summaryUnit: {
    marginTop: 1,
    fontSize: 12,
    color: "#9CA3AF",
  },

  chartCard: {
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7E9EF",
    padding: 18,
    marginBottom: 18,
  },

  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },

  chartTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#111827",
  },

  chartSubtitle: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    color: "#7B7B85",
  },

  chartIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: "#EEF0FF",
    alignItems: "center",
    justifyContent: "center",
  },

  barItem: {
    marginBottom: 17,
  },

  barLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 7,
  },

  barLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: "#374151",
  },

  barValue: {
    fontSize: 13,
    fontWeight: "800",
    color: "#4F59D5",
  },

  barTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: "#EEF0F5",
    overflow: "hidden",
  },

  barFill: {
    height: "100%",
    borderRadius: 5,
    backgroundColor: "#4F59D5",
  },

  barFillSecondary: {
    height: "100%",
    borderRadius: 5,
    backgroundColor: "#6FA58A",
  },

  barFillMuted: {
    height: "100%",
    borderRadius: 5,
    backgroundColor: "#A1A1AA",
  },

  emptyText: {
    paddingVertical: 20,
    textAlign: "center",
    fontSize: 14,
    color: "#8B8B93",
  },

  noteCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
  },

  noteText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 19,
    color: "#64748B",
  },

  loadingState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6B7280",
  },

  caregiverBreakdownCard: {
    borderTopWidth: 1,
    borderTopColor: "#ECEEF3",
    paddingTop: 18,
    marginTop: 4,
    marginBottom: 18,
    },

    caregiverBreakdownHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 15,
    },

    caregiverBreakdownName: {
    fontSize: 16,
    fontWeight: "900",
    color: "#111827",
    },

    caregiverBreakdownHint: {
    marginTop: 3,
    fontSize: 12,
    color: "#8B8B93",
    },

    caregiverBreakdownTotal: {
    fontSize: 13,
    fontWeight: "800",
    color: "#4F59D5",
    },

    miniBarItem: {
    marginBottom: 13,
    },

    miniBarLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 6,
    },

    miniBarLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: "#4B5563",
    },

    miniBarValue: {
    fontSize: 12,
    fontWeight: "800",
    color: "#6FA58A",
    },

    selectorLabel: {
    marginBottom: 8,
    fontSize: 13,
    fontWeight: "700",
    color: "#6B7280",
    },

    caregiverSelector: {
    minHeight: 66,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#DDE3FF",
    backgroundColor: "#F7F8FF",
    paddingHorizontal: 15,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    },

    selectorTextWrap: {
    flex: 1,
    minWidth: 0,
    },

    selectorName: {
    fontSize: 16,
    fontWeight: "900",
    color: "#111827",
    },

    selectorCount: {
    marginTop: 3,
    fontSize: 12,
    color: "#7B7B85",
    },

    caregiverDropdown: {
    marginTop: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E1E4EC",
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    },

    caregiverDropdownItem: {
    minHeight: 60,
    paddingHorizontal: 15,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F1F5",
    },

    caregiverDropdownItemSelected: {
    backgroundColor: "#F3F4FF",
    },

    caregiverDropdownName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#374151",
    },

    caregiverDropdownNameSelected: {
    color: "#3730A3",
    fontWeight: "900",
    },

    caregiverDropdownCount: {
    marginTop: 3,
    fontSize: 12,
    color: "#9CA3AF",
    },

    selectedCaregiverChart: {
    marginTop: 20,
    },

    noReportText: {
    paddingVertical: 18,
    textAlign: "center",
    fontSize: 13,
    color: "#9CA3AF",
    },
});