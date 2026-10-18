import { after, before, beforeEach, describe, test } from "node:test";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import {
  collection, deleteDoc, doc, getDoc, getDocs, increment, orderBy, query, runTransaction, serverTimestamp,
  setDoc, Timestamp, updateDoc, where, writeBatch,
} from "firebase/firestore";
import { authed, createEnv, seedUser, uid } from "./helpers.mjs";

const FAM = uid("family");
const AG = uid("agency");
const CG = uid("caregiver");
const OTHER = uid("otherfamily");
const POST = "2026-10-18_10-00-00-000_post_family00";
const IMG = "https://firebasestorage.googleapis.com/v0/b/x/o/community_posts%2Fa.jpg?alt=media";

let env;
before(async () => { env = await createEnv(); });
after(async () => { await env?.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await seedUser(env, FAM, "family");
  await seedUser(env, AG, "agency");
  await seedUser(env, CG, "caregiver");
  await seedUser(env, OTHER, "family");
});

/** Same payload as src/community/api.ts createPost. */
function newPost(author, extra = {}) {
  return {
    category: "照護技巧", title: "翻身技巧", content: "每兩小時翻身一次", preview: "每兩小時翻身一次",
    authorUid: author, authorName: "王小明", createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    viewCount: 0, commentCount: 0, likeCount: 0, reportCount: 0, status: "published", imageUrls: [], ...extra,
  };
}

async function seedPost(author = FAM, extra = {}) {
  await assertSucceeds(setDoc(doc(authed(env, author), "posts", POST), newPost(author, extra)));
}

const reportId = (postId, reporter) => `${postId}_by_${reporter}`;

function report(db, reporter) {
  return runTransaction(db, async (tx) => {
    const postRef = doc(db, "posts", POST);
    const snap = await tx.get(postRef);
    const next = Number(snap.data().reportCount ?? 0) + 1;
    tx.set(doc(db, "reports", reportId(POST, reporter)), {
      postId: POST, reporterUid: reporter, reason: "其他", detail: "", createdAt: serverTimestamp(),
    });
    tx.update(postRef, { reportCount: increment(1), ...(next >= 3 ? { status: "hidden" } : {}) });
  });
}

describe("posts", () => {
  test("family and agency post with images and their own role label; old posts without it still read", async () => {
    await assertSucceeds(setDoc(doc(authed(env, FAM), "posts", POST),
      newPost(FAM, { imageUrls: [IMG, IMG], authorRole: "family" })));
    await assertSucceeds(setDoc(doc(authed(env, AG), "posts", "agency_post"), newPost(AG, { authorRole: "agency" })));
    await assertSucceeds(setDoc(doc(authed(env, OTHER), "posts", "legacy_post"), newPost(OTHER)));
    const feed = await assertSucceeds(getDocs(query(collection(authed(env, AG), "posts"),
      where("status", "==", "published"), orderBy("viewCount", "desc"))));
    if (feed.size !== 3) throw new Error(`expected 3 posts, got ${feed.size}`);
    await assertSucceeds(getDocs(query(collection(authed(env, FAM), "posts"),
      where("status", "==", "published"), where("createdAt", ">=", Timestamp.fromMillis(0)),
      orderBy("createdAt", "desc"))));
    await assertSucceeds(getDocs(query(collection(authed(env, FAM), "posts"), where("authorUid", "==", FAM))));
  });

  test("role label must match the author's real role; too many images denied", async () => {
    await assertFails(setDoc(doc(authed(env, FAM), "posts", POST), newPost(FAM, { authorRole: "agency" })));
    await assertFails(setDoc(doc(authed(env, AG), "posts", POST), newPost(AG, { authorRole: "family" })));
    await assertFails(setDoc(doc(authed(env, FAM), "posts", POST), newPost(FAM, { authorRole: "caregiver" })));
    await assertFails(setDoc(doc(authed(env, FAM), "posts", POST),
      newPost(FAM, { imageUrls: [IMG, IMG, IMG, IMG, IMG] })));
  });

  test("caregiver cannot read or write the community", async () => {
    await seedPost();
    await assertFails(setDoc(doc(authed(env, CG), "posts", "cg_post"), newPost(CG)));
    await assertFails(getDoc(doc(authed(env, CG), "posts", POST)));
    await assertFails(getDocs(collection(authed(env, CG), "posts", POST, "comments")));
  });

  test("author edits content; cannot touch counters or status; others cannot edit", async () => {
    await seedPost(FAM, { authorRole: "family" });
    const fam = authed(env, FAM);
    await assertSucceeds(updateDoc(doc(fam, "posts", POST), {
      category: "經驗交流", title: "新標題", content: "新內容", preview: "新內容", imageUrls: [IMG],
      updatedAt: serverTimestamp(),
    }));
    await assertFails(updateDoc(doc(fam, "posts", POST), { likeCount: 99 }));
    await assertFails(updateDoc(doc(fam, "posts", POST), { status: "published", reportCount: 0 }));
    await assertFails(updateDoc(doc(authed(env, OTHER), "posts", POST), {
      title: "亂改", updatedAt: serverTimestamp(),
    }));
  });

  test("only the author deletes", async () => {
    await seedPost();
    await assertFails(deleteDoc(doc(authed(env, OTHER), "posts", POST)));
    await assertSucceeds(deleteDoc(doc(authed(env, FAM), "posts", POST)));
  });
});

