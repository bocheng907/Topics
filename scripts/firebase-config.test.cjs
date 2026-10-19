const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function config({native = false, initialized = false} = {}) {
  const calls = [];
  const app = {}, storage = {}, persistence = {}, nativeAuth = {}, fallbackAuth = {};
  const authModule = {
    getAuth: () => { calls.push('getAuth'); return fallbackAuth; },
    initializeAuth: (target, options) => {
      assert.equal(target, app); assert.equal(options.persistence, persistence);
      calls.push('initializeAuth');
      if (initialized) throw new Error('auth/already-initialized');
      return nativeAuth;
    },
    ...(native ? {getReactNativePersistence: value => {
      assert.equal(value, storage); calls.push('persistence'); return persistence;
    }} : {}),
  };
  const dependencies = {
    'firebase/app': {getApps: () => [], initializeApp: () => app},
    'firebase/auth': authModule,
    '@react-native-async-storage/async-storage': {__esModule: true, default: storage},
    'firebase/storage': {getStorage: () => ({})},
    'firebase/firestore': {getFirestore: () => ({})},
    'firebase/functions': {getFunctions: () => ({})},
  };
  const file = path.join(__dirname, '../firebase/firebaseConfig.ts');
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
  }).outputText;
  const exports = {};
  new Function('require', 'exports', 'process', 'console', js)(name => {
    assert.ok(name in dependencies, 'Unexpected dependency: ' + name);
    return dependencies[name];
  }, exports, {env: {}}, {log: () => {}});
  return {calls, auth: exports.auth, nativeAuth, fallbackAuth};
}

test('native Firebase Auth still uses AsyncStorage persistence', () => {
  const result = config({native: true});
  assert.deepEqual(result.calls, ['persistence', 'initializeAuth']);
  assert.equal(result.auth, result.nativeAuth);
});
test('browser Firebase Auth uses getAuth without native persistence', () => {
  const result = config();
  assert.deepEqual(result.calls, ['getAuth']);
  assert.equal(result.auth, result.fallbackAuth);
});
test('hot reload with existing Auth instance retains the getAuth fallback', () => {
  const result = config({native: true, initialized: true});
  assert.deepEqual(result.calls, ['persistence', 'initializeAuth', 'getAuth']);
  assert.equal(result.auth, result.fallbackAuth);
});
