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
  return Array.isArray(data.caregivers) && data.caregivers.includes(uid);
}

export async function canEditPrescription(id: string): Promise<boolean> {
  const uid = auth.currentUser?.uid;
  if (!uid) return false;
  const prescription = await getDoc(doc(db, "prescriptions", id));
  if (!prescription.exists()) return false;
  const patient = await getDoc(doc(db, "patients", prescription.data().patientId));
  if (!patient.exists()) return false;
  const data = patient.data() as Record<string, any>;
  const isFamily = Array.isArray(data.families) && data.families.includes(uid);
  const isCaregiver = Array.isArray(data.caregivers) && data.caregivers.includes(uid);
  return auth.currentUser?.uid === uid && (isFamily || isCaregiver);
}

export async function canDeletePrescription(id: string): Promise<boolean> {
  return canEditPrescription(id);
}
