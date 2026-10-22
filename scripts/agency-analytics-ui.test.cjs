// Component-branch tests with native views and data hooks stubbed; not device QA.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');

function fixture(reportError = '', caregiverError = '', loading = false) {
  let attempt = 0;
  let stateIndex = 0;
  const react = {...React, useMemo: fn => fn(), useState: initial => {
    const index = stateIndex++;
    return [index === 0 ? attempt : initial, update => {
      if (index === 0) attempt = typeof update === 'function' ? update(attempt) : update;
    }];
  }};
  const mocks = {
    react,
    'react/jsx-runtime': require('react/jsx-runtime'),
    '@/src/agency/useAgencyReports': {useAgencyReports: () => ({reports: [], loading, error: reportError})},
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
  vm.runInNewContext(code, {exports: module.exports, require: name => {
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
