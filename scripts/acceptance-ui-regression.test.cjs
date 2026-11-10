/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
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
  const source = read('src/calendar/components/DailyChecklistCard.tsx');
  assert.match(source, /accessibilityRole="checkbox"/);
  assert.match(source, /accessibilityState=\{\{ checked: item.completed \}\}/);
  assert.match(source, /"aria-checked": item.completed/);
  assert.match(source, /accessibilityLabel=\{copy.editA11y\(item.title\)\}/);
  assert.match(source, /accessibilityLabel=\{copy.deleteA11y\(item.title\)\}/);
});

test('publication explains required category and names publishing control', () => {
  const source = read('src/community/screens/NewPostScreen.tsx');
  assert.match(source, /c\.chooseCategoryHint/);
  assert.match(read('src/i18n/copy/communityCopy.ts'), /chooseCategoryHint: "請先選擇文章分類/);
  assert.match(source, /disabled=\{!canPublish\}/);
  assert.match(source, /accessibilityLabel=\{submitLabel\}/);
});

test('deep-linked prescription saves have a safe destination without navigation history', () => {
  for (const role of ['family', 'caregiver']) {
    assert.ok(read(`app/${role}/edit.tsx`).includes(`router.canGoBack() ? router.back() : router.replace("/${role}/list")`));
  }
});

test('calendar optional strings do not render raw empty text into native views', () => {
  const file=ts.createSourceFile('calendar.tsx',read('app/caregiver/calendar.tsx'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const invalid=[];
  function visit(node) {
    if (ts.isJsxExpression(node) && ts.isBinaryExpression(node.expression) &&
        node.expression.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken &&
        ts.isIdentifier(node.expression.left) &&
        ['eventTitle','eventLocation','eventDescription'].includes(node.expression.left.text)) invalid.push(node.getText(file));
    ts.forEachChild(node,visit);
  }
  visit(file);
  assert.deepEqual(invalid,[]);
});
