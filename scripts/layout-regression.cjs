/* Layout regression fixtures, NOT authenticated E2E or native-device tests.
 * Uses real StyleSheet objects and translations; never contacts Firebase.
 * PLAYWRIGHT_MODULE may point to an existing Playwright installation.
 */
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { View, Text, StyleSheet } = require("react-native-web");
const playwright = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const root = path.resolve(__dirname, "..");
const output = path.join(root, "output/playwright/layout-audit");
const h = React.createElement;

function stylesFrom(file) {
  const text = fs.readFileSync(path.join(root, file), "utf8");
  const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let result;
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(ast) === "StyleSheet.create") {
      result = vm.runInNewContext("(" + node.arguments[0].getText(ast) + ")", {
        Platform: { OS: "web", select: (items) => items.web ?? items.default },
      });
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(result, "Missing styles: " + file);
  return result;
}
function translationsFrom() {
  const exports = {};
  const js = ts.transpileModule(fs.readFileSync(path.join(root, "src/i18n/translations.ts"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(js, { exports });
  return exports.translations;
}
const sources = {
  family: "app/family/index.tsx",
  caregiver: "app/caregiver/index.tsx",
  familyHandbook: "app/family/handbook.tsx",
  caregiverHandbook: "app/caregiver/handbook.tsx",
  video: "app/caregiver/video-record.tsx",
  drawer: "app/family/_layout.tsx",
};
const sourceStyles = Object.fromEntries(Object.entries(sources).map(([key, file]) => [key, stylesFrom(file)]));
const translations = translationsFrom();
const layoutExports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, "src/ui/homeLayout.ts"), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { exports: layoutExports });
function scaled(styles, scale) {
  return Object.fromEntries(Object.entries(styles).map(([name, style]) => [name, {
    ...style,
    ...(style.fontSize ? { fontSize: style.fontSize * scale } : {}),
    ...(style.lineHeight ? { lineHeight: style.lineHeight * scale } : {}),
  }]));
}
function fixtures(width, scale, language) {
  const all = Object.fromEntries(Object.entries(sourceStyles).map(([key, style]) => [key, scaled(style, scale)]));
  const s = all.family, c = all.caregiver, v = all.video, d = all.drawer, t = translations[language];
  const layout = layoutExports.getHomeLayout(width, scale);
  const text = (style, value) => h(Text, { style, "data-testid": "layout-text" }, value);
  const view = (style, ...children) => h(View, { style }, ...children);
  const section = (name, child) => h(View, { key: name, style: { marginBottom: 24 }, "data-testid": name }, child);
  const button = (style, labelStyle, label) => view(style, text(labelStyle, label));
  const icon = (style) => view(style, text({ fontSize: 24 }, "●"));
  const family = section("family-home", view({},
    view(s.medCard, text(s.medTitle, t.todayMedicationProgress)),
    view(s.vitalsOuterCard,
      view(s.vitalsGrid, ...["temperature", "heartRate", "bloodPressure", "bloodSugar"].map((key) =>
        view([s.vitalBlock, { width: layout.vitalWidth }],
          text(s.vitalTitle, t[key]),
          view(s.vitalCardWrap,
            view([s.vitalCardTop, { backgroundColor: "#ddd" }],
              ...(key === "bloodPressure" ?
                [text([s.vitalValue, { fontSize: 26 * scale }], "120"), text([s.vitalValue, { fontSize: 26 * scale }], "80")] :
                [text([s.vitalValue, { fontSize: 34 * scale }], "40")])),
            view([s.vitalCardBottom, { backgroundColor: "#888" }], text(s.vitalTimeText, "17:25"), text(s.vitalLabelText, t.today)))))),
      view(s.chartBtn, icon({ width: 18 }), text(s.chartBtnText, t.viewChart))),
    view([s.actionsRow, layout.stackedActions && s.actionsColumn],
      ...["prescriptionRecords", "conditionView", "recordVoice"].map((key) =>
        view([s.actionBtn, { backgroundColor: "#DBEAFE" }],
          view(s.actionGroup, icon(s.actionIconBadge), text(s.actionText, t[key])))))));
  const caregiver = section("caregiver-actions", view(c.gridContainer,
    view([c.gridRow, layout.narrowCards && { flexDirection: "column" }],
      ...["viewPrescriptionRecords", "scanPrescription"].map((key) =>
        view([c.gridItem, { backgroundColor: "#FEF9C3" }],
          view(c.gridGroup, icon(c.gridIconBadge), text(c.gridText, t[key])))))));
  const headers = ["familyHandbook", "caregiverHandbook"].map((name) => {
    const s = all[name];
    return section(name, view(s.header,
      view(s.backButton, icon({ width: 28, flexShrink: 0 }), text(s.backText, t.back)),
      text(s.title, t.handbook), view(s.headerSpacer)));
  });
  const media = section("media-controls", view({ padding: 20 },
    view(v.doctorModeRow, view(v.doctorModeBtn, icon({ width: 18 }), text(v.doctorModeText, t.handbookCaregiverDescription))),
    view(v.switchTabs, ...["cameraPickImage", "recordVoice"].map((key) => button(v.tabBtn, v.tabText, t[key]))),
    view(v.addEntryBtn, icon({ width: 20 }), text(v.addEntryBtnText, t.cameraPickImage))));
  const drawer = section("drawer", view([d.drawer, {
    position: "relative", width: Math.min(width - 24, Math.max(280, width * .82)),
  }], ...["handbook", "prescriptionRecords", "todayMedicationProgress"].map((key) =>
    button(d.menuItem, d.menuItemText, t[key]))));
  return h(View, { style: { width, backgroundColor: "#fff" } }, family, caregiver, ...headers, media, drawer);
}
async function inspect(page) {
  return page.evaluate(() => {
    const failures = [];
    for (const el of document.querySelectorAll('[data-testid="layout-text"]')) {
      const r = el.getBoundingClientRect(), p = el.parentElement.getBoundingClientRect();
      for (let ancestor = el.parentElement; ancestor; ancestor = ancestor.parentElement) {
        const css = getComputedStyle(ancestor), box = ancestor.getBoundingClientRect();
        if ((css.overflowX === "hidden" || css.overflowX === "clip") &&
            (r.left < box.left - 2 || r.right > box.right + 2)) {
          failures.push({ clippedText: el.textContent });
          break;
        }
      }
      if (r.left < p.left - 2 || r.right > p.right + 2 || el.scrollWidth > el.clientWidth + 2 ||
          el.scrollHeight > el.clientHeight + 2) {
        failures.push({ text: el.textContent, section: el.closest('[data-testid]:not([data-testid="layout-text"])')?.dataset.testid,
          x: r.x, width: r.width, parentWidth: p.width, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth });
      }
    }
    if (document.documentElement.scrollWidth > innerWidth + 2) failures.push({ pageOverflow: document.documentElement.scrollWidth });
    return failures;
  });
}
async function main() {
  fs.mkdirSync(output, { recursive: true });
  const browser = await playwright.chromium.launch({ headless: true });
  const results = [];
  try {
    for (const language of ["zh", "en", "vi", "id"]) {
      for (const width of [320, 393, 768]) {
        for (const scale of [1, 1.5]) {
          const page = await browser.newPage({ viewport: { width, height: 852 } });
          const markup = renderToStaticMarkup(fixtures(width, scale, language));
          const sheet = StyleSheet.getSheet();
          await page.setContent('<html lang="' + language + '"><head><meta charset="utf-8"><style>body{margin:0} ' + sheet.textContent + '</style></head><body>' + markup + '</body></html>');
          const failures = await inspect(page);
          const name = language + "-" + width + "-" + scale;
          if ((width === 393 && scale === 1) || (width === 320 && scale === 1.5) || failures.length) {
            await page.screenshot({ path: path.join(output, name + ".png"), fullPage: true });
          }
          results.push({ language, width, simulatedFontScale: scale, failures });
          await page.close();
        }
      }
    }
  } finally { await browser.close(); }
  const report = { scope: "Synthetic React Native Web layout fixtures using source styles, not native or authenticated E2E.",
    sourceFiles: sources, sectionsPerCase: 6, results };
  fs.writeFileSync(path.join(output, "results.json"), JSON.stringify(report, null, 2));
  const failed = results.filter((result) => result.failures.length);
  console.log(JSON.stringify({ cases: results.length, passed: results.length - failed.length, failed }, null, 2));
  if (failed.length) process.exitCode = 1;
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
