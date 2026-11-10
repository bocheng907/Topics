// Component and validation tests use synthetic data and stubbed services; no real records are written.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const React = require("react");

function load(file, mocks = {}) {
  const source = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  }}).outputText;
  const result = {};
  new Function("exports", "require", code)(result, name => {
    if (name in mocks) return mocks[name];
    throw new Error("Unexpected dependency: " + name);
  });
  return result;
}
function nodes(value) {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(nodes);
  return [value, ...nodes(value.props && value.props.children)];
}
const jsx = require("react/jsx-runtime");
const recognition = load("src/api/prescriptionRecognition.ts");
const chartCopy = load("src/health/healthChartCopy.ts").healthChartCopy;
const calendarCopy = load("src/i18n/copy/calendarCopy.ts").calendarCopy;
const accountCopy = load("src/i18n/copy/accountCopy.ts");
const myDataCopy = load("src/profile/myDataCopy.ts");
const activity = load("src/profile/activityLabels.ts", {
  "@/src/i18n/copy/accountCopy": accountCopy, "./myDataCopy": myDataCopy,
});
const translations = load("src/i18n/translations.ts").translations;
const ui = {
  Button: "Button", Card: "Card", EmptyState: "EmptyState", IconButton: "IconButton",
  Divider: "Divider", StatusBadge: "StatusBadge", TextField: "TextField",
  AppHeader: "AppHeader",
};
const scalar = new Proxy({}, { get: () => 8 });
const theme = { colors: scalar, spacing: scalar, radii: scalar, layout: scalar,
  typography: new Proxy({}, { get: () => ({}) }) };
const native = { Platform: { OS: "web" }, View: "View", Text: "Text", Pressable: "Pressable", Image: "Image",
  ScrollView: "ScrollView", ActivityIndicator: "ActivityIndicator",
  StyleSheet: { create: x => x, absoluteFill: {} }, useWindowDimensions: () => ({width: 390}) };
const vector = { Ionicons: "Ionicons" };

