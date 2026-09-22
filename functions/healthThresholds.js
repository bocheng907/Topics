"use strict";

const DEFAULTS = {
  temperature: {max: 38},
  heartRate: {max: 120},
  systolic: {max: 140},
  diastolic: {max: 90},
  bloodSugar: {max: 200},
};

function finiteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function rangeFor(config, fallback) {
  const source = config && typeof config === "object" ? config : {};
  return {
    enabled: source.enabled !== false,
    min: finiteNumber(source.min ?? fallback.min),
    max: finiteNumber(source.max ?? fallback.max),
  };
}

function outsideRange(value, range) {
  if (!range.enabled || value === null) return false;
  return (
    (range.min !== null && value < range.min) ||
    (range.max !== null && value > range.max)
  );
}

function bloodSugarRange(record, thresholds) {
  const config = thresholds.bloodSugar &&
    typeof thresholds.bloodSugar === "object" ?
    thresholds.bloodSugar : {};
  const mealType = String(record.bloodSugarType || "").toLowerCase();
  const isBeforeMeal = mealType.includes("before") ||
    mealType.includes("空腹") || mealType.includes("餐前");

  const min = isBeforeMeal ?
    config.beforeMealMin : config.afterMealMin;
  const max = isBeforeMeal ?
    config.beforeMealMax : config.afterMealMax;

  return rangeFor({
    enabled: config.enabled,
    min: min ?? config.min,
    max: max ?? config.max,
  }, DEFAULTS.bloodSugar);
}

function evaluateHealthRecord(record, thresholds = {}) {
  const temperature = finiteNumber(record.temperature);
  const heartRate = finiteNumber(record.heartRate);
  const systolic = finiteNumber(record.bloodPressureSys);
  const diastolic = finiteNumber(record.bloodPressureDia);
  const bloodSugar = finiteNumber(record.bloodSugar);

  if (outsideRange(
    temperature,
    rangeFor(thresholds.temperature, DEFAULTS.temperature),
  )) {
    return `體溫異常：${temperature}°C`;
  }

  if (outsideRange(
    heartRate,
    rangeFor(thresholds.heartRate, DEFAULTS.heartRate),
  )) {
    return `心率異常：${heartRate} bpm`;
  }

  const systolicConfig = thresholds.systolic ||
    thresholds.bloodPressureSys;
  const diastolicConfig = thresholds.diastolic ||
    thresholds.bloodPressureDia;
  if (
    outsideRange(systolic, rangeFor(systolicConfig, DEFAULTS.systolic)) ||
    outsideRange(diastolic, rangeFor(diastolicConfig, DEFAULTS.diastolic))
  ) {
    return `血壓異常：${systolic ?? "-"}/${diastolic ?? "-"} mmHg`;
  }

  if (outsideRange(bloodSugar, bloodSugarRange(record, thresholds))) {
    return `血糖異常：${bloodSugar} mg/dL`;
  }

  return "";
}

module.exports = {
  evaluateHealthRecord,
};
