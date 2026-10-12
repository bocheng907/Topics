// 照顧者知識共享 — 發文頁
// 結構：Header（取消 / 發表文章 / 發布）→ 分類選擇 → 標題 → 內容 → 加入圖片 → 底部免責提示
// 第一階段：發布只驗證欄位並回主頁，實際寫入 Firestore 於第四階段實作

import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { COMMUNITY_COLORS, POST_CATEGORIES, getCategoryStyle } from "@/src/community/theme";
import type { PostCategory } from "@/src/community/types";

/** 標題長度上限，與原型一致 */
const TITLE_MAX_LENGTH = 50;

export default function NewPostScreen() {
  const [category, setCategory] = useState<PostCategory | "">("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const canPublish = category !== "" && title.trim() !== "" && content.trim() !== "";

  const handlePublish = () => {
    if (!canPublish) return;

    // 第四階段會在這裡做關鍵字過濾並寫入 Firestore
    Alert.alert("文章已發布", "第一階段為畫面測試，文章尚未真的儲存。", [
      { text: "確定", onPress: () => router.back() },
    ]);
  };

  const handlePickImage = () => {
    Alert.alert("尚未開放", "圖片上傳會在第五階段實作。");
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerSide} hitSlop={8}>
          <Text style={styles.cancelText}>取消</Text>
        </Pressable>

        <Text style={styles.headerTitle}>發表文章</Text>

        <Pressable
          onPress={handlePublish}
          disabled={!canPublish}
          style={[styles.headerSide, styles.publishBtn]}
          hitSlop={8}
        >
          <Text style={[styles.publishText, !canPublish && styles.publishTextDisabled]}>發布</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* 分類選擇 */}
        <View style={styles.categoryRow}>
          {POST_CATEGORIES.map((item) => {
            const style = getCategoryStyle(item);
            const isSelected = category === item;

            return (
              <Pressable
                key={item}
                onPress={() => setCategory(item)}
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
            textAlignVertical="top"
          />
        </View>

        {/* 加入圖片（第五階段實作） */}
        <View style={styles.imageWrap}>
          <Pressable onPress={handlePickImage} style={styles.imageBtn}>
            <Ionicons name="image-outline" size={20} color={COMMUNITY_COLORS.textSecondary} />
            <Text style={styles.imageText}>加入圖片</Text>
          </Pressable>
        </View>

        {/* 底部免責提示 */}
        <View style={styles.disclaimerWrap}>
          <Text style={styles.disclaimerText}>
            本平台內容為使用者經驗分享，不能取代專業醫療建議
          </Text>
        </View>
      </ScrollView>
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
