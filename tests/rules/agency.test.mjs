import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import {
  collection, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, setDoc, Timestamp, updateDoc, where, writeBatch,
} from "firebase/firestore";
import { authed, createEnv, PATIENT_ID, seedPatient, seedUser, uid, userDocId } from "./helpers.mjs";

const AG = uid("agency");
const AG2 = uid("agencytwo");
const CG = uid("caregiver");
const FAM = uid("family");
const CODE = "K7M2PQ";

let env;
const require = createRequire(import.meta.url);
const { Firestore } = require("../../functions/node_modules/@google-cloud/firestore");
const { createAgencyAccessService } = require("../../functions/agencyAccess.js");
const admin = new Firestore({ projectId: "demo-rules-test" });
const service = createAgencyAccessService(admin);
const request = (id, data = {}) => ({ auth: { uid: id }, data });
before(async () => { env = await createEnv(); });
after(async () => { await env?.cleanup(); await admin.terminate(); });
beforeEach(async () => {
  await env.clearFirestore();
  await seedUser(env, AG, "agency");
  await seedUser(env, AG2, "agency");
  await seedUser(env, CG, "caregiver");
  await seedUser(env, FAM, "family");
  await seedPatient(env, { families: [FAM], caregivers: [CG] });
});

/** Legacy direct transaction must remain forbidden after callable migration. */
function createInvite(db, agencyUid, code = CODE) {
  return runTransaction(db, async (tx) => {
    const userRef = doc(db, "users", userDocId(agencyUid));
    const fresh = await tx.get(userRef);
    if (!fresh.exists()) throw new Error("no profile");
    const inviteRef = doc(db, "agency_invites", code);
    const invite = await tx.get(inviteRef);
    if (invite.exists()) throw new Error("collision");
    tx.update(userRef, { agencyInviteCode: code });
    tx.set(inviteRef, {
      inviteCode: code, agencyUid, agencyEmail: "agency@example.com", active: true, createdAt: serverTimestamp(),
    });
  });
}

async function bindCaregiver() {
  const { inviteCode } = await service.getAgencyInvite(request(AG));
  await service.bindAgency(request(CG, { code: inviteCode }));
}

describe("agency invites", () => {
  test("agency callable creates a stable code; direct writes and lists denied", async () => {
    await assertFails(createInvite(authed(env, AG), AG));
    const first = await service.getAgencyInvite(request(AG));
    assert.match(first.inviteCode, /^[A-Z0-9]{6}$/);
    assert.deepEqual(await service.getAgencyInvite(request(AG)), first);
    await assertFails(getDocs(query(collection(authed(env, AG), "agency_invites"), where("agencyUid", "==", AG))));
    // Code is set once.
    await assertFails(updateDoc(doc(authed(env, AG), "users", userDocId(AG)), { agencyInviteCode: "ZZZZZZ" }));
  });

  test("non-agency roles cannot create invites or set agencyInviteCode", async () => {
    await assertFails(createInvite(authed(env, CG), CG));
    await assertFails(createInvite(authed(env, FAM), FAM));
  });

  test("invite lookup is server-only; caregiver cannot enumerate codes", async () => {
    const { inviteCode } = await service.getAgencyInvite(request(AG));
    await assertFails(getDoc(doc(authed(env, CG), "agency_invites", inviteCode)));
    await assertFails(getDocs(collection(authed(env, CG), "agency_invites")));
  });
});

