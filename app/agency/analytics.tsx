import { useAgencyCaregivers } from "@/src/agency/useAgencyCaregivers";
import { useAgencyReports } from "@/src/agency/useAgencyReports";
import type {
  AgencyReport,
  AgencyReportCategory,
} from "@/src/agency/agencyReportTypes";
import { agencyCopy, type AgencyCopy } from "@/src/i18n/copy/agencyCopy";
import { useLanguage } from "@/src/store/LanguageContext";
import { AppHeader, Card, Chip, EmptyState } from "@/src/ui/components";
import { colors, layout, radii, spacing, typography } from "@/src/ui/theme";

import { Ionicons } from "@expo/vector-icons";
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

const CATEGORY_ORDER: AgencyReportCategory[] = [
  "communication",
  "schedule",
  "service",
  "other",
];

function categoryLabel(c: AgencyCopy, category: AgencyReportCategory) {
  switch (category) {
    case "communication":
      return c.catCommunication;
    case "schedule":
      return c.catSchedule;
    case "service":
      return c.catService;
    default:
      return c.catOther;
  }
}

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

/**
 * Categorical series colours for the trend chart only. Four lines need four
 * distinguishable hues; they are not status colours. The first is the brand primary.
 */
const TREND_COLORS: Record<
  AgencyReportCategory,
  string
> = {
  communication: colors.primary,
  schedule: "#B7832F",
  service: "#4E8F72",
  other: "#8A6BB5",
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
  c,
}: {
  data: TrendPoint[];
  c: AgencyCopy;
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
        {CATEGORY_ORDER.map((category) => (
          <View key={category} style={styles.trendLegendItem}>
            <View
              style={[
                styles.trendLegendDot,
                { backgroundColor: TREND_COLORS[category] },
              ]}
            />
            <Text style={styles.trendLegendText}>{categoryLabel(c, category)}</Text>
          </View>
        ))}
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
                  stroke={colors.divider}
                  strokeWidth="1"
                />

                <SvgText
                  x={left - 6}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="10"
                  fill={colors.textMuted}
                >
                  {value}
                </SvgText>
              </React.Fragment>
            );
          })}

          {CATEGORY_ORDER.map((category) => (
            <React.Fragment key={category}>
              <Polyline
                points={buildPoints(category)}
                fill="none"
                stroke={TREND_COLORS[category]}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {data.map((item, index) => (
                <Circle
                  key={`${category}-${item.dateKey}`}
                  cx={getX(index)}
                  cy={getY(item[category])}
                  r="3"
                  fill={TREND_COLORS[category]}
                />
              ))}
            </React.Fragment>
          ))}

          {data.map((item, index) => {
            const showLabel = index % 2 === 0;

            if (!showLabel) {
              return null;
            }

            return (
              <SvgText
                key={item.dateKey}
                x={getX(index)}
                y={height - 10}
                textAnchor="middle"
                fontSize="10"
                fill={colors.textMuted}
              >
                {item.label}
              </SvgText>
            );
          })}
        </Svg>
      </View>
    </View>
  );
}

