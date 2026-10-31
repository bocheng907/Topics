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
  Platform,
  Pressable,
  StyleSheet,
  Text,
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
import { POST_CATEGORIES, getCategoryStyle } from "@/src/community/theme";
import type { PostCategory } from "@/src/community/types";
import { useCommunityProfile } from "@/src/community/useCommunityProfile";
import { communityCategoryLabel, communityCopy } from "@/src/i18n/copy/communityCopy";
import { useLanguage } from "@/src/store/LanguageContext";
import { AppAlert } from "@/src/ui/AppAlert";
import { AppHeader, EmptyState, KeyboardAwareScroll, TextField } from "@/src/ui/components";
import { colors, layout, radii, spacing, typography } from "@/src/ui/theme";

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

/** 編輯模式讀取失敗的原因（畫面上依語言顯示） */
type LoadError = "" | "deleted" | "notOwner" | "failed";

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
  const { language } = useLanguage();
  const c = communityCopy[language];

  const [category, setCategory] = useState<PostCategory | "">("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [images, setImages] = useState<DraftImage[]>([]);
  const [originalImageUrls, setOriginalImageUrls] = useState<string[]>([]);

  const [loadingPost, setLoadingPost] = useState(isEdit);
  const [loadError, setLoadError] = useState<LoadError>("");
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
          setLoadError("deleted");
        } else if (!user?.uid || post.author.uid !== user.uid) {
          setLoadError("notOwner");
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
        if (alive) setLoadError("failed");
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
      AppAlert.alert(c.cantPublishTitle, c.loginFirst);
      return;
    }

    // 送出前的敏感字詞檢查：只警告、讓使用者自己修改
    const check = checkPostContent(title, content);
    if (!check.passed) {
      AppAlert.alert(c.contentNeedsEditTitle, check.message);
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
        const label = c.uploadingImage(uploadIndex, pendingCount);
        setUploadText(`${label}…`);

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
      setUploadText(isEdit ? c.savingProgress : c.publishingProgress);
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
        isEdit ? c.saveFailedTitle : c.publishFailedTitle,
        userMessage ?? (isEdit ? c.saveFailedBody : c.publishFailedBody)
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
      AppAlert.alert(c.imageLimitTitle, c.imageLimitBody(MAX_POST_IMAGES));
      return;
    }

    try {
      // Android 用系統相片挑選器、web 用檔案選擇，都不需要相簿權限；
      // 只有 iOS 沿用聊天室的作法先請求權限
      if (Platform.OS === "ios") {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          AppAlert.alert(c.photoPermissionTitle, c.photoPermissionBody);
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
        AppAlert.alert(c.tooLargeTitle, c.tooLargeBody(tooLarge));
      }
    } catch (error) {
      console.log("[community] pick image failed:", error);
      AppAlert.alert(c.pickFailedTitle, c.pickFailedBody);
    }
  };

  const handleRemoveImage = (key: string) => {
    if (publishing) return;
    setImages((current) => current.filter((image) => image.key !== key));
  };

  const headerTitle = isEdit ? c.editPostTitle : c.newPostTitle;
  const submitLabel = isEdit ? c.save : c.publish;
  const loadErrorText =
    loadError === "deleted" ? c.editDeleted : loadError === "notOwner" ? c.editNotOwner : c.editLoadFailed;

  const renderBody = () => {
    if (loadingPost) {
      return (
        <View style={styles.stateWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }

    if (loadError !== "") {
      return (
        <View style={styles.stateWrap}>
          <EmptyState icon="alert-circle-outline" title={loadErrorText} />
        </View>
      );
    }

    return (
      <KeyboardAwareScroll
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 分類選擇 */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>
            {c.categoryLabel}
            <Text style={{ color: colors.danger }}> *</Text>
          </Text>
          {category === "" && <Text style={styles.hint}>{c.chooseCategoryHint}</Text>}
          <View style={styles.categoryRow} accessibilityRole="radiogroup">
            {POST_CATEGORIES.map((item) => {
              const style = getCategoryStyle(item);
              const isSelected = category === item;

              return (
                <Pressable
                  key={item}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected, disabled: publishing }}
                  onPress={() => setCategory(item)}
                  disabled={publishing}
                  style={({ pressed }) => [
                    styles.categoryBtn,
                    isSelected && styles.categoryBtnSelected,
                    pressed && !isSelected && { backgroundColor: colors.surfaceSunken },
                  ]}
                >
                  <Ionicons
                    name={isSelected ? "checkmark-circle" : style.icon}
                    size={20}
                    color={isSelected ? colors.primary : colors.textSecondary}
                  />
                  <Text
                    style={[styles.categoryText, isSelected && styles.categoryTextSelected]}
                    numberOfLines={2}
                  >
                    {communityCategoryLabel(c, item)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* 標題 */}
        <TextField
          label={c.titleLabel}
          required
          placeholder={c.titlePlaceholder}
          value={title}
          onChangeText={setTitle}
          maxLength={TITLE_MAX_LENGTH}
          editable={!publishing}
          helper={`${title.length} / ${TITLE_MAX_LENGTH}`}
          inputStyle={styles.titleInput}
        />

        {/* 內容 */}
        <TextField
          label={c.contentLabel}
          required
          placeholder={c.contentPlaceholder}
          value={content}
          onChangeText={setContent}
          multiline
          maxLength={CONTENT_MAX_LENGTH}
          editable={!publishing}
          inputStyle={styles.contentInput}
        />

        {/* 圖片：已選的縮圖（可移除）+ 加入圖片按鈕 */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{c.imagesLabel}</Text>
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
                    accessibilityRole="button"
                    accessibilityLabel={c.removeImage}
                  >
                    <View style={styles.thumbRemoveDot}>
                      <Ionicons name="close" size={16} color={colors.onPrimary} />
                    </View>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}

          {images.length < MAX_POST_IMAGES ? (
            <Pressable
              onPress={handlePickImage}
              disabled={publishing}
              accessibilityRole="button"
              style={({ pressed }) => [styles.imageBtn, pressed && { backgroundColor: colors.surfaceSunken }]}
            >
              <Ionicons name="image-outline" size={22} color={colors.primary} />
              <Text style={styles.imageText}>{c.addImage(images.length, MAX_POST_IMAGES)}</Text>
            </Pressable>
          ) : null}
        </View>

        {/* 底部免責提示 */}
        <Text style={styles.disclaimerText}>{c.disclaimer}</Text>
      </KeyboardAwareScroll>
    );
  };

  return (
    <View style={styles.container}>
      <AppHeader
        title={headerTitle}
        left={
          <Pressable
            onPress={() => router.back()}
            disabled={publishing}
            accessibilityRole="button"
            style={({ pressed }) => [styles.headerTextBtn, pressed && styles.headerTextBtnPressed]}
          >
            <Text style={styles.cancelText}>{c.cancel}</Text>
          </Pressable>
        }
        right={
          <Pressable
            onPress={handlePublish}
            accessibilityRole="button"
            accessibilityLabel={submitLabel}
            accessibilityState={{ disabled: !canPublish, busy: publishing }}
            disabled={!canPublish}
            style={({ pressed }) => [styles.headerTextBtn, styles.publishBtn, pressed && styles.headerTextBtnPressed]}
          >
            {publishing ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={[styles.publishText, !canPublish && styles.publishTextDisabled]}>
                {submitLabel}
              </Text>
            )}
          </Pressable>
        }
      />

      {/* 上傳／儲存進度 */}
      {publishing && uploadText !== "" ? (
        <View style={styles.progressBar} accessibilityLiveRegion="polite">
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.progressText}>{uploadText}</Text>
        </View>
      ) : null}

      {renderBody()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  headerTextBtn: {
    minWidth: 64,
    minHeight: layout.minTouchTarget,
    paddingHorizontal: spacing.md,
    borderRadius: radii.control,
    justifyContent: "center",
  },
  headerTextBtnPressed: {
    backgroundColor: colors.surfaceSunken,
  },
  cancelText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  publishBtn: {
    alignItems: "flex-end",
  },
  publishText: {
    ...typography.bodyStrong,
    color: colors.primary,
  },
  publishTextDisabled: {
    color: colors.textDisabled,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.xl,
    width: "100%",
    maxWidth: layout.maxContentWidth,
    alignSelf: "center",
  },
  field: {
    gap: spacing.sm,
  },
  fieldLabel: {
    ...typography.label,
  },
  hint: {
    ...typography.bodySmall,
  },
  categoryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  categoryBtn: {
    flexGrow: 1,
    flexBasis: 96,
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  categoryBtnSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  categoryText: {
    ...typography.label,
    fontSize: 16,
    color: colors.textSecondary,
    flexShrink: 1,
    textAlign: "center",
  },
  categoryTextSelected: {
    color: colors.primary,
  },
  titleInput: {
    fontSize: 18,
    fontWeight: "600",
  },
  contentInput: {
    minHeight: 200,
    lineHeight: 27,
  },
  thumbRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  thumbItem: {
    width: 88,
    height: 88,
    borderRadius: radii.control,
    overflow: "hidden",
    backgroundColor: colors.surfaceSunken,
  },
  thumbImage: {
    width: "100%",
    height: "100%",
  },
  // 48pt touch target in the corner; the visible dot is smaller.
  thumbRemove: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 48,
    height: 48,
    alignItems: "flex-end",
    justifyContent: "flex-start",
    padding: 4,
  },
  thumbRemoveDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.overlay,
  },
  progressBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primarySoft,
  },
  progressText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: "600",
  },
  stateWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  imageBtn: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radii.control,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.primaryBorder,
  },
  imageText: {
    ...typography.bodyStrong,
    color: colors.primary,
  },
  disclaimerText: {
    ...typography.caption,
    textAlign: "center",
  },
});
