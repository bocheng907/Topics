const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'output/reliability-review');
fs.mkdirSync(out, {recursive:true});
const read = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
const old = read('output/handbook-release-20261016/handbook-block.rules');
const baseline = read('output/handbook-release-20261016/firestore.rules');
const local = read('firestore.rules');
const start = local.indexOf('      // Care handbook:');
const end = local.indexOf('      allow read: if signedIn() && (', start);
if (start < 0 || end < 0 || !baseline.includes(old)) throw Error('Handbook block boundaries missing');
const block = local.slice(start, end);
const candidate = baseline.replace(old, () => block);
fs.writeFileSync(path.join(out, 'firestore.rules'), process.argv.includes('--working-tree') ? local : candidate);
fs.writeFileSync(path.join(out, 'handbook-block.rules'), block);
fs.writeFileSync(path.join(out, 'firebase.json'), JSON.stringify({
  firestore:{rules:'firestore.rules'},
  emulators:{auth:{host:'127.0.0.1',port:19099},firestore:{host:'127.0.0.1',port:18298,websocketPort:19297},
    hub:{host:'127.0.0.1',port:14428},logging:{host:'127.0.0.1',port:14528},ui:{enabled:false},singleProjectMode:true}
},null,2));
if (candidate.replace(block, '') !== baseline.replace(old,'')) throw Error('Unrelated rules changed');
console.log(process.argv.includes('--working-tree') ? 'Prepared working-tree rules for local regression only.' :
  'Prepared isolated emulator rules; only handbook subtree differs from release snapshot. No deployment.');