describe("likes, views, comments, reports", () => {
  beforeEach(async () => { await seedPost(); });

  test("like / unlike batches; bare counter changes are denied", async () => {
    const db = authed(env, OTHER);
    const likeRef = doc(db, "posts", POST, "likes", OTHER);
    let batch = writeBatch(db);
    batch.set(likeRef, { createdAt: serverTimestamp() });
    batch.update(doc(db, "posts", POST), { likeCount: increment(1) });
    await assertSucceeds(batch.commit());
    await assertSucceeds(getDoc(likeRef));
    await assertFails(updateDoc(doc(db, "posts", POST), { likeCount: increment(1) }));
    batch = writeBatch(db);
    batch.delete(likeRef);
    batch.update(doc(db, "posts", POST), { likeCount: increment(-1) });
    await assertSucceeds(batch.commit());
    await assertFails(updateDoc(doc(db, "posts", POST), { likeCount: increment(-1) }));
    await assertFails(getDoc(doc(db, "posts", POST, "likes", FAM)));
  });

  test("view batch counts; bare view bump denied", async () => {
    const db = authed(env, AG);
    const batch = writeBatch(db);
    batch.set(doc(db, "posts", POST, "views", AG), { lastViewedAt: serverTimestamp() });
    batch.update(doc(db, "posts", POST), { viewCount: increment(1) });
    await assertSucceeds(batch.commit());
    await assertFails(updateDoc(doc(db, "posts", POST), { viewCount: increment(1) }));
  });

  test("comment with role label + counter; only the commenter deletes", async () => {
    const db = authed(env, AG);
    const commentRef = doc(db, "posts", POST, "comments", "2026-10-18_10-01-00-000_comment_agency00");
    let batch = writeBatch(db);
    batch.set(commentRef, {
      postId: POST, content: "謝謝分享", authorUid: AG, authorName: "仲介小美", createdAt: serverTimestamp(),
      likeCount: 0, authorRole: "agency",
    });
    batch.update(doc(db, "posts", POST), { commentCount: increment(1) });
    await assertSucceeds(batch.commit());
    await assertSucceeds(getDocs(query(collection(authed(env, FAM), "posts", POST, "comments"),
      orderBy("createdAt", "asc"))));
    await assertFails(setDoc(doc(db, "posts", POST, "comments", "c2"), {
      postId: POST, content: "x", authorUid: AG, authorName: "x", createdAt: serverTimestamp(), likeCount: 0,
      authorRole: "family",
    }));
    await assertFails(deleteDoc(doc(authed(env, FAM), "posts", POST, "comments",
      "2026-10-18_10-01-00-000_comment_agency00")));
    batch = writeBatch(db);
    batch.delete(commentRef);
    batch.update(doc(db, "posts", POST), { commentCount: increment(-1) });
    await assertSucceeds(batch.commit());
  });

  test("report transaction; duplicates and bare report bumps denied; 3 reports hide", async () => {
    await assertSucceeds(report(authed(env, OTHER), OTHER));
    await assertFails(report(authed(env, OTHER), OTHER));
    await assertFails(updateDoc(doc(authed(env, OTHER), "posts", POST), { reportCount: increment(1) }));
    await assertFails(updateDoc(doc(authed(env, OTHER), "posts", POST),
      { reportCount: increment(1), status: "hidden" }));
    await assertFails(setDoc(doc(authed(env, AG), "reports", reportId(POST, OTHER)), {
      postId: POST, reporterUid: AG, reason: "其他", detail: "", createdAt: serverTimestamp(),
    }));
    await assertSucceeds(report(authed(env, AG), AG));
    await assertSucceeds(report(authed(env, FAM), FAM));
    const snap = await env.withSecurityRulesDisabled(async (ctx) => {
      const s = await getDoc(doc(ctx.firestore(), "posts", POST));
      if (s.data().status !== "hidden") throw new Error("post should be hidden after 3 reports");
    });
    void snap;
    await assertFails(getDoc(doc(authed(env, FAM), "reports", reportId(POST, FAM))));
  });
});
