/* global __dirname */
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

test('invite feedback distinguishes revoked, used, expired and unknown reasons in every language', () => {
  const exports = {};
  vm.runInNewContext(ts.transpile(read('src/care-target/inviteFeedback.ts'), {module: ts.ModuleKind.CommonJS}), {exports});
  for (const language of ['zh', 'en', 'vi', 'id']) {
    const message = reason => exports.inviteErrorMessage({details: {reason}}, language, 'invalid', 'expired');
    assert.equal(message('revoked'), exports.inviteFeedback[language].revoked);
    assert.equal(message('used'), exports.inviteFeedback[language].used);
    assert.equal(message('expired'), 'expired');
    assert.equal(message(undefined), 'invalid');
    assert.equal(message('unknown'), 'invalid');
    assert.ok(exports.inviteFeedback[language].askPrimary);
  }
  assert.match(read('app/care-target/join.tsx'), /inviteErrorMessage\(e, language/);
  for (const page of ['list', 'index']) {
    const source = read('app/caregiver/' + page + '.tsx');
    assert.doesNotMatch(source, /inviteFeedback\[language\].askPrimary/);
    assert.match(source, /t\.(goHomeScanPrescription|buildReminderByScan)/);
  }
});

test('Web confirmation executes only confirmed actions and handles cancellation', () => {
  const exports = {};
  let accepted = true, performed = 0, cancelled = 0, shown = 0;
  vm.runInNewContext(ts.transpile(read('src/ui/AppAlert.web.ts'), {module: ts.ModuleKind.CommonJS}), {
    exports, window: {confirm: () => accepted, alert: () => shown++},
  });
  const buttons = [{style: 'cancel', onPress: () => cancelled++}, {onPress: () => performed++}];
  exports.AppAlert.alert('Confirm', 'test', buttons);
  accepted = false;
  exports.AppAlert.alert('Confirm', 'test', buttons);
  assert.equal(performed, 1); assert.equal(cancelled, 1);
  exports.AppAlert.alert('Success', 'test', [{onPress: () => performed++}]);
  assert.equal(shown, 1); assert.equal(performed, 2);
});

function selection(overrides = {}) {
  const source = ts.createSourceFile('provider.tsx', read('src/care-target/useActiveCareTarget.tsx'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let node;
  function visit(n) { if (ts.isFunctionDeclaration(n) && n.name?.text === 'setActivePatientId') node = n; ts.forEachChild(n, visit); }
  visit(source); assert.ok(node);
  const effects = [];
  const context = {user: {uid: 'owner', role: 'family'}, auth: {currentUser: {uid: 'owner'}}, db: {},
    doc: (...args) => args, collection: (...args) => args, query: (...args) => args, where: (...args) => args,
    getDocFromServer: async () => ({exists: () => true, data: () => ({families: ['owner'], caregivers: [], name: 'Test'})}),
    getDocs: async () => ({size: 1, docs: [{ref: 'profile'}]}), updateDoc: async () => effects.push('server'),
    AsyncStorage: {setItem: async () => effects.push('cache')}, activeKey: uid => uid,
    setTargets: () => effects.push('targets'), setLinkedIds: () => effects.push('links'), setActiveId: id => effects.push(id),
    ...overrides};
  return {effects, run: vm.runInNewContext(ts.transpile('(' + node.getText() + ')'), context)};
}
test('selection validates server membership before switching', async () => {
  const {run, effects} = selection(); await run('patient');
  assert.deepEqual(effects, ['server', 'cache', 'targets', 'links', 'patient']);
});
for (const [name, overrides] of [
  ['missing patient', {getDocFromServer: async () => ({exists: () => false})}],
  ['revoked membership', {getDocFromServer: async () => ({exists: () => true, data: () => ({families: [], caregivers: []})})}],
  ['duplicate profile', {getDocs: async () => ({size: 2})}],
  ['failed server write', {updateDoc: async () => {throw Error('offline');}}],
  ['signed out', {auth: {currentUser: null}}],
]) test(name + ' rejects and does not switch local target', async () => {
  const {run, effects} = selection(overrides); await assert.rejects(run('patient'));
  assert.deepEqual(effects, []);
});
test('flow routes and confirmations use the corrected entry points', () => {
  for (const name of ['create', 'join', 'invitations']) assert.match(read('app/care-target/' + name + '.tsx'), /AppAlert as Alert/);
  assert.match(read('app/family/index.tsx'), /isPrimaryFamily && <Pressable/);
  assert.match(read('app/family/index.tsx'), /\/family\/camera/);
  assert.ok(read('app/caregiver/index.tsx').includes('router.push("/caregiver/camera")'));
  assert.match(read('app/caregiver/camera.tsx'), /\/family\/scan-result/);
  assert.match(read('app/caregiver/result.tsx'), /user\?\.role === "family" \? "\/family\/list"/);
  assert.match(read('app/care-target/create.tsx'), /created.current\?\.uid === user.uid/);
});
