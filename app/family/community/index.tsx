// 照顧者知識共享 — 主頁
// 結構：Header → 搜尋列 → 本週熱門（橫向）→ 分類切換 → 文章列表 → 發文浮動鍵
// 第一階段使用假資料，第四階段改接 Firestore

import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import PostCard from "@/src/community/components/PostCard";
import CategoryTabs from "@/src/community/components/CategoryTabs";
import { MOCK_POSTS } from "@/src/community/mockPosts";
import { COMMUNITY_COLORS } from "@/src/community/theme";
import type { CategoryFilter, Post } from "@/src/community/types";

/** 本週熱門顯示的篇數上限（規劃書：過去 7 天觀看數前 5 名） */
const HOT_POST_LIMIT = 5;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export default function CommunityHomeScreen() {
  const [category, setCategory] = useState<CategoryFilter>("全部");
  const [keyword, setKeyword] = useState("");

  /** 只顯示未被隱藏的文章 */
  const visiblePosts = useMemo(
    () => MOCK_POSTS.filter((post) => post.status === "published"),
    []
  );

  /** 本週熱門：過去 7 天內、依觀看數取前 5 名；不足 5 篇就顯示現有的 */
  const hotPosts = useMemo(() => {
    const since = Date.now() - SEVEN_DAYS_MS;
    return visiblePosts
      .filter((post) => post.createdAt >= since)
      .sort((a, b) => b.viewCount - a.viewCount)
      .slice(0, HOT_POST_LIMIT);
  }, [visiblePosts]);

  /** 列表：先套分類與關鍵字，再依觀看數由高到低排序（預設排序） */
  const listPosts = useMemo(() => {
    const trimmedKeyword = keyword.trim();

    return visiblePosts
      .filter((post) => (category === "全部" ? true : post.category === category))
      .filter((post) => {
        if (!trimmedKeyword) return true;
        return (
          post.title.includes(trimmedKeyword) || post.content.includes(trimmedKeyword)
        );
      })
      .sort((a, b) => b.viewCount - a.viewCount);
  }, [visiblePosts, category, keyword]);

  const openPost = (post: Post) => {
    router.push(`/family/community/${post.id}` as any);
  };

  return (
    <View style={styles.container}>
      {/* Header：返回鍵沿用家屬端其他頁面的樣式 */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={COMMUNITY_COLORS.text} />
        </Pressable>
        <Text style={styles.headerTitle}>照顧者交流</Text>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* 搜尋列 */}
        <View style={styles.searchWrap}>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={20} color={COMMUNITY_COLORS.textLight} />
            <TextInput
              style={styles.searchInput}
              placeholder="搜尋照護資訊、用品推薦..."
              placeholderTextColor={COMMUNITY_COLORS.textLight}
              value={keyword}
              onChangeText={setKeyword}
              returnKeyType="search"
            />
            {keyword.length > 0 ? (
              <Pressable onPress={() => setKeyword("")} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={COMMUNITY_COLORS.textLight} />
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* 本週熱門：搜尋中就不顯示，避免干擾搜尋結果 */}
        {keyword.trim() === "" && hotPosts.length > 0 ? (
          <>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="flame" size={16} color={COMMUNITY_COLORS.danger} />
              <Text style={styles.sectionTitle}>本週熱門</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.hotScroll}
              contentContainerStyle={styles.hotRow}
            >
              {hotPosts.map((post) => (
                <PostCard key={post.id} post={post} variant="hot" onPress={openPost} />
              ))}
            </ScrollView>
          </>
        ) : null}

        {/* 分類切換 */}
        <View style={styles.tabsWrap}>
          <CategoryTabs value={category} onChange={setCategory} />
        </View>

        {/* 文章列表 */}
        {listPosts.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="document-text-outline" size={48} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>
              {keyword.trim() !== "" ? "找不到符合的文章" : "這個分類還沒有文章"}
            </Text>
            <Text style={styles.emptyHint}>
              {keyword.trim() !== ""
                ? "換個關鍵字再試試看"
                : "成為第一個分享經驗的人吧"}
            </Text>
          </View>
        ) : (
          <View style={styles.listWrap}>
            {listPosts.map((post) => (
              <PostCard key={post.id} post={post} onPress={openPost} />
            ))}
          </View>
        )}
      </ScrollView>

      {/* 發文浮動鍵 */}
      <Pressable
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        onPress={() => router.push("/family/community/new-post" as any)}
      >
        <Ionicons name="add" size={28} color={COMMUNITY_COLORS.white} />
      </Pressable>
    </View>
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
    gap: 4,
    paddingTop: 54,
    paddingBottom: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COMMUNITY_COLORS.borderLight,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 21,
    fontWeight: "800",
    color: COMMUNITY_COLORS.text,
    letterSpacing: 0.5,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
    flexGrow: 1,
  },
  searchWrap: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 4,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#F5F5F5",
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: COMMUNITY_COLORS.text,
    padding: 0,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 20,
    marginTop: 18,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: COMMUNITY_COLORS.text,
  },
  hotScroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  hotRow: {
    flexGrow: 0,
    paddingHorizontal: 20,
    paddingBottom: 18,
    gap: 14,
  },
  tabsWrap: {
    borderBottomWidth: 1,
    borderBottomColor: COMMUNITY_COLORS.borderLight,
  },
  listWrap: {
    paddingBottom: 12,
  },
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 70,
    paddingHorizontal: 40,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: COMMUNITY_COLORS.textSecondary,
  },
  emptyHint: {
    fontSize: 15,
    color: COMMUNITY_COLORS.textLight,
    textAlign: "center",
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 32,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: COMMUNITY_COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COMMUNITY_COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  fabPressed: {
    opacity: 0.85,
  },
});
