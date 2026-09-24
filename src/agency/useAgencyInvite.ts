import { db } from "@/firebase/firebaseConfig";
import { useAuth } from "@/src/auth/useAuth";
import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { useEffect, useState } from "react";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateInviteCode(length = 6) {
  let result = "";

  for (let i = 0; i < length; i += 1) {
    const index = Math.floor(Math.random() * CODE_CHARS.length);
    result += CODE_CHARS[index];
  }

  return result;
}

export function useAgencyInvite() {
  const { user } = useAuth();

  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  
  useEffect(() => {
    if (!user || user.role !== "agency") {
      setInviteCode("");
      setLoading(false);
      return;
    }

    // 先把目前登入仲介的資料固定下來
    // 後面的 async function 就不需要再直接讀 user
    const agencyUid = user.uid;
    const agencyEmail = user.email;

    let cancelled = false;

    async function loadOrCreateInvite() {
      try {
        setLoading(true);
        setError(null);

        const agencyRef = doc(
          db,
          "agencies",
          agencyUid
        );

        // 先確認這個仲介是否已經有邀請碼
        const agencySnap = await getDoc(agencyRef);

        if (agencySnap.exists()) {
          const data = agencySnap.data();

          if (!cancelled) {
            setInviteCode(data.inviteCode ?? "");
          }

          return;
        }

        // 尚未建立時才產生新邀請碼
        for (
          let attempt = 0;
          attempt < 10;
          attempt += 1
        ) {
          const newCode = generateInviteCode();

          try {
            const inviteRef = doc(
              db,
              "agency_invites",
              newCode
            );

            await runTransaction(
              db,
              async (transaction) => {
                const inviteSnap =
                  await transaction.get(inviteRef);

                // 已有人使用這組邀請碼，重新產生
                if (inviteSnap.exists()) {
                  throw new Error(
                    "invite-code-collision"
                  );
                }

                transaction.set(agencyRef, {
                  agencyUid,
                  email: agencyEmail,
                  inviteCode: newCode,
                  createdAt: serverTimestamp(),
                });

                transaction.set(inviteRef, {
                  inviteCode: newCode,
                  agencyUid,
                  agencyEmail,
                  active: true,
                  createdAt: serverTimestamp(),
                });
              }
            );

            if (!cancelled) {
              setInviteCode(newCode);
            }

            return;
          } catch (transactionError: any) {
            if (
              transactionError?.message ===
              "invite-code-collision"
            ) {
              continue;
            }

            throw transactionError;
          }
        }

        throw new Error(
          "無法產生唯一仲介邀請碼"
        );
      } catch (e: any) {
        console.log(
          "[agency invite] error:",
          e
        );

        if (!cancelled) {
          setError(
            e?.message ?? "邀請碼建立失敗"
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadOrCreateInvite();

    return () => {
      cancelled = true;
    };
  }, [
    user?.uid,
    user?.role,
    user?.email,
  ]);

  return {
    inviteCode,
    loading,
    error,
  };
}