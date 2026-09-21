/* global __dirname */
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../src/auth/passwordPolicy.ts'), 'utf8');
const compiled = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS}});
const policy = {};
new Function('exports', compiled.outputText)(policy);
for (const [name, password, valid] of [
  ['empty', '', false], ['six characters', 'abcd12', false],
  ['seven characters', 'abc1234', false], ['eight characters', 'abcd1234', true],
  ['letters only', 'abcdefgh', false], ['digits only', '12345678', false],
  ['symbols only', '!@#$%^&*', false], ['no English letter', '中文中文1234', false],
  ['full-width digits do not replace digits', 'abcd１２３４', false],
  ['uppercase without lowercase rejected', 'ABCD1234', false], ['mixed case accepted', 'Abcd1234', true],
  ['symbols allowed', 'abc123!@', true], ['long password', 'long-passphrase-123', true],
]) {
  test(name, () => assert.equal(policy.isValidRegistrationPassword(password), valid));
}
