import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { LineChart } from "./HealthLineChart";
import { healthChartCopy } from "./healthChartCopy";
import { useLanguage } from "@/src/store/LanguageContext";
import type { ChartDataType } from "./useHealthChartData";

type ChartPoint = {
  value: number;
  label: string;
  dateLabel?: string;
};

type Props = {
  chartDataType: ChartDataType;
  loading: boolean;
  empty: boolean;
  lineData: ChartPoint[];
  bpSysData: ChartPoint[];
  bpDiaData: ChartPoint[];
};

function getChartConfig(chartDataType: ChartDataType, copy: typeof healthChartCopy.zh) {
  if (chartDataType === "體溫") {
    return {
      minValue: 33,
      maxValue: 7, // 33 ~ 40
      stepValue: 0.5,
      noOfSections: 14,
      title: copy.temperature,
      subTitle: copy.perGrid("0.5°C"),
      unit: "°C",
    };
  }

  if (chartDataType === "心跳") {
    return {
      minValue: 50,
      maxValue: 100, // 50 ~ 150
      stepValue: 10,
      noOfSections: 10,
      title: copy.heartRate,
      subTitle: copy.perGrid("10 bpm"),
      unit: "bpm",
    };
  }

  if (chartDataType === "血糖") {
    return {
      minValue: 50,
      maxValue: 170, // 50 ~ 220
      stepValue: 10,
      noOfSections: 17,
      title: copy.bloodSugar,
      subTitle: copy.perGrid("10 mg/dL"),
      unit: "mg/dL",
    };
  }

  return {
    minValue: 50,
    maxValue: 150, // 50 ~ 200
    stepValue: 10,
    noOfSections: 15,
    title: copy.bloodPressure,
    subTitle: copy.perGrid("10 mmHg"),
    unit: "mmHg",
  };
}

function buildTemperatureYAxisLabels() {
  const labels: string[] = [];
  for (let v = 33; v <= 40.0001; v += 0.5) {
    if (Number.isInteger(v)) {
      labels.push(String(v));
    } else {
      labels.push(v.toFixed(1));
    }
  }
  return labels;
}

