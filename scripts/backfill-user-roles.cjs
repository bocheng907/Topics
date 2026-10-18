// One-off admin backfill for user_roles/{uid} (run once after deploying the new rules).
//
// Why: rules now require user_roles.role to match users/{id}.role, and new
// users docs can only be created together with a fresh user_roles doc. Accounts
// registered before the community feature have no user_roles doc yet, so until
// they log in once, such an account could still create a second users doc +
// role in one batch. Backfilling closes that window and also repairs role docs
// written before the cross-check existed (e.g. a caregiver who self-claimed
// "family").
//
// Usage (needs admin credentials, e.g. GOOGLE_APPLICATION_CREDENTIALS):
//   node scripts/backfill-user-roles.cjs --project smart-care-system-1a41e          (dry run)
//   node scripts/backfill-user-roles.cjs --project smart-care-system-1a41e --apply  (write)
const path = require('node:path');
const requireFunctions = require('node:module').createRequire(
    path.join(__dirname, '../functions/package.json'));
const {initializeApp} = requireFunctions('firebase-admin/app');
const {getFirestore, FieldValue} = requireFunctions('firebase-admin/firestore');

const args = process.argv.slice(2);
const projectId = args[args.indexOf('--project') + 1];
const apply = args.includes('--apply');
if (!args.includes('--project') || !projectId) {
  console.error('Usage: node scripts/backfill-user-roles.cjs --project <id> [--apply]');
  process.exit(2);
}

const ROLES = new Set(['family', 'caregiver', 'agency']);

async function main() {
  initializeApp({projectId});
  const db = getFirestore();
  const [users, roles] = await Promise.all([
    db.collection('users').get(),
    db.collection('user_roles').get(),
  ]);
  const roleByUid = new Map(roles.docs.map((d) => [d.id, d.data()]));
  const profilesByUid = new Map();
  for (const d of users.docs) {
    const uid = d.get('uid');
    if (typeof uid !== 'string' || !uid) continue;
    profilesByUid.set(uid, [...(profilesByUid.get(uid) || []), d]);
  }

  const writes = [];
  for (const [uid, profiles] of profilesByUid) {
    if (profiles.length !== 1) {
      console.warn(`[skip] ${uid}: ${profiles.length} users docs (` +
        profiles.map((p) => `${p.id}=${p.get('role')}`).join(', ') + ') - resolve manually');
      continue;
    }
    const profile = profiles[0];
    const role = profile.get('role');
    if (!ROLES.has(role)) {
      console.warn(`[skip] ${uid}: users/${profile.id} has invalid role ${role}`);
      continue;
    }
    const current = roleByUid.get(uid);
    if (current && current.role === role && current.userDocId === profile.id) continue;
    const reason = !current ? 'missing' : current.role !== role ?
      `role ${current.role} -> ${role}` : 'add userDocId';
    console.log(`[${apply ? 'write' : 'dry-run'}] user_roles/${uid}: ${reason}`);
    writes.push({uid, role, userDocId: profile.id});
  }

  if (apply) {
    for (let i = 0; i < writes.length; i += 400) {
      const batch = db.batch();
      for (const w of writes.slice(i, i + 400)) {
        batch.set(db.doc(`user_roles/${w.uid}`), {
          uid: w.uid, role: w.role, userDocId: w.userDocId, updatedAt: FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();
    }
  }
  const orphans = [...roleByUid.keys()].filter((uid) => !profilesByUid.has(uid));
  if (orphans.length) console.warn(`[warn] user_roles without users doc: ${orphans.join(', ')}`);
  console.log(`${writes.length} user_roles ${apply ? 'written' : 'would be written'}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
