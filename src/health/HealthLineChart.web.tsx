import React from "react";
import type { LineChart as NativeLineChart } from "react-native-gifted-charts";

// SVG on the web must not receive React Native responder event props.
// Keep this adapter limited to the static health trends used by this app.
export function LineChart(props: React.ComponentProps<typeof NativeLineChart>) {
  const { data = [], data2 = [], width = 300, height = 260,
    yAxisOffset = 0, maxValue = 100, stepValue = 10 } = props;
  const series = [data, data2];
  const values = series.flatMap(points => points.map(p => p.value ?? NaN)).filter(Number.isFinite);
  const step = stepValue > 0 ? stepValue : 10;
  const low = Math.min(yAxisOffset, Math.floor(Math.min(...values, yAxisOffset) / step) * step);
  const high = Math.max(yAxisOffset + maxValue, Math.ceil(Math.max(...values, yAxisOffset + maxValue) / step) * step, low + step);
  const count = Math.max(data.length, data2.length, 1);
  const plotWidth = Math.max(width, (count - 1) * 64 + 24);
  const left = 48, top = 12;
  const x = (i: number) => left + 12 + (count === 1 ? (plotWidth - 24) / 2 : i * (plotWidth - 24) / (count - 1));
  const y = (v: number) => top + height * (high - v) / (high - low);
  const ticks = Math.min(100, Math.ceil((high - low) / step));
  return (
    <div style={{ maxWidth: "100%", overflowX: "auto" }} tabIndex={0} aria-label="健康趨勢圖，可橫向捲動">
      <svg width={plotWidth + left + 12} height={height + 60} role="img" aria-label="健康紀錄趨勢">
        <title>健康紀錄趨勢；各資料點提供日期及數值</title>
        {Array.from({ length: ticks + 1 }, (_, i) => low + (high - low) * i / ticks).map(value => (
          <g key={value}>
            <line x1={left} x2={left + plotWidth} y1={y(value)} y2={y(value)} stroke="#D6D6D6" />
            <text x={left - 6} y={y(value) + 4} textAnchor="end" fontSize={12} fill="#444">{Number(value.toFixed(1))}</text>
          </g>
        ))}
        {series.map((points, s) => {
          const color = String(s ? props.color2 || "blue" : props.color || "black");
          return <g key={s}>
            <polyline fill="none" stroke={color} strokeWidth={3}
              points={points.map((p, i) => Number.isFinite(p.value) ? `${x(i)},${y(p.value!)}` : "").join(" ")} />
            {points.map((p, i) => Number.isFinite(p.value) && <circle key={i} cx={x(i)} cy={y(p.value!)} r={4} fill={color} data-value={p.value}>
              <title>{p.label}：{p.value}</title>
            </circle>)}
          </g>;
        })}
        {(data.length ? data : data2).map((p, i) => <text key={i} x={x(i)} y={top + height + 22}
          textAnchor="middle" fontSize={11} fill="#444">{p.label}</text>)}
      </svg>
    </div>
  );
}
