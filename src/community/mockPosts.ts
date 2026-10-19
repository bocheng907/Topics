// 照顧者知識共享 — 第一階段用的假資料
// 內容沿用 Gemini 原型的 10 篇文章，第四階段接上 Firestore 後這個檔案就會刪除

import { buildPreview } from "./format";
import type { Comment, Post } from "./types";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** 用「距今多久」產生時間，讓假資料的相對時間顯示會跟著當下變化 */
const ago = (ms: number) => Date.now() - ms;

type MockPostSeed = Omit<Post, "preview" | "reportCount" | "status" | "imageUrls">;

const SEEDS: MockPostSeed[] = [
  {
    id: "1",
    category: "經驗交流",
    title: "照顧媽媽 5 年了，今天終於哭出來",
    content:
      "看著她越來越不認得我，今天下午餵飯時她突然把碗打翻，我一邊收一邊眼淚就掉下來了。這五年來我辭掉工作全職照顧，雖然有申請長照 2.0，但晚上的時間還是只能靠自己。\n\n我知道這不是她的錯，失智症讓她變成這樣，但真的覺得好累。有人也是這樣熬過來的嗎？",
    author: { uid: "mock-1", name: "陳曉明" },
    createdAt: ago(2 * HOUR),
    viewCount: 1250,
    commentCount: 24,
    likeCount: 85,
    likedByMe: false,
  },
  {
    id: "2",
    category: "照護技巧",
    title: "怎麼幫爸爸翻身不會傷到他的肩膀？",
    content:
      "最近爸爸因為中風長期臥床，出院前護理師有交代要每兩小時翻身一次避免壓瘡。但我發現每次我出力幫他翻身時，他都會喊肩膀痛。\n\n我上網看了幾支影片，好像說要先曲起他的膝蓋，然後推骨盆？請問大家有沒有更實用的技巧或輔具推薦？",
    author: { uid: "mock-2", name: "林太太" },
    createdAt: ago(4 * HOUR),
    viewCount: 842,
    commentCount: 12,
    likeCount: 34,
    likedByMe: true,
  },
  {
    id: "3",
    category: "用品資源",
    title: "南投 XX 藥局的成人尿布真的便宜！",
    content:
      "分享一下，今天去補貨發現這家藥局的包大人（黏貼型，L號）一整箱才賣 1200！老闆說這是每個月的特價活動。如果有在南投市區附近的家屬可以去看看，省下不少耗材費！\n\n他們也有賣一些傷口敷料，價格也算公道。",
    author: { uid: "mock-3", name: "王大衛" },
    createdAt: ago(6 * HOUR),
    viewCount: 1890,
    commentCount: 30,
    likeCount: 120,
    likedByMe: false,
  },
  {
    id: "4",
    category: "照護技巧",
    title: "餵藥時長輩一直吐出來怎麼辦",
    content:
      "阿嬤最近吞嚥功能變差，每次餵藥都像打仗，原來的藥丸吞不下去。我請醫生開粉狀的，加在水裡她又嫌苦不喝。\n\n今天試了加在布丁裡，結果她吃兩口發現有藥味就全吐出來了。請問大家對於抗拒吃藥的長輩都怎麼處理？",
    author: { uid: "mock-4", name: "李小姐" },
    createdAt: ago(12 * HOUR),
    viewCount: 520,
    commentCount: 8,
    likeCount: 21,
    likedByMe: false,
  },
  {
    id: "5",
    category: "用品資源",
    title: "網購看護墊推薦，含連結",
    content:
      "之前因為爸爸會漏尿，晚上常要起來換床單，試過很多牌子的看護墊，不是太薄就是會破。最近在蝦皮買到一款藍色包裝的，真的最吸水又不回滲！\n\n趁著免運活動一次買了三箱，分享給也在為漏尿煩惱的家屬們。",
    author: { uid: "mock-5", name: "阿信" },
    createdAt: ago(1 * DAY),
    viewCount: 3100,
    commentCount: 45,
    likeCount: 210,
    likedByMe: true,
  },
  {
    id: "6",
    category: "經驗交流",
    title: "跟外籍看護溝通的小訣竅",
    content:
      "家裡剛請了印尼籍看護阿蒂，雖然仲介說她會一點中文，但實際上遇到照護細節還是很難溝通。\n\n後來我發現「Google 翻譯的語音功能」加上「親自示範一次並錄影給她看」是最有效的方法！現在她看著影片跟著做，錯誤率降低很多。",
    author: { uid: "mock-6", name: "張先生" },
    createdAt: ago(1 * DAY + 3 * HOUR),
    viewCount: 980,
    commentCount: 15,
    likeCount: 67,
    likedByMe: false,
  },
  {
    id: "7",
    category: "照護技巧",
    title: "臥床長輩的皮膚照護重點",
    content:
      "長照2.0的居服員來洗澡時教我的。臥床長輩因為血液循環差，皮膚很容易脆弱。除了勤翻身，大便後一定要用溫水洗淨擦乾，然後塗上一層薄薄的凡士林或氧化鋅當隔離。\n\n千萬別用力擦拭，用點壓的方式把水分吸乾就好。",
    author: { uid: "mock-7", name: "吳阿姨" },
    createdAt: ago(2 * DAY),
    viewCount: 654,
    commentCount: 5,
    likeCount: 42,
    likedByMe: false,
  },
  {
    id: "8",
    category: "用品資源",
    title: "二手輔具租借的資源整理",
    content:
      "剛開始照顧時什麼都想買新的，後來發現其實很多輪椅、氣墊床不用買，各縣市的「輔具資源中心」都有二手租借服務，而且都有經過專業消毒。\n\n如果有低收或中低收身分，租金甚至可以全免。建議大家要買昂貴輔具前先打電話去問問看！",
    author: { uid: "mock-8", name: "社工小林" },
    createdAt: ago(2 * DAY + 5 * HOUR),
    viewCount: 4200,
    commentCount: 52,
    likeCount: 380,
    likedByMe: true,
  },
  {
    id: "9",
    category: "經驗交流",
    title: "感謝有這個平台，讓我不孤單",
    content:
      "每天晚上照顧完爸爸睡覺後，滑滑大家的文章，才知道原來有這麼多人在經歷一樣的事情。\n\n看到有人生氣、有人崩潰、有人分享好物，覺得這條漫長的照顧路上好像多了一群戰友。謝謝大家無私的分享，我們一起加油！",
    author: { uid: "mock-1", name: "陳曉明" },
    createdAt: ago(3 * DAY),
    viewCount: 1100,
    commentCount: 33,
    likeCount: 156,
    likedByMe: false,
  },
  {
    id: "10",
    category: "照護技巧",
    title: "如何判斷長輩是不是尿道感染？",
    content:
      "分享上次送阿公去急診的經驗。尿道感染不一定會馬上發燒，如果有發現長輩突然變得很躁動、尿液味道變重、或是尿布上的顏色變深，就有可能是感染了。\n\n醫生說平常一定要多鼓勵喝水，如果吞嚥不好可以把水稍微增稠。",
    author: { uid: "mock-9", name: "黃護理師" },
    createdAt: ago(4 * DAY),
    viewCount: 890,
    commentCount: 9,
    likeCount: 72,
    likedByMe: false,
  },
];

