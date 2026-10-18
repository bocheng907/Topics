// 照顧者知識共享 — 文章詳情頁
// 結構：Header（返回 / 更多）→ 內文 → 互動列（按讚、留言數、分享）→ 留言區 → 底部留言輸入框
// 資料讀寫皆走 src/community/api.ts

import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useAuth } from "@/src/auth/useAuth";
import {
  AUTO_HIDE_REPORT_COUNT,
  createComment,
  deleteComment,
  deletePost,
  getComments,
  getPostById,
  hasLikedPost,
  incrementViewCount,
  reportPost,
  togglePostLike,
} from "@/src/community/api";
import Avatar from "@/src/community/components/Avatar";
import CategoryTag from "@/src/community/components/CategoryTag";
import ReportModal from "@/src/community/components/ReportModal";
import { formatRelativeTime } from "@/src/community/format";
import { COMMUNITY_COLORS } from "@/src/community/theme";
import type { Comment, Post, ReportReason } from "@/src/community/types";
import { useCommunityProfile } from "@/src/community/useCommunityProfile";
import { useCommunityRoutes } from "@/src/community/useCommunityRoutes";
import { AppAlert } from "@/src/ui/AppAlert";

/** 單則留言長度上限 */
const COMMENT_MAX_LENGTH = 500;

