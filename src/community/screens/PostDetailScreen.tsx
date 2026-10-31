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
  communityAuthorRole,
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
import AuthorRoleBadge from "@/src/community/components/AuthorRoleBadge";
import Avatar from "@/src/community/components/Avatar";
import CategoryTag from "@/src/community/components/CategoryTag";
import ReportModal from "@/src/community/components/ReportModal";
import { formatRelativeTime } from "@/src/community/format";
import type { Comment, Post, ReportReason } from "@/src/community/types";
import { useCommunityProfile } from "@/src/community/useCommunityProfile";
import { useCommunityRoutes } from "@/src/community/useCommunityRoutes";
import { communityCopy, communityReasonLabel } from "@/src/i18n/copy/communityCopy";
import { useLanguage } from "@/src/store/LanguageContext";
import { AppAlert } from "@/src/ui/AppAlert";
import { AppHeader, EmptyState, IconButton } from "@/src/ui/components";
import { colors, layout, radii, spacing, typography } from "@/src/ui/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** 讀取失敗的原因（畫面上依語言顯示） */
type LoadError = "" | "notFound" | "gone" | "failed";

/** 單則留言長度上限 */
const COMMENT_MAX_LENGTH = 500;

export default function PostDetailScreen() {
  const routes = useCommunityRoutes();
  const params = useLocalSearchParams<{ id?: string }>();
  const postId = typeof params.id === "string" ? params.id : "";
  const { user } = useAuth();
  const profile = useCommunityProfile();
  const { language } = useLanguage();
  const c = communityCopy[language];
  const insets = useSafeAreaInsets();

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<LoadError>("");

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
      setLoadError("notFound");
      return;
    }

    try {
      setLoadError("");

      // 先計觀看數再讀文章，這樣畫面上的數字就會包含這一次
      if (user?.uid) {
        try {
          await incrementViewCount(postId, user.uid);
        } catch (error) {
          // 觀看數失敗不該影響閱讀，只記錄不中斷
          console.log("[community] incrementViewCount failed:", error);
        }
      }

      const loadedPost = await getPostById(postId, { includeHidden: true });

      if (!loadedPost) {
        setPost(null);
        setComments([]);
        setViewerUrl("");
        setLoadError("gone");
        return;
      }

      const [loadedComments, likedByMe] = await Promise.all([
        getComments(postId),
        user?.uid ? hasLikedPost(postId, user.uid) : Promise.resolve(false),
      ]);

      setPost(loadedPost);
      setComments(loadedComments);
      setLiked(likedByMe);
    } catch (error) {
      setPost(null);
      setComments([]);
      setViewerUrl("");
      console.log("[community] load post failed:", error);
      setLoadError("failed");
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
    if (!post || post.status !== "published") return;
    try {
      await Share.share({
        message: `${post.title}\n\n${post.content}\n\n${c.shareSuffix}`,
      });
    } catch (error) {
      console.log("分享失敗：", error);
    }
  };

  const handleToggleLike = async () => {
    if (!post || post.status !== "published" || !user?.uid || likeBusy) return;

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
      AppAlert.alert(c.actionFailedTitle, c.likeFailed);
    } finally {
      setLikeBusy(false);
    }
  };

  const handleSubmitComment = async () => {
    const trimmed = commentText.trim();
    if (!trimmed || !post || post.status !== "published" || !user?.uid || sendingComment) return;

    setSendingComment(true);
    try {
      await createComment({
        postId: post.id,
        content: trimmed,
        authorUid: user.uid,
        authorName: profile.name,
        authorRole: communityAuthorRole(user.role),
        authorAvatarUrl: profile.avatarUrl,
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
      AppAlert.alert(c.commentFailedTitle, c.commentFailedBody);
    } finally {
      setSendingComment(false);
    }
  };

  const handleReport = async (reason: ReportReason, detail: string) => {
    if (!post || post.status !== "published" || !user?.uid || reporting) return;

    setReporting(true);
    try {
      const result = await reportPost(post.id, user.uid, reason, detail);
      setReportVisible(false);

      if (result.alreadyReported) {
        // 規則禁止覆寫既有檢舉，所以重複檢舉不會重複累加次數
        AppAlert.alert(c.alreadyReportedTitle, c.alreadyReportedBody);
      } else if (result.hidden) {
        AppAlert.alert(
          c.reportSentTitle,
          c.reportAutoHidden(AUTO_HIDE_REPORT_COUNT),
          [{ text: c.ok, onPress: () => router.back() }]
        );
      } else {
        AppAlert.alert(
          c.reportSentTitle,
          c.reportThanks(`${communityReasonLabel(c, reason)}${detail ? `（${detail}）` : ""}`)
        );
      }
    } catch (error) {
      console.log("[community] report post failed:", error);
      AppAlert.alert(c.reportFailedTitle, c.reportFailedBody);
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

    AppAlert.alert(c.deletePostTitle, c.deletePostConfirm, [
      { text: c.cancel, style: "cancel" },
      {
        text: c.delete,
        style: "destructive",
        onPress: async () => {
          setDeleting(true);
          try {
            await deletePost(post.id, post.imageUrls);
            router.back();
          } catch (error) {
            console.log("[community] delete post failed:", error);
            AppAlert.alert(c.deleteFailedTitle, c.deletePostFailed);
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  };

  const handleDeleteComment = (comment: Comment) => {
    if (!post || post.status !== "published" || deletingCommentId) return;

    AppAlert.alert(c.deleteCommentTitle, c.deleteCommentConfirm, [
      { text: c.cancel, style: "cancel" },
      {
        text: c.delete,
        style: "destructive",
        onPress: async () => {
          setDeletingCommentId(comment.id);
          try {
            await deleteComment(post.id, comment.id);
            setComments((current) => current.filter((item) => item.id !== comment.id));
          } catch (error) {
            console.log("[community] delete comment failed:", error);
            AppAlert.alert(c.deleteFailedTitle, c.deleteCommentFailed);
          } finally {
            setDeletingCommentId("");
          }
        },
      },
    ]);
  };

  const loadErrorText =
    loadError === "gone" ? c.postGone : loadError === "failed" ? c.postLoadFailed : c.postNotFound;

  // 載入中
  if (loading) {
    return (
      <View style={styles.container}>
        <AppHeader title={c.feedTitle} left="back" fallbackHref={routes.feed as any} />
        <View style={styles.missingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  // 找不到文章或讀取失敗
  if (!post) {
    return (
      <View style={styles.container}>
        <AppHeader title={c.feedTitle} left="back" fallbackHref={routes.feed as any} />
        <View style={styles.missingWrap}>
          <EmptyState icon="alert-circle-outline" title={loadErrorText} />
        </View>
      </View>
    );
  }

  const isAuthor = !!user?.uid && user.uid === post.author.uid;
  const published = post.status === "published";
  const canSend = published && commentText.trim() !== "" && !sendingComment;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      // Android 走 edge-to-edge，adjustResize 不一定會縮畫面，與聊天室相同改用 height
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* 自己的文章：編輯／刪除；別人的文章：檢舉 */}
      <AppHeader
        title={c.feedTitle}
        left="back"
        fallbackHref={routes.feed as any}
        right={
          isAuthor ? (
            <>
              <IconButton
                icon="create-outline"
                onPress={handleEditPost}
                disabled={deleting}
                accessibilityLabel={c.editPost}
                color={colors.text}
              />
              {deleting ? (
                <View style={styles.headerSpinner}>
                  <ActivityIndicator size="small" color={colors.danger} />
                </View>
              ) : (
                <IconButton
                  icon="trash-outline"
                  onPress={handleDeletePost}
                  accessibilityLabel={c.deletePost}
                  color={colors.danger}
                />
              )}
            </>
          ) : (
            <IconButton
              icon="flag-outline"
              onPress={() => setReportVisible(true)}
              accessibilityLabel={c.reportPost}
              color={colors.textSecondary}
            />
          )
        }
      />

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      >
        {/* 內文 */}
        <View style={styles.articleWrap}>
          <CategoryTag category={post.category} />
          <Text style={styles.title} accessibilityRole="header">
            {post.title}
          </Text>

          <View style={styles.authorRow}>
            <Avatar name={post.author.name} uri={post.author.avatarUrl} uid={post.author.uid} size={44} />
            <View style={styles.authorText}>
              <View style={styles.authorNameRow}>
                <Text style={styles.authorName} numberOfLines={1}>
                  {post.author.name}
                </Text>
                <AuthorRoleBadge role={post.author.role} />
              </View>
              <Text style={styles.postTime}>{formatRelativeTime(post.createdAt, language)}</Text>
            </View>
          </View>

          <Text style={styles.content} selectable>
            {post.content}
          </Text>

          {/* 附圖：點擊放大 */}
          {post.imageUrls.length > 0 ? (
            <View style={styles.imageList}>
              {post.imageUrls.map((url) => (
                <Pressable
                  key={url}
                  onPress={() => setViewerUrl(url)}
                  accessibilityRole="imagebutton"
                  accessibilityLabel={c.viewImage}
                >
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

        {/* 互動列 */}
        <View style={styles.actionRow}>
          <View style={styles.actionLeft}>
            <Pressable
              style={({ pressed }) => [styles.actionBtn, liked && styles.actionBtnLiked, pressed && styles.actionBtnPressed]}
              onPress={handleToggleLike}
              disabled={likeBusy}
              accessibilityRole="button"
              accessibilityLabel={`${liked ? c.unlike : c.like}，${c.likesA11y(post.likeCount)}`}
              accessibilityState={{ selected: liked, disabled: likeBusy }}
            >
              <Ionicons
                name={liked ? "heart" : "heart-outline"}
                size={22}
                color={liked ? colors.primary : colors.textSecondary}
              />
              <Text style={[styles.actionText, liked && styles.actionTextLiked]}>
                {post.likeCount}
              </Text>
            </Pressable>

            <View style={styles.statItem} accessibilityLabel={c.commentsA11y(comments.length)}>
              <Ionicons name="chatbubble-outline" size={20} color={colors.textSecondary} />
              <Text style={styles.actionText}>{comments.length}</Text>
            </View>

            <View style={styles.statItem} accessibilityLabel={c.viewsA11y(String(post.viewCount))}>
              <Ionicons name="eye-outline" size={21} color={colors.textSecondary} />
              <Text style={styles.actionText}>{post.viewCount}</Text>
            </View>
          </View>

          <IconButton
            icon="share-social-outline"
            onPress={handleShare}
            accessibilityLabel={c.share}
            color={colors.textSecondary}
            size={22}
          />
        </View>

        {/* 留言區 */}
        <View style={styles.commentsWrap}>
          <Text style={styles.commentsTitle} accessibilityRole="header">
            {c.commentsTitle(comments.length)}
          </Text>

          {comments.length === 0 ? (
            <Text style={styles.noComment}>{c.noComments}</Text>
          ) : (
            <View style={styles.commentList}>
              {comments.map((comment) => (
                <View key={comment.id} style={styles.commentRow}>
                  <Avatar name={comment.author.name} uri={comment.author.avatarUrl} uid={comment.author.uid} size={36} />
                  <View style={styles.commentBody}>
                    <View style={styles.commentHeader}>
                      <Text style={styles.commentAuthor} numberOfLines={1}>
                        {comment.author.name}
                      </Text>
                      <AuthorRoleBadge role={comment.author.role} />
                      <Text style={styles.commentTime}>
                        {formatRelativeTime(comment.createdAt, language)}
                      </Text>
                      {/* 只能刪自己的留言（規則同樣限制） */}
                      {user?.uid && comment.author.uid === user.uid ? (
                        deletingCommentId === comment.id ? (
                          <View style={styles.commentDelete}>
                            <ActivityIndicator size="small" color={colors.textMuted} />
                          </View>
                        ) : (
                          <IconButton
                            icon="trash-outline"
                            size={18}
                            onPress={() => handleDeleteComment(comment)}
                            disabled={deletingCommentId !== ""}
                            accessibilityLabel={c.deleteComment}
                            color={colors.textMuted}
                            style={styles.commentDelete}
                          />
                        )
                      ) : null}
                    </View>
                    <Text style={styles.commentContent} selectable>
                      {comment.content}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* 底部留言輸入框 */}
      <View style={[styles.inputBar, { paddingBottom: spacing.md + insets.bottom }]}>
        <TextInput
          style={[styles.commentInput, Platform.OS === "web" && ({ outlineStyle: "none" } as object)]}
          placeholder={published ? c.commentPlaceholder : c.commentDisabledPlaceholder}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={published ? c.commentPlaceholder : c.commentDisabledPlaceholder}
          value={commentText}
          onChangeText={setCommentText}
          multiline
          maxLength={COMMENT_MAX_LENGTH}
          editable={published && !sendingComment}
        />
        <Pressable
          onPress={handleSubmitComment}
          accessibilityRole="button"
          accessibilityLabel={c.sendComment}
          accessibilityState={{ disabled: !canSend, busy: sendingComment }}
          disabled={!canSend}
          style={({ pressed }) => [
            styles.sendBtn,
            !canSend && !sendingComment && styles.sendBtnDisabled,
            pressed && canSend && styles.sendBtnPressed,
          ]}
        >
          {sendingComment ? (
            <ActivityIndicator size="small" color={colors.onPrimary} />
          ) : (
            <Ionicons name="send" size={20} color={canSend ? colors.onPrimary : colors.textDisabled} />
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
        <Pressable
          style={styles.viewerOverlay}
          onPress={() => setViewerUrl("")}
          accessibilityRole="button"
          accessibilityLabel={c.closeImage}
        >
          {viewerUrl !== "" ? (
            <Image source={{ uri: viewerUrl }} style={styles.viewerImage} contentFit="contain" />
          ) : null}
          <View style={[styles.viewerClose, { top: insets.top + spacing.md }]}>
            <Ionicons name="close" size={28} color={colors.onPrimary} />
          </View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  headerSpinner: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
    width: "100%",
    maxWidth: layout.maxContentWidth,
    alignSelf: "center",
  },
  articleWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  title: {
    ...typography.title,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  authorText: {
    flex: 1,
    minWidth: 0,
  },
  authorNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  authorName: {
    ...typography.bodyStrong,
    flexShrink: 1,
  },
  postTime: {
    ...typography.caption,
    fontSize: 14,
  },
  content: {
    ...typography.body,
    fontSize: 18,
    lineHeight: 29,
    marginTop: spacing.xs,
  },
  imageList: {
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  postImage: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: radii.card,
    backgroundColor: colors.surfaceSunken,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
  },
  actionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  actionBtn: {
    minHeight: layout.minTouchTarget,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
  },
  actionBtnLiked: {
    backgroundColor: colors.primarySoft,
  },
  actionBtnPressed: {
    backgroundColor: colors.surfaceSunken,
  },
  statItem: {
    minHeight: layout.minTouchTarget,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.xs,
  },
  actionText: {
    ...typography.label,
    color: colors.textSecondary,
  },
  actionTextLiked: {
    color: colors.primary,
  },
  commentsWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    borderTopWidth: spacing.sm,
    borderTopColor: colors.canvas,
  },
  commentsTitle: {
    ...typography.header,
    fontSize: 18,
    marginBottom: spacing.md,
  },
  noComment: {
    ...typography.body,
    color: colors.textMuted,
    paddingVertical: spacing.lg,
  },
  commentList: {
    gap: spacing.lg,
  },
  commentRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  commentBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  commentHeader: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.sm,
    minHeight: 32,
  },
  commentAuthor: {
    ...typography.label,
    flexShrink: 1,
  },
  commentTime: {
    ...typography.caption,
  },
  commentDelete: {
    marginLeft: "auto",
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    marginVertical: -8,
    alignItems: "center",
    justifyContent: "center",
  },
  commentContent: {
    ...typography.body,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  commentInput: {
    // No lineHeight: on iOS it pushes the text/placeholder below centre.
    fontSize: typography.body.fontSize,
    color: typography.body.color,
    includeFontPadding: false,
    textAlignVertical: "center",
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    backgroundColor: colors.surfaceSunken,
    borderRadius: radii.sheet,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  sendBtn: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    borderRadius: layout.minTouchTarget / 2,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: {
    backgroundColor: colors.surfaceSunken,
  },
  sendBtnPressed: {
    backgroundColor: colors.primaryPressed,
  },
  missingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  viewerOverlay: {
    flex: 1,
    backgroundColor: "rgba(17, 24, 39, 0.94)",
    alignItems: "center",
    justifyContent: "center",
  },
  viewerImage: {
    width: "100%",
    height: "80%",
  },
  viewerClose: {
    position: "absolute",
    right: spacing.lg,
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    borderRadius: layout.minTouchTarget / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.18)",
  },
});
