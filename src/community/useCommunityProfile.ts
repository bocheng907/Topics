// 目前登入者在社群顯示用的名稱與頭像
// 讀不到 users 文件時退回 email 前綴，與既有發文的 authorName 規則一致

import { useEffect, useState } from "react";

import { useAuth } from "@/src/auth/useAuth";
import { fallbackDisplayName, getCommunityProfile, type CommunityProfile } from "./api";

export function useCommunityProfile(): CommunityProfile & { loaded: boolean } {
  const { user } = useAuth();
  const uid = user?.uid ?? "";
  const email = user?.email ?? "";
  const requestKey = `${uid}|${email}`;

  // 記下這份資料是哪個帳號讀到的，切換帳號時自然視為「尚未載入」
  const [result, setResult] = useState<{ key: string; profile: CommunityProfile } | null>(null);

  useEffect(() => {
    let alive = true;

    getCommunityProfile(uid, email)
      .catch((error) => {
        console.log("[community] load profile failed:", error);
        return { name: fallbackDisplayName(email), avatarUrl: "" };
      })
      .then((profile) => {
        if (alive) setResult({ key: `${uid}|${email}`, profile });
      });

    return () => {
      alive = false;
    };
  }, [uid, email]);

  const loaded = result?.key === requestKey;
  const profile = loaded && result
    ? result.profile
    : { name: fallbackDisplayName(email), avatarUrl: "" };

  return { ...profile, loaded };
}
