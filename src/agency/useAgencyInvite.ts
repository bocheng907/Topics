import { useAuth } from "@/src/auth/useAuth";
import { functions } from "@/firebase/firebaseConfig";
import { httpsCallable } from "firebase/functions";
import { useEffect, useState } from "react";
const getInvite = httpsCallable<void, {inviteCode: string}>(functions, "getAgencyInvite");

export function useAgencyInvite() {
  const {user} = useAuth();
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scope = user?.role === "agency" ? user.uid : "";
  const [loadedScope, setLoadedScope] = useState(scope);
  if (loadedScope !== scope) {
    setLoadedScope(scope);
    setInviteCode("");
    setError(null);
    setLoading(Boolean(scope));
  }
  useEffect(() => {
    let cancelled = false;
    if (!scope) return;
    getInvite().then(result => {
      if (!cancelled) setInviteCode(result.data.inviteCode);
    }).catch(() => {
      if (!cancelled) setError("邀請碼讀取失敗，請稍後重試。");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [scope]);
  return {inviteCode, loading: Boolean(scope) && loading, error};
}