export default function HealthTrendChart({
  chartDataType,
  loading,
  empty,
  lineData,
  bpSysData,
  bpDiaData,
}: Props) {
  const { width } = useWindowDimensions();
  const { language } = useLanguage();
  const copy = healthChartCopy[language];
  const [containerWidth, setContainerWidth] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const chartWidth = Math.max(1, (containerWidth || width - 48) - 64);
  const config = getChartConfig(chartDataType, copy);

  const temperatureYAxisLabels =
    chartDataType === "體溫" ? buildTemperatureYAxisLabels() : undefined;

  const renderDetails = (primary: ChartPoint[], secondary?: ChartPoint[]) => (
    <View style={styles.details}>
      <Pressable onPress={() => setShowDetails(value => !value)} accessibilityRole="button"
        accessibilityState={{ expanded: showDetails }}
        {...(Platform.OS === "web" ? { "aria-expanded": showDetails } : {})}
        style={styles.detailsToggle}>
        <Text style={styles.detailsToggleText}>{showDetails ? copy.hideDetails : copy.showDetails}</Text>
      </Pressable>
      {showDetails ? primary.map((point, index) => (
        <Text key={index} style={styles.detailRow}>
          {point.dateLabel || point.label || copy.unknownDate}{" · "}
          {secondary ? `${copy.systolic} ${point.value} / ${copy.diastolic} ${secondary[index]?.value ?? "--"} ${config.unit}` : `${point.value} ${config.unit}`}
        </Text>
      )) : null}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.stateBox}>
        <ActivityIndicator size="large" color="#E59752" />
        <Text style={styles.stateText}>{copy.loading}</Text>
      </View>
    );
  }

  if (empty) {
    return (
      <View style={styles.stateBox}>
        <Text style={styles.emptyTitle}>{copy.emptyTitle}</Text>
        <Text style={styles.stateText}>{copy.emptyBody}</Text>
      </View>
    );
  }

  if (chartDataType === "血壓") {
    return (
      <View style={styles.chartCard} onLayout={event => setContainerWidth(event.nativeEvent.layout.width)}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{config.title}</Text>
          <Text style={styles.unit}>{config.unit}</Text>
        </View>

        <Text style={styles.subTitle}>{config.subTitle}</Text>

        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.sysDot]} />
            <Text style={styles.legendText}>{copy.systolic}</Text>
          </View>

          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.diaDot]} />
            <Text style={styles.legendText}>{copy.diastolic}</Text>
          </View>
        </View>

        <LineChart
          data={bpSysData}
          data2={bpDiaData}
          width={chartWidth}
          height={260}
          spacing={Math.max(
            30,
            Math.floor(chartWidth / Math.max(bpSysData.length, 5))
          )}
          initialSpacing={12}
          endSpacing={12}
          thickness={3}
          thickness2={3}
          color="black"
          color2="blue"
          dataPointsRadius={4}
          dataPointsWidth={4}
          dataPointsHeight={4}
          dataPointsColor="black"
          dataPointsColor2="blue"
          hideDataPoints={false}
          yAxisThickness={1}
          xAxisThickness={1}
          yAxisColor="#666"
          xAxisColor="#666"
          rulesColor="#D6D6D6"
          hideRules={false}
          yAxisTextStyle={styles.axisText}
          xAxisLabelTextStyle={styles.axisText}
          noOfSections={config.noOfSections}
          maxValue={config.maxValue}
          stepValue={config.stepValue}
          yAxisOffset={config.minValue}
          disableScroll
        />
        {renderDetails(bpSysData, bpDiaData)}
      </View>
    );
  }

  return (
    <View style={styles.chartCard} onLayout={event => setContainerWidth(event.nativeEvent.layout.width)}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{config.title}</Text>
        <Text style={styles.unit}>{config.unit}</Text>
      </View>

      <Text style={styles.subTitle}>{config.subTitle}</Text>

      <LineChart
        data={lineData}
        width={chartWidth}
        height={260}
        spacing={Math.max(
          30,
          Math.floor(chartWidth / Math.max(lineData.length, 5))
        )}
        initialSpacing={12}
        endSpacing={12}
        thickness={3}
        color="black"
        dataPointsRadius={4}
        dataPointsWidth={4}
        dataPointsHeight={4}
        dataPointsColor="black"
        hideDataPoints={false}
        yAxisThickness={1}
        xAxisThickness={1}
        yAxisColor="#666"
        xAxisColor="#666"
        rulesColor="#D6D6D6"
        hideRules={false}
        yAxisTextStyle={styles.axisText}
        xAxisLabelTextStyle={styles.axisText}
        noOfSections={config.noOfSections}
        maxValue={config.maxValue}
        stepValue={config.stepValue}
        yAxisOffset={config.minValue}
        yAxisLabelTexts={temperatureYAxisLabels}
        disableScroll
      />
      {renderDetails(lineData)}
    </View>
  );
}

const styles = StyleSheet.create({
  stateBox: {
    minHeight: 320,
    borderRadius: 20,
    backgroundColor: "#F8F8F8",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  stateText: {
    marginTop: 10,
    fontSize: 15,
    color: "#666",
    textAlign: "center",
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#444",
    textAlign: "center",
  },
  chartCard: {
    backgroundColor: "transparent",
    borderRadius: 20,
    paddingTop: 6,
    paddingBottom: 10,
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4, paddingHorizontal: 2, flexWrap: "wrap", gap: 8 },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#222",
  },
  unit: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
  },
  subTitle: {
    fontSize: 13,
    color: "#666",
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  legendRow: { flexDirection: "row", alignItems: "center", marginBottom: 10, gap: 18, paddingHorizontal: 2, flexWrap: "wrap" },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    marginRight: 6,
  },
  sysDot: {
    backgroundColor: "black",
  },
  diaDot: {
    backgroundColor: "blue",
  },
  legendText: {
    fontSize: 14,
    color: "#333",
    fontWeight: "600",
  },
  details: { marginTop: 12, gap: 6 },
  detailsToggle: { alignSelf: "flex-start", paddingVertical: 8, paddingHorizontal: 4 },
  detailsToggleText: { color: "#245E96", fontWeight: "600" },
  detailRow: { color: "#444", fontSize: 14, paddingVertical: 3 },
  axisText: {
    color: "#444",
    fontSize: 12,
  },
});
