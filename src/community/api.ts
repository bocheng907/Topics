// 照顧者知識共享 — Firestore 操作層
// 所有社群資料的讀寫都集中在這裡，畫面只呼叫這些函式，不直接碰 Firestore

import { db } from "@/firebase/firebaseConfig";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit as fsLimit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

import {
  makeCommunityCommentDocumentId,
  makeCommunityPostDocumentId,
  makeCommunityReportDocumentId,
} from "@/src/data/firestoreDocumentIds";
import { buildPreview } from "./format";
import { deletePostImages, MAX_POST_IMAGES } from "./imageUpload";
import type {
  CategoryFilter,
  Comment,
  Post,
  PostCategory,
  ReportReason,
} from "./types";

export const POSTS_COLLECTION = "posts";
const COMMENTS_SUBCOLLECTION = "comments";
const LIKES_SUBCOLLECTION = "likes";
const VIEWS_SUBCOLLECTION = "views";
const REPORTS_COLLECTION = "reports";

/** 檢舉達到這個次數，文章自動隱藏（規劃書 4-1） */
export const AUTO_HIDE_REPORT_COUNT = 3;
/** 文章不存在時的錯誤訊息，畫面可用它分辨是不是被刪除 */
const POST_NOT_FOUND = "找不到這篇文章";
/** 同一使用者對同一篇文章，這段時間內只計一次觀看（規劃書 3-3） */
const VIEW_DEDUPE_MS = 24 * 60 * 60 * 1000;
/** 列表單次最多撈幾筆，避免資料量成長後一次讀太多 */
const LIST_PAGE_SIZE = 60;
/** 本週熱門的時間範圍 */
const HOT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

// ─────────────────────────────────────────
// 轉換工具
// ─────────────────────────────────────────

/** Firestore Timestamp 轉成 epoch 毫秒；serverTimestamp 回填前會是 null，先用現在時間頂著 */
function toMillis(value: unknown): number {
  if (value instanceof Timestamp) return value.toMillis();
  if (value && typeof (value as { toMillis?: unknown }).toMillis === "function") {
    return (value as Timestamp).toMillis();
  }
  if (typeof value === "number") return value;
  return Date.now();
}

function toPost(id: string, data: Record<string, unknown>): Post {
  return {
    id,
    category: (data.category ?? "經驗交流") as PostCategory,
    title: String(data.title ?? ""),
    content: String(data.content ?? ""),
    preview: String(data.preview ?? ""),
    author: {
      uid: String(data.authorUid ?? ""),
      name: String(data.authorName ?? "照顧者"),
    },
    createdAt: toMillis(data.createdAt),
    viewCount: Number(data.viewCount ?? 0),
    commentCount: Number(data.commentCount ?? 0),
    likeCount: Number(data.likeCount ?? 0),
    imageUrls: Array.isArray(data.imageUrls) ? data.imageUrls.map(String) : [],
    reportCount: Number(data.reportCount ?? 0),
    status: data.status === "hidden" ? "hidden" : "published",
  };
}

function toComment(postId: string, id: string, data: Record<string, unknown>): Comment {
  return {
    id,
    postId,
    author: {
      uid: String(data.authorUid ?? ""),
      name: String(data.authorName ?? "照顧者"),
    },
    content: String(data.content ?? ""),
    createdAt: toMillis(data.createdAt),
    likeCount: Number(data.likeCount ?? 0),
  };
}

// ─────────────────────────────────────────
// 文章
// ─────────────────────────────────────────

export type CreatePostInput = {
  /** 預先產生的文章 ID；圖片要先上傳到這篇文章的資料夾，所以 ID 需要在寫入前就決定 */
  postId?: string;
  category: PostCategory;
  title: string;
  content: string;
  authorUid: string;
  authorName: string;
  imageUrls?: string[];
};

/** 產生新文章 ID（發文頁先拿 ID 上傳圖片，再呼叫 createPost） */
export function newPostId(authorUid: string): string {
  return makeCommunityPostDocumentId(authorUid);
}

