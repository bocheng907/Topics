const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');

function render(props={}) {
 const mocks={
  'react/jsx-runtime':require('react/jsx-runtime'),
  'react-native':{Pressable:'Pressable',Text:'Text',Alert:{alert(){}},Linking:{openURL:async()=>{}}},
  '@/src/store/LanguageContext':{useLanguage:()=>({language:'zh'})},
  './consent':{PRIVACY_POLICY_URL:'https://example.invalid/privacy',privacyCopy:{zh:{link:'閱讀隱私權政策（繁體中文）',openFailed:'無法開啟'}}},
 };
 const source=fs.readFileSync(require.resolve('../src/privacy/PrivacyPolicyLink.tsx'),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const exports={};
 vm.runInNewContext(code,{exports,require:name=>{assert.ok(name in mocks,name);return mocks[name];}});
 return exports.PrivacyPolicyLink(props);
}

test('privacy menu aligns with menu rows and has a usable hit target',()=>{
 const node=render({variant:'menu'});
 assert.equal(node.props.accessibilityRole,'link');
 assert.equal(node.props.style.paddingHorizontal,20);
 assert.equal(node.props.style.paddingVertical,16);
 assert.ok(node.props.style.minHeight>=48);
 assert.equal(node.props.style.borderBottomWidth,2);
 assert.equal(node.props.children.props.style.lineHeight,25);
});

test('login and register inline privacy links keep original compact layout',()=>{
 const node=render();
 assert.equal(node.props.style.paddingVertical,12);
 assert.equal(node.props.style.paddingHorizontal,undefined);
 assert.equal(node.props.style.borderBottomWidth,undefined);
 assert.equal(node.props.children.props.style.fontSize,15);
});

for(const role of ['family','caregiver','agency']) {
 test(`${role} drawer opts into privacy menu variant`,()=>{
  const source=fs.readFileSync(require.resolve(`../app/${role}/_layout.tsx`),'utf8');
  assert.match(source,/<PrivacyPolicyLink variant="menu"\s*\/>/);
 });
}
