import { after, before, beforeEach, describe, test } from "node:test";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import {createRequire} from "node:module";
const require = createRequire(import.meta.url);
const {Firestore} = require('../../functions/node_modules/@google-cloud/firestore');
const {createSyncCommunityRole} = require('../../functions/communityRole');
const adminDb = new Firestore({projectId: 'demo-rules-test'});
const syncRole = createSyncCommunityRole(adminDb);
import {
  doc, getDoc, getDocs, collection, query, where, limit, serverTimestamp, setDoc, updateDoc, writeBatch,
} from "firebase/firestore";
import {
  authed, createEnv, PATIENT_ID, registerBatch, registrationPayload, seedPatient, seedUser, uid, userDocId,
} from "./helpers.mjs";

let env;
before(async () => { env = await createEnv(); });
after(async () => { await env?.cleanup(); await adminDb.terminate(); });
beforeEach(async () => { await env.clearFirestore(); });

describe("registration (profile then trusted role bootstrap)", () => {
  for (const role of ["family", "caregiver", "agency"]) {
    test(`${role} can register`, async () => {
      const id = uid(role);
      const db = authed(env, id);
      await assertSucceeds(registerBatch(db, id, role));
      await syncRole({auth: {uid: id}});
      // First-login lookup used by AuthProvider / getUserDocSnapshotByUid.
      await assertSucceeds(getDocs(query(collection(db, "users"), where("uid", "==", id), limit(1))));
      await assertSucceeds(getDoc(doc(db, "user_roles", id)));
      // Clients cannot write even their correct role; subsequent login uses the callable.
      await assertFails(setDoc(doc(db, "user_roles", id),
        { uid: id, role, userDocId: userDocId(id), updatedAt: serverTimestamp() }, { merge: true }));
      await syncRole({auth: {uid: id}});
    });
  }

  test("display name may be omitted or filled", async () => {
    const a = uid("noname");
    const payload = registrationPayload(a, "caregiver");
    delete payload.displayName;
    await assertSucceeds(registerBatch(authed(env, a), a, "caregiver", { payload }));
    const b = uid("named");
    await assertSucceeds(registerBatch(authed(env, b), b, "family",
      { payload: registrationPayload(b, "family", { displayName: "王小明" }) }));
  });

  test("profile alone registers but cannot access community before server bootstrap", async () => {
    const id = uid("alone");
    await assertSucceeds(setDoc(doc(authed(env, id), "users", userDocId(id)), registrationPayload(id, "family")));
    await assertFails(getDocs(query(collection(authed(env, id), "posts"), where("status", "==", "published"))));
  });

  test("wrong privacy version, extra keys, bad role and foreign uid are denied", async () => {
    const id = uid("bad");
    const db = authed(env, id);
    const consent = { accepted: true, version: "old", acceptedAt: serverTimestamp() };
    await assertFails(registerBatch(db, id, "family",
      { payload: registrationPayload(id, "family", { privacyConsent: consent }) }));
    await assertFails(registerBatch(db, id, "family",
      { payload: registrationPayload(id, "family", { isAdmin: true }) }));
    await assertFails(registerBatch(db, id, "admin"));
    const other = uid("other");
    await assertFails(registerBatch(db, other, "family"));
  });

  test("user_roles role must match the users doc role", async () => {
    const id = uid("mismatch");
    const db = authed(env, id);
    await assertFails(registerBatch(db, id, "caregiver", {
      roleDoc: { uid: id, role: "family", userDocId: userDocId(id), updatedAt: serverTimestamp() },
    }));
  });
});