/** 發文，回傳新文章的 ID */
export async function createPost(input: CreatePostInput): Promise<string> {
  const postId = input.postId || makeCommunityPostDocumentId(input.authorUid);

  await setDoc(doc(db, POSTS_COLLECTION, postId), {
    category: input.category,
    title: input.title.trim(),
    content: input.content.trim(),
    preview: buildPreview(input.content),
    authorUid: input.authorUid,
    authorName: input.authorName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    viewCount: 0,
    commentCount: 0,
    likeCount: 0,
    reportCount: 0,
    status: "published",
    imageUrls: (input.imageUrls ?? []).slice(0, MAX_POST_IMAGES),
  });

  return postId;
}

export type UpdatePostInput = {
  category: PostCategory;
  title: string;
  content: string;
  imageUrls: string[];
};

/** 作者編輯自己的文章（規則只允許改內容相關欄位，計數器與狀態不可動） */
export async function updatePost(postId: string, input: UpdatePostInput): Promise<void> {
  await updateDoc(doc(db, POSTS_COLLECTION, postId), {
    category: input.category,
    title: input.title.trim(),
    content: input.content.trim(),
    preview: buildPreview(input.content),
    imageUrls: input.imageUrls.slice(0, MAX_POST_IMAGES),
    updatedAt: serverTimestamp(),
  });
}

/**
 * 取得文章列表（預設依觀看數排序）
 * Firestore 不支援子字串查詢，關鍵字過濾在前端做
 */
export async function getPosts(options?: {
  category?: CategoryFilter;
  keyword?: string;
}): Promise<Post[]> {
  const snap = await getDocs(
    query(
      collection(db, POSTS_COLLECTION),
      where("status", "==", "published"),
      orderBy("viewCount", "desc"),
      fsLimit(LIST_PAGE_SIZE)
    )
  );

  let posts = snap.docs.map((d) => toPost(d.id, d.data()));

  const category = options?.category;
  if (category && category !== "全部") {
    posts = posts.filter((post) => post.category === category);
  }

  const keyword = options?.keyword?.trim();
  if (keyword) {
    posts = posts.filter(
      (post) => post.title.includes(keyword) || post.content.includes(keyword)
    );
  }

  return posts;
}

/**
 * 本週熱門：近 7 天的文章取觀看數前 N 名
 * Firestore 規定有範圍條件的欄位必須是第一個排序欄位，
 * 所以先依 createdAt 撈近 7 天，再在前端依觀看數排序
 */
export async function getHotPosts(topN = 5): Promise<Post[]> {
  const since = Timestamp.fromMillis(Date.now() - HOT_WINDOW_MS);

  const snap = await getDocs(
    query(
      collection(db, POSTS_COLLECTION),
      where("status", "==", "published"),
      where("createdAt", ">=", since),
      orderBy("createdAt", "desc"),
      fsLimit(LIST_PAGE_SIZE)
    )
  );

  return snap.docs
    .map((d) => toPost(d.id, d.data()))
    .sort((a, b) => b.viewCount - a.viewCount)
    .slice(0, topN);
}

/**
 * 取得單篇文章，找不到回傳 null
 * 預設已隱藏的文章也回傳 null；編輯自己的文章時傳 includeHidden 才拿得到
 */
export async function getPostById(
  postId: string,
  options?: { includeHidden?: boolean }
): Promise<Post | null> {
  const snap = await getDoc(doc(db, POSTS_COLLECTION, postId));
  if (!snap.exists()) return null;

  const post = toPost(snap.id, snap.data());
  if (post.status === "hidden" && !options?.includeHidden) return null;
  return post;
}

/**
 * 我的文章：只用 authorUid 等值查詢、在前端依發文時間排序，
 * 不需要另外建立複合索引；包含被檢舉隱藏的文章，讓作者知道狀態
 */
