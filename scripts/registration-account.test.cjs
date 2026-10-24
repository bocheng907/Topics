const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const api={};
new Function('exports',ts.transpileModule(fs.readFileSync(require.resolve('../src/auth/registrationAccount.ts'),'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS},
}).outputText)(api);
test('new registration obtains a fresh account without using cached identity',async()=>{
  const user={uid:'new-user'};
  assert.equal(await api.registrationAccount(async()=>user,async()=>assert.fail('must not sign in')),user);
});
test('interrupted registration can authenticate again after an app restart',async()=>{
  const user={uid:'unfinished-user'};
  assert.equal(await api.registrationAccount(async()=>{throw {code:'auth/email-already-in-use'};},async()=>user),user);
});
test('invalid credentials never return an identity for profile creation',async()=>{
  await assert.rejects(api.registrationAccount(async()=>{throw {code:'auth/email-already-in-use'};},async()=>{throw {code:'auth/invalid-credential'};}),{code:'auth/invalid-credential'});
});
for(const code of ['auth/network-request-failed','auth/too-many-requests','auth/weak-password']){
  test(`${code} is preserved without trying account recovery`,async()=>{
    await assert.rejects(api.registrationAccount(async()=>{throw {code};},async()=>assert.fail('must not sign in')),{code});
  });
}
test('email validation and submission share normalization',()=>{
  assert.equal(api.normalizeRegistrationEmail(' ＡＢＣ＠ＥＸＡＭＰＬＥ．ＣＯＭ '),'abc@example.com');
  const form=fs.readFileSync(require.resolve('../app/(auth)/register.tsx'),'utf8');
  assert.match(form,/register\(normalizedEmail, password, role, extra\)/);
});
test('existing profiles are rejected before any role or consent write',()=>{
  const provider=fs.readFileSync(require.resolve('../src/auth/AuthProvider.tsx'),'utf8');
  const start=provider.indexOf('async function createProfile');
  const end=provider.indexOf('async function register',start);
  const creation=provider.slice(start,end);
  assert.ok(creation.indexOf('existing.kind !== "missing"')<creation.indexOf('batch.set'));
  assert.match(creation,/throw profileStateError\(existing\)/);
  assert.match(creation,/code: "auth\/email-already-in-use"/);
  assert.doesNotMatch(provider,/reauthenticateWithCredential/);
});
