import { after, before, beforeEach, describe, test } from "node:test";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { deleteObject, getBytes, ref, uploadBytes } from "firebase/storage";
import { doc, setDoc } from "firebase/firestore";
import { createEnv, PATIENT_ID, seedPatient, seedUser, uid } from "./helpers.mjs";

const FAM = uid("family");
const CG = uid("caregiver");
const AG = uid("agency");
const OUT = uid("outsider");
const UUID = "3f2a9c1e-4b7d-4e2a-9c3b-1a2b3c4d5e6f";
const BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);

let env;
before(async () => { env = await createEnv({ storage: true }); });
after(async () => { await env?.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.clearStorage();
  await seedUser(env, FAM, "family");
  await seedUser(env, CG, "caregiver");
  await seedUser(env, AG, "agency");
  await seedUser(env, OUT, "family");
  await seedPatient(env, { families: [FAM], caregivers: [CG] });
});

const storage = (id) => env.authenticatedContext(id).storage();
const meta = (uploader, extra = {}) => ({
  contentType: "image/jpeg", customMetadata: { uploaderUid: uploader, patientId: PATIENT_ID, ...extra },
});

describe("prescriptions", () => {
  test("linked member uploads to the patient-scoped path; outsiders cannot", async () => {
    const path = `prescriptions/${PATIENT_ID}/${CG}/${UUID}.jpg`;
    await assertSucceeds(uploadBytes(ref(storage(CG), path), BYTES, meta(CG)));
    await assertSucceeds(getBytes(ref(storage(FAM), path)));
    await assertFails(getBytes(ref(storage(OUT), path)));
    await assertFails(uploadBytes(ref(storage(OUT), `prescriptions/${PATIENT_ID}/${OUT}/${UUID}.jpg`),
      BYTES, meta(OUT)));
    await assertFails(uploadBytes(ref(storage(CG), `prescriptions/${PATIENT_ID}/${FAM}/${UUID}.jpg`),
      BYTES, meta(CG)));
    await assertFails(uploadBytes(ref(storage(CG), `prescriptions/${PATIENT_ID}/${CG}/scan.jpg`), BYTES, meta(CG)));
    await assertFails(uploadBytes(ref(storage(CG), `prescriptions/${PATIENT_ID}/${CG}/${UUID}.png`),
      BYTES, { ...meta(CG), contentType: "application/pdf" }));
    await assertFails(deleteObject(ref(storage(FAM), path)));
    await assertSucceeds(deleteObject(ref(storage(CG), path)));
  });
});

describe("profile images", () => {
  test("owner uploads immutable UUID avatar; unrelated accounts denied", async () => {
    const path = `profile_images/${FAM}/${UUID}.jpg`;
    await assertSucceeds(uploadBytes(ref(storage(FAM), path), BYTES, meta(FAM)));
    await assertFails(uploadBytes(ref(storage(FAM), path), BYTES, meta(FAM)));
    await assertSucceeds(getBytes(ref(storage(FAM), path)));
    await assertFails(getBytes(ref(storage(CG), path)));
    await assertFails(uploadBytes(ref(storage(CG), path), BYTES, { contentType: "image/jpeg" }));
    await assertFails(uploadBytes(ref(storage(FAM), `profile_images/${FAM}/other.jpg`), BYTES,
      { contentType: "image/jpeg" }));
    await assertFails(getBytes(ref(env.unauthenticatedContext().storage(), path)));
  });
});

describe("community post images", () => {
  test("family / agency upload under their own folder; caregiver denied", async () => {
    const famPath = `community_posts/${FAM}/post1/${UUID}.jpg`;
    const metaPost = (u, postId = "post1") => ({ contentType: "image/jpeg", customMetadata: { uploaderUid: u, postId } });
    await assertSucceeds(uploadBytes(ref(storage(FAM), famPath), BYTES, metaPost(FAM)));
    await assertSucceeds(uploadBytes(ref(storage(AG), `community_posts/${AG}/post2/${UUID}.png`), BYTES,
      { ...metaPost(AG, "post2"), contentType: "image/png" }));
    await assertFails(getBytes(ref(storage(AG), famPath)));
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), "posts", "post1"), {
      authorUid: FAM, status: "published",
    }));
    await assertSucceeds(getBytes(ref(storage(AG), famPath)));
    await assertFails(uploadBytes(ref(storage(CG), `community_posts/${CG}/post3/${UUID}.jpg`), BYTES, metaPost(CG)));
    await assertFails(getBytes(ref(storage(CG), famPath)));
    await assertFails(uploadBytes(ref(storage(OUT), `community_posts/${FAM}/post1/${UUID}.png`), BYTES,
      metaPost(OUT)));
    await assertFails(deleteObject(ref(storage(OUT), famPath)));
    await assertSucceeds(deleteObject(ref(storage(FAM), famPath)));
  });
});

describe("abnormal media and voice messages", () => {
  test("abnormal media: caregiver uploads UUID, family reads only", async () => {
    const path = `abnormal_media/${PATIENT_ID}/${UUID}.mp4`;
    await assertFails(uploadBytes(ref(storage(CG), `abnormal_media/${PATIENT_ID}/2026-10-18_abnormal.mp4`), BYTES, { ...meta(CG), contentType: "video/mp4" }));
    await assertSucceeds(uploadBytes(ref(storage(CG), path), BYTES, { ...meta(CG), contentType: "video/mp4" }));
    await assertSucceeds(getBytes(ref(storage(FAM), path)));
    await assertFails(uploadBytes(ref(storage(FAM), `abnormal_media/${PATIENT_ID}/x_abnormal.jpg`), BYTES,
      meta(FAM)));
    await assertFails(getBytes(ref(storage(OUT), path)));
  });

  test("voice messages: family uploads and deletes; caregiver listens only", async () => {
    const path = `voice_messages/${PATIENT_ID}/${UUID}.m4a`;
    await assertFails(uploadBytes(ref(storage(FAM), `voice_messages/${PATIENT_ID}/2026-10-18_voice.m4a`), BYTES, { ...meta(FAM), contentType: "audio/mp4" }));
    await assertSucceeds(uploadBytes(ref(storage(FAM), path), BYTES, { ...meta(FAM), contentType: "audio/mp4" }));
    await assertSucceeds(getBytes(ref(storage(CG), path)));
    await assertFails(uploadBytes(ref(storage(CG), `voice_messages/${PATIENT_ID}/cg_voice.m4a`), BYTES,
      { ...meta(CG), contentType: "audio/mp4" }));
    await assertFails(deleteObject(ref(storage(CG), path)));
    await assertSucceeds(deleteObject(ref(storage(FAM), path)));
  });

  test("chat images for linked members", async () => {
    const path = `chats/${PATIENT_ID}/images/${UUID}.jpg`;
    await assertSucceeds(uploadBytes(ref(storage(CG), path), BYTES, meta(CG)));
    await assertSucceeds(getBytes(ref(storage(FAM), path)));
    await assertFails(uploadBytes(ref(storage(OUT), `chats/${PATIENT_ID}/images/${UUID}.png`), BYTES, meta(OUT)));
  });
});
