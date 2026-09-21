import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/firebase/firebaseConfig";

export function primaryFamilyUid(data: Record<string, any>): string | null {
  const uid = Object.prototype.hasOwnProperty.call(data, "primaryFamilyUid")
    ? data.primaryFamilyUid : data.createdBy;
  return typeof uid === "string" && uid.length > 0 &&
    Array.isArray(data.families) && data.families.includes(uid) &&
    Array.isArray(data.caregivers) && !data.caregivers.includes(uid) ? uid : null;
}

export function canCreatePrescriptionForPatient(data: Record<string, any>, uid: string): boolean {
  return primaryFamilyUid(data) === uid ||
    (Array.isArray(data.caregivers) && data.caregivers.includes(uid));
}

export async function canEditPrescription(id: string): Promise<boolean> {
  const uid = auth.currentUser?.uid;
  if (!uid) return false;
  const prescription = await getDoc(doc(db, "prescriptions", id));
  if (!prescription.exists()) return false;
  const patient = await getDoc(doc(db, "patients", prescription.data().patientId));
  return auth.currentUser?.uid === uid && patient.exists() && primaryFamilyUid(patient.data()) === uid;
}
