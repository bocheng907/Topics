// 照顧者知識共享 — 主頁
// 結構：Header → 搜尋列 → 本週熱門（橫向）→ 分類切換 → 文章列表 → 發文浮動鍵
// 資料來自 Firestore 的 posts 集合

import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import PostCard from "@/src/community/components/PostCard";
import CategoryTabs from "@/src/community/components/CategoryTabs";
import ProfileButton from "@/src/community/components/ProfileButton";
import { getHotPosts, getPosts } from "@/src/community/api";
import { COMMUNITY_COLORS } from "@/src/community/theme";
import type { CategoryFilter, Post } from "@/src/community/types";
import { useCommunityRoutes } from "@/src/community/useCommunityRoutes";

/** 本週熱門顯示的篇數上限（規劃書：過去 7 天觀看數前 5 名） */
const HOT_POST_LIMIT = 5;

export default function CommunityHomeScreen() {
  const routes = useCommunityRoutes();
  const [category, setCategory] = useState<CategoryFilter>("全部");
  const [keyword, setKeyword] = useState("");

  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [hotPosts, setHotPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorText, setErrorText] = useState("");

  /** 從 Firestore 讀取文章與本週熱門 */
  const loadPosts = useCallback(async () => {
    try {
      setErrorText("");
      const [posts, hot] = await Promise.all([getPosts(), getHotPosts(HOT_POST_LIMIT)]);
      setAllPosts(posts);
      setHotPosts(hot);
    } catch (error) {
      console.log("[community] load posts failed:", error);
      setErrorText("讀取文章失敗，請確認網路後下拉重新整理");
    }
  }, []);

  // 每次回到這個畫面都重新讀取，發文或看完文章回來才會看到最新的數字
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        setLoading(true);
        await loadPosts();
        if (alive) setLoading(false);
      })();
      return () => {
        alive = false;
      };
    }, [loadPosts])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadPosts();
    setRefreshing(false);
  }, [loadPosts]);

  /** 列表：套分類與關鍵字（排序已由 Firestore 依觀看數處理） */
  const listPosts = useMemo(() => {
    const trimmedKeyword = keyword.trim();

    return allPosts
      .filter((post) => (category === "全部" ? true : post.category === category))
      .filter((post) => {
        if (!trimmedKeyword) return true;
        return (
          post.title.includes(trimmedKeyword) || post.content.includes(trimmedKeyword)
        );
      });
  }, [allPosts, category, keyword]);

  const openPost = (post: Post) => {
    router.push(routes.post(post.id) as any);
  };

  return (
    <View style={styles.container}>
      {/* Header：色底 + 「‹ 返回」文字，與家屬端其他頁面一致 */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color="#111827" />
          <Text style={styles.backText}>返回</Text>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          照顧者交流
        </Text>
        {/* 右上角頭像：進入「我的文章」 */}
        <View style={styles.headerRight}>
          <ProfileButton onPress={() => router.push(routes.myPosts as any)} />
        </View>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COMMUNITY_COLORS.primary}
          />
        }
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
        {loading ? (
          <View style={styles.emptyWrap}>
            <ActivityIndicator size="large" color={COMMUNITY_COLORS.primary} />
            <Text style={styles.emptyHint}>載入中...</Text>
          </View>
        ) : errorText !== "" ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="cloud-offline-outline" size={48} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>讀取失敗</Text>
            <Text style={styles.emptyHint}>{errorText}</Text>
          </View>
        ) : listPosts.length === 0 ? (
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
        accessibilityRole="button"
        accessibilityLabel="發表文章"
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        onPress={() => router.push(routes.newPost() as any)}
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
    gap: 12,
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
  headerRight: {
    marginLeft: "auto",
    // 頭像比返回文字高，抵銷多出的高度，讓 header 與家屬端其他頁面同高
    marginVertical: -8,
  },
  headerTitle: {
    flexShrink: 1,
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
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
    fontSize: 16,
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
    fontSize: 17,
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
    fontSize: 18,
    fontWeight: "700",
    color: COMMUNITY_COLORS.textSecondary,
  },
  emptyHint: {
    fontSize: 16,
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
