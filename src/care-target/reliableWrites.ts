import {
  doc, getDocFromServer, runTransaction, serverTimestamp, setDoc,
  type DocumentData, type Firestore,
} from 'firebase/firestore';

export const handbookKeys = ['dailyRoutine', 'medicationNotes', 'dietNotes',
  'mobilityNotes', 'hygieneNotes', 'sleepNotes', 'communicationNotes',
  'emergencyNotes', 'otherNotes'] as const;
export type HandbookForm = Record<typeof handbookKeys[number], string>;
export function handbookForm(data: DocumentData = {}): HandbookForm {
  return Object.fromEntries(handbookKeys.map(k => [k, typeof data[k] === 'string' ? data[k] : ''])) as HandbookForm;
}
export function versionOf(data: DocumentData | undefined): string {
  return typeof data?.revision === 'string' ? data.revision : '';
}
export function legacyVersion(data: DocumentData | undefined): string {
  // Detect concurrent edits to older documents during the first versioned save.
  return JSON.stringify([handbookForm(data), data?.updatedBy ?? '', data?.updatedAt ?? null]);
}
function conflict() { return Object.assign(new Error('The handbook has changed.'), { code: 'care/conflict' }); }

export async function publishHandbook(db: Firestore, patientId: string, uid: string,
  form: HandbookForm, baseRevision: string, legacy: string, revision: string) {
  const ref = doc(db, 'patients', patientId, 'care_handbook', 'main');
  await getDocFromServer(ref);
  await runTransaction(db, async tx => {
    const current = (await tx.get(ref)).data();
    if (current?.revision === revision && current.updatedBy === uid &&
      JSON.stringify(handbookForm(current)) === JSON.stringify(form)) return;
    if (versionOf(current) !== baseRevision ||
      (!baseRevision && legacyVersion(current) !== legacy)) throw conflict();
    // Create-only marker prevents recycling an old UUID to revive its acknowledgment.
    tx.set(doc(db, 'patients', patientId, 'care_handbook_revisions', revision), { createdAt: serverTimestamp() });
    tx.set(ref, { ...form, patientId, updatedBy: uid, updatedAt: serverTimestamp(), revision, baseRevision });
  });
}

export async function acknowledgeHandbook(db: Firestore, patientId: string, uid: string, revision: string) {
  const main = doc(db, 'patients', patientId, 'care_handbook', 'main');
  const acknowledgment = doc(main, 'acknowledgments', uid);
  await getDocFromServer(main);
  await runTransaction(db, async tx => {
    const current = (await tx.get(main)).data();
    const previous = (await tx.get(acknowledgment)).data();
    if (!revision || current?.revision !== revision) throw conflict();
    if (previous?.revision === revision) return;
    tx.set(acknowledgment, { patientId, caregiverUid: uid, revision, acknowledgedAt: serverTimestamp() });
  });
}

export type HealthPayload = { patientId: string; caregiverId: string } & Record<string, string | number>;
export async function saveHealthOnce(db: Firestore, id: string, payload: HealthPayload) {
  // An online read fails promptly offline instead of silently queuing a new submission.
  await getDocFromServer(doc(db, 'patients', payload.patientId));
  const ref = doc(db, 'health_records', id);
  try {
    await setDoc(ref, { ...payload, createdAt: serverTimestamp() });
  } catch (error) {
    // A retry uses the SAME ID. Existing immutable createdAt rejects the overwrite.
    // Confirm the original commit, including all measurement fields, before reporting success.
    const existing = (await getDocFromServer(ref)).data();
    const keys = Object.keys(payload);
    if (existing && Object.keys(existing).length === keys.length + 1 &&
      keys.every(k => existing[k] === payload[k]) && existing.createdAt) return;
    throw error;
  }
}
