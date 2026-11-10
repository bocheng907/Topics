import { useCallback } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/firebase/firebaseConfig";
import { useAuth } from "@/src/auth/useAuth";
import { useScopedSnapshot } from "@/src/data/useScopedSnapshot";
import { chatMessageCollection, type CareChatRoom } from "./rooms";

export function useLastChatMessage(patientId: string | null, room: CareChatRoom, targetReady: boolean) {
  const { user, ready: authReady } = useAuth();
  const uid = user?.uid;
  const scope = uid && patientId ? JSON.stringify([uid, patientId, room]) : null;
  const subscribe = useCallback((onData: (message: any | null, fromCache?: boolean) => void, onError: () => void) => {
    if (!patientId || !uid) return () => {};
    const q = query(collection(db, "chats", patientId, chatMessageCollection(room)), orderBy("createdAt", "desc"), limit(1));
    return onSnapshot(q, { includeMetadataChanges: true }, snap => {
      onData(snap.empty ? null : { ...snap.docs[0].data(), id: snap.docs[0].id }, snap.metadata.fromCache);
    }, onError);
  }, [patientId, uid, room]);
  return useScopedSnapshot(scope, authReady && targetReady, subscribe);
}
