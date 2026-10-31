// 文章卡片
// variant="list"：主頁文章列表用（標題、摘要、作者、觀看/留言數）
// variant="hot"：主頁「本週熱門」橫向卡片用（標題、觀看數）

import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { communityCopy } from "@/src/i18n/copy/communityCopy";
import { useLanguage } from "@/src/store/LanguageContext";
import { colors, radii, spacing, typography } from "@/src/ui/theme";
import { formatRelativeTime, formatViewCount } from "../format";
import type { Post } from "../types";
import AuthorRoleBadge from "./AuthorRoleBadge";
import Avatar from "./Avatar";
import CategoryTag from "./CategoryTag";

type Props = {
  post: Post;
  variant?: "list" | "hot";
  onPress: (post: Post) => void;
  /** 列表卡片底部分隔線；「我的文章」底下還有操作列，會關掉改由外層畫 */
  divider?: boolean;
};

export default function PostCard({ post, variant = "list", onPress, divider = true }: Props) {
  const { language } = useLanguage();
  const c = communityCopy[language];
  const views = formatViewCount(post.viewCount);

  if (variant === "hot") {
    return (
      <Pressable
        onPress={() => onPress(post)}
        accessibilityRole="button"
        accessibilityLabel={`${post.title}，${c.viewsA11y(views)}`}
        style={({ pressed }) => [styles.hotCard, pressed && styles.pressedCard]}
      >
        <View>
          <CategoryTag category={post.category} />
          <Text style={styles.hotTitle} numberOfLines={2}>
            {post.title}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="eye-outline" size={16} color={colors.textMuted} />
          <Text style={styles.metaText}>{c.views(views)}</Text>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={() => onPress(post)}
      accessibilityRole="button"
      accessibilityLabel={`${post.title}，${post.author.name}，${c.viewsA11y(views)}，${c.commentsA11y(post.commentCount)}`}
      style={({ pressed }) => [
        styles.listCard,
        !divider && styles.noDivider,
        pressed && styles.pressedList,
      ]}
    >
      <View style={styles.listHeader}>
        <CategoryTag category={post.category} />
        <Text style={styles.timeText}>{formatRelativeTime(post.createdAt, language)}</Text>
      </View>

      <View style={styles.listBody}>
        <View style={styles.listTextCol}>
          <Text style={styles.listTitle} numberOfLines={2}>
            {post.title}
          </Text>
          <Text style={styles.listPreview} numberOfLines={2}>
            {post.preview}
          </Text>
        </View>

        {/* 有附圖時顯示第一張縮圖，多張時標示張數 */}
        {post.imageUrls.length > 0 ? (
          <View style={styles.thumbWrap}>
            <Image
              source={{ uri: post.imageUrls[0] }}
              style={styles.thumb}
              contentFit="cover"
              transition={150}
              accessibilityLabel={c.imagesCount(post.imageUrls.length)}
            />
            {post.imageUrls.length > 1 ? (
              <View style={styles.thumbBadge}>
                <Ionicons name="images-outline" size={12} color={colors.onPrimary} />
                <Text style={styles.thumbBadgeText}>{post.imageUrls.length}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

      <View style={styles.listFooter}>
        <View style={styles.authorRow}>
          <Avatar name={post.author.name} uri={post.author.avatarUrl} uid={post.author.uid} size={28} />
          <Text style={styles.authorName} numberOfLines={1}>
            {post.author.name}
          </Text>
          <AuthorRoleBadge role={post.author.role} />
        </View>

        <View style={styles.statsRow}>
          <View style={styles.metaRow}>
            <Ionicons name="eye-outline" size={16} color={colors.textMuted} />
            <Text style={styles.metaText}>{views}</Text>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="chatbubble-outline" size={15} color={colors.textMuted} />
            <Text style={styles.metaText}>{post.commentCount}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressedCard: {
    backgroundColor: colors.surfaceSunken,
  },
  pressedList: {
    backgroundColor: colors.surfaceSunken,
  },

  // 本週熱門橫向卡片
  hotCard: {
    width: 248,
    minHeight: 128,
    padding: spacing.lg,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: "space-between",
    gap: spacing.md,
  },
  hotTitle: {
    ...typography.bodyStrong,
    marginTop: spacing.sm,
  },

  // 列表卡片
  listCard: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  noDivider: {
    borderBottomWidth: 0,
  },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  timeText: {
    ...typography.caption,
    fontSize: 14,
  },
  listBody: {
    flexDirection: "row",
    gap: spacing.md,
  },
  listTextCol: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  thumbWrap: {
    width: 76,
    height: 76,
    borderRadius: radii.control,
    overflow: "hidden",
    backgroundColor: colors.surfaceSunken,
  },
  thumb: {
    width: "100%",
    height: "100%",
  },
  thumbBadge: {
    position: "absolute",
    right: 4,
    bottom: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radii.pill,
    backgroundColor: colors.overlay,
  },
  thumbBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.onPrimary,
  },
  listTitle: {
    ...typography.header,
    fontSize: 18,
    lineHeight: 25,
  },
  listPreview: {
    ...typography.bodySmall,
    fontSize: 16,
    lineHeight: 23,
  },
  listFooter: {
    marginTop: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  authorRow: {
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  authorName: {
    ...typography.bodySmall,
    flexShrink: 1,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    ...typography.caption,
    fontSize: 14,
    color: colors.textSecondary,
  },
});