describe("user_roles spoofing", () => {
  test("registered caregiver cannot change role to family or agency", async () => {
    const id = uid("cg");
    await seedUser(env, id, "caregiver");
    const db = authed(env, id);
    for (const role of ["family", "agency"]) {
      await assertFails(setDoc(doc(db, "user_roles", id),
        { uid: id, role, userDocId: userDocId(id), updatedAt: serverTimestamp() }, { merge: true }));
    }
  });

  test("legacy caregiver (no user_roles yet) cannot self-claim family", async () => {
    const id = uid("legacycg");
    await seedUser(env, id, "caregiver", { withRole: false });
    const db = authed(env, id);
    await assertFails(setDoc(doc(db, "user_roles", id),
      { uid: id, role: "family", userDocId: userDocId(id), updatedAt: serverTimestamp() }));
    // Without pointing at a profile at all.
    await assertFails(setDoc(doc(db, "user_roles", id), { uid: id, role: "family", updatedAt: serverTimestamp() }));
    // Even a correct client mapping is denied; only the server bootstraps it.
    await assertFails(setDoc(doc(db, "user_roles", id),
      { uid: id, role: "caregiver", userDocId: userDocId(id), updatedAt: serverTimestamp() }, { merge: true }));
    await syncRole({auth: {uid: id}});
    await assertSucceeds(getDoc(doc(db, "user_roles", id)));
  });

  test("cannot point user_roles at someone else's family profile", async () => {
    const fam = uid("realfam");
    const cg = uid("thief");
    await seedUser(env, fam, "family");
    await seedUser(env, cg, "caregiver", { withRole: false });
    await assertFails(setDoc(doc(authed(env, cg), "user_roles", cg),
      { uid: cg, role: "family", userDocId: userDocId(fam), updatedAt: serverTimestamp() }));
  });

  test("registered caregiver cannot mint a second users doc with another role", async () => {
    const id = uid("dup");
    await seedUser(env, id, "caregiver");
    const db = authed(env, id);
    const batch = writeBatch(db);
    batch.set(doc(db, "users", "2026-10-18_11-00-00_user_dup2"), registrationPayload(id, "family"));
    batch.set(doc(db, "user_roles", id),
      { uid: id, role: "family", userDocId: "2026-10-18_11-00-00_user_dup2", updatedAt: serverTimestamp() });
    await assertFails(batch.commit());
  });

  test("caregiver is denied from community even after spoof attempts", async () => {
    const id = uid("cgcomm");
    await seedUser(env, id, "caregiver");
    await assertFails(getDocs(query(collection(authed(env, id), "posts"), where("status", "==", "published"))));
  });
});

describe("users profile updates", () => {
  test("name / avatar edits work even with a stale activePatientId", async () => {
    const id = uid("stale");
    await seedUser(env, id, "family", { extra: { activePatientId: "gone_patient" } });
    const db = authed(env, id);
    await assertSucceeds(updateDoc(doc(db, "users", userDocId(id)), { displayName: "新名字" }));
    await assertSucceeds(updateDoc(doc(db, "users", userDocId(id)), { avatarUrl: "https://example.com/a.jpg" }));
    await assertSucceeds(updateDoc(doc(db, "users", userDocId(id)), { activePatientId: "" }));
  });

  test("activePatientId may only point at a linked care target", async () => {
    const id = uid("fam");
    await seedUser(env, id, "family");
    await seedPatient(env, { families: [id], caregivers: [] });
    const db = authed(env, id);
    await assertSucceeds(updateDoc(doc(db, "users", userDocId(id)), { activePatientId: PATIENT_ID }));
    await assertFails(updateDoc(doc(db, "users", userDocId(id)), { activePatientId: "someone_else" }));
  });

  test("role, uid, email, consent are immutable; other users' docs are hidden", async () => {
    const id = uid("immut");
    const other = uid("nosy");
    await seedUser(env, id, "caregiver");
    const db = authed(env, id);
    await assertFails(updateDoc(doc(db, "users", userDocId(id)), { role: "family" }));
    await assertFails(updateDoc(doc(db, "users", userDocId(id)), { email: "x@example.com" }));
    await assertFails(updateDoc(doc(db, "users", userDocId(id)), { accountStatus: "active" }));
    await assertFails(getDoc(doc(authed(env, other), "users", userDocId(id))));
  });

  test("push token device doc under own profile", async () => {
    const id = uid("push");
    await seedUser(env, id, "family");
    await assertSucceeds(setDoc(doc(authed(env, id), "users", userDocId(id), "devices", `${id}_Android`), {
      expoPushToken: "ExponentPushToken[x]", platform: "Android", enabled: true, updatedAt: serverTimestamp(),
    }, { merge: true }));
    await assertFails(setDoc(doc(authed(env, uid("other")), "users", userDocId(id), "devices", "x"), {
      expoPushToken: "t", platform: "Android", enabled: true, updatedAt: serverTimestamp(),
    }));
  });
});
