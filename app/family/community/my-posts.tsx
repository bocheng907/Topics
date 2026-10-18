// 照顧者知識共享 — 我的文章
// 結構：Header（返回 / 我的文章）→ 個人資料（頭像、名稱、文章數）→ 自己的文章列表（每篇可編輯、刪除）
// 包含被檢舉隱藏的文章，並標示狀態，讓作者知道哪些文章目前別人看不到

import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useAuth } from "@/src/auth/useAuth";
import { deletePost, getMyPosts } from "@/src/community/api";
import Avatar from "@/src/community/components/Avatar";
import PostCard from "@/src/community/components/PostCard";
import { COMMUNITY_COLORS } from "@/src/community/theme";
import type { Post } from "@/src/community/types";
import { useCommunityProfile } from "@/src/community/useCommunityProfile";
import { AppAlert } from "@/src/ui/AppAlert";

export default function MyPostsScreen() {
  const { user } = useAuth();
  const uid = user?.uid ?? "";
  const profile = useCommunityProfile();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [deletingId, setDeletingId] = useState("");

  const loadPosts = useCallback(async () => {
    try {
      setErrorText("");
      setPosts(await getMyPosts(uid));
    } catch (error) {
      console.log("[community] load my posts failed:", error);
      setErrorText("讀取文章失敗，請確認網路後下拉重新整理");
    }
  }, [uid]);

  // 每次回到這頁都重新讀取，編輯完回來就會看到最新內容
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

  const openPost = (post: Post) => {
    if (post.status === "hidden") {
      AppAlert.alert("文章已被隱藏", "這篇文章因檢舉次數過多已被隱藏，其他人目前看不到。");
      return;
    }
    router.push(`/family/community/${post.id}` as any);
  };

  const editPost = (post: Post) => {
    router.push({ pathname: "/family/community/new-post", params: { editId: post.id } } as any);
  };

  const confirmDelete = (post: Post) => {
    if (deletingId) return;

    AppAlert.alert("刪除文章", `確定要刪除「${post.title}」嗎？刪除後無法復原。`, [
      { text: "取消", style: "cancel" },
      {
        text: "刪除",
        style: "destructive",
        onPress: async () => {
          setDeletingId(post.id);
          try {
            await deletePost(post.id, post.imageUrls);
            // 先從畫面移除，再重新讀取確認
            setPosts((current) => current.filter((item) => item.id !== post.id));
            await loadPosts();
          } catch (error) {
            console.log("[community] delete post failed:", error);
            AppAlert.alert("刪除失敗", "文章沒有刪除，請確認網路後再試");
          } finally {
            setDeletingId("");
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      {/* Header：與社群主頁相同的色底 + 「‹ 返回」 */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color="#111827" />
          <Text style={styles.backText}>返回</Text>
        </Pressable>
        <Text style={styles.headerTitle}>我的文章</Text>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COMMUNITY_COLORS.primary}
          />
        }
      >
        {/* 個人資料 */}
        <View style={styles.profileRow}>
          <Avatar name={profile.name} uri={profile.avatarUrl} size={64} />
          <View style={styles.profileText}>
            <Text style={styles.profileName} numberOfLines={1}>
              {profile.name}
            </Text>
            <Text style={styles.profileMeta}>
              {loading ? "讀取中..." : `共 ${posts.length} 篇文章`}
            </Text>
          </View>
          <Pressable
            style={styles.editProfileBtn}
            onPress={() => router.push("/account-settings" as any)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="編輯個人資料"
          >
            <Ionicons name="person-circle-outline" size={18} color={COMMUNITY_COLORS.primary} />
            <Text style={styles.editProfileText}>編輯個人資料</Text>
          </Pressable>
        </View>

        <View style={styles.sectionGap} />

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
        ) : posts.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="create-outline" size={48} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>還沒有發表過文章</Text>
            <Text style={styles.emptyHint}>分享你的照護經驗，幫助其他照顧者</Text>
            <Pressable
              style={styles.emptyBtn}
              onPress={() => router.push("/family/community/new-post" as any)}
            >
              <Ionicons name="add" size={18} color={COMMUNITY_COLORS.white} />
              <Text style={styles.emptyBtnText}>發表文章</Text>
            </Pressable>
          </View>
        ) : (
          <View>
            {posts.map((post) => {
              const isDeleting = deletingId === post.id;
              return (
                <View key={post.id} style={[styles.postItem, isDeleting && styles.postItemBusy]}>
                  {post.status === "hidden" ? (
                    <View style={styles.hiddenBadge}>
                      <Ionicons name="eye-off-outline" size={14} color={COMMUNITY_COLORS.danger} />
                      <Text style={styles.hiddenText}>已被檢舉隱藏，其他人看不到這篇文章</Text>
                    </View>
                  ) : null}

                  <PostCard post={post} onPress={openPost} divider={false} />

                  <View style={styles.actionRow}>
                    <Pressable
                      style={styles.actionBtn}
                      onPress={() => editPost(post)}
                      disabled={isDeleting}
                      hitSlop={6}
                    >
                      <Ionicons name="create-outline" size={18} color={COMMUNITY_COLORS.primary} />
                      <Text style={[styles.actionText, { color: COMMUNITY_COLORS.primary }]}>
                        編輯
                      </Text>
                    </Pressable>
                    <Pressable
                      style={styles.actionBtn}
                      onPress={() => confirmDelete(post)}
                      disabled={isDeleting}
                      hitSlop={6}
                    >
                      {isDeleting ? (
                        <ActivityIndicator size="small" color={COMMUNITY_COLORS.danger} />
                      ) : (
                        <Ionicons name="trash-outline" size={18} color={COMMUNITY_COLORS.danger} />
                      )}
                      <Text style={[styles.actionText, { color: COMMUNITY_COLORS.danger }]}>
                        {isDeleting ? "刪除中" : "刪除"}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
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
    paddingBottom: 40,
    flexGrow: 1,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  profileText: {
    flex: 1,
    gap: 4,
  },
  profileName: {
    fontSize: 20,
    fontWeight: "800",
    color: COMMUNITY_COLORS.text,
  },
  profileMeta: {
    fontSize: 15,
    fontWeight: "500",
    color: COMMUNITY_COLORS.textSecondary,
  },
  editProfileBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COMMUNITY_COLORS.primary,
  },
  editProfileText: {
    fontSize: 14,
    fontWeight: "700",
    color: COMMUNITY_COLORS.primary,
  },
  sectionGap: {
    height: 8,
    backgroundColor: COMMUNITY_COLORS.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COMMUNITY_COLORS.borderLight,
  },
  postItem: {
    borderBottomWidth: 1,
    borderBottomColor: COMMUNITY_COLORS.borderLight,
  },
  postItemBusy: {
    opacity: 0.5,
  },
  hiddenBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginHorizontal: 20,
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#FDECEA",
    alignSelf: "flex-start",
  },
  hiddenText: {
    fontSize: 13,
    fontWeight: "600",
    color: COMMUNITY_COLORS.danger,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 24,
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  actionText: {
    fontSize: 15,
    fontWeight: "700",
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
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 22,
    backgroundColor: COMMUNITY_COLORS.primary,
  },
  emptyBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: COMMUNITY_COLORS.white,
  },
});
