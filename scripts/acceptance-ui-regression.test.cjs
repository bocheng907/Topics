const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('legacy checklist queries are constrained to the current patient', () => {
  const source = read('app/caregiver/calendar.tsx');
  assert.match(source, /query\(legacyItemsRef, where\("patientId", "==", activePatientId\)\)/);
  assert.doesNotMatch(source, /getDocs\(legacyItemsRef\)/);
});

for (const page of ['caregiver/calendar', 'caregiver/notebook', 'caregiver/list',
  'family/list', 'caregiver/edit', 'family/edit', 'account-deletion', 'family/voice',
  'caregiver/video-record']) {
  test(`${page}: alerts use the platform-aware confirmation adapter`, () => {
    assert.match(read(`app/${page}.tsx`), /import \{ AppAlert as Alert \} from ["']@\/src\/ui\/AppAlert["']/);
  });
}

test('checklist icon actions and state have accessible labels', () => {
  const source = read('app/caregiver/calendar.tsx');
  assert.match(source, /accessibilityRole="checkbox"/);
  assert.match(source, /accessibilityState=\{\{ checked: item.completed \}\}/);
  assert.match(source, /accessibilityLabel=\{`編輯 /);
  assert.match(source, /accessibilityLabel=\{`刪除 /);
});

test('publication explains required category and names publishing control', () => {
  const source = read('src/community/screens/NewPostScreen.tsx');
  assert.match(source, /請先選擇文章分類/);
  assert.match(source, /accessibilityLabel=\{submitLabel\}/);
});

test('deep-linked prescription saves have a safe destination without navigation history', () => {
  for (const role of ['family', 'caregiver']) {
    assert.ok(read(`app/${role}/edit.tsx`).includes(`router.canGoBack() ? router.back() : router.replace("/${role}/list")`));
  }
});

test('calendar optional strings do not render raw empty text into native views', () => {
  const source=read('app/caregiver/calendar.tsx');
  for(const name of ['eventTitle','eventLocation','eventDescription']) {
    assert.doesNotMatch(source,new RegExp(`\\{${name} &&`));
  }
});
