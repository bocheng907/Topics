"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {evaluateHealthRecord} = require("./healthThresholds");

test("uses the previous hard-coded limits when no threshold exists", () => {
  assert.equal(
    evaluateHealthRecord({temperature: 38.1}),
    "體溫異常：38.1°C",
  );
  assert.equal(evaluateHealthRecord({temperature: 37.5}), "");
});

test("uses configured min and max ranges", () => {
  const thresholds = {
    heartRate: {enabled: true, min: 55, max: 100},
  };

  assert.equal(
    evaluateHealthRecord({heartRate: 50}, thresholds),
    "心率異常：50 bpm",
  );
  assert.equal(evaluateHealthRecord({heartRate: 80}, thresholds), "");
});

test("supports before-meal and after-meal blood sugar ranges", () => {
  const thresholds = {
    bloodSugar: {
      enabled: true,
      beforeMealMin: 70,
      beforeMealMax: 100,
      afterMealMin: 80,
      afterMealMax: 140,
    },
  };

  assert.equal(
    evaluateHealthRecord({
      bloodSugar: 110,
      bloodSugarType: "空腹",
    }, thresholds),
    "血糖異常：110 mg/dL",
  );
  assert.equal(
    evaluateHealthRecord({
      bloodSugar: 110,
      bloodSugarType: "餐後",
    }, thresholds),
    "",
  );
});

test("disabled thresholds do not produce alerts", () => {
  assert.equal(
    evaluateHealthRecord(
      {temperature: 40},
      {temperature: {enabled: false, max: 38}},
    ),
    "",
  );
});
