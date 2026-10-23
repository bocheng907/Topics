// Component-branch tests with native views and data hooks stubbed; not device QA.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');

function fixture(reportError = '', caregiverError = '', loading = false, reports = [], mode = 'distribution', clock = Date) {
  let attempt = 0;
  let stateIndex = 0;
  const react = {...React, useMemo: fn => fn(), useState: initial => {
    const index = stateIndex++;
    return [index === 0 ? attempt : index === 1 ? mode : initial, update => {
      if (index === 0) attempt = typeof update === 'function' ? update(attempt) : update;
    }];
  }};
  const mocks = {
    react,
    'react/jsx-runtime': require('react/jsx-runtime'),
    '@/src/agency/useAgencyReports': {useAgencyReports: () => ({reports, loading, error: reportError})},
    '@/src/agency/useAgencyCaregivers': {useAgencyCaregivers: () => ({caregivers: [], loading, error: caregiverError})},
    '@expo/vector-icons': {Ionicons: 'Icon'},
    'expo-router': {router: {back() {}}},
    'react-native': {View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView', ActivityIndicator: 'Spinner', StyleSheet: {create: value => value}},
    'react-native-svg': {__esModule: true, default: 'Svg', Circle: 'Circle', Line: 'Line', Polyline: 'Polyline', Text: 'SvgText'},
    'react-native-safe-area-context': {useSafeAreaInsets: () => ({top: 0, bottom: 0})},
  };
  const source = fs.readFileSync(require.resolve('../app/agency/analytics.tsx'), 'utf8');
  const code = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true}}).outputText;
  const module = {exports: {}};
  vm.runInNewContext(code, {Date: clock, exports: module.exports, require: name => {
    assert.ok(name in mocks, `Unexpected dependency: ${name}`);
    return mocks[name];
  }});
  function render() {
    stateIndex = 0;
    const root = module.exports.default();
    return {key: root.key, tree: root.type(root.props)};
  }
  return {render};
}
function nodes(value) {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(nodes);
  return [value, ...nodes(value.props?.children)];
}
for (const source of ['reports', 'caregivers']) {
  test(`${source} error blocks statistics even while another source is loading`, () => {
    const f = fixture(source === 'reports' ? 'failed' : '', source === 'caregivers' ? 'failed' : '', true);
    const first = f.render();
    const elements = nodes(first.tree);
    assert.ok(elements.some(n => n.props?.accessibilityRole === 'alert'));
    assert.ok(!elements.some(n => n.type === 'ScrollView' || n.type === 'Spinner'));
    const retry = elements.find(n => n.props?.accessibilityRole === 'button');
    assert.ok(retry);
    retry.props.onPress();
    assert.notEqual(f.render().key, first.key, 'Retry remounts both data subscriptions');
  });
}
test('loading does not render zero statistics', () => {
  const elements = nodes(fixture('', '', true).render().tree);
  assert.ok(elements.some(n => n.type === 'Spinner'));
  assert.ok(!elements.some(n => n.type === 'ScrollView'));
});
test('successful empty result renders statistics without an error', () => {
  const elements = nodes(fixture().render().tree);
  assert.ok(elements.some(n => n.type === 'ScrollView'));
  assert.ok(!elements.some(n => n.props?.accessibilityRole === 'alert'));
});

for (const day of ['2026-10-23', '2026-01-03', '2024-03-01']) {
  test(`trend includes exactly 13 local days and seven spaced labels at ${day}`, () => {
    const anchor = new Date(day + 'T12:00:00');
    class Clock extends Date { constructor(...args) { super(...(args.length ? args : [anchor])); } }
    const dateAt = offset => { const d = new Date(anchor); d.setDate(d.getDate() + offset); return d; };
    const reports = [-13, -12, -1, 0, 1].map((offset, i) => ({
      id: String(i), category: 'service', status: 'open', level: 'normal',
      createdAt: {toDate: () => dateAt(offset)},
    }));
    const tree = fixture('', '', false, reports, 'trend', Clock).render().tree;
    const chart = nodes(tree).find(n => typeof n.type === 'function' && Array.isArray(n.props?.data));
    assert.ok(chart);
    const data = chart.props.data;
    const key = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    assert.equal(data.length, 13);
    assert.equal(data[0].dateKey, key(dateAt(-12)));
    assert.equal(data[12].dateKey, key(anchor));
    assert.equal(data.reduce((sum, d) => sum + d.service, 0), 3, 'outside range excluded');
    assert.equal(new Set(data.map(d => d.dateKey)).size, 13);
    const labels = nodes(chart.type(chart.props)).filter(n => n.type === 'SvgText' && n.props.textAnchor === 'middle');
    assert.equal(labels.length, 7);
    assert.equal(labels[0].props.children, data[0].label);
    assert.equal(labels[6].props.children, data[12].label);
    assert.ok(nodes(tree).some(n => n.props?.children === '最近 13 天問題變化'));
  });
}
