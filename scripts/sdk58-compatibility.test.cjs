const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToString } = require('react-dom/server');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('SDK 58 dependency family stays aligned', () => {
  const { dependencies: d } = JSON.parse(read('package.json'));
  assert.match(d.expo, /58\./);
  assert.match(d['expo-router'], /58\./);
  assert.match(d['react-native'], /0\.88\./);
  assert.match(d.react, /19\.3\./);
});

test('web uses synchronous routes and a client-only session tree', () => {
  const config = JSON.parse(read('app.json')).expo;
  const router = config.plugins.find(p => Array.isArray(p) && p[0] === 'expo-router');
  assert.equal(router[1].asyncRoutes.web, false);
  assert.equal(config.web.output, 'single');
  assert.match(read('app/_layout.tsx'), /<ClientOnly><RootLayoutNav \/><\/ClientOnly>/);
});

test('patched ngrok UUID retains the v4 API used by Expo', () => {
  const { createRequire } = require('node:module');
  const ngrokRequire = createRequire(require.resolve('@expo/ngrok'));
  const uuid = ngrokRequire('uuid');
  assert.match(uuid.v4(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test('patched Firestore gRPC dependency exposes required client APIs', () => {
  const { createRequire } = require('node:module');
  const firestoreRequire = createRequire(require.resolve('@firebase/firestore'));
  const grpc = firestoreRequire('@grpc/grpc-js');
  assert.equal(typeof grpc.makeGenericClientConstructor, 'function');
  const client = new grpc.Client('localhost:1', grpc.credentials.createInsecure());
  client.close();
});

test('browser-only children are not evaluated during static rendering', () => {
  const filename = path.join(root, 'src/ui/ClientOnly.tsx');
  const source = ts.transpileModule(read('src/ui/ClientOnly.tsx'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const compiled = new Module(filename, module);
  compiled.filename = filename;
  compiled.paths = module.paths;
  compiled._compile(source, filename);
  function BrowserMedia() { throw Error('Browser media must not run on server'); }
  assert.equal(renderToString(React.createElement(compiled.exports.ClientOnly, null,
    React.createElement(BrowserMedia))), '');
});

for (const file of ['app/family/voice.tsx', 'app/caregiver/communication-cards.tsx']) {
  test(`${file} defers media hooks until client rendering`, () => {
    assert.match(read(file), /return <ClientOnly><\w+Content \/><\/ClientOnly>/);
  });
}

test('SPA HTML retains root element and browser safe areas', () => {
  const source = read('public/index.html');
  assert.match(source, /<div id="root"><\/div>/);
  assert.match(source, /viewport-fit=cover/);
  assert.match(source, /env\(safe-area-inset-top/);
});

test('create target uses reactive back-state hook, camera avoids removed native APIs', () => {
  assert.match(read('app/care-target/create.tsx'), /const canGoBack = useCanGoBack\(\)/);
  const camera = read('app/caregiver/camera.tsx');
  assert.doesNotMatch(camera, /InteractionManager\s*\./);
  assert.doesNotMatch(camera, /<StatusBar[^>]*backgroundColor/);
});
