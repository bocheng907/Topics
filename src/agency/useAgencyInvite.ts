import { db } from "@/firebase/firebaseConfig";
import { useAuth } from "@/src/auth/useAuth";
import { getUserDocSnapshotByUid } from "@/src/user/getUserDocRefByUid";
import {
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
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

function isValidInviteCode(value: unknown): value is string {
  return typeof value === "string" && value.trim().length === 6;
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
      setError(null);
      return;
    }

    // 先把值固定下來，避免 async function 裡 TypeScript
    // 認為 user 有可能在等待期間變回 null。
    const agencyUid = user.uid;
    const agencyEmail = user.email ?? "";

    let cancelled = false;

    async function loadOrCreateInvite() {
      try {
        setLoading(true);
        setError(null);

        // 仲介基本資料統一由 users 管理。
        const userSnap = await getUserDocSnapshotByUid(agencyUid);

        if (!userSnap) {
          throw new Error("找不到仲介帳號資料");
        }

        const userData = userSnap.data() as any;

        // ==========================================
        // 1. users 已經有 agencyInviteCode
        // ==========================================
        const storedCode = String(
          userData.agencyInviteCode ?? ""
        ).trim();

        if (isValidInviteCode(storedCode)) {
          if (!cancelled) {
            setInviteCode(storedCode);
          }

          return;
        }

        // ==========================================
        // 2. 舊資料相容
        //    agency_invites 已有此仲介的邀請碼，
        //    但 users 還沒有 agencyInviteCode。
        // ==========================================
        const existingInviteQuery = query(
          collection(db, "agency_invites"),
          where("agencyUid", "==", agencyUid)
        );

        const existingInviteSnapshot = await getDocs(
          existingInviteQuery
        );

        const existingInvite = existingInviteSnapshot.docs.find(
          (inviteDoc) => inviteDoc.data().active === true
        );

        if (existingInvite) {
          const existingData = existingInvite.data();

          const existingCode = String(
            existingData.inviteCode ?? existingInvite.id
          ).trim();

          if (isValidInviteCode(existingCode)) {
            const migratedCode = await runTransaction(
              db,
              async (transaction) => {
                const freshUserSnap = await transaction.get(
                  userSnap.ref
                );

                if (!freshUserSnap.exists()) {
                  throw new Error("找不到仲介帳號資料");
                }

                const freshUserData = freshUserSnap.data() as any;

                const currentCode = String(
                  freshUserData.agencyInviteCode ?? ""
                ).trim();

                // 若另一個流程已先完成搬移，直接沿用。
                if (isValidInviteCode(currentCode)) {
                  return currentCode;
                }

                transaction.update(userSnap.ref, {
                  agencyInviteCode: existingCode,
                });

                return existingCode;
              }
            );

            if (!cancelled) {
              setInviteCode(migratedCode);
            }

            return;
          }
        }

        // ==========================================
        // 3. 完全沒有邀請碼 -> 建立新的
        // ==========================================
        for (let attempt = 0; attempt < 10; attempt += 1) {
          const newCode = generateInviteCode();

          try {
            const inviteRef = doc(
              db,
              "agency_invites",
              newCode
            );

            const resultCode = await runTransaction(
              db,
              async (transaction) => {
                const freshUserSnap = await transaction.get(
                  userSnap.ref
                );

                if (!freshUserSnap.exists()) {
                  throw new Error("找不到仲介帳號資料");
                }

                const freshUserData = freshUserSnap.data() as any;

                const currentCode = String(
                  freshUserData.agencyInviteCode ?? ""
                ).trim();

                // 同時間另一個流程可能已完成建立。
                if (isValidInviteCode(currentCode)) {
                  return currentCode;
                }

                const inviteSnap = await transaction.get(inviteRef);

                if (inviteSnap.exists()) {
                  throw new Error("invite-code-collision");
                }

                // 邀請碼保存在 users。
                transaction.update(userSnap.ref, {
                  agencyInviteCode: newCode,
                });

                // agency_invites 保留為「邀請碼 -> 仲介」索引。
                transaction.set(inviteRef, {
                  inviteCode: newCode,
                  agencyUid,
                  agencyEmail,
                  active: true,
                  createdAt: serverTimestamp(),
                });

                return newCode;
              }
            );

            if (!cancelled) {
              setInviteCode(resultCode);
            }

            return;
          } catch (transactionError: any) {
            if (
              transactionError?.message === "invite-code-collision"
            ) {
              continue;
            }

            throw transactionError;
          }
        }

        throw new Error("無法產生唯一仲介邀請碼");
      } catch (e: any) {
        console.log("[agency invite] error:", e);

        if (!cancelled) {
          setError(e?.message ?? "邀請碼建立失敗");
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
  }, [user?.uid, user?.role, user?.email]);

  return {
    inviteCode,
    loading,
    error,
  };
}
