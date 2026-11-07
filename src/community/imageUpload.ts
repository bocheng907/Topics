// 照顧者知識共享 — 文章圖片上傳
// Storage 路徑：community_posts/{uid}/{postId}/{uuid}.{ext}
// 對應的 Storage 規則在 storage.rules 的 match /community_posts/{uid}/{postId}/{fileName}
// （作者本人上傳、需帶 uploaderUid metadata、僅限圖片且 <= 10MB）

import { storage } from "@/firebase/firebaseConfig";
import { readLocalBlob } from "@/src/media/readLocalBlob";
import { randomUUID } from "expo-crypto";
import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";

/** 每篇文章最多幾張圖，與 Firestore Rules 的 imageUrls 上限一致 */
export const MAX_POST_IMAGES = 4;
/** 單張圖片大小上限（位元組），與 storage.rules 的上限一致 */
export const MAX_POST_IMAGE_BYTES = 10 * 1024 * 1024;

export const COMMUNITY_IMAGE_ROOT = "community_posts";

/** 發文頁挑選好、尚未上傳的本地圖片 */
export type LocalPostImage = {
  uri: string;
  mimeType?: string | null;
  fileSize?: number | null;
};

function extensionFor(contentType: string): string {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  if (contentType === "image/gif") return "gif";
  if (contentType === "image/heic" || contentType === "image/heif") return "heic";
  return "jpg";
}

/** 依副檔名推測 MIME，picker 沒給 mimeType 時使用（部分 Android 機型會缺） */
function guessContentType(image: LocalPostImage): string {
  const fromPicker = image.mimeType?.toLowerCase() ?? "";
  if (fromPicker.startsWith("image/")) return fromPicker;

  const lower = image.uri.toLowerCase().split("?")[0];
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".heic") || lower.endsWith(".heif")) return "image/heic";
  return "image/jpeg";
}

/**
 * 把本地 URI 轉成 Blob
 * React Native（特別是 Android 的 content:// 與 file://）用 fetch().blob() 不穩定，
 * 改用 XMLHttpRequest 取得 blob；web 的 blob: URI 也能用同一套
 */

/**
 * 上傳一張文章圖片，回傳 download URL
 * onProgress 回報 0~1 的進度
 */
export async function uploadPostImage(params: {
  uid: string;
  postId: string;
  image: LocalPostImage;
  onProgress?: (ratio: number) => void;
}): Promise<string> {
  const { uid, postId, image, onProgress } = params;

  if (image.fileSize && image.fileSize > MAX_POST_IMAGE_BYTES) {
    throw Object.assign(new Error("image exceeds 10MB"), { code: "community/image-too-large" });
  }

  const contentType = guessContentType(image);
  const blob = await readLocalBlob(image.uri);

  if (blob.size > MAX_POST_IMAGE_BYTES) {
    (blob as Blob & { close?: () => void }).close?.();
    throw Object.assign(new Error("image exceeds 10MB"), { code: "community/image-too-large" });
  }

  const path = `${COMMUNITY_IMAGE_ROOT}/${uid}/${postId}/${randomUUID()}.${extensionFor(contentType)}`;
  const storageRef = ref(storage, path);

  try {
    // 一定要帶 contentType：RN 產生的 blob 常常沒有 type，
    // storage.rules 用 contentType 檢查是不是圖片，缺了就會被拒絕
    const task = uploadBytesResumable(storageRef, blob, {
      contentType,
      customMetadata: { uploaderUid: uid, postId },
    });

    await new Promise<void>((resolve, reject) => {
      task.on(
        "state_changed",
        (snapshot) => {
          if (snapshot.totalBytes > 0) {
            onProgress?.(snapshot.bytesTransferred / snapshot.totalBytes);
          }
        },
        reject,
        () => resolve()
      );
    });

    return await getDownloadURL(task.snapshot.ref);
  } finally {
    (blob as Blob & { close?: () => void }).close?.();
  }
}

/** 依 download URL 刪除 Storage 上的圖片；盡力而為，失敗只記錄 */
export async function deletePostImages(urls: string[]): Promise<void> {
  await Promise.all(
    urls.map(async (url) => {
      try {
        await deleteObject(ref(storage, url));
      } catch (error) {
        console.log("[community] delete post image failed:", url, error);
      }
    })
  );
}

/** 上傳錯誤的穩定代碼；畫面用 communityUploadErrorMessage 依語言轉成文字 */
export type UploadErrorCode = "tooLarge" | "unauthorized" | "canceled" | "timeout" | "failed";

/** 把上傳錯誤歸類成穩定代碼 */
export function uploadErrorCode(error: unknown): UploadErrorCode {
  const code = (error as { code?: string })?.code ?? "";
  if (code === "community/image-too-large") return "tooLarge";
  if (code === "storage/unauthorized") return "unauthorized";
  if (code === "storage/canceled") return "canceled";
  if (code === "storage/retry-limit-exceeded") return "timeout";
  return "failed";
}