test("empty, null and placeholder OCR responses cannot create a prescription", () => {
  for (const result of [null, {}, {medicines: []}, {medicines: [null]},
    {medicines: [{drug_name: null}]}, {medicines: [{drug_name: "  null  "}]},
    {medicines: [{drug_name: "undefined"}]}, {medicines: [{drug_name: 123}]},
    {medicines: [{drug_name: "（未辨識藥品名稱）"}]}]) {
    assert.equal(recognition.hasRecognizedMedicine(result), false);
  }
  assert.equal(recognition.hasValidMedicineNames([]), false);
  assert.equal(recognition.hasValidMedicineNames([{name:"A"}, {name:"null"}]), false);
  assert.equal(recognition.hasValidMedicineNames([{name:"A"}, {name:"  "}]), false);
  assert.equal(recognition.cleanOcrText("null"), "");
});
test("valid OCR results and edited medicine names remain accepted", () => {
  assert.equal(recognition.hasRecognizedMedicine({medicines: [{drug_name: "Fluoxetine"}]}), true);
  assert.equal(recognition.hasRecognizedMedicine({medicines: [{drug_name_zh: "藥物 A"}]}), true);
  assert.equal(recognition.hasValidMedicineNames([{name:"藥物 A"}, {name:"Medicine B"}]), true);
  const source = fs.readFileSync(path.join(__dirname, "../app/caregiver/result.tsx"), "utf8");
  assert.ok(source.indexOf("if (!hasValidMedicineNames(items))") < source.indexOf("const batch = writeBatch(db)"));
});
function cameraFixture(response) {
  let stateIndex = 0;
  const alerts = [], navigations = [];
  const react = {...React, useState: initial => [stateIndex++ === 0 ? "synthetic-image" : initial, () => {}]};
  const mocks = {
    react, "react/jsx-runtime": jsx, "react-native": native, "@expo/vector-icons": vector,
    "@/src/ui/components": ui, "@/src/ui/theme": theme,
    "react-native-safe-area-context": {SafeAreaView: "SafeAreaView"},
    "@/src/ui/AppAlert": {AppAlert: {alert: (...args) => alerts.push(args)}},
    "@/src/ui/userErrorMessages": {userErrorMessage: () => "Could not analyze"},
    "@/src/care-target/PrescriptionWriteGuard": {__esModule:true, default: "Guard"},
    "expo-router": {router: {replace: data => navigations.push(data)}},
    "expo-image-picker": {},
    "expo-camera": {CameraView:"CameraView", useCameraPermissions: () => [null, () => {}]},
    "@/firebase/uploadPrescriptionImage": {uploadPrescriptionImage: async () => "https://example.invalid/image"},
    "@/src/auth/useAuth": {useAuth: () => ({user: {uid: "synthetic"}})},
    "@/src/api/analyzePrescription": {analyzePrescriptionByUrl: async () => response},
    "@/src/api/prescriptionRecognition": recognition,
    "@/src/care-target/useActiveCareTarget": {useActiveCareTarget: () => ({activePatientId:"synthetic"})},
    "@/src/i18n/translations": {translations},
    "@/src/store/LanguageContext": {useLanguage: () => ({language:"zh"})},
    "@/src/ui/BottomInsetContext": {useScreenBottomInset: () => 0},
  };
  const component = load("app/caregiver/camera.tsx", mocks).default().props.children;
  const tree = component.type(component.props);
  return {alerts, navigations, go: nodes(tree).find(n => n.type === "Button" && n.props.label === translations.zh.cameraStartAnalyze).props.onPress};
}
test("camera shows a useful message for an image without medicine, and stays on the page", async () => {
  const f = cameraFixture({clinic_name:"null", medicines: []});
  await f.go();
  assert.equal(f.navigations.length, 0);
  assert.equal(f.alerts.length, 1);
  assert.equal(f.alerts[0][1], translations.zh.cameraNoMedicinesMessage);
  assert.doesNotMatch(f.alerts[0][1], /null/i);
});
test("camera proceeds for a recognized medicine and replaces a null title", async () => {
  const f = cameraFixture({clinic_name:"null", medicines:[{drug_name:"Medicine A"}]});
  await f.go();
  assert.equal(f.alerts.length, 0);
  assert.equal(f.navigations.length, 1);
  assert.equal(f.navigations[0].params.draftTitle, translations.zh.cameraDefaultDraftTitle);
});