export async function getMyPosts(uid: string): Promise<Post[]> {
  if (!uid) return [];

  const snap = await getDocs(
    query(collection(db, POSTS_COLLECTION), where("authorUid", "==", uid))
  );

  return snap.docs
    .map((d) => toPost(d.id, d.data()))
    .sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * 刪除自己的文章（規則只允許作者本人）
 * 先刪文件、再盡力清掉 Storage 上的圖片；
 * 留言、按讚、觀看紀錄等子集合用戶端無權（也無法一次）刪除，會留在資料庫成為孤兒資料，
 * 但文章文件不存在後畫面上就讀不到它們
 */
export async function deletePost(postId: string, imageUrls: string[] = []): Promise<void> {
  await deleteDoc(doc(db, POSTS_COLLECTION, postId));
  if (imageUrls.length > 0) {
    await deletePostImages(imageUrls);
  }
}

// ─────────────────────────────────────────
// 社群顯示用的個人資料
// ─────────────────────────────────────────

export type CommunityProfile = {
  name: string;
  avatarUrl: string;
};

/** 依 email 推出的預設顯示名稱 */
export function fallbackDisplayName(email?: string | null): string {
  return email?.split("@")[0] || "照顧者";
}

/**
 * 讀取目前使用者在 users 集合的顯示名稱與頭像
 * users 的文件 ID 是自訂格式，只能用 uid 查詢（與 AuthProvider 相同作法）
 */
export async function getCommunityProfile(
  uid: string,
  email?: string | null
): Promise<CommunityProfile> {
  const fallback = { name: fallbackDisplayName(email), avatarUrl: "" };
  if (!uid) return fallback;

  const snap = await getDocs(
    query(collection(db, "users"), where("uid", "==", uid), fsLimit(1))
  );
  if (snap.empty) return fallback;

  const data = snap.docs[0].data();
  const displayName = typeof data.displayName === "string" ? data.displayName.trim() : "";
  const avatarUrl = typeof data.avatarUrl === "string" ? data.avatarUrl.trim() : "";

  return {
    name: displayName || fallback.name,
    avatarUrl: /^https?:\/\//.test(avatarUrl) ? avatarUrl : "",
  };
}

// ─────────────────────────────────────────
// 觀看數（24 小時去重）
// ─────────────────────────────────────────

/**
 * 計算觀看數：同一使用者對同一篇文章 24 小時內只算一次
 * 回傳這次是否真的增加了觀看數
 */
export async function incrementViewCount(
  postId: string,
  userId: string
): Promise<boolean> {
  const viewRef = doc(db, POSTS_COLLECTION, postId, VIEWS_SUBCOLLECTION, userId);
  const viewSnap = await getDoc(viewRef);

  if (viewSnap.exists()) {
    const lastViewedAt = toMillis(viewSnap.data()?.lastViewedAt);
    if (Date.now() - lastViewedAt < VIEW_DEDUPE_MS) {
      return false;
    }
  }

  // 觀看紀錄與計數器一起寫，避免只成功一半
  const batch = writeBatch(db);
  batch.set(viewRef, { lastViewedAt: serverTimestamp() });
  batch.update(doc(db, POSTS_COLLECTION, postId), { viewCount: increment(1) });
  await batch.commit();

  return true;
}

// ─────────────────────────────────────────
// 按讚
// ─────────────────────────────────────────

/** 查詢目前使用者是否已對這篇文章按讚 */
export async function hasLikedPost(postId: string, userId: string): Promise<boolean> {
  const snap = await getDoc(
    doc(db, POSTS_COLLECTION, postId, LIKES_SUBCOLLECTION, userId)
  );
  return snap.exists();
}

/**
 * 切換按讚狀態（文件 ID 就是 uid，一人一讚由結構本身保證）
 * 回傳切換後是否為已按讚
 */
export async function togglePostLike(
  postId: string,
  userId: string
): Promise<boolean> {
  const likeRef = doc(db, POSTS_COLLECTION, postId, LIKES_SUBCOLLECTION, userId);
  const liked = (await getDoc(likeRef)).exists();

  const batch = writeBatch(db);
  if (liked) {
    batch.delete(likeRef);
    batch.update(doc(db, POSTS_COLLECTION, postId), { likeCount: increment(-1) });
  } else {
    batch.set(likeRef, { createdAt: serverTimestamp() });
    batch.update(doc(db, POSTS_COLLECTION, postId), { likeCount: increment(1) });
  }
  await batch.commit();

  return !liked;
}

// ─────────────────────────────────────────
// 留言
// ─────────────────────────────────────────

export async function getComments(postId: string): Promise<Comment[]> {
  const snap = await getDocs(
    query(
      collection(db, POSTS_COLLECTION, postId, COMMENTS_SUBCOLLECTION),
      orderBy("createdAt", "asc")
    )
  );

  return snap.docs.map((d) => toComment(postId, d.id, d.data()));
}

export type CreateCommentInput = {
  postId: string;
  content: string;
  authorUid: string;
  authorName: string;
};

/** 新增留言，同時把文章的留言數 +1 */
export async function createComment(input: CreateCommentInput): Promise<string> {
  const commentId = makeCommunityCommentDocumentId(input.authorUid);

  const batch = writeBatch(db);
  batch.set(
    doc(db, POSTS_COLLECTION, input.postId, COMMENTS_SUBCOLLECTION, commentId),
    {
      postId: input.postId,
      content: input.content.trim(),
      authorUid: input.authorUid,
      authorName: input.authorName,
      createdAt: serverTimestamp(),
      likeCount: 0,
    }
  );
  batch.update(doc(db, POSTS_COLLECTION, input.postId), {
    commentCount: increment(1),
  });
  await batch.commit();

  return commentId;
}

/** 刪除自己的留言（規則只允許留言作者本人） */
export async function deleteComment(postId: string, commentId: string): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, POSTS_COLLECTION, postId, COMMENTS_SUBCOLLECTION, commentId));
  batch.update(doc(db, POSTS_COLLECTION, postId), { commentCount: increment(-1) });
  await batch.commit();
}

