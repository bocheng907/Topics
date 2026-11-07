// 照顧者知識共享 — 共用型別定義
// 第三階段接 Firestore 時，這裡的型別會直接對應 collection 的欄位

/** 三大固定分類，不開放使用者自建（避免內容失控） */
export type PostCategory = "照護技巧" | "用品資源" | "經驗交流";

/** 文章狀態：published 正常顯示、hidden 被檢舉滿 3 次後自動隱藏 */
export type PostStatus = "published" | "hidden";

/** 發文者身分標籤（家屬／仲介）；舊文章沒有這個欄位 */
export type CommunityAuthorRole = "family" | "agency";

/** 發文者的精簡資料，直接存在文章上，避免列表每一篇都要再讀一次 users */
export type PostAuthor = {
  uid: string;
  name: string;
  /** 舊文章、舊留言沒有存身分，顯示時就不出現標籤 */
  role?: CommunityAuthorRole;
  /** 發文／留言當下存的頭像網址；舊資料沒有，顯示時退回字首頭像 */
  avatarUrl?: string;
};

export type Post = {
  id: string;
  category: PostCategory;
  title: string;
  content: string;
  /** 列表用的摘要，發文時由內容自動截取前幾十個字 */
  preview: string;
  author: PostAuthor;
  /** 發文時間（epoch 毫秒）；接 Firestore 後由 Timestamp 轉換而來 */
  createdAt: number;
  viewCount: number;
  commentCount: number;
  likeCount: number;
  imageUrls: string[];
  reportCount: number;
  status: PostStatus;
  /** 目前登入者是否已按讚（前端依按讚紀錄推算，不存在文章文件上） */
  likedByMe?: boolean;
};

export type Comment = {
  id: string;
  postId: string;
  author: PostAuthor;
  content: string;
  createdAt: number;
  likeCount: number;
  likedByMe?: boolean;
};

/** 檢舉原因；選「其他」時必須另外填寫說明 */
export type ReportReason =
  | "廣告或垃圾訊息"
  | "攻擊性言論"
  | "醫療謠言或錯誤資訊"
  | "涉及個人隱私"
  | "其他";

/** 列表排序方式：hot 依觀看數（預設）、latest 依發文時間 */
export type SortOption = "hot" | "latest";

/** 分類切換用；"全部" 只是篩選條件，不是真正的分類 */
export type CategoryFilter = "全部" | PostCategory;
