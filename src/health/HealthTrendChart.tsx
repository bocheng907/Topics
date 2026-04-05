import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { LineChart } from "react-native-gifted-charts";
import type { ChartDataType } from "./useHealthChartData";

type ChartPoint = {
  value: number;
  label: string;
};

type Props = {
  chartDataType: ChartDataType;
  loading: boolean;
  empty: boolean;
  lineData: ChartPoint[];
  bpSysData: ChartPoint[];
  bpDiaData: ChartPoint[];
};

function getChartConfig(chartDataType: ChartDataType) {
  if (chartDataType === "體溫") {
    return {
      minValue: 33,
      maxValue: 7, // 33 ~ 40
      stepValue: 0.5,
      noOfSections: 14,
      title: "體溫趨勢",
      subTitle: "每格 0.5°C",
      unit: "°C",
    };
  }

  if (chartDataType === "心跳") {
    return {
      minValue: 50,
      maxValue: 100, // 50 ~ 150
      stepValue: 10,
      noOfSections: 10,
      title: "心跳趨勢",
      subTitle: "每格 10 bpm",
      unit: "bpm",
    };
  }

  if (chartDataType === "血糖") {
    return {
      minValue: 50,
      maxValue: 170, // 50 ~ 220
      stepValue: 10,
      noOfSections: 17,
      title: "血糖趨勢",
      subTitle: "每格 10 mg/dL",
      unit: "mg/dL",
    };
  }

  return {
    minValue: 50,
    maxValue: 150, // 50 ~ 200
    stepValue: 10,
    noOfSections: 15,
    title: "血壓趨勢",
    subTitle: "每格 10 mmHg",
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
  const chartWidth = Math.max(width - 120, 220);
  const config = getChartConfig(chartDataType);

  const temperatureYAxisLabels =
    chartDataType === "體溫" ? buildTemperatureYAxisLabels() : undefined;

  if (loading) {
    return (
      <View style={styles.stateBox}>
        <ActivityIndicator size="large" color="#E59752" />
        <Text style={styles.stateText}>圖表資料載入中...</Text>
      </View>
    );
  }

  if (empty) {
    return (
      <View style={styles.stateBox}>
        <Text style={styles.emptyTitle}>目前沒有可顯示的資料</Text>
        <Text style={styles.stateText}>先新增幾筆紀錄，這裡就會顯示趨勢圖</Text>
      </View>
    );
  }

  if (chartDataType === "血壓") {
    return (
      <View style={styles.chartCard}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{config.title}</Text>
          <Text style={styles.unit}>{config.unit}</Text>
        </View>

        <Text style={styles.subTitle}>{config.subTitle}</Text>

        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.sysDot]} />
            <Text style={styles.legendText}>收縮壓</Text>
          </View>

          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.diaDot]} />
            <Text style={styles.legendText}>舒張壓</Text>
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
      </View>
    );
  }

  return (
    <View style={styles.chartCard}>
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
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 4,
    paddingHorizontal: 2,
  },
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
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 18,
    paddingHorizontal: 2,
  },
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
  axisText: {
    color: "#444",
    fontSize: 12,
  },
});