describe("agency memberships, profiles, summaries", () => {
  test("caregiver binds with a valid code; agency sees its caregivers", async () => {
    await bindCaregiver();
    await assertSucceeds(getDoc(doc(authed(env, CG), "agency_memberships", CG)));
    await assertSucceeds(getDocs(query(collection(authed(env, AG), "agency_memberships"),
      where("agencyUid", "==", AG))));
    await assertFails(getDocs(query(collection(authed(env, AG2), "agency_memberships"),
      where("agencyUid", "==", AG))));
  });

  test("family cannot bind; caregiver cannot bind to a mismatched agency", async () => {
    const { inviteCode } = await service.getAgencyInvite(request(AG));
    await assert.rejects(service.bindAgency(request(FAM, { code: inviteCode })), { code: "permission-denied" });
    await assertFails(setDoc(doc(authed(env, FAM), "agency_memberships", FAM), {
      caregiverUid: FAM, caregiverEmail: "f@example.com", agencyUid: AG, agencyInviteCode: CODE,
      createdAt: serverTimestamp(),
    }));
    await assertFails(setDoc(doc(authed(env, CG), "agency_memberships", CG), {
      caregiverUid: CG, caregiverEmail: "cg@example.com", agencyUid: AG2, agencyInviteCode: CODE,
      createdAt: serverTimestamp(),
    }));
  });

  test("caregiver profile + service summary readable by bound agency only", async () => {
    await bindCaregiver();
    const cg = authed(env, CG);
    await assertSucceeds(setDoc(doc(cg, "caregiver_profiles", CG), {
      caregiverUid: CG, profileId: userDocId(CG), displayName: "照護成員", phone: "0900", avatarUrl: "",
      updatedAt: serverTimestamp(),
    }));
    await assertFails(updateDoc(doc(cg, "caregiver_profiles", CG), { displayName: "冒用名字" }));
    const profileBatch = writeBatch(cg);
    profileBatch.update(doc(cg, "users", userDocId(CG)), { displayName: "阿明哥" });
    profileBatch.update(doc(cg, "caregiver_profiles", CG),
      { displayName: "阿明哥", phone: "0911", avatarUrl: "", updatedAt: serverTimestamp() });
    await assertSucceeds(profileBatch.commit());
    await assertSucceeds(setDoc(doc(cg, "caregiver_service_summaries", CG, "patients", PATIENT_ID), {
      caregiverUid: CG, patientId: PATIENT_ID, patientName: "陳爺爺", active: true,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }));
    await assertSucceeds(getDoc(doc(authed(env, AG), "caregiver_profiles", CG)));
    await assertSucceeds(getDocs(collection(authed(env, AG), "caregiver_service_summaries", CG, "patients")));
    await assertFails(getDoc(doc(authed(env, AG2), "caregiver_profiles", CG)));
    await assertFails(setDoc(doc(authed(env, FAM), "caregiver_profiles", FAM), {
      caregiverUid: FAM, displayName: "x", email: "x", phone: "x", avatarUrl: "",
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }));
  });
});

describe("agency reports", () => {
  beforeEach(async () => {
    await bindCaregiver();
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), "agency_reports", "r1"), {
      agencyUid: AG, caregiverUid: CG, patientId: PATIENT_ID, reporterUid: FAM, title: "遲到",
      description: "", level: "pending", status: "open", handlingNote: "", createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(), handledAt: null, handledBy: "",
    }));
  });

  test("owning agency reads and handles; others cannot; clients cannot create", async () => {
    const ag = authed(env, AG);
    await assertFails(getDocs(query(collection(ag, "agency_reports"), where("agencyUid", "==", AG))));
    await assertSucceeds(getDocs(query(collection(ag, "agency_reports"), where("agencyUid", "==", AG), where("caregiverUid", "==", CG))));
    await assertSucceeds(updateDoc(doc(ag, "agency_reports", "r1"), {
      level: "attention", status: "resolved", handlingNote: "已聯繫", updatedAt: serverTimestamp(),
      handledAt: serverTimestamp(), handledBy: AG,
    }));
    await assertFails(updateDoc(doc(ag, "agency_reports", "r1"), { caregiverUid: AG }));
    await assertFails(getDoc(doc(authed(env, AG2), "agency_reports", "r1")));
    await assertFails(getDoc(doc(authed(env, FAM), "agency_reports", "r1")));
    await assertFails(setDoc(doc(authed(env, FAM), "agency_reports", "r2"), { agencyUid: AG }));
  });
});
