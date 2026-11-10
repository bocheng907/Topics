const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function render(props = {}) {
  const opened = [];
  const mocks = {
    'react/jsx-runtime': require('react/jsx-runtime'),
    'react-native': {
      Pressable: 'Pressable', Text: 'Text', Alert: {alert() {}},
      Linking: {openURL: async url => {opened.push(url);}},
    },
    '@/src/store/LanguageContext': {useLanguage: () => ({language: 'zh'})},
    '@/src/ui/components/SideDrawer': {SideDrawerRow: 'SideDrawerRow'},
    '@/src/ui/theme': {colors: {primary: '#44709E'}, layout: {minTouchTarget: 48}},
    './consent': {PRIVACY_POLICY_URL: 'https://example.invalid/privacy',
      privacyCopy: {zh: {link: '閱讀隱私權政策（繁體中文）', openFailed: '無法開啟'}}},
  };
  const source = fs.readFileSync(require.resolve('../src/privacy/PrivacyPolicyLink.tsx'), 'utf8');
  const code = ts.transpileModule(source, {compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
  }}).outputText;
  const exports = {};
  vm.runInNewContext(code, {exports, require: name => {
    assert.ok(name in mocks, name);
    return mocks[name];
  }});
  return {node: exports.PrivacyPolicyLink(props), opened};
}

test('privacy menu has an accessible link and usable touch target', () => {
  const {node, opened} = render({variant: 'menu'});
  assert.equal(node.props.accessibilityRole, 'link');
  assert.ok(node.props.style.minHeight >= 48);
  assert.equal(node.props.children.props.children, '閱讀隱私權政策（繁體中文）');
  node.props.onPress();
  assert.equal(opened[0], 'https://example.invalid/privacy');
});

test('login and registration privacy links are accessible and open the policy', () => {
  const {node, opened} = render();
  assert.equal(node.props.accessibilityRole, 'link');
  assert.ok(node.props.style.minHeight >= 48);
  assert.equal(node.props.children.props.style.fontSize, 15);
  node.props.onPress();
  assert.equal(opened[0], 'https://example.invalid/privacy');
});

test('drawer privacy link uses the shared row and opens the policy', () => {
  const {node, opened} = render({variant: 'drawer'});
  assert.equal(node.type, 'SideDrawerRow');
  assert.equal(node.props.item.label, '閱讀隱私權政策（繁體中文）');
  node.props.item.onPress();
  assert.equal(opened[0], 'https://example.invalid/privacy');
});

for (const role of ['family', 'caregiver', 'agency']) {
  test(role + ' drawer includes the shared privacy row', () => {
    const source = fs.readFileSync(require.resolve('../app/' + role + '/_layout.tsx'), 'utf8');
    assert.ok(source.includes('<PrivacyPolicyLink variant="drawer" />'));
  });
}
