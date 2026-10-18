// 照顧者知識共享 — 文章圖片上傳
// Storage 路徑：community_posts/{uid}/{postId}/{uuid}.{ext}
// 這個 repo 沒有 storage.rules，Firebase Console 的 Storage 規則需加上：
//
//   match /community_posts/{uid}/{postId}/{fileName} {
//     allow read: if request.auth != null;
//     allow create: if request.auth != null && request.auth.uid == uid
//       && request.resource.size < 10 * 1024 * 1024
//       && request.resource.contentType.matches('image/.*')
//       && request.resource.metadata.uploaderUid == request.auth.uid;
//     allow update: if false;
//     allow delete: if request.auth != null && request.auth.uid == uid;
//   }

import { storage } from "@/firebase/firebaseConfig";
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
function uriToBlob(uri: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => resolve(xhr.response as Blob);
    xhr.onerror = () => reject(new Error("讀取圖片檔案失敗"));
    xhr.responseType = "blob";
    xhr.open("GET", uri, true);
    xhr.send(null);
  });
}

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
    throw Object.assign(new Error("圖片超過 10MB"), { code: "community/image-too-large" });
  }

  const contentType = guessContentType(image);
  const blob = await uriToBlob(image.uri);

  if (blob.size > MAX_POST_IMAGE_BYTES) {
    (blob as Blob & { close?: () => void }).close?.();
    throw Object.assign(new Error("圖片超過 10MB"), { code: "community/image-too-large" });
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

/** 把上傳錯誤轉成給使用者看的訊息 */
export function describeUploadError(error: unknown): string {
  const code = (error as { code?: string })?.code ?? "";
  if (code === "community/image-too-large") return "單張圖片不可超過 10MB，請換一張較小的圖片";
  if (code === "storage/unauthorized") return "沒有上傳圖片的權限，請聯絡管理員確認 Storage 規則";
  if (code === "storage/canceled") return "圖片上傳已取消";
  if (code === "storage/retry-limit-exceeded") return "網路不穩定，圖片上傳逾時，請稍後再試";
  return "圖片上傳失敗，請確認網路後再試";
}
