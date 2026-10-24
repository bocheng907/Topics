const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(file) {
  const result = {};
  const source = fs.readFileSync(require.resolve(file), 'utf8');
  new Function('exports', ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(result);
  return result;
}
const {registrationErrorMessage} = load('../src/auth/registrationError.ts');
const {translations} = load('../src/i18n/translations.ts');
for (const language of ['zh','en','vi','id']) {
  test(`${language}: registration messages never display provider details`, () => {
    const t = translations[language];
    for (const [code, key] of [
      ['auth/email-already-in-use','registrationEmailInUse'],
      ['auth/invalid-credential','registrationEmailInUse'],
      ['auth/wrong-password','registrationEmailInUse'],
      ['auth/invalid-email','registrationInvalidEmail'],
      ['auth/network-request-failed','registrationNetworkError'],
      ['functions/unavailable','registrationNetworkError'],
      ['deadline-exceeded','registrationNetworkError'],
      ['auth/too-many-requests','registrationTooManyRequests'],
      ['auth/weak-password','registerValidation'],
      ['auth/password-does-not-meet-requirements','registerValidation'],
      ['auth/internal-error','registerFailedFallback'],
    ]) {
      const message = registrationErrorMessage({code,message:'Firebase: private detail'},t,'consent');
      assert.equal(message,t[key]);
      assert.ok(message.length > 0);
      assert.doesNotMatch(message,/Firebase|auth\/|private detail/);
    }
    for (const error of [null,undefined,'Firebase: private detail',new Error('secret')]) {
      assert.equal(registrationErrorMessage(error,t,'consent'),t.registerFailedFallback);
    }
    assert.equal(registrationErrorMessage({code:'privacy/consent-required'},t,'consent'),'consent');
  });
}
test('Chinese duplicate email explains how to proceed', () => {
  assert.match(registrationErrorMessage({code:'auth/email-already-in-use'},translations.zh,''),/已經註冊.*返回登入/);
});
