import { auth } from "@/firebase/firebaseConfig";
import { onIdTokenChanged } from "firebase/auth";
import { useCallback, useEffect, useState } from "react";

export function useAuditAccess() {
  const [access, setAccess] = useState({ ready: false, allowed: false, uid: "" });
  const refresh = useCallback(async () => {
    const user = auth.currentUser;
    setAccess({ ready: false, allowed: false, uid: user?.uid ?? "" });
    if (!user) { setAccess({ ready: true, allowed: false, uid: "" }); return; }
    try {
      const token = await user.getIdTokenResult(true);
      if (auth.currentUser === user) setAccess({ ready: true, allowed: token.claims.auditAdmin === true, uid: user.uid });
    } catch {
      if (auth.currentUser === user) setAccess({ ready: true, allowed: false, uid: user.uid });
    }
  }, []);
  useEffect(() => {
    let version = 0;
    const unsubscribe = onIdTokenChanged(auth, async (user) => {
      const current = ++version;
      setAccess({ ready: false, allowed: false, uid: user?.uid ?? "" });
      try {
        const token = await user?.getIdTokenResult();
        if (current === version) setAccess({ ready: true, allowed: token?.claims.auditAdmin === true, uid: user?.uid ?? "" });
      } catch {
        if (current === version) setAccess({ ready: true, allowed: false, uid: user?.uid ?? "" });
      }
    });
    return () => { version++; unsubscribe(); };
  }, []);
  return { ...access, refresh };
}
