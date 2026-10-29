import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "expo-router";
import { collection, limit, onSnapshot, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/firebase/firebaseConfig";
import type { ChatIdentity } from "./chatIdentity";
import type { CareChatRoom } from "./rooms";

const empty: ChatIdentity = { displayName: "", avatarUrl: "" };

export function useChatProfiles(uid: string | undefined, patientId: string | null | undefined,
  room: CareChatRoom, messages: { senderId?: string }[]) {
  const [own, setOwn] = useState<{ uid: string; profile: ChatIdentity } | null>(null);
  const [remote, setRemote] = useState<{ scope: string; profiles: Record<string, ChatIdentity> } | null>(null);
  const scope = `${uid}/${patientId}/${room}`;
  const senderIds = JSON.stringify([...new Set(messages.map(m => m.senderId)
    .filter((id): id is string => !!id && id !== uid))].sort());

  useEffect(() => {
    if (!uid) return;
    let active = true;
    const stop = onSnapshot(query(collection(db, "users"), where("uid", "==", uid), limit(2)), snap => {
      if (!active) return;
      if (snap.size !== 1) { setOwn(null); return; }
      const data = snap.docs[0].data();
      setOwn({ uid, profile: {
        displayName: typeof data.displayName === "string" ? data.displayName.trim() : "",
        avatarUrl: typeof data.avatarUrl === "string" ? data.avatarUrl.trim() : "",
      } });
    }, () => { if (active) setOwn(null); });
    return () => { active = false; stop(); };
  }, [uid]);

  // Refresh other members on entering the room and while it remains visible.
  useFocusEffect(useCallback(() => {
    if (!uid || !patientId) return;
    let active = true;
    let busy = false;
    const refresh = async () => {
      if (busy) return;
      busy = true;
      try {
        const ids: string[] = JSON.parse(senderIds);
        const profiles: Record<string, ChatIdentity> = {};
        const call = httpsCallable<unknown, { profiles: Record<string, ChatIdentity> }>(functions, "getChatProfiles");
        for (let i = 0; i < ids.length; i += 30) {
          const result = await call({ patientId, room, uids: ids.slice(i, i + 30) });
          if (!active) return;
          Object.assign(profiles, result.data.profiles);
        }
        if (active) setRemote({ scope, profiles });
      } catch {
        // Keep chat usable during outages, using the identity saved with messages.
        if (active) setRemote(null);
      } finally { busy = false; }
    };
    void refresh();
    const timer = setInterval(() => { void refresh(); }, 60000);
    return () => { active = false; clearInterval(timer); };
  }, [uid, patientId, room, scope, senderIds]));

  const senderProfile = own?.uid === uid ? own?.profile : undefined;
  return {
    senderProfile: senderProfile || empty,
    profiles: { ...(remote?.scope === scope ? remote.profiles : {}),
      ...(uid && senderProfile ? { [uid]: senderProfile } : {}) },
  };
}
