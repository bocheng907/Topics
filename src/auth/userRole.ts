// 角色對照表（user_roles/{uid}）
//
// 為什麼需要這一份：
// users 集合的文件 ID 是自訂格式（2026-..._user_xxxx），程式是用
// where("uid","==",uid) 查出來的。但 Firestore Security Rules 只能 get()
// 一個算得出來的路徑、不能下查詢，所以規則讀不到使用者的 role。
// 這份以 uid 當文件 ID 的對照表，是讓「只有家屬能存取社群」這類規則
// 能夠成立的唯一方式（除了 Cloud Functions 寫 custom claims）。

import { db } from "@/firebase/firebaseConfig";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import type { Role } from "./AuthProvider";

export const USER_ROLES_COLLECTION = "user_roles";

/**
 * 寫入／更新目前使用者的角色對照
 * 在註冊完成與每次登入時各呼叫一次，既有帳號只要重新登入就會自動補上
 */
export async function syncUserRole(uid: string, role: Role): Promise<void> {
  if (!uid) return;

  await setDoc(
    doc(db, USER_ROLES_COLLECTION, uid),
    { uid, role, updatedAt: serverTimestamp() },
    { merge: true }
  );
}
