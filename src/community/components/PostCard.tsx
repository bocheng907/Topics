// 文章卡片
// variant="list"：主頁文章列表用（標題、摘要、作者、觀看/留言數）
// variant="hot"：主頁「本週熱門」橫向卡片用（分類色底、標題、觀看數）

import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatRelativeTime, formatViewCount } from "../format";
import { COMMUNITY_COLORS, getCategoryStyle } from "../theme";
import type { Post } from "../types";
import Avatar from "./Avatar";
import CategoryTag from "./CategoryTag";

type Props = {
  post: Post;
  variant?: "list" | "hot";
  onPress: (post: Post) => void;
};

export default function PostCard({ post, variant = "list", onPress }: Props) {
  if (variant === "hot") {
    const categoryStyle = getCategoryStyle(post.category);

    return (
      <Pressable
        onPress={() => onPress(post)}
        style={({ pressed }) => [
          styles.hotCard,
          { backgroundColor: categoryStyle.bg },
          pressed && styles.pressed,
        ]}
      >
        <View>
          <CategoryTag category={post.category} />
          <Text style={styles.hotTitle} numberOfLines={2}>
            {post.title}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="eye-outline" size={14} color={COMMUNITY_COLORS.textSecondary} />
          <Text style={styles.metaText}>{formatViewCount(post.viewCount)} 觀看</Text>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={() => onPress(post)}
      style={({ pressed }) => [styles.listCard, pressed && styles.pressedList]}
    >
      <View style={styles.listHeader}>
        <CategoryTag category={post.category} />
        <Text style={styles.timeText}>{formatRelativeTime(post.createdAt)}</Text>
      </View>

      <Text style={styles.listTitle} numberOfLines={2}>
        {post.title}
      </Text>
      <Text style={styles.listPreview} numberOfLines={2}>
        {post.preview}
      </Text>

      <View style={styles.listFooter}>
        <View style={styles.authorRow}>
          <Avatar name={post.author.name} size={26} />
          <Text style={styles.authorName} numberOfLines={1}>
            {post.author.name}
          </Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.metaRow}>
            <Ionicons name="eye-outline" size={14} color={COMMUNITY_COLORS.textSecondary} />
            <Text style={styles.metaText}>{formatViewCount(post.viewCount)}</Text>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="chatbubble-outline" size={14} color={COMMUNITY_COLORS.textSecondary} />
            <Text style={styles.metaText}>{post.commentCount}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.85,
  },
  pressedList: {
    backgroundColor: COMMUNITY_COLORS.surface,
  },

  // 本週熱門橫向卡片
  hotCard: {
    width: 240,
    padding: 16,
    borderRadius: 12,
    justifyContent: "space-between",
    gap: 12,
  },
  hotTitle: {
    marginTop: 10,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
    color: COMMUNITY_COLORS.text,
  },

  // 列表卡片
  listCard: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: COMMUNITY_COLORS.borderLight,
    gap: 6,
  },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  timeText: {
    fontSize: 13,
    color: COMMUNITY_COLORS.textLight,
    fontWeight: "500",
  },
  listTitle: {
    fontSize: 17,
    lineHeight: 23,
    fontWeight: "700",
    color: COMMUNITY_COLORS.text,
  },
  listPreview: {
    fontSize: 15,
    lineHeight: 21,
    color: COMMUNITY_COLORS.textSecondary,
  },
  listFooter: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  authorRow: {
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  authorName: {
    flexShrink: 1,
    fontSize: 14,
    color: COMMUNITY_COLORS.textSecondary,
    fontWeight: "500",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  metaText: {
    fontSize: 13,
    color: COMMUNITY_COLORS.textSecondary,
    fontWeight: "500",
  },
});
