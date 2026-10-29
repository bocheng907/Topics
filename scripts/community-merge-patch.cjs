// Emit a reviewable apply_patch patch. Never writes source files or the Git index.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const root = path.resolve(__dirname, '..');
const snapshot = 'e7c96f9e8b75cc348ab89cd4c4124300ef0e4879';
const tree = 'cebe8f1e42198a62aba61e5135dbeab0ecea5ea6';
function git(args) { return cp.execFileSync('git', args, {cwd: root, encoding: 'utf8', maxBuffer: 30e6}); }
const norm = s => s.replace(/\r\n/g, '\n').trimEnd();
const files = process.argv.slice(2);
let patch = '*** Begin Patch\n';
for (const file of files) {
  const dest = path.resolve(root, file);
  if (!dest.startsWith(root + path.sep)) throw Error('Outside workspace');
  const incoming = norm(git(['show', tree + ':' + file]));
  if (/^(<<<<<<<|=======|>>>>>>>)/m.test(incoming)) throw Error('Unresolved: ' + file);
  if (fs.existsSync(dest)) {
    const current = norm(fs.readFileSync(dest, 'utf8'));
    if (current === incoming) continue;
    const original = norm(git(['show', snapshot + ':' + file]));
    if (current !== original) throw Error('Changed since snapshot: ' + file);
    patch += '*** Update File: ' + dest.replace(/\\/g, '/') + '\n@@\n';
    // Compact hunks avoid truncation for large screens.
    const diff = git(['diff', '--no-ext-diff', '--unified=3', snapshot, tree, '--', file]);
    const hunks = diff.slice(diff.indexOf('@@')).replace(/^@@[^\n]*@@[^\n]*/gm, '@@').replace(/^\\ No newline at end of file\n?/gm, '');
    patch = patch.slice(0, -3) + hunks + (hunks.endsWith('\n') ? '' : '\n');
    continue;
  } else {
    fs.mkdirSync(path.dirname(dest), {recursive: true});
    patch += '*** Add File: ' + dest.replace(/\\/g, '/') + '\n';
  }
  patch += incoming.split('\n').map(s => '+' + s).join('\n') + '\n';
}
process.stdout.write(patch + '*** End Patch\n');
