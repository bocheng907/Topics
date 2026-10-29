const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(file, imports = {}) {
  const result = {};
  const source = fs.readFileSync(require.resolve(file), 'utf8');
  new Function('exports', 'require', ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(result, name => imports[name]);
  return result;
}
const {userErrorMessage, userErrorCopy} = load('../src/ui/userErrorMessages.ts');
for (const language of ['zh', 'en', 'vi', 'id']) {
  test(`${language}: approved messages for known errors`, () => {
    const cases = [
      ['login','auth/invalid-credential','credentials'], ['login','auth/wrong-password','credentials'],
      ['login','auth/user-not-found','credentials'], ['login','auth/invalid-email','invalidEmail'],
      ['login','auth/user-disabled','disabled'], ['login','auth/network-request-failed','network'],
      ['login','auth/too-many-requests','busy'], ['ocr','ocr/network','network'],
      ['ocr','ocr/busy','busy'], ['ocr','ocr/unavailable','ocrUnavailable'],
      ['ocr','ocr/recognition','ocr'], ['ocr','storage/unauthorized','permission'],
      ['report','functions/failed-precondition','relation'], ['report','functions/permission-denied','permission'],
      ['report','functions/unauthenticated','account'], ['report','functions/unavailable','network'],
    ];
    for (const [context, code, key] of cases) {
      assert.equal(userErrorMessage({code, message:'<html>private backend details</html>'}, context, language), userErrorCopy[language][key]);
    }
    assert.equal(userErrorMessage({code:'functions/permission-denied', message:'Active account required.'},'report',language),userErrorCopy[language].account);
    assert.equal(userErrorMessage({code:'functions/permission-denied', message:'Membership changed.'},'report',language),userErrorCopy[language].relation);
  });
  test(`${language}: unexpected values never leak raw details`, () => {
    for (const context of ['login','ocr','report']) {
      for (const error of [null, undefined, 'Network request failed', new Error('secret'), {code:'unknown', message:'Firebase auth/internal-error <html>secret</html>'}]) {
        assert.equal(userErrorMessage(error, context, language),userErrorCopy[language][context]);
      }
    }
  });
}

test('OCR converts fetch, HTTP and malformed responses to bounded error codes', async () => {
  const originalFetch = global.fetch;
  const previousUrl = process.env.EXPO_PUBLIC_PRESCRIPTION_API_BASE_URL;
  process.env.EXPO_PUBLIC_PRESCRIPTION_API_BASE_URL = 'https://example.invalid';
  const {analyzePrescriptionByUrl} = load('../src/api/analyzePrescription.ts', {'expo-constants': {default:{}}});
  try {
    const cases = [
      [async () => {throw new Error('private network details');}, 'ocr/network'],
      [async () => ({ok:false,status:429}), 'ocr/busy'],
      [async () => ({ok:false,status:503}), 'ocr/unavailable'],
      [async () => ({ok:false,status:400}), 'ocr/recognition'],
      [async () => ({ok:true,text:async () => '<html>private details</html>'}), 'ocr/recognition'],
      [async () => ({ok:true,text:async () => {throw new Error('private details');}}), 'ocr/network'],
    ];
    for (const [fetch, code] of cases) {
      global.fetch = fetch;
      await assert.rejects(analyzePrescriptionByUrl('synthetic-image'), e => e.code === code && !/private|html|429|503/.test(e.message));
    }
    global.fetch = async () => ({ok:true,text:async () => JSON.stringify({medicines:[]})});
    assert.deepEqual(await analyzePrescriptionByUrl('synthetic-image'),{medicines:[]});
    process.env.EXPO_PUBLIC_PRESCRIPTION_API_BASE_URL = 'invalid-url';
    await assert.rejects(analyzePrescriptionByUrl('synthetic-image'), e => e.code === 'ocr/unavailable');
  } finally {
    global.fetch = originalFetch;
    if (previousUrl === undefined) delete process.env.EXPO_PUBLIC_PRESCRIPTION_API_BASE_URL;
    else process.env.EXPO_PUBLIC_PRESCRIPTION_API_BASE_URL = previousUrl;
  }
});

test('UI uses safe mappings and export diagnostics are opt-in', () => {
  const read = path => fs.readFileSync(require.resolve(path),'utf8');
  for (const [file, context] of [['../app/(auth)/login.tsx','login'],['../app/caregiver/camera.tsx','ocr'],['../app/family/report-care-issue.tsx','report']]) {
    assert.ok(read(file).includes(`"${context}", language)`));
    assert.doesNotMatch(read(file),/Alert\.alert\([^;]*(?:e\?\.message|error\?\.message)/s);
  }
  const calendar = read('../app/caregiver/calendar.tsx');
  assert.match(calendar,/setDailyChecklistError\(\s*userErrorCopy\[language\]\.taskCreate/);
  assert.match(calendar,/setDailyChecklistError\(\s*userErrorCopy\[language\]\.taskLoad/);
  const page = read('../app/personal-data-export.tsx');
  assert.match(page,/\[showDiagnostic, setShowDiagnostic\] = useState\(false\)/);
  assert.match(page,/showDiagnostic && <View>[\s\S]*?\{diagnostic\}/);
  assert.match(page,/accessibilityState=\{\{ expanded: showDiagnostic \}\}/);
  assert.equal((page.match(/setShowDiagnostic\(false\)/g)||[]).length,3);
});
