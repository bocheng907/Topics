// Shared setup for the Security Rules tests.
// Run through `npm run test:rules`, which starts the Firestore + Storage
// emulators (firebase.rules-test.json) and sets the *_EMULATOR_HOST variables.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, serverTimestamp, setDoc, Timestamp, writeBatch } from "firebase/firestore";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const PROJECT_ID = "demo-rules-test";
export const PRIVACY_VERSION = "2026-09-22.v2";

function hostPort(value, fallbackPort) {
  const [host, port] = String(value || `127.0.0.1:${fallbackPort}`).split(":");
  return { host, port: Number(port) };
}

export async function createEnv({ storage = false } = {}) {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error("Run via `npm run test:rules` (emulators only, never a real project).");
  }
  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      ...hostPort(process.env.FIRESTORE_EMULATOR_HOST, 8288),
      rules: readFileSync(join(root, process.env.COMMUNITY_RULES_CANDIDATE || "firestore.rules"), "utf8"),
    },
    ...(storage ? {
      storage: {
        ...hostPort(process.env.FIREBASE_STORAGE_EMULATOR_HOST, 9299),
        rules: readFileSync(join(root, "storage.rules"), "utf8"),
      },
    } : {}),
  });
}

// Firebase Auth UIDs are 28 alphanumerics; keep test UIDs in the same shape.
export const uid = (name) => (name + "0000000000000000000000000000").slice(0, 28);

export function userDocId(id) {
  // Unique per account (the app uses time + uid suffix; test UIDs share a zero-padded tail).
  return `2026-10-18_10-00-00_user_${id}`;
}

/** The exact payload AuthProvider.register writes. */
export function registrationPayload(id, role, extra = {}) {
  return {
    uid: id,
    email: `${id.toLowerCase()}@example.com`,
    role,
    createdAt: serverTimestamp(),
    activePatientId: "",
    emergencyPhone1: role === "family" ? "0912345678" : "",
    emergencyPhone2: role === "family" ? "0987654321" : "",
    displayName: "照護成員",
    avatarUrl: "",
    privacyConsent: { accepted: true, version: PRIVACY_VERSION, acceptedAt: serverTimestamp() },
    ...extra,
  };
}

/** Registration writes the profile; trusted syncCommunityRole creates the mapping. */
export function registerBatch(db, id, role, { payload, roleDoc } = {}) {
  const batch = writeBatch(db);
  batch.set(doc(db, "users", userDocId(id)), payload ?? registrationPayload(id, role));
  if (roleDoc) batch.set(doc(db, "user_roles", id), roleDoc);
  return batch.commit();
}

/** Seed a fully registered account directly (rules disabled). */
export async function seedUser(env, id, role, { withRole = true, extra = {} } = {}) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "users", userDocId(id)), {
      ...registrationPayload(id, role),
      createdAt: Timestamp.now(),
      privacyConsent: { accepted: true, version: PRIVACY_VERSION, acceptedAt: Timestamp.now() },
      ...extra,
    });
    if (withRole) {
      await setDoc(doc(db, "user_roles", id), {
        uid: id, role, userDocId: userDocId(id), updatedAt: Timestamp.now(),
      });
    }
  });
}

export const PATIENT_ID = "2026-10-18_10-00-00_pat_AB12";

export async function seedPatient(env, { families, caregivers, id = PATIENT_ID }) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "patients", id), {
      patientsId: "XYZWAB12", name: "陳爺爺", notes: "", inviteCode: "ABC123",
      families, caregivers, familyGroupId: id, primaryFamilyUid: families[0] ?? "",
      invitationVersion: 2, createdBy: families[0] ?? "", createdAt: Timestamp.now(),
      emergencyPhone1: "0912345678", emergencyPhone2: "0987654321",
    });
  });
}

export function authed(env, id) {
  return env.authenticatedContext(id).firestore();
}
