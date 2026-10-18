// 角色對照表（user_roles/{uid}）
//
// 為什麼需要這一份：
// users 集合的文件 ID 是自訂格式（2026-..._user_xxxx），程式是用
// where("uid","==",uid) 查出來的。但 Firestore Security Rules 只能 get()
// 一個算得出來的路徑、不能下查詢，所以規則讀不到使用者的 role。
// 這份以 uid 當文件 ID 的對照表，是讓「只有家屬能存取社群」這類規則
// 能夠成立的唯一方式（除了 Cloud Functions 寫 custom claims）。

import { db } from "@/firebase/firebaseConfig";
import { doc, serverTimestamp, setDoc, type WriteBatch } from "firebase/firestore";
import type { Role } from "./AuthProvider";

export const USER_ROLES_COLLECTION = "user_roles";

/**
 * user_roles/{uid} 的內容。userDocId 指向本人的 users 文件，
 * Security Rules 會用它確認 role 與 users 文件上的 role 一致（防止自行宣稱身分）
 */
export function userRolePayload(uid: string, role: Role, userDocId: string) {
  return { uid, role, userDocId, updatedAt: serverTimestamp() };
}

/** 註冊時與 users 文件放在同一個 batch 寫入 */
export function addUserRoleToBatch(batch: WriteBatch, uid: string, role: Role, userDocId: string) {
  batch.set(doc(db, USER_ROLES_COLLECTION, uid), userRolePayload(uid, role, userDocId));
}

/**
 * 寫入／更新目前使用者的角色對照（登入時呼叫），
 * 既有帳號只要重新登入就會自動補上
 */
export async function syncUserRole(uid: string, role: Role, userDocId: string): Promise<void> {
  if (!uid || !userDocId) return;

  await setDoc(
    doc(db, USER_ROLES_COLLECTION, uid),
    userRolePayload(uid, role, userDocId),
    { merge: true }
  );
}
