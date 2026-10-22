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

import Svg, {
  Circle,
  Line as SvgLine,
  Polyline,
  Text as SvgText,
} from "react-native-svg";

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

type AnalysisMode =
  | "distribution"
  | "trend";

type TrendPoint = {
  dateKey: string;
  label: string;
  communication: number;
  schedule: number;
  service: number;
  other: number;
};

const TREND_COLORS: Record<
  AgencyReportCategory,
  string
> = {
  communication: "#4F59D5",
  schedule: "#D39A2C",
  service: "#6FA58A",
  other: "#DC5A5A",
};

function getLocalDateKey(date: Date) {
  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getDateLabel(date: Date) {
  return `${
    date.getMonth() + 1
  }/${date.getDate()}`;
}

function ReportTrendChart({
  data,
}: {
  data: TrendPoint[];
}) {
  const width = 320;
  const height = 220;

  const left = 32;
  const right = 10;
  const top = 18;
  const bottom = 34;

  const chartWidth =
    width - left - right;

  const chartHeight =
    height - top - bottom;

  const maxValue = Math.max(
    1,
    ...data.flatMap((item) => [
      item.communication,
      item.schedule,
      item.service,
      item.other,
    ])
  );

  const getX = (index: number) => {
    if (data.length <= 1) {
      return left;
    }

    return (
      left +
      (index / (data.length - 1)) *
        chartWidth
    );
  };

  const getY = (value: number) =>
    top +
    chartHeight -
    (value / maxValue) *
      chartHeight;

  const buildPoints = (
    category: AgencyReportCategory
  ) =>
    data
      .map(
        (item, index) =>
          `${getX(index)},${getY(
            item[category]
          )}`
      )
      .join(" ");

  return (
    <View>
      <View style={styles.trendLegend}>
        {CATEGORY_ORDER.map(
          (category) => (
            <View
              key={category}
              style={
                styles.trendLegendItem
              }
            >
              <View
                style={[
                  styles.trendLegendDot,
                  {
                    backgroundColor:
                      TREND_COLORS[
                        category
                      ],
                  },
                ]}
              />

              <Text
                style={
                  styles.trendLegendText
                }
              >
                {
                  CATEGORY_LABELS[
                    category
                  ]
                }
              </Text>
            </View>
          )
        )}
      </View>

      <View style={styles.svgChartWrap}>
        <Svg
          width="100%"
          height={height}
          viewBox={`0 0 ${width} ${height}`}
        >
          {Array.from(
            { length: maxValue + 1 },
            (_, value) => value
          ).map((value) => {
            const y =
              top +
              chartHeight -
              (value / maxValue) *
                chartHeight;

            return (
              <React.Fragment key={value}>
                <SvgLine
                  x1={left}
                  y1={y}
                  x2={width - right}
                  y2={y}
                  stroke="#E8EAF0"
                  strokeWidth="1"
                />

                <SvgText
                  x={left - 6}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="9"
                  fill="#9CA3AF"
                >
                  {value}
                </SvgText>
              </React.Fragment>
            );
          })}

          {CATEGORY_ORDER.map(
            (category) => (
              <React.Fragment
                key={category}
              >
                <Polyline
                  points={buildPoints(
                    category
                  )}
                  fill="none"
                  stroke={
                    TREND_COLORS[
                      category
                    ]
                  }
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {data.map(
                  (item, index) => (
                    <Circle
                      key={`${category}-${item.dateKey}`}
                      cx={getX(index)}
                      cy={getY(
                        item[
                          category
                        ]
                      )}
                      r="3"
                      fill={
                        TREND_COLORS[
                          category
                        ]
                      }
                    />
                  )
                )}
              </React.Fragment>
            )
          )}

          {data.map(
            (item, index) => {
              const showLabel =
                index % 2 === 0 ||
                index ===
                  data.length - 1;

              if (!showLabel) {
                return null;
              }

              return (
                <SvgText
                  key={item.dateKey}
                  x={getX(index)}
                  y={
                    height - 10
                  }
                  textAnchor="middle"
                  fontSize="8.5"
                  fill="#8B8B93"
                >
                  {item.label}
                </SvgText>
              );
            }
          )}
        </Svg>
      </View>
    </View>
  );
}

export default function AgencyAnalyticsScreen() {
  const [attempt, setAttempt] = useState(0);
  return <AgencyAnalyticsContent key={attempt} onRetry={() => setAttempt(value => value + 1)} />;
}

function AgencyAnalyticsContent({ onRetry }: { onRetry: () => void }) {
  const insets = useSafeAreaInsets();

  const {
    reports,
    loading: reportLoading,
    error: reportError,
  } = useAgencyReports();

  const {
    caregivers,
    loading: caregiverLoading,
    error: caregiverError,
  } = useAgencyCaregivers();

  const totalReports = reports.length;

  const [
    analysisMode,
    setAnalysisMode,
  ] =
    useState<AnalysisMode>(
      "distribution"
    );

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

  const trendData = useMemo<
    TrendPoint[]
  >(() => {
    const today = new Date();

    today.setHours(
      0,
      0,
      0,
      0
    );

    const days = Array.from(
      { length: 14 },
      (_, index) => {
        const date =
          new Date(today);

        date.setDate(
          today.getDate() -
            (13 - index)
        );

        return {
          date,
          dateKey:
            getLocalDateKey(date),
          label:
            getDateLabel(date),
          communication: 0,
          schedule: 0,
          service: 0,
          other: 0,
        } satisfies TrendPoint & {
          date: Date;
        };
      }
    );

    const byDate =
      new Map<
        string,
        TrendPoint & {
          date: Date;
        }
      >();

    days.forEach((item) => {
      byDate.set(
        item.dateKey,
        item
      );
    });

    reports.forEach(
      (report) => {
        if (
          !report.createdAt ||
          !report.category
        ) {
          return;
        }

        if (
          !CATEGORY_ORDER.includes(
            report.category
          )
        ) {
          return;
        }

        const reportDate =
          report.createdAt.toDate();

        const key =
          getLocalDateKey(
            reportDate
          );

        const target =
          byDate.get(key);

        if (!target) {
          return;
        }

        target[
          report.category
        ] += 1;
      }
    );

    return days.map(
      ({
        date: _date,
        ...item
      }) => item
    );
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

      {reportError || caregiverError ? (
        <View style={styles.loadingState}>
          <Text accessibilityRole="alert" style={styles.loadingText}>
            統計資料載入失敗，暫時無法顯示完整統計。請確認網路連線及帳號權限後重試。
          </Text>
          <Pressable accessibilityRole="button" onPress={onRetry} style={{ padding: 16 }}>
            <Text style={styles.loadingText}>重新載入</Text>
          </Pressable>
        </View>
      ) : loading ? (
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
            {/* 標題 Header */}
            <View style={styles.chartHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.chartTitle}>
                  問題分析
                </Text>

                <Text style={styles.chartSubtitle}>
                  查看整體問題類型與近期每日變化
                </Text>
              </View>

              <View style={styles.chartIcon}>
                <Ionicons
                  name={
                    analysisMode === "distribution"
                      ? "bar-chart-outline"
                      : "trending-up-outline"
                  }
                  size={22}
                  color="#4F59D5"
                />
              </View>
            </View>

            {/* 這裡就是我說的 Header 下方切換鍵 */}
            <View style={styles.analysisToggle}>
              <Pressable
                style={[
                  styles.analysisToggleButton,
                  analysisMode === "distribution" &&
                    styles.analysisToggleButtonActive,
                ]}
                onPress={() =>
                  setAnalysisMode("distribution")
                }
              >
                <Ionicons
                  name="bar-chart-outline"
                  size={17}
                  color={
                    analysisMode === "distribution"
                      ? "#4F59D5"
                      : "#8B8B93"
                  }
                />

                <Text
                  style={[
                    styles.analysisToggleText,
                    analysisMode === "distribution" &&
                      styles.analysisToggleTextActive,
                  ]}
                >
                  問題類型
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.analysisToggleButton,
                  analysisMode === "trend" &&
                    styles.analysisToggleButtonActive,
                ]}
                onPress={() =>
                  setAnalysisMode("trend")
                }
              >
                <Ionicons
                  name="trending-up-outline"
                  size={17}
                  color={
                    analysisMode === "trend"
                      ? "#4F59D5"
                      : "#8B8B93"
                  }
                />

                <Text
                  style={[
                    styles.analysisToggleText,
                    analysisMode === "trend" &&
                      styles.analysisToggleTextActive,
                  ]}
                >
                  每日趨勢
                </Text>
              </Pressable>
            </View>

            {/* 問題類型長條圖 */}
            {analysisMode === "distribution" ? (
              <>
                {totalReports === 0 ? (
                  <Text style={styles.emptyText}>
                    尚未有可統計的問題回報
                  </Text>
                ) : (
                  <>
                    {categoryStats.map((item) => {
                      const percent =
                        (item.count / maxCategoryCount) *
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
                            <Text style={styles.barLabel}>
                              {item.label}
                            </Text>

                            <Text style={styles.barValue}>
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
                        <View style={styles.barLabelRow}>
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
              </>
            ) : (
              /* 每日趨勢折線圖 */
              <View>
                <View style={styles.trendHeader}>
                  <Text style={styles.trendTitle}>
                    最近 14 天問題變化
                  </Text>

                  <Text style={styles.trendSubtitle}>
                    所有旗下看護的家庭回報
                  </Text>
                </View>

                <ReportTrendChart
                  data={trendData}
                />
              </View>
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

    analysisToggle: {
      flexDirection: "row",
      backgroundColor: "#F1F2F7",
      borderRadius: 14,
      padding: 4,
      marginBottom: 20,
    },

    analysisToggleButton: {
      flex: 1,
      minHeight: 42,
      borderRadius: 11,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },

    analysisToggleButtonActive: {
      backgroundColor: "#FFFFFF",

      shadowColor: "#000",
      shadowOffset: {
        width: 0,
        height: 1,
      },
      shadowOpacity: 0.05,
      shadowRadius: 3,
      elevation: 1,
    },

    analysisToggleText: {
      fontSize: 13,
      fontWeight: "700",
      color: "#8B8B93",
    },

    analysisToggleTextActive: {
      color: "#4F59D5",
      fontWeight: "900",
    },

    trendHeader: {
      marginBottom: 12,
    },

    trendTitle: {
      fontSize: 15,
      fontWeight: "900",
      color: "#374151",
    },

    trendSubtitle: {
      marginTop: 3,
      fontSize: 12,
      color: "#8B8B93",
    },

    trendLegend: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
      marginBottom: 8,
    },

    trendLegendItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
    },

    trendLegendDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },

    trendLegendText: {
      fontSize: 11,
      fontWeight: "700",
      color: "#6B7280",
    },

    svgChartWrap: {
      width: "100%",
      overflow: "hidden",
    },
});
