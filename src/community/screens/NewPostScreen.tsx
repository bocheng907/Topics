// 照顧者知識共享 — 發文／編輯頁
// 結構：Header（取消 / 發表文章 / 發布）→ 分類選擇 → 標題 → 內容 → 圖片 → 底部免責提示
// 送出前會做敏感字詞檢查（規劃書 4-2），通過後先上傳圖片到 Storage，再寫入 Firestore 的 posts 集合
// 帶 editId 參數時為編輯模式：預填既有內容，儲存時更新原文章

import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useAuth } from "@/src/auth/useAuth";
import { communityAuthorRole, createPost, getPostById, newPostId, updatePost } from "@/src/community/api";
import { checkPostContent } from "@/src/community/contentFilter";
import {
  MAX_POST_IMAGE_BYTES,
  MAX_POST_IMAGES,
  deletePostImages,
  describeUploadError,
  uploadPostImage,
  type LocalPostImage,
} from "@/src/community/imageUpload";
import { COMMUNITY_COLORS, POST_CATEGORIES, getCategoryStyle } from "@/src/community/theme";
import type { PostCategory } from "@/src/community/types";
import { useCommunityProfile } from "@/src/community/useCommunityProfile";
import { AppAlert } from "@/src/ui/AppAlert";

/** 標題長度上限，與原型一致 */
const TITLE_MAX_LENGTH = 50;

/** 內容長度上限，與 Security Rules 的上限一致 */
const CONTENT_MAX_LENGTH = 5000;

/** 畫面上的圖片：remoteUrl 有值代表已在 Storage（編輯既有文章時），否則是剛挑選的本地檔 */
type DraftImage = {
  key: string;
  uri: string;
  remoteUrl?: string;
  local?: LocalPostImage;
};

let draftKeySeed = 0;
function nextDraftKey(): string {
  draftKeySeed += 1;
  return `img_${Date.now()}_${draftKeySeed}`;
}