export default function PostDetailScreen() {
  const routes = useCommunityRoutes();
  const params = useLocalSearchParams<{ id?: string }>();
  const postId = typeof params.id === "string" ? params.id : "";
  const { user } = useAuth();
  const profile = useCommunityProfile();

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");

  const [commentText, setCommentText] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState("");
  /** 全螢幕看圖：目前開啟的圖片網址 */
  const [viewerUrl, setViewerUrl] = useState("");

  /** 讀文章 + 留言 + 自己的按讚狀態，並計算觀看數（24 小時去重） */
  const load = useCallback(async () => {
    if (!postId) {
      setErrorText("找不到這篇文章");
      return;
    }

    try {
      setErrorText("");

      // 先計觀看數再讀文章，這樣畫面上的數字就會包含這一次
      if (user?.uid) {
        try {
          await incrementViewCount(postId, user.uid);
        } catch (error) {
          // 觀看數失敗不該影響閱讀，只記錄不中斷
          console.log("[community] incrementViewCount failed:", error);
        }
      }

      const [loadedPost, loadedComments, likedByMe] = await Promise.all([
        getPostById(postId),
        getComments(postId),
        user?.uid ? hasLikedPost(postId, user.uid) : Promise.resolve(false),
      ]);

      if (!loadedPost) {
        setPost(null);
        setErrorText("這篇文章已被刪除或隱藏");
        return;
      }

      setPost(loadedPost);
      setComments(loadedComments);
      setLiked(likedByMe);
    } catch (error) {
      console.log("[community] load post failed:", error);
      setErrorText("讀取文章失敗，請確認網路後再試");
    }
  }, [postId, user]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        setLoading(true);
        await load();
        if (alive) setLoading(false);
      })();
      return () => {
        alive = false;
      };
    }, [load])
  );

  const handleShare = async () => {
    if (!post) return;
    try {
      await Share.share({
        message: `${post.title}\n\n${post.content}\n\n— 來自 OmniCare 照顧者交流`,
      });
    } catch (error) {
      console.log("分享失敗：", error);
    }
  };

  const handleToggleLike = async () => {
    if (!post || !user?.uid || likeBusy) return;

    // 先更新畫面，失敗再回復，讓按讚有即時回饋
    const previousLiked = liked;
    setLiked(!previousLiked);
    setPost({
      ...post,
      likeCount: post.likeCount + (previousLiked ? -1 : 1),
    });
    setLikeBusy(true);

    try {
      await togglePostLike(post.id, user.uid);
    } catch (error) {
      console.log("[community] toggle like failed:", error);
      setLiked(previousLiked);
      setPost({ ...post, likeCount: post.likeCount });
      AppAlert.alert("操作失敗", "按讚沒有成功，請確認網路後再試");
    } finally {
      setLikeBusy(false);
    }
  };

  const handleSubmitComment = async () => {
    const trimmed = commentText.trim();
    if (!trimmed || !post || !user?.uid || sendingComment) return;

    setSendingComment(true);
    try {
      await createComment({
        postId: post.id,
        content: trimmed,
        authorUid: user.uid,
        authorName: profile.name,
      });

      setCommentText("");
      // 重新讀留言與留言數，確保顯示的是伺服器上的結果
      const [loadedComments, loadedPost] = await Promise.all([
        getComments(post.id),
        getPostById(post.id),
      ]);
      setComments(loadedComments);
      if (loadedPost) setPost(loadedPost);
    } catch (error) {
      console.log("[community] create comment failed:", error);
      AppAlert.alert("留言失敗", "留言沒有送出，請確認網路後再試");
    } finally {
      setSendingComment(false);
    }
  };

  const handleReport = async (reason: ReportReason, detail: string) => {
    if (!post || !user?.uid || reporting) return;

    setReporting(true);
    try {
      const result = await reportPost(post.id, user.uid, reason, detail);
      setReportVisible(false);

      if (result.alreadyReported) {
        // 規則禁止覆寫既有檢舉，所以重複檢舉不會重複累加次數
        AppAlert.alert("已經檢舉過", "你先前已檢舉過這篇文章，我們會持續確認。");
      } else if (result.hidden) {
        AppAlert.alert(
          "檢舉已送出",
          `這篇文章已被檢舉 ${AUTO_HIDE_REPORT_COUNT} 次，系統已自動隱藏。`,
          [{ text: "確定", onPress: () => router.back() }]
        );
      } else {
        AppAlert.alert(
          "檢舉已送出",
          `感謝你的回報，我們會盡快確認。\n原因：${reason}${detail ? `（${detail}）` : ""}`
        );
      }
    } catch (error) {
      console.log("[community] report post failed:", error);
      AppAlert.alert("檢舉失敗", "檢舉沒有送出，請確認網路後再試");
    } finally {
      setReporting(false);
    }
  };

  const handleEditPost = () => {
    if (!post) return;
    router.push(routes.newPost(post.id) as any);
  };

  const handleDeletePost = () => {
    if (!post || deleting) return;

    AppAlert.alert("刪除文章", "確定要刪除這篇文章嗎？刪除後無法復原。", [
      { text: "取消", style: "cancel" },
      {
        text: "刪除",
        style: "destructive",
        onPress: async () => {
          setDeleting(true);
          try {
            await deletePost(post.id, post.imageUrls);
            router.back();
          } catch (error) {
            console.log("[community] delete post failed:", error);
            AppAlert.alert("刪除失敗", "文章沒有刪除，請確認網路後再試");
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  };

  const handleDeleteComment = (comment: Comment) => {
    if (!post || deletingCommentId) return;

    AppAlert.alert("刪除留言", "確定要刪除這則留言嗎？", [
      { text: "取消", style: "cancel" },
      {
        text: "刪除",
        style: "destructive",
        onPress: async () => {
          setDeletingCommentId(comment.id);
          try {
            await deleteComment(post.id, comment.id);
            setComments((current) => current.filter((item) => item.id !== comment.id));
          } catch (error) {
            console.log("[community] delete comment failed:", error);
            AppAlert.alert("刪除失敗", "留言沒有刪除，請確認網路後再試");
          } finally {
            setDeletingCommentId("");
          }
        },
      },
    ]);
  };

  // 載入中
  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color="#111827" />
            <Text style={styles.backText}>返回</Text>
          </Pressable>
        </View>
        <View style={styles.missingWrap}>
          <ActivityIndicator size="large" color={COMMUNITY_COLORS.primary} />
        </View>
      </View>
    );
  }

  // 找不到文章或讀取失敗
  if (!post) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color="#111827" />
            <Text style={styles.backText}>返回</Text>
          </Pressable>
        </View>
        <View style={styles.missingWrap}>
          <Ionicons name="alert-circle-outline" size={48} color="#D1D5DB" />
          <Text style={styles.missingText}>{errorText || "找不到這篇文章"}</Text>
        </View>
      </View>
    );
  }

  const isAuthor = !!user?.uid && user.uid === post.author.uid;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      // Android 走 edge-to-edge，adjustResize 不一定會縮畫面，與聊天室相同改用 height
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color="#111827" />
          <Text style={styles.backText}>返回</Text>
        </Pressable>
        {/* 自己的文章：編輯／刪除；別人的文章：檢舉 */}
        {isAuthor ? (
          <View style={styles.headerActions}>
            <Pressable
              onPress={handleEditPost}
              disabled={deleting}
              style={styles.iconBtn}
              hitSlop={8}
              accessibilityLabel="編輯文章"
            >
              <Ionicons name="create-outline" size={23} color="#111827" />
            </Pressable>
            <Pressable
              onPress={handleDeletePost}
              disabled={deleting}
              style={styles.iconBtn}
              hitSlop={8}
              accessibilityLabel="刪除文章"
            >
              {deleting ? (
                <ActivityIndicator size="small" color={COMMUNITY_COLORS.danger} />
              ) : (
                <Ionicons name="trash-outline" size={22} color={COMMUNITY_COLORS.danger} />
              )}
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={() => setReportVisible(true)} style={styles.iconBtn} hitSlop={8}>
            <Ionicons name="ellipsis-horizontal" size={24} color="#111827" />
          </Pressable>
        )}
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* 內文 */}
        <View style={styles.articleWrap}>
          <CategoryTag category={post.category} />
          <Text style={styles.title}>{post.title}</Text>

          <View style={styles.authorRow}>
            <Avatar name={post.author.name} size={40} />
            <View>
              <Text style={styles.authorName}>{post.author.name}</Text>
              <Text style={styles.postTime}>{formatRelativeTime(post.createdAt)}</Text>
            </View>
          </View>

          <Text style={styles.content}>{post.content}</Text>

          {/* 附圖：點擊放大 */}
          {post.imageUrls.length > 0 ? (
            <View style={styles.imageList}>
              {post.imageUrls.map((url) => (
                <Pressable key={url} onPress={() => setViewerUrl(url)}>
                  <Image
                    source={{ uri: url }}
                    style={styles.postImage}
                    contentFit="cover"
                    transition={200}
                  />
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.divider} />

        {/* 互動列 */}
        <View style={styles.actionRow}>
          <View style={styles.actionLeft}>
            <Pressable
              style={styles.actionBtn}
              onPress={handleToggleLike}
              disabled={likeBusy}
              hitSlop={6}
            >
              <Ionicons
                name={liked ? "heart" : "heart-outline"}
                size={22}
                color={liked ? COMMUNITY_COLORS.heart : COMMUNITY_COLORS.textSecondary}
              />
              <Text style={[styles.actionText, liked && styles.actionTextLiked]}>
                {post.likeCount}
              </Text>
            </Pressable>

            <View style={styles.actionBtn}>
              <Ionicons
                name="chatbubble-outline"
                size={21}
                color={COMMUNITY_COLORS.textSecondary}
              />
              <Text style={styles.actionText}>{comments.length}</Text>
            </View>

            <View style={styles.actionBtn}>
              <Ionicons
                name="eye-outline"
                size={21}
                color={COMMUNITY_COLORS.textSecondary}
              />
              <Text style={styles.actionText}>{post.viewCount}</Text>
            </View>
          </View>

          <Pressable onPress={handleShare} style={styles.iconBtn} hitSlop={6}>
            <Ionicons
              name="share-social-outline"
              size={21}
              color={COMMUNITY_COLORS.textSecondary}
            />
          </Pressable>
        </View>

        <View style={styles.sectionGap} />

        {/* 留言區 */}
        <View style={styles.commentsWrap}>
          <Text style={styles.commentsTitle}>留言 ({comments.length})</Text>

          {comments.length === 0 ? (
            <Text style={styles.noComment}>還沒有人留言，留個言鼓勵一下吧</Text>
          ) : (
            <View style={styles.commentList}>
              {comments.map((comment) => (
                <View key={comment.id} style={styles.commentRow}>
                  <Avatar name={comment.author.name} size={34} />
                  <View style={styles.commentBody}>
                    <View style={styles.commentHeader}>
                      <Text style={styles.commentAuthor}>{comment.author.name}</Text>
                      <Text style={styles.commentTime}>
                        {formatRelativeTime(comment.createdAt)}
                      </Text>
                      {/* 只能刪自己的留言（規則同樣限制） */}
                      {user?.uid && comment.author.uid === user.uid ? (
                        <Pressable
                          onPress={() => handleDeleteComment(comment)}
                          disabled={deletingCommentId !== ""}
                          style={styles.commentDelete}
                          hitSlop={8}
                          accessibilityLabel="刪除留言"
                        >
                          {deletingCommentId === comment.id ? (
                            <ActivityIndicator size="small" color={COMMUNITY_COLORS.textLight} />
                          ) : (
                            <Ionicons
                              name="trash-outline"
                              size={15}
                              color={COMMUNITY_COLORS.textLight}
                            />
                          )}
                        </Pressable>
                      ) : null}
                    </View>
                    <Text style={styles.commentContent}>{comment.content}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* 底部留言輸入框 */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.commentInput}
          placeholder="留個言鼓勵一下吧..."
          placeholderTextColor={COMMUNITY_COLORS.textLight}
          value={commentText}
          onChangeText={setCommentText}
          multiline
          maxLength={COMMENT_MAX_LENGTH}
          editable={!sendingComment}
        />
        <Pressable
          onPress={handleSubmitComment}
          disabled={commentText.trim() === "" || sendingComment}
          style={[
            styles.sendBtn,
            (commentText.trim() === "" || sendingComment) && styles.sendBtnDisabled,
          ]}
        >
          {sendingComment ? (
            <ActivityIndicator size="small" color={COMMUNITY_COLORS.white} />
          ) : (
            <Ionicons name="send" size={18} color={COMMUNITY_COLORS.white} />
          )}
        </Pressable>
      </View>

      <ReportModal
        visible={reportVisible}
        onClose={() => setReportVisible(false)}
        onSubmit={handleReport}
        submitting={reporting}
      />

      {/* 全螢幕看圖 */}
      <Modal
        visible={viewerUrl !== ""}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerUrl("")}
      >
        <Pressable style={styles.viewerOverlay} onPress={() => setViewerUrl("")}>
          {viewerUrl !== "" ? (
            <Image source={{ uri: viewerUrl }} style={styles.viewerImage} contentFit="contain" />
          ) : null}
          <View style={styles.viewerClose}>
            <Ionicons name="close" size={26} color={COMMUNITY_COLORS.white} />
          </View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COMMUNITY_COLORS.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 54,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: COMMUNITY_COLORS.headerBg,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  backText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
  },
  iconBtn: {
    padding: 6,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  imageList: {
    gap: 10,
    marginTop: 4,
  },
  postImage: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: 12,
    backgroundColor: COMMUNITY_COLORS.inputBg,
  },
  viewerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  viewerImage: {
    width: "100%",
    height: "80%",
  },
  viewerClose: {
    position: "absolute",
    top: 54,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  commentDelete: {
    marginLeft: "auto",
    padding: 2,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  articleWrap: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 12,
  },
  title: {
    fontSize: 24,
    lineHeight: 33,
    fontWeight: "800",
    color: COMMUNITY_COLORS.text,
    letterSpacing: 0.3,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 4,
    marginBottom: 8,
  },
  authorName: {
    fontSize: 16,
    fontWeight: "700",
    color: COMMUNITY_COLORS.text,
    marginBottom: 2,
  },
  postTime: {
    fontSize: 13,
    color: COMMUNITY_COLORS.textLight,
    fontWeight: "500",
  },
  content: {
    fontSize: 18,
    lineHeight: 29,
    color: "#374151",
  },
  divider: {
    height: 1,
    backgroundColor: COMMUNITY_COLORS.borderLight,
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 4,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  actionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  actionText: {
    fontSize: 16,
    fontWeight: "600",
    color: COMMUNITY_COLORS.textSecondary,
  },
  actionTextLiked: {
    color: COMMUNITY_COLORS.heart,
  },
  sectionGap: {
    height: 8,
    backgroundColor: COMMUNITY_COLORS.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COMMUNITY_COLORS.borderLight,
    marginTop: 8,
  },
  commentsWrap: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  commentsTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: COMMUNITY_COLORS.text,
    marginBottom: 18,
  },
  noComment: {
    fontSize: 16,
    color: COMMUNITY_COLORS.textLight,
    paddingBottom: 12,
  },
  commentList: {
    gap: 20,
  },
  commentRow: {
    flexDirection: "row",
    gap: 12,
  },
  commentBody: {
    flex: 1,
    gap: 4,
  },
  commentHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  commentAuthor: {
    fontSize: 15,
    fontWeight: "700",
    color: COMMUNITY_COLORS.text,
  },
  commentTime: {
    fontSize: 12,
    color: COMMUNITY_COLORS.textLight,
  },
  commentContent: {
    fontSize: 16,
    lineHeight: 24,
    color: "#374151",
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: COMMUNITY_COLORS.border,
    backgroundColor: COMMUNITY_COLORS.white,
  },
  commentInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 110,
    backgroundColor: COMMUNITY_COLORS.inputBg,
    borderRadius: 21,
    paddingHorizontal: 16,
    paddingTop: 11,
    paddingBottom: 11,
    fontSize: 16,
    color: COMMUNITY_COLORS.text,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COMMUNITY_COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: {
    backgroundColor: "#B0BAC5",
  },
  missingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  missingText: {
    fontSize: 18,
    color: COMMUNITY_COLORS.textSecondary,
    fontWeight: "600",
    textAlign: "center",
    paddingHorizontal: 40,
  },
});
