// 照顧者知識共享 — 文章詳情頁
// 結構：Header（返回 / 更多）→ 內文 → 互動列（按讚、留言數、分享）→ 留言區 → 底部留言輸入框
// 第一階段：資料為假資料，按讚與留言僅存在畫面狀態，第四階段接 Firestore

import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import Avatar from "@/src/community/components/Avatar";
import CategoryTag from "@/src/community/components/CategoryTag";
import ReportModal from "@/src/community/components/ReportModal";
import { formatRelativeTime } from "@/src/community/format";
import { findMockComments, findMockPost } from "@/src/community/mockPosts";
import { COMMUNITY_COLORS } from "@/src/community/theme";
import type { Comment, ReportReason } from "@/src/community/types";

export default function PostDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const postId = typeof params.id === "string" ? params.id : "";

  const post = useMemo(() => findMockPost(postId), [postId]);
  const [comments, setComments] = useState<Comment[]>(() => findMockComments(postId));
  const [commentText, setCommentText] = useState("");
  const [liked, setLiked] = useState(post?.likedByMe ?? false);
  const [reportVisible, setReportVisible] = useState(false);

  // 找不到文章（例如已被刪除或連結失效）時的防呆畫面
  if (!post) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn} hitSlop={8}>
            <Ionicons name="chevron-back" size={26} color={COMMUNITY_COLORS.text} />
          </Pressable>
        </View>
        <View style={styles.missingWrap}>
          <Ionicons name="alert-circle-outline" size={48} color="#D1D5DB" />
          <Text style={styles.missingText}>找不到這篇文章</Text>
        </View>
      </View>
    );
  }

  // 依原始按讚狀態推算目前顯示的按讚數
  const likeCount =
    post.likeCount + (liked && !post.likedByMe ? 1 : 0) - (!liked && post.likedByMe ? 1 : 0);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `${post.title}\n\n${post.content}\n\n— 來自 OmniCare 照顧者交流`,
      });
    } catch (error) {
      console.log("分享失敗：", error);
    }
  };

  const handleSubmitComment = () => {
    const trimmed = commentText.trim();
    if (!trimmed) return;

    // 第一階段只加到畫面狀態；第四階段改為寫入 Firestore
    const newComment: Comment = {
      id: `local-${Date.now()}`,
      postId: post.id,
      author: { uid: "me", name: "我" },
      content: trimmed,
      createdAt: Date.now(),
      likeCount: 0,
    };
    setComments((current) => [...current, newComment]);
    setCommentText("");
  };

  const handleReport = (reason: ReportReason, detail: string) => {
    setReportVisible(false);
    // 第四階段會寫入 reports collection 並累計檢舉次數
    Alert.alert(
      "檢舉已送出",
      `感謝你的回報，我們會盡快確認。\n原因：${reason}${detail ? `（${detail}）` : ""}`
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color={COMMUNITY_COLORS.text} />
        </Pressable>
        <Pressable onPress={() => setReportVisible(true)} style={styles.iconBtn} hitSlop={8}>
          <Ionicons name="ellipsis-horizontal" size={24} color={COMMUNITY_COLORS.text} />
        </Pressable>
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
        </View>

        <View style={styles.divider} />

        {/* 互動列 */}
        <View style={styles.actionRow}>
          <View style={styles.actionLeft}>
            <Pressable
              style={styles.actionBtn}
              onPress={() => setLiked((current) => !current)}
              hitSlop={6}
            >
              <Ionicons
                name={liked ? "heart" : "heart-outline"}
                size={22}
                color={liked ? COMMUNITY_COLORS.heart : COMMUNITY_COLORS.textSecondary}
              />
              <Text style={[styles.actionText, liked && styles.actionTextLiked]}>{likeCount}</Text>
            </Pressable>

            <View style={styles.actionBtn}>
              <Ionicons
                name="chatbubble-outline"
                size={21}
                color={COMMUNITY_COLORS.textSecondary}
              />
              <Text style={styles.actionText}>{comments.length}</Text>
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
        />
        <Pressable
          onPress={handleSubmitComment}
          disabled={commentText.trim() === ""}
          style={[styles.sendBtn, commentText.trim() === "" && styles.sendBtnDisabled]}
        >
          <Ionicons name="send" size={18} color={COMMUNITY_COLORS.white} />
        </Pressable>
      </View>

      <ReportModal
        visible={reportVisible}
        onClose={() => setReportVisible(false)}
        onSubmit={handleReport}
      />
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
    paddingBottom: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: COMMUNITY_COLORS.borderLight,
  },
  iconBtn: {
    padding: 6,
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
    fontSize: 22,
    lineHeight: 30,
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
    fontSize: 15,
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
    fontSize: 17,
    lineHeight: 27,
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
    gap: 24,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  actionText: {
    fontSize: 15,
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
    fontSize: 17,
    fontWeight: "800",
    color: COMMUNITY_COLORS.text,
    marginBottom: 18,
  },
  noComment: {
    fontSize: 15,
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
    fontSize: 14,
    fontWeight: "700",
    color: COMMUNITY_COLORS.text,
  },
  commentTime: {
    fontSize: 12,
    color: COMMUNITY_COLORS.textLight,
  },
  commentContent: {
    fontSize: 15,
    lineHeight: 22,
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
    minHeight: 42,
    maxHeight: 110,
    backgroundColor: COMMUNITY_COLORS.inputBg,
    borderRadius: 21,
    paddingHorizontal: 16,
    paddingTop: 11,
    paddingBottom: 11,
    fontSize: 15,
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
    fontSize: 17,
    color: COMMUNITY_COLORS.textSecondary,
    fontWeight: "600",
  },
});
