import { after, before, beforeEach, describe, test } from "node:test";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import {
  collection, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, setDoc, Timestamp, updateDoc, where,
} from "firebase/firestore";
import { authed, createEnv, PATIENT_ID, seedPatient, seedUser, uid, userDocId } from "./helpers.mjs";

const AG = uid("agency");
const AG2 = uid("agencytwo");
const CG = uid("caregiver");
const FAM = uid("family");
const CODE = "K7M2PQ";

let env;
before(async () => { env = await createEnv(); });
after(async () => { await env?.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await seedUser(env, AG, "agency");
  await seedUser(env, AG2, "agency");
  await seedUser(env, CG, "caregiver");
  await seedUser(env, FAM, "family");
  await seedPatient(env, { families: [FAM], caregivers: [CG] });
});

/** Same transaction as useAgencyInvite: users.agencyInviteCode + agency_invites/{code}. */
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
  await assertSucceeds(createInvite(authed(env, AG), AG));
  await assertSucceeds(setDoc(doc(authed(env, CG), "agency_memberships", CG), {
    caregiverUid: CG, caregiverEmail: "cg@example.com", agencyUid: AG, agencyInviteCode: CODE,
    createdAt: serverTimestamp(),
  }));
}

describe("agency invites", () => {
  test("agency creates its invite code (transaction with users doc)", async () => {
    await assertSucceeds(createInvite(authed(env, AG), AG));
    await assertSucceeds(getDocs(query(collection(authed(env, AG), "agency_invites"), where("agencyUid", "==", AG))));
    // Code is set once.
    await assertFails(updateDoc(doc(authed(env, AG), "users", userDocId(AG)), { agencyInviteCode: "ZZZZZZ" }));
  });

  test("non-agency roles cannot create invites or set agencyInviteCode", async () => {
    await assertFails(createInvite(authed(env, CG), CG));
    await assertFails(createInvite(authed(env, FAM), FAM));
  });

  test("caregiver looks up by code but cannot list every agency", async () => {
    await createInvite(authed(env, AG), AG);
    await assertSucceeds(getDoc(doc(authed(env, CG), "agency_invites", CODE)));
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
    await createInvite(authed(env, AG), AG);
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
      caregiverUid: CG, displayName: "阿明", email: "cg@example.com", phone: "0900", avatarUrl: "",
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }));
    await assertSucceeds(updateDoc(doc(cg, "caregiver_profiles", CG),
      { displayName: "阿明哥", phone: "0911", avatarUrl: "", updatedAt: serverTimestamp() }));
    await assertSucceeds(setDoc(doc(cg, "caregiver_service_summaries", CG, "patients", PATIENT_ID), {
      caregiverUid: CG, patientId: PATIENT_ID, patientName: "陳爺爺",
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
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), "agency_reports", "r1"), {
      agencyUid: AG, caregiverUid: CG, patientId: PATIENT_ID, reporterUid: FAM, title: "遲到",
      description: "", level: "pending", status: "open", handlingNote: "", createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(), handledAt: null, handledBy: "",
    }));
  });

  test("owning agency reads and handles; others cannot; clients cannot create", async () => {
    const ag = authed(env, AG);
    await assertSucceeds(getDocs(query(collection(ag, "agency_reports"), where("agencyUid", "==", AG))));
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