for (const language of ["zh","en","vi","id"]) {
  test(language + ": activity labels are readable and unknown fields never leak", () => {
    for (const op of ["prescription_create","threshold_update","profile_update","invitation_regenerate","caregiver_self_leave"]) {
      assert.notEqual(activity.activityOperationLabel(language, op), op);
    }
    assert.equal(activity.activityOperationLabel(language, "unexpected_internal_code"), accountCopy.auditLogCopy[language].unknownOperation);
    assert.equal(activity.activityOperationLabel(language, "__proto__"), accountCopy.auditLogCopy[language].unknownOperation);
    assert.equal(activity.activityResourceLabel(language, "prescriptions"), myDataCopy.myDataCopy[language].prescriptions);
    assert.equal(activity.activityResourceLabel(language, "unexpected_internal_field"), "");
  });
  test(language + ": calendar distinguishes loading, errors and confirmed empty", () => {
    const mocks = {react: React, "react/jsx-runtime":jsx, "react-native":native,
      "@/src/i18n/copy/calendarCopy": {calendarCopy},
      "@/src/store/LanguageContext": {useLanguage: () => ({language})},
      "@/src/ui/components":ui, "@/src/ui/theme":theme, "@expo/vector-icons":vector};
    const Agenda = load("src/calendar/components/DayAgenda.tsx", mocks).DayAgenda;
    const base = {date:new Date(2026,10,8), count:0, onAdd:()=>{}, onRetry:()=>{}};
    const loading = nodes(Agenda({...base,status:"loading"}));
    assert.ok(loading.some(n => n.type === "ActivityIndicator"));
    assert.ok(!loading.some(n => n.type === "EmptyState"));
    const error = nodes(Agenda({...base,status:"error"})).find(n => n.type === "EmptyState");
    assert.equal(error.props.title, calendarCopy[language].agendaLoadFailed);
    assert.equal(error.props.actionLabel, calendarCopy[language].retry);
    const empty = nodes(Agenda({...base,status:"ready"})).find(n => n.type === "EmptyState");
    assert.equal(empty.props.title, calendarCopy[language].emptyTitle);
    assert.equal(empty.props.actionLabel, calendarCopy[language].addEvent);
  });
  test(language + ": all chart titles, states and legends use the chosen language", () => {
    const react = {...React, useState: initial => [initial, () => {}]};
    const mocks = {react, "react/jsx-runtime":jsx, "react-native":native,
      "./HealthLineChart": {LineChart:"LineChart"}, "./healthChartCopy": {healthChartCopy:chartCopy},
      "@/src/store/LanguageContext": {useLanguage: () => ({language})}};
    const Chart = load("src/health/HealthTrendChart.tsx", mocks).default;
    const props = {loading:false, empty:false, lineData:[], bpSysData:[], bpDiaData:[]};
    for (const [type,key] of [["體溫","temperature"],["心跳","heartRate"],["血壓","bloodPressure"],["血糖","bloodSugar"]]) {
      const elements = nodes(Chart({...props,chartDataType:type}));
      assert.ok(elements.some(n => n.props && n.props.children === chartCopy[language][key]));
      if (type === "血壓") {
        assert.ok(elements.some(n => n.props && n.props.children === chartCopy[language].systolic));
        assert.ok(elements.some(n => n.props && n.props.children === chartCopy[language].diastolic));
      }
      if (language !== "zh") {
        for (const n of elements) if (typeof n.props?.children === "string") assert.doesNotMatch(n.props.children, /[\u4e00-\u9fff]/);
      }
    }
    assert.ok(nodes(Chart({...props,chartDataType:"體溫",loading:true})).some(n => n.props?.children === chartCopy[language].loading));
    assert.ok(nodes(Chart({...props,chartDataType:"體溫",empty:true})).some(n => n.props?.children === chartCopy[language].emptyTitle));
  });
}