// ─────────────────────────────────────────
// 檢舉
// ─────────────────────────────────────────

export type ReportPostResult = {
  /** 這次檢舉後累積的次數 */
  reportCount: number;
  /** 是否因此被自動隱藏 */
  hidden: boolean;
  /** 是否因為已經檢舉過而沒有再累加 */
  alreadyReported: boolean;
};

/**
 * 檢舉文章
 * 文件 ID 為 {postId}_by_{uid 尾碼}，Security Rules 禁止更新既有的檢舉文件，
 * 所以同一人重複檢舉會讓整筆交易失敗、次數不會被重複累加
 * 累積達 AUTO_HIDE_REPORT_COUNT 次時，一併把文章轉為 hidden
 */
export async function reportPost(
  postId: string,
  userId: string,
  reason: ReportReason,
  detail = ""
): Promise<ReportPostResult> {
  const reportRef = doc(db, REPORTS_COLLECTION, makeCommunityReportDocumentId(postId, userId));
  const postRef = doc(db, POSTS_COLLECTION, postId);

  try {
    // 用交易讀取檢舉數，避免多人同時檢舉時算出錯誤的累積次數
    return await runTransaction(db, async (tx) => {
      const postSnap = await tx.get(postRef);
      if (!postSnap.exists()) {
        throw new Error(POST_NOT_FOUND);
      }

      const nextCount = Number(postSnap.data()?.reportCount ?? 0) + 1;
      const shouldHide = nextCount >= AUTO_HIDE_REPORT_COUNT;

      tx.set(reportRef, {
        postId,
        reporterUid: userId,
        reason,
        detail,
        createdAt: serverTimestamp(),
      });
      tx.update(postRef, {
        reportCount: increment(1),
        ...(shouldHide ? { status: "hidden" } : {}),
      });

      return { reportCount: nextCount, hidden: shouldHide, alreadyReported: false };
    });
  } catch (error) {
    // 一般使用者讀不到 reports，無法事先檢查是否檢舉過；
    // 規則擋下重複檢舉時會回 permission-denied，這裡轉成「已檢舉過」讓畫面提示使用者
    if ((error as { code?: string })?.code === "permission-denied") {
      return { reportCount: 0, hidden: false, alreadyReported: true };
    }
    throw error;
  }
}
