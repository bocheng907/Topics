const {FieldValue, FieldPath} = require("firebase-admin/firestore");

// Called only after the existing account-deletion grace period has elapsed.
// Preserve other people's replies; erase the departing author's content.
async function purgeCommunityAccount({db, bucket, uid}) {
  const posts = await db.collection("posts").where("authorUid", "==", uid).get();
  for (const post of posts.docs) {
    await db.runTransaction(async (tx) => {
      const fresh = await tx.get(post.ref);
      if (!fresh.exists || fresh.data().authorUid !== uid) return;
      const d = fresh.data();
      tx.set(post.ref, {
        category: d.category || "經驗交流", title: "作者已刪除帳號",
        content: "本文內容已隨作者帳號刪除。", preview: "本文內容已移除。",
        authorUid: "deleted-account", authorName: "已刪除帳號", imageUrls: [],
        createdAt: d.createdAt || FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        status: d.status === "published" ? "published" : "hidden",
        viewCount: d.viewCount || 0, commentCount: d.commentCount || 0,
        likeCount: d.likeCount || 0, reportCount: d.reportCount || 0,
      });
    });
  }
  // Exact account prefix only; never follow user-supplied media URLs.
  await bucket.deleteFiles({prefix: `community_posts/${uid}/`});
  const comments = await db.collectionGroup("comments").where("authorUid", "==", uid).get();
  for (const comment of comments.docs) {
    const parts = comment.ref.path.split("/");
    if (parts.length !== 4 || parts[0] !== "posts" || parts[2] !== "comments") continue;
    await db.runTransaction(async (tx) => {
      const fresh = await tx.get(comment.ref);
      const parent = await tx.get(comment.ref.parent.parent);
      if (!fresh.exists || fresh.data().authorUid !== uid) return;
      tx.delete(comment.ref);
      if (parent.exists) tx.update(parent.ref, {
        commentCount: Math.max(0, Number(parent.data().commentCount || 0) - 1),
      });
    });
  }
  // Tracking IDs are UIDs rather than data fields. Scope every group result.
  let cursor;
  for (;;) {
    let query = db.collection("posts").orderBy(FieldPath.documentId()).limit(200);
    if (cursor) query = query.startAfter(cursor);
    const parents = await query.get();
    for (const post of parents.docs) {
      for (const group of ["likes", "views"]) {
      const ref = post.ref.collection(group).doc(uid);
      await db.runTransaction(async (tx) => {
        const tracking = await tx.get(ref);
        const parent = await tx.get(post.ref);
        if (!tracking.exists) return;
        tx.delete(ref);
        if (group === "likes" && parent.exists) tx.update(parent.ref, {
          likeCount: Math.max(0, Number(parent.data().likeCount || 0) - 1),
        });
      });
      }
    }
    if (parents.size < 200) break;
    cursor = parents.docs[parents.docs.length - 1];
  }
  const reports = await db.collection("reports").where("reporterUid", "==", uid).get();
  for (const report of reports.docs) {
    // Keep moderation totals/hidden status; erase the departing reporter's record.
    await report.ref.delete();
  }
  await db.doc("user_roles/" + uid).delete();
}
module.exports = {purgeCommunityAccount};
