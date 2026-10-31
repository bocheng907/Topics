// 照顧者知識共享 — 主頁
// 結構：Header → 搜尋列 → 本週熱門（橫向）→ 分類切換 → 文章列表 → 發文浮動鍵
// 資料來自 Firestore 的 posts 集合

import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { communityCopy } from "@/src/i18n/copy/communityCopy";
import { useLanguage } from "@/src/store/LanguageContext";
import { AppHeader, EmptyState } from "@/src/ui/components";
import { colors, radii, shadows, spacing, typography } from "@/src/ui/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import PostCard from "@/src/community/components/PostCard";
import CategoryTabs from "@/src/community/components/CategoryTabs";
import ProfileButton from "@/src/community/components/ProfileButton";
import { getHotPosts, getPosts } from "@/src/community/api";
import type { CategoryFilter, Post } from "@/src/community/types";
import { useCommunityRoutes } from "@/src/community/useCommunityRoutes";

/** 本週熱門顯示的篇數上限（規劃書：過去 7 天觀看數前 5 名） */
const HOT_POST_LIMIT = 5;

export default function CommunityHomeScreen() {
  const routes = useCommunityRoutes();
  const { language } = useLanguage();
  const c = communityCopy[language];
  const insets = useSafeAreaInsets();
  const [category, setCategory] = useState<CategoryFilter>("全部");
  const [keyword, setKeyword] = useState("");

  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [hotPosts, setHotPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  /** 從 Firestore 讀取文章與本週熱門 */
  const loadPosts = useCallback(async () => {
    try {
      setLoadFailed(false);
      const [posts, hot] = await Promise.all([getPosts(), getHotPosts(HOT_POST_LIMIT)]);
      setAllPosts(posts);
      setHotPosts(hot);
    } catch (error) {
      console.log("[community] load posts failed:", error);
      setLoadFailed(true);
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

  const searching = keyword.trim() !== "";

  return (
    <View style={styles.container}>
      <AppHeader
        title={c.feedTitle}
        left="back"
        fallbackHref={`/${routes.group}` as any}
        right={<ProfileButton onPress={() => router.push(routes.myPosts as any)} />}
      />

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 112 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* 搜尋列 */}
        <View style={styles.searchWrap}>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={20} color={colors.textMuted} />
            <TextInput
              style={[styles.searchInput, Platform.OS === "web" && ({ outlineStyle: "none" } as object)]}
              placeholder={c.searchPlaceholder}
              placeholderTextColor={colors.textMuted}
              accessibilityLabel={c.searchPlaceholder}
              value={keyword}
              onChangeText={setKeyword}
              returnKeyType="search"
            />
            {keyword.length > 0 ? (
              <Pressable
                onPress={() => setKeyword("")}
                accessibilityRole="button"
                accessibilityLabel={c.clearSearch}
                style={styles.clearBtn}
              >
                <Ionicons name="close-circle" size={20} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* 本週熱門：搜尋中就不顯示，避免干擾搜尋結果 */}
        {!searching && hotPosts.length > 0 ? (
          <>
            <Text style={styles.sectionTitle} accessibilityRole="header">
              {c.hotTitle}
            </Text>
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
          <View style={styles.stateWrap}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.stateHint}>{c.loading}</Text>
          </View>
        ) : loadFailed ? (
          <EmptyState icon="cloud-offline-outline" title={c.loadFailedTitle} body={c.feedLoadFailed} />
        ) : listPosts.length === 0 ? (
          <EmptyState
            icon={searching ? "search-outline" : "document-text-outline"}
            title={searching ? c.noMatchTitle : c.emptyCategoryTitle}
            body={searching ? c.noMatchBody : c.emptyCategoryBody}
          />
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
        accessibilityLabel={c.newPost}
        style={({ pressed }) => [
          styles.fab,
          { bottom: spacing.xl + insets.bottom },
          pressed && styles.fabPressed,
        ]}
        onPress={() => router.push(routes.newPost() as any)}
      >
        <Ionicons name="create-outline" size={22} color={colors.onPrimary} />
        <Text style={styles.fabText}>{c.newPost}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  searchWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 48,
    paddingLeft: spacing.md,
    borderRadius: radii.control,
    backgroundColor: colors.surfaceSunken,
  },
  searchInput: {
    ...typography.body,
    flex: 1,
    minHeight: 48,
    paddingVertical: 0,
  },
  clearBtn: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    ...typography.overline,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  hotScroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  hotRow: {
    flexGrow: 0,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.md,
  },
  tabsWrap: {
    marginTop: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  listWrap: {
    paddingBottom: spacing.md,
  },
  stateWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: spacing.xxxl,
    gap: spacing.md,
  },
  stateHint: {
    ...typography.body,
    color: colors.textSecondary,
  },
  fab: {
    position: "absolute",
    right: spacing.lg,
    minHeight: 56,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    ...shadows.fab,
  },
  fabPressed: {
    backgroundColor: colors.primaryPressed,
  },
  fabText: {
    ...typography.bodyStrong,
    color: colors.onPrimary,
  },
});