function BarRow({
  label,
  value,
  ratio,
  muted,
  c,
}: {
  label: string;
  value: number;
  ratio: number;
  muted?: boolean;
  c: AgencyCopy;
}) {
  const width = `${Math.max(value > 0 ? 5 : 0, ratio * 100)}%` as `${number}%`;
  return (
    <View style={styles.barItem}>
      <View style={styles.barLabelRow}>
        <Text style={styles.barLabel}>{label}</Text>
        <Text style={[styles.barValue, muted && { color: colors.textSecondary }]}>{c.cases(value)}</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, muted && styles.barFillMuted, { width }]} />
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
  const { language } = useLanguage();
  const c = agencyCopy[language];

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
      { length: 13 },
      (_, index) => {
        const date =
          new Date(today);

        date.setDate(
          today.getDate() -
            (12 - index)
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
          // Empty name falls back to a localized label at render time.
          name:
            caregiver.displayName ||
            caregiver.caregiverEmail ||
            "",
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

  const summary = [
    { key: "total", label: c.totalReports, value: totalReports },
    { key: "open", label: c.pending, value: openCount },
    { key: "resolved", label: c.resolved, value: resolvedCount },
  ];

  return (
    <View style={styles.container}>
      <AppHeader title={c.analyticsTitle} left="back" fallbackHref="/agency" />

      {reportError || caregiverError ? (
        <View style={styles.centerState}>
          <EmptyState
            icon="cloud-offline-outline"
            title={c.loadFailed}
            actionLabel={c.reload}
            onAction={onRetry}
          />
        </View>
      ) : loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>{c.loadingStats}</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(spacing.xxl, insets.bottom + spacing.xl) },
          ]}
        >
          <Text style={styles.pageTitle} accessibilityRole="header">
            {c.overviewTitle}
          </Text>
          <Text style={styles.pageSubtitle}>{c.overviewSubtitle}</Text>

          <View style={styles.summaryRow}>
            {summary.map((item) => (
              <Card key={item.key} style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>{item.label}</Text>
                <Text style={[styles.summaryValue, item.key === "open" && item.value > 0 && { color: colors.danger }]}>
                  {item.value}
                </Text>
              </Card>
            ))}
          </View>

          <Card style={styles.chartCard}>
            <Text style={styles.chartTitle} accessibilityRole="header">
              {c.analysisTitle}
            </Text>
            <Text style={styles.chartSubtitle}>{c.analysisSubtitle}</Text>

            <View style={styles.modeRow}>
              <Chip
                label={c.modeDistribution}
                icon="bar-chart-outline"
                selected={analysisMode === "distribution"}
                onPress={() => setAnalysisMode("distribution")}
              />
              <Chip
                label={c.modeTrend}
                icon="trending-up-outline"
                selected={analysisMode === "trend"}
                onPress={() => setAnalysisMode("trend")}
              />
            </View>

            {analysisMode === "distribution" ? (
              totalReports === 0 ? (
                <Text style={styles.emptyText}>{c.noReportsYet}</Text>
              ) : (
                <>
                  {categoryStats.map((item) => (
                    <BarRow
                      key={item.category}
                      label={categoryLabel(c, item.category)}
                      value={item.count}
                      ratio={item.count / maxCategoryCount}
                      c={c}
                    />
                  ))}

                  {uncategorizedCount > 0 && (
                    <BarRow
                      label={c.uncategorized}
                      value={uncategorizedCount}
                      ratio={uncategorizedCount / maxCategoryCount}
                      muted
                      c={c}
                    />
                  )}
                </>
              )
            ) : (
              <View>
                <Text style={styles.trendTitle}>{c.trendTitle}</Text>
                <Text style={styles.trendSubtitle}>{c.trendSubtitle}</Text>
                <ReportTrendChart data={trendData} c={c} />
              </View>
            )}
          </Card>

          <Card style={styles.chartCard}>
            <Text style={styles.chartTitle} accessibilityRole="header">
              {c.perCaregiverTitle}
            </Text>
            <Text style={styles.chartSubtitle}>{c.perCaregiverSubtitle}</Text>

            {caregiverStats.length === 0 ||
            !selectedCaregiverStat ? (
              <Text style={styles.emptyText}>{c.noCaregiversTitle}</Text>
            ) : (
              <>
                <Text style={styles.selectorLabel}>{c.selectCaregiver}</Text>

                <Pressable
                  style={({ pressed }) => [styles.caregiverSelector, pressed && styles.selectorPressed]}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: caregiverDropdownOpen }}
                  onPress={() =>
                    setCaregiverDropdownOpen(
                      (current) => !current
                    )
                  }
                >
                  <View style={styles.selectorTextWrap}>
                    <Text style={styles.selectorName} numberOfLines={1}>
                      {selectedCaregiverStat.name || c.unnamedCaregiverShort}
                    </Text>
                    <Text style={styles.selectorCount}>
                      {c.caregiverTotal(selectedCaregiverStat.total)}
                    </Text>
                  </View>

                  <Ionicons
                    name={caregiverDropdownOpen ? "chevron-up" : "chevron-down"}
                    size={22}
                    color={colors.textSecondary}
                  />
                </Pressable>

                {caregiverDropdownOpen && (
                  <View style={styles.caregiverDropdown}>
                    {caregiverStats.map((item, index) => {
                      const selected =
                        item.caregiverUid ===
                        selectedCaregiverStat.caregiverUid;

                      return (
                        <Pressable
                          key={item.caregiverUid}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                          style={({ pressed }) => [
                            styles.caregiverDropdownItem,
                            index > 0 && styles.dropdownDivider,
                            selected && styles.caregiverDropdownItemSelected,
                            pressed && !selected && styles.selectorPressed,
                          ]}
                          onPress={() => {
                            setSelectedCaregiverUid(
                              item.caregiverUid
                            );
                            setCaregiverDropdownOpen(false);
                          }}
                        >
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text
                              style={[
                                styles.caregiverDropdownName,
                                selected && styles.caregiverDropdownNameSelected,
                              ]}
                              numberOfLines={1}
                            >
                              {item.name || c.unnamedCaregiverShort}
                            </Text>
                            <Text style={styles.caregiverDropdownCount}>
                              {c.caregiverReports(item.total)}
                            </Text>
                          </View>

                          {selected && (
                            <Ionicons name="checkmark" size={22} color={colors.primary} />
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                )}

                <View style={styles.selectedCaregiverChart}>
                  {selectedCaregiverStat.total === 0 ? (
                    <Text style={styles.emptyText}>{c.noReportsForCaregiver}</Text>
                  ) : (
                    <>
                      {selectedCaregiverStat.categories.map((item) => (
                        <BarRow
                          key={item.category}
                          label={categoryLabel(c, item.category)}
                          value={item.count}
                          ratio={item.count / selectedCaregiverMaxCount}
                          c={c}
                        />
                      ))}

                      {selectedCaregiverStat.uncategorizedCount > 0 && (
                        <BarRow
                          label={c.uncategorized}
                          value={selectedCaregiverStat.uncategorizedCount}
                          ratio={selectedCaregiverStat.uncategorizedCount / selectedCaregiverMaxCount}
                          muted
                          c={c}
                        />
                      )}
                    </>
                  )}
                </View>
              </>
            )}
          </Card>

          <Card tone="sunken" style={styles.noteCard}>
            <Ionicons name="information-circle-outline" size={22} color={colors.textSecondary} />
            <Text style={styles.noteText}>{c.analyticsNote}</Text>
          </Card>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },

  content: {
    padding: layout.screenPaddingX,
    width: "100%",
    maxWidth: layout.maxContentWidth,
    alignSelf: "center",
  },

  pageTitle: {
    ...typography.title,
  },

  pageSubtitle: {
    ...typography.bodySmall,
    marginTop: spacing.xs,
  },

  summaryRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },

  summaryCard: {
    flex: 1,
    minWidth: 0,
  },

  summaryLabel: {
    ...typography.label,
    color: colors.textSecondary,
  },

  summaryValue: {
    ...typography.display,
    marginTop: spacing.xs,
  },

  chartCard: {
    marginBottom: spacing.lg,
  },

  chartTitle: {
    ...typography.header,
  },

  chartSubtitle: {
    ...typography.bodySmall,
    marginTop: 2,
  },

  modeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },

  barItem: {
    marginBottom: spacing.lg,
  },

  barLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: 6,
  },

  barLabel: {
    ...typography.body,
    flex: 1,
  },

  barValue: {
    ...typography.bodyStrong,
    color: colors.primary,
  },

  barTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.surfaceSunken,
    overflow: "hidden",
  },

  barFill: {
    height: "100%",
    borderRadius: 5,
    backgroundColor: colors.primary,
  },

  barFillMuted: {
    backgroundColor: colors.textDisabled,
  },

  emptyText: {
    ...typography.body,
    color: colors.textMuted,
    paddingVertical: spacing.xl,
    textAlign: "center",
  },

  noteCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },

  noteText: {
    ...typography.bodySmall,
    flex: 1,
  },

  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },

  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },

  selectorLabel: {
    ...typography.label,
    color: colors.textSecondary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },

  caregiverSelector: {
    minHeight: 64,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },

  selectorPressed: {
    backgroundColor: colors.surfaceSunken,
  },

  selectorTextWrap: {
    flex: 1,
    minWidth: 0,
  },

  selectorName: {
    ...typography.bodyStrong,
  },

  selectorCount: {
    ...typography.caption,
    marginTop: 2,
  },

  caregiverDropdown: {
    marginTop: spacing.sm,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },

  caregiverDropdownItem: {
    minHeight: 56,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },

  dropdownDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },

  caregiverDropdownItemSelected: {
    backgroundColor: colors.primarySoft,
  },

  caregiverDropdownName: {
    ...typography.body,
  },

  caregiverDropdownNameSelected: {
    ...typography.bodyStrong,
    color: colors.primary,
  },

  caregiverDropdownCount: {
    ...typography.caption,
    marginTop: 2,
  },

  selectedCaregiverChart: {
    marginTop: spacing.xl,
  },

  trendTitle: {
    ...typography.bodyStrong,
  },

  trendSubtitle: {
    ...typography.caption,
    marginTop: 2,
    marginBottom: spacing.md,
  },

  trendLegend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    marginBottom: spacing.sm,
  },

  trendLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  trendLegendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  trendLegendText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: "600",
  },

  svgChartWrap: {
    width: "100%",
    overflow: "hidden",
  },
});