function resultFixture(items) {
  let stateIndex = 0;
  const alerts = [], writes = [], navigations = [];
  let commits = 0;
  const initialValues = ["done", items, "Synthetic prescription", "", "", "", "", false, null];
  const react = {...React, useState: initial => [stateIndex < initialValues.length ? initialValues[stateIndex++] : initial, () => {}],
    useEffect: () => {}, useMemo: fn => fn()};
  const firestore = {
    doc: (...args) => ({id: String(args[args.length - 1])}),
    writeBatch: () => ({set: (...args) => writes.push(args), commit: async () => { commits++; }}),
    serverTimestamp: () => "server timestamp",
  };
  const mocks = {
    react, "react/jsx-runtime":jsx, "react-native":native,
    "@/src/ui/components": {...ui, KeyboardAwareScroll:"KeyboardAwareScroll", SectionHeader:"SectionHeader"},
    "@/src/ui/theme":theme, "@/src/ui/AppAlert":{AppAlert:{alert:(...args) => alerts.push(args)}},
    "@/src/api/prescriptionRecognition":recognition,
    "@/src/i18n/copy/caregiverCopy":load("src/i18n/copy/caregiverCopy.ts"),
    "@/src/care-target/PrescriptionWriteGuard":{__esModule:true, default:"Guard"},
    "expo-router":{router:{replace: value => navigations.push(value)}, useLocalSearchParams: () => ({
      imageUrl:"synthetic", draftTitle:"Synthetic prescription",
      analyzeResult:JSON.stringify({medicines:[{drug_name:"Medicine A"}]})
    })},
    "firebase/firestore":firestore, "@/firebase/firebaseConfig":{db:{}},
    "@/src/care-target/useActiveCareTarget":{useActiveCareTarget:() => ({activePatientId:"synthetic",activePatient:{patientsId:"synthetic"}})},
    "@/src/auth/useAuth":{useAuth:() => ({user:{uid:"synthetic",role:"caregiver"}})},
    "@/src/i18n/dynamicTranslation":{ensureFirestoreTranslations:async () => ({}),PRESCRIPTION_ITEM_TRANSLATION_SPECS:[]},
    "@/src/reminders/createMedicationReminders":{createMedicationReminders:async () => {},inferScheduleTimesFromText:() => []},
    "@/src/data/firestoreDocumentIds":{makePrescriptionDocumentId:() => "rx",makePrescriptionItemDocumentId:i => "item-" + i},
    "@/src/i18n/translations":{translations}, "@/src/store/LanguageContext":{useLanguage:() => ({language:"zh"})},
  };
  const element = load("app/caregiver/result.tsx", mocks).default().props.children;
  const tree = element.type(element.props);
  const save = nodes(tree).find(n => n.type === "Button" && n.props.label === translations.zh.saveConfirm);
  return {save:save.props.onPress, alerts, writes, navigations, get commits() {return commits;}};
}
test("result screen refuses to commit an empty or nameless prescription", async () => {
  for (const items of [[], [{name:"null",raw:{},dose:"",quantity:"",time:[],note:""}]]) {
    const f = resultFixture(items);
    await f.save();
    assert.equal(f.commits, 0);
    assert.equal(f.writes.length, 0);
    assert.equal(f.alerts[0][1], translations.zh.resultMedicinesRequiredMessage);
  }
});
test("result screen still saves a valid prescription", async () => {
  const f = resultFixture([{name:"Medicine A",raw:{drug_name:"Medicine A"},dose:"1",quantity:"1",time:[],note:""}]);
  await f.save();
  assert.equal(f.alerts.length, 0);
  assert.equal(f.writes.length, 2);
  assert.equal(f.commits, 1);
  assert.equal(f.navigations[0], "/caregiver/list");
});
for (const language of ["zh","en","vi","id"]) {
  test(language + ": checklist does not show zero tasks while loading or on failure", () => {
    const mocks = {react:React, "react/jsx-runtime":jsx, "react-native":native,
      "@/src/i18n/copy/calendarCopy":{calendarCopy}, "@/src/store/LanguageContext":{useLanguage:() => ({language})},
      "@/src/ui/components":ui, "@/src/ui/theme":theme, "@expo/vector-icons":vector};
    const Checklist = load("src/calendar/components/DailyChecklistCard.tsx", mocks).DailyChecklistCard;
    const base = {date:new Date(2026,10,8),items:[],doneCount:0,expanded:true,onToggleExpanded:()=>{},
      input:"",onChangeInput:()=>{},editing:false,onSubmit:()=>{},onCancelEdit:()=>{},
      onToggleItem:()=>{},onEditItem:()=>{},onDeleteItem:()=>{},onRetry:()=>{}};
    const loading = nodes(Checklist({...base,loading:true}));
    assert.ok(loading.some(n => n.type === "ActivityIndicator"));
    assert.ok(!loading.some(n => n.type === "StatusBadge"));
    assert.ok(!loading.some(n => n.props?.children === calendarCopy[language].checklistEmpty));
    const failed = nodes(Checklist({...base,error:"Unavailable"}));
    assert.ok(failed.some(n => n.type === "Button" && n.props.label === calendarCopy[language].retry));
    assert.ok(!failed.some(n => n.props?.children === calendarCopy[language].checklistEmpty));
    const ready = nodes(Checklist(base));
    assert.ok(ready.some(n => n.props?.children === calendarCopy[language].checklistEmpty));
  });
  test(language + ": web chart accessibility text follows the selected language", () => {
    const mocks = {react:React, "react/jsx-runtime":jsx,
      "@/src/store/LanguageContext":{useLanguage:() => ({language})}, "./healthChartCopy":{healthChartCopy:chartCopy}};
    const Chart = load("src/health/HealthLineChart.web.tsx", mocks).LineChart;
    const elements = nodes(Chart({data:[{value:72,label:"11/8"}]}));
    assert.equal(elements.find(n => n.type === "svg").props["aria-label"], chartCopy[language].chartLabel);
    assert.equal(elements.find(n => n.type === "title").props.children, chartCopy[language].chartDescription);
  });
}
