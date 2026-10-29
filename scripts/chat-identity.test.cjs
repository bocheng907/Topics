const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const code = ts.transpileModule(fs.readFileSync('src/chat/chatIdentity.ts', 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS},
}).outputText;
const mod = {exports: {}};
new Function('exports', 'module', code)(mod.exports, mod);
const {chatIdentity} = mod.exports;
const message = {senderId: 'a', senderName: 'old', senderAvatarUrl: 'old.jpg'};
test('historical messages resolve current name and avatar', () => {
  assert.deepEqual(chatIdentity(message, {a: {displayName: 'new', avatarUrl: 'new.jpg'}}, 'member'),
    {displayName: 'new', avatarUrl: 'new.jpg'});
});
test('cleared avatar stays cleared; does not revive historical image', () => {
  assert.equal(chatIdentity(message, {a: {displayName: 'new', avatarUrl: ''}}, 'member').avatarUrl, '');
});
test('missing or inaccessible member uses message snapshot', () => {
  assert.deepEqual(chatIdentity(message, {}, 'member'), {displayName: 'old', avatarUrl: 'old.jpg'});
  assert.deepEqual(chatIdentity({}, {}, 'member'), {displayName: 'member', avatarUrl: ''});
});