export default function NewPostScreen() {
  const params = useLocalSearchParams<{ editId?: string }>();
  const editId = typeof params.editId === "string" ? params.editId : "";
  const isEdit = editId !== "";

  const { user } = useAuth();
  const profile = useCommunityProfile();

  const [category, setCategory] = useState<PostCategory | "">("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [images, setImages] = useState<DraftImage[]>([]);
  const [originalImageUrls, setOriginalImageUrls] = useState<string[]>([]);

  const [loadingPost, setLoadingPost] = useState(isEdit);
  const [loadError, setLoadError] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [uploadText, setUploadText] = useState("");

  // 編輯模式：讀取原文章預填（被檢舉隱藏的自己的文章也可以編輯）
  useEffect(() => {
    if (!isEdit) return;
    let alive = true;

    (async () => {
      try {
        const post = await getPostById(editId, { includeHidden: true });
        if (!alive) return;

        if (!post) {
          setLoadError("這篇文章已被刪除");
        } else if (!user?.uid || post.author.uid !== user.uid) {
          setLoadError("只能編輯自己的文章");
        } else {
          setCategory(post.category);
          setTitle(post.title);
          setContent(post.content);
          setOriginalImageUrls(post.imageUrls);
          setImages(
            post.imageUrls.map((url) => ({ key: nextDraftKey(), uri: url, remoteUrl: url }))
          );
        }
      } catch (error) {
        console.log("[community] load post for edit failed:", error);
        if (alive) setLoadError("讀取文章失敗，請確認網路後再試");
      } finally {
        if (alive) setLoadingPost(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [editId, isEdit, user?.uid]);

  const canPublish =
    category !== "" &&
    title.trim() !== "" &&
    content.trim() !== "" &&
    !publishing &&
    !loadingPost &&
    loadError === "";

  const handlePublish = async () => {
    // canPublish 已確認 category 不是空字串，TypeScript 會自動窄化型別
    if (!canPublish) return;

    if (!user?.uid) {
      AppAlert.alert("無法發布", "請先登入後再發文");
      return;
    }

    // 送出前的敏感字詞檢查：只警告、讓使用者自己修改
    const check = checkPostContent(title, content);
    if (!check.passed) {
      AppAlert.alert("內容需要修改", check.message);
      return;
    }

    const uid = user.uid;
    const postId = isEdit ? editId : newPostId(uid);
    const pendingCount = images.filter((image) => !image.remoteUrl).length;
    const uploadedNow: string[] = [];

    setPublishing(true);
    try {
      // 1. 依畫面順序上傳新挑選的圖片（先上傳、再寫文章，文章上的 imageUrls 才會完整）
      const finalUrls: string[] = [];
      let uploadIndex = 0;

      for (const image of images) {
        if (image.remoteUrl) {
          finalUrls.push(image.remoteUrl);
          continue;
        }

        uploadIndex += 1;
        const label = `上傳圖片 ${uploadIndex}/${pendingCount}`;
        setUploadText(`${label}...`);

        let url: string;
        try {
          url = await uploadPostImage({
            uid,
            postId,
            image: image.local ?? { uri: image.uri },
            onProgress: (ratio) => setUploadText(`${label}（${Math.round(ratio * 100)}%）`),
          });
        } catch (error) {
          console.log("[community] upload post image failed:", error);
          throw Object.assign(new Error("upload failed"), {
            userMessage: describeUploadError(error),
          });
        }

        uploadedNow.push(url);
        finalUrls.push(url);
      }

      // 2. 寫入文章
      setUploadText(isEdit ? "儲存中..." : "發布中...");
      if (isEdit) {
        await updatePost(postId, { category, title, content, imageUrls: finalUrls });

        // 編輯時被移除的舊圖，在文章更新成功後才從 Storage 清掉
        const removed = originalImageUrls.filter((url) => !finalUrls.includes(url));
        if (removed.length > 0) void deletePostImages(removed);
      } else {
        await createPost({
          postId,
          category,
          title,
          content,
          authorUid: uid,
          authorName: profile.name,
          authorRole: communityAuthorRole(user?.role),
          imageUrls: finalUrls,
        });
      }

      // 回上一頁時 useFocusEffect 會重新讀取，新內容就會出現在列表
      router.back();
    } catch (error) {
      console.log("[community] save post failed:", error);
      // 文章沒寫進去，這次上傳的圖片就沒人引用，盡力清掉
      if (uploadedNow.length > 0) void deletePostImages(uploadedNow);

      const userMessage = (error as { userMessage?: string })?.userMessage;
      AppAlert.alert(
        isEdit ? "儲存失敗" : "發布失敗",
        userMessage ??
          (isEdit ? "文章沒有更新，請確認網路後再試" : "文章沒有送出，請確認網路後再試")
      );
    } finally {
      setPublishing(false);
      setUploadText("");
    }
  };

  const handlePickImage = async () => {
    if (publishing) return;

    const remaining = MAX_POST_IMAGES - images.length;
    if (remaining <= 0) {
      AppAlert.alert("圖片已達上限", `每篇文章最多 ${MAX_POST_IMAGES} 張圖片`);
      return;
    }

    try {
      // Android 用系統相片挑選器、web 用檔案選擇，都不需要相簿權限；
      // 只有 iOS 沿用聊天室的作法先請求權限
      if (Platform.OS === "ios") {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          AppAlert.alert("需要相簿權限", "請到系統設定允許存取相簿，才能加入圖片");
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: remaining > 1,
        selectionLimit: remaining,
        // 壓縮後一般手機照片約 1MB 上下，上傳較快
        quality: 0.7,
      });

      if (result.canceled || !result.assets?.length) return;

      const accepted: DraftImage[] = [];
      let tooLarge = 0;

      for (const asset of result.assets.slice(0, remaining)) {
        if (asset.fileSize && asset.fileSize > MAX_POST_IMAGE_BYTES) {
          tooLarge += 1;
          continue;
        }
        accepted.push({
          key: nextDraftKey(),
          uri: asset.uri,
          local: { uri: asset.uri, mimeType: asset.mimeType, fileSize: asset.fileSize },
        });
      }

      if (accepted.length > 0) {
        setImages((current) => [...current, ...accepted].slice(0, MAX_POST_IMAGES));
      }
      if (tooLarge > 0) {
        AppAlert.alert("部分圖片過大", `有 ${tooLarge} 張圖片超過 10MB，已略過`);
      }
    } catch (error) {
      console.log("[community] pick image failed:", error);
      AppAlert.alert("無法開啟相簿", "請稍後再試");
    }
  };

  const handleRemoveImage = (key: string) => {
    if (publishing) return;
    setImages((current) => current.filter((image) => image.key !== key));
  };

  const headerTitle = isEdit ? "編輯文章" : "發表文章";
  const submitLabel = isEdit ? "儲存" : "發布";

  const renderBody = () => {
    if (loadingPost) {
      return (
        <View style={styles.stateWrap}>
          <ActivityIndicator size="large" color={COMMUNITY_COLORS.primary} />
        </View>
      );
    }

    if (loadError !== "") {
      return (
        <View style={styles.stateWrap}>
          <Ionicons name="alert-circle-outline" size={48} color="#D1D5DB" />
          <Text style={styles.stateText}>{loadError}</Text>
        </View>
      );
    }

    return (
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* 分類選擇 */}
        {category === "" && <Text style={{ color: COMMUNITY_COLORS.textSecondary, marginBottom: 8, paddingHorizontal: 20 }}>請先選擇文章分類，再填寫標題與內容。</Text>}
        <View style={styles.categoryRow}>
          {POST_CATEGORIES.map((item) => {
            const style = getCategoryStyle(item);
            const isSelected = category === item;

            return (
              <Pressable
                key={item}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected, disabled: publishing }}
                onPress={() => setCategory(item)}
                disabled={publishing}
                style={[
                  styles.categoryBtn,
                  isSelected
                    ? { backgroundColor: style.main, borderColor: style.main }
                    : { backgroundColor: style.bg, borderColor: "transparent" },
                ]}
              >
                <Ionicons
                  name={style.icon}
                  size={15}
                  color={isSelected ? COMMUNITY_COLORS.white : style.main}
                />
                <Text
                  style={[
                    styles.categoryText,
                    { color: isSelected ? COMMUNITY_COLORS.white : style.main },
                  ]}
                  numberOfLines={1}
                >
                  {item}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* 標題 */}
        <View style={styles.titleWrap}>
          <TextInput
            style={styles.titleInput}
            placeholder="輸入標題..."
            placeholderTextColor="#D1D5DB"
            value={title}
            onChangeText={setTitle}
            maxLength={TITLE_MAX_LENGTH}
            editable={!publishing}
          />
          <Text style={styles.counter}>
            {title.length} / {TITLE_MAX_LENGTH}
          </Text>
        </View>

        {/* 內容 */}
        <View style={styles.contentWrap}>
          <TextInput
            style={styles.contentInput}
            placeholder="分享你的照護經驗、用品推薦或心得..."
            placeholderTextColor={COMMUNITY_COLORS.textLight}
            value={content}
            onChangeText={setContent}
            multiline
            maxLength={CONTENT_MAX_LENGTH}
            textAlignVertical="top"
            editable={!publishing}
          />
        </View>

        {/* 圖片：已選的縮圖（可移除）+ 加入圖片按鈕 */}
        <View style={styles.imageWrap}>
          {images.length > 0 ? (
            <View style={styles.thumbRow}>
              {images.map((image) => (
                <View key={image.key} style={styles.thumbItem}>
                  <Image
                    source={{ uri: image.uri }}
                    style={styles.thumbImage}
                    contentFit="cover"
                    transition={150}
                  />
                  <Pressable
                    onPress={() => handleRemoveImage(image.key)}
                    disabled={publishing}
                    style={styles.thumbRemove}
                    hitSlop={6}
                    accessibilityLabel="移除圖片"
                  >
                    <Ionicons name="close" size={14} color={COMMUNITY_COLORS.white} />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}

          {images.length < MAX_POST_IMAGES ? (
            <Pressable onPress={handlePickImage} disabled={publishing} style={styles.imageBtn}>
              <Ionicons name="image-outline" size={20} color={COMMUNITY_COLORS.textSecondary} />
              <Text style={styles.imageText}>
                加入圖片（{images.length}/{MAX_POST_IMAGES}）
              </Text>
            </Pressable>
          ) : null}
        </View>

        {/* 底部免責提示 */}
        <View style={styles.disclaimerWrap}>
          <Text style={styles.disclaimerText}>
            本平台內容為使用者經驗分享，不能取代專業醫療建議
          </Text>
        </View>
      </ScrollView>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          disabled={publishing}
          style={styles.headerSide}
          hitSlop={8}
        >
          <Text style={styles.cancelText}>取消</Text>
        </Pressable>

        <Text style={styles.headerTitle}>{headerTitle}</Text>

        <Pressable
          onPress={handlePublish}
          accessibilityRole="button"
          accessibilityLabel={submitLabel}
          accessibilityState={{ disabled: !canPublish, busy: publishing }}
          disabled={!canPublish}
          style={[styles.headerSide, styles.publishBtn]}
          hitSlop={8}
        >
          {publishing ? (
            <ActivityIndicator size="small" color={COMMUNITY_COLORS.primary} />
          ) : (
            <Text style={[styles.publishText, !canPublish && styles.publishTextDisabled]}>
              {submitLabel}
            </Text>
          )}
        </Pressable>
      </View>

      {/* 上傳／儲存進度 */}
      {publishing && uploadText !== "" ? (
        <View style={styles.progressBar}>
          <ActivityIndicator size="small" color={COMMUNITY_COLORS.primary} />
          <Text style={styles.progressText}>{uploadText}</Text>
        </View>
      ) : null}

      {renderBody()}
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
  headerSide: {
    minWidth: 56,
  },
  cancelText: {
    fontSize: 17,
    fontWeight: "600",
    color: COMMUNITY_COLORS.textSecondary,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: COMMUNITY_COLORS.text,
    letterSpacing: 0.5,
  },
  publishBtn: {
    alignItems: "flex-end",
  },
  publishText: {
    fontSize: 17,
    fontWeight: "800",
    color: COMMUNITY_COLORS.primary,
  },
  publishTextDisabled: {
    color: "#D1D5DB",
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
    flexGrow: 1,
  },
  categoryRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  categoryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
  },
  categoryText: {
    fontSize: 15,
    fontWeight: "700",
  },
  titleWrap: {
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: COMMUNITY_COLORS.borderLight,
    paddingBottom: 12,
  },
  titleInput: {
    fontSize: 20,
    fontWeight: "700",
    color: COMMUNITY_COLORS.text,
    padding: 0,
  },
  counter: {
    marginTop: 6,
    fontSize: 12,
    color: COMMUNITY_COLORS.textLight,
    textAlign: "right",
  },
  contentWrap: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  contentInput: {
    minHeight: 220,
    fontSize: 18,
    lineHeight: 28,
    color: COMMUNITY_COLORS.text,
    padding: 0,
  },
  imageWrap: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  thumbRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 12,
  },
  thumbItem: {
    width: 76,
    height: 76,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: COMMUNITY_COLORS.inputBg,
  },
  thumbImage: {
    width: "100%",
    height: "100%",
  },
  thumbRemove: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  progressBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: COMMUNITY_COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COMMUNITY_COLORS.borderLight,
  },
  progressText: {
    fontSize: 15,
    fontWeight: "600",
    color: COMMUNITY_COLORS.textSecondary,
  },
  stateWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 40,
  },
  stateText: {
    fontSize: 18,
    color: COMMUNITY_COLORS.textSecondary,
    fontWeight: "600",
    textAlign: "center",
  },
  imageBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#D1D5DB",
  },
  imageText: {
    fontSize: 17,
    fontWeight: "600",
    color: COMMUNITY_COLORS.textSecondary,
  },
  disclaimerWrap: {
    marginTop: "auto",
    paddingTop: 28,
    paddingHorizontal: 24,
    paddingBottom: 16,
    alignItems: "center",
  },
  disclaimerText: {
    fontSize: 13,
    color: COMMUNITY_COLORS.textLight,
    fontWeight: "500",
    textAlign: "center",
  },
});
