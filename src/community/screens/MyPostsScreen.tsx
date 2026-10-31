// 照顧者知識共享 — 我的文章
// 結構：Header（返回 / 我的文章）→ 個人資料（頭像、名稱、文章數）→ 自己的文章列表（每篇可編輯、刪除）
// 包含被檢舉隱藏的文章，並標示狀態，讓作者知道哪些文章目前別人看不到

import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth/useAuth";
import { deletePost, getMyPosts } from "@/src/community/api";
import Avatar from "@/src/community/components/Avatar";
import PostCard from "@/src/community/components/PostCard";
import type { Post } from "@/src/community/types";
import { useCommunityProfile } from "@/src/community/useCommunityProfile";
import { useCommunityRoutes } from "@/src/community/useCommunityRoutes";
import { communityCopy } from "@/src/i18n/copy/communityCopy";
import { useLanguage } from "@/src/store/LanguageContext";
import { AppAlert } from "@/src/ui/AppAlert";
import { AppHeader, Button, EmptyState, StatusBadge } from "@/src/ui/components";
import { colors, radii, spacing, typography } from "@/src/ui/theme";

export default function MyPostsScreen() {
  const routes = useCommunityRoutes();
  const { user } = useAuth();
  const uid = user?.uid ?? "";
  const profile = useCommunityProfile();
  const { language } = useLanguage();
  const c = communityCopy[language];
  const insets = useSafeAreaInsets();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [deletingId, setDeletingId] = useState("");

  const loadPosts = useCallback(async () => {
    try {
      setLoadFailed(false);
      setPosts(await getMyPosts(uid));
    } catch (error) {
      console.log("[community] load my posts failed:", error);
      setLoadFailed(true);
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
      AppAlert.alert(c.hiddenAlertTitle, c.hiddenAlertBody);
      return;
    }
    router.push(routes.post(post.id) as any);
  };

  const editPost = (post: Post) => {
    router.push(routes.newPost(post.id) as any);
  };

  const confirmDelete = (post: Post) => {
    if (deletingId) return;

    AppAlert.alert(c.deletePostTitle, c.deletePostConfirmNamed(post.title), [
      { text: c.cancel, style: "cancel" },
      {
        text: c.delete,
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
            AppAlert.alert(c.deleteFailedTitle, c.deletePostFailed);
          } finally {
            setDeletingId("");
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <AppHeader title={c.myPosts} left="back" fallbackHref={routes.feed as any} />

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: spacing.xxl + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* 個人資料 */}
        <View style={styles.profileCard}>
          <View style={styles.profileRow}>
            <Avatar name={profile.name} uri={profile.avatarUrl} uid={uid} size={64} />
            <View style={styles.profileText}>
              <Text style={styles.profileName} numberOfLines={1}>
                {profile.name}
              </Text>
              <Text style={styles.profileMeta}>
                {loading ? c.readingShort : c.postCount(posts.length)}
              </Text>
            </View>
          </View>
          <Button
            label={c.editProfile}
            icon="person-circle-outline"
            variant="secondary"
            onPress={() => router.push("/account-settings" as any)}
          />
        </View>

        {loading ? (
          <View style={styles.stateWrap}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.stateHint}>{c.loading}</Text>
          </View>
        ) : loadFailed ? (
          <EmptyState icon="cloud-offline-outline" title={c.loadFailedTitle} body={c.feedLoadFailed} />
        ) : posts.length === 0 ? (
          <EmptyState
            icon="create-outline"
            title={c.noPostsTitle}
            body={c.noPostsBody}
            actionLabel={c.newPost}
            onAction={() => router.push(routes.newPost() as any)}
          />
        ) : (
          <View>
            {posts.map((post) => {
              const isDeleting = deletingId === post.id;
              return (
                <View key={post.id} style={[styles.postItem, isDeleting && styles.postItemBusy]}>
                  {post.status === "hidden" ? (
                    <StatusBadge
                      label={c.hiddenBadge}
                      tone="danger"
                      icon="eye-off-outline"
                      style={styles.hiddenBadge}
                    />
                  ) : null}

                  <PostCard post={post} onPress={openPost} divider={false} />

                  <View style={styles.actionRow}>
                    <Button
                      label={c.edit}
                      icon="create-outline"
                      variant="ghost"
                      onPress={() => editPost(post)}
                      disabled={isDeleting}
                      accessibilityLabel={c.editPostA11y(post.title)}
                    />
                    <Pressable
                      onPress={() => confirmDelete(post)}
                      disabled={isDeleting}
                      accessibilityRole="button"
                      accessibilityLabel={c.deletePostA11y(post.title)}
                      accessibilityState={{ disabled: isDeleting, busy: isDeleting }}
                      style={({ pressed }) => [styles.deleteBtn, pressed && styles.deleteBtnPressed]}
                    >
                      {isDeleting ? (
                        <ActivityIndicator size="small" color={colors.danger} />
                      ) : (
                        <Ionicons name="trash-outline" size={20} color={colors.danger} />
                      )}
                      <Text style={styles.deleteText}>{isDeleting ? c.deleting : c.delete}</Text>
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
    backgroundColor: colors.surface,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  profileCard: {
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    borderBottomWidth: spacing.sm,
    borderBottomColor: colors.canvas,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
  },
  profileText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  profileName: {
    ...typography.title,
  },
  profileMeta: {
    ...typography.bodySmall,
  },
  postItem: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  postItemBusy: {
    opacity: 0.5,
  },
  hiddenBadge: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },
  // Text-style destructive action (Button has no ghost-danger variant).
  deleteBtn: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.control,
  },
  deleteBtnPressed: {
    backgroundColor: colors.dangerSoft,
  },
  deleteText: {
    ...typography.label,
    fontSize: 17,
    color: colors.danger,
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
});