export const MOCK_POSTS: Post[] = SEEDS.map((seed) => ({
  ...seed,
  preview: buildPreview(seed.content),
  imageUrls: [],
  reportCount: 0,
  status: "published",
}));

export const MOCK_COMMENTS: Comment[] = [
  {
    id: "c1",
    postId: "1",
    author: { uid: "mock-2", name: "林太太" },
    content: "我懂這種感覺，真的辛苦你了。你要記得先照顧好自己，找喘息服務幫忙。",
    createdAt: ago(1 * HOUR),
    likeCount: 4,
  },
  {
    id: "c2",
    postId: "1",
    author: { uid: "mock-3", name: "王大衛" },
    content: "拍拍你，我照顧失智父親 3 年，他現在連我都打。真的很累，但我們只能盡力。",
    createdAt: ago(45 * MINUTE),
    likeCount: 2,
  },
  {
    id: "c3",
    postId: "1",
    author: { uid: "mock-4", name: "李小姐" },
    content: "如果不介意，可以去參加家屬支持團體，說出來心裡會好過很多。",
    createdAt: ago(20 * MINUTE),
    likeCount: 1,
  },
];

/** 依 id 取得假文章，找不到回傳 null（詳情頁防呆用） */
export function findMockPost(id: string): Post | null {
  return MOCK_POSTS.find((post) => post.id === id) ?? null;
}

/** 取得某篇文章的假留言 */
export function findMockComments(postId: string): Comment[] {
  return MOCK_COMMENTS.filter((comment) => comment.postId === postId);
}
