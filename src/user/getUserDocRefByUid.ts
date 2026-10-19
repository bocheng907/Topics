import { db } from "@/firebase/firebaseConfig";
import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore";

export async function getUserDocSnapshotByUid(uid: string) {
  const q = query(
    collection(db, "users"),
    where("uid", "==", uid),
    limit(2)
  );

  const snap = await getDocs(q);
  if (snap.size > 1) throw new Error("Duplicate account profiles require administrator review.");

  if (snap.empty) {
    return null;
  }

  return snap.docs[0];
}

export async function getUserDocRefByUid(uid: string) {
  const userDocSnap = await getUserDocSnapshotByUid(uid);

  if (!userDocSnap) {
    return null;
  }

  return doc(db, "users", userDocSnap.id);
}
