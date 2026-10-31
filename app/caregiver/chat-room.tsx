import { AppHeader, Button } from "@/src/ui/components";
import UserAvatar from "@/src/ui/components/UserAvatar";
import { colors, radii, spacing, typography } from "@/src/ui/theme";
import { AppAlert as Alert } from "@/src/ui/AppAlert";
import { chatCopy } from "@/src/chat/chatCopy";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  type ScrollViewInstance,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  useWindowDimensions,
} from "react-native";
import { type Href, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { db, storage } from "@/firebase/firebaseConfig";
import { createImageUploadFilename } from "@/firebase/uploadFilename";
import { randomUUID } from "expo-crypto";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { useActiveCareTarget } from "@/src/care-target/useActiveCareTarget";
import { useAuth } from "@/src/auth/useAuth";
import { useChatTranslation } from "@/src/chat/useChatTranslation";
import { ChatTranslationStatus } from "@/src/chat/ChatTranslationStatus";
import { chatLocales } from "@/src/chat/chatTranslation";
import { translations } from "@/src/i18n/translations";
import { useLanguage } from "@/src/store/LanguageContext";
import { chatMessageCollection } from "@/src/chat/rooms";
import { useChatProfiles } from "@/src/chat/useChatProfiles";
import { chatIdentity } from "@/src/chat/chatIdentity";
import { readLocalBlob } from "@/src/media/readLocalBlob";

export default function CaregiverChatRoomScreen() {
  const [inputText, setInputText] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const sendLock = useRef(false);
  const uploadLock = useRef(false);
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);
  const chatScrollRef = useRef<ScrollViewInstance>(null);
  const shouldScrollToEndRef = useRef(true);

  const { patientId } = useLocalSearchParams<{ patientId: string }>();
  const { activePatientId, activePatient } = useActiveCareTarget();
  const { user } = useAuth();
  const { language } = useLanguage();
  const t = translations[language];
  const copy = chatCopy[language];
  const { width } = useWindowDimensions();
  const messageMaxWidth = Math.min(600, Math.max(120, width - 76));

  const targetId = patientId || activePatientId;
  // Caregivers only use the direct caregiver-family room. Family group is family-only.
  const roomType = "caregiver" as const;
  const messageCollection = chatMessageCollection(roomType);
  const { senderProfile, profiles } = useChatProfiles(user?.uid, targetId, roomType, messages);
  const chatScope = `${user?.uid}/${targetId}/${messageCollection}`;
  const currentScope = useRef(chatScope);
  useLayoutEffect(() => {
    currentScope.current = chatScope;
    return () => { currentScope.current = ""; };
  }, [chatScope]);
  const [previousChatScope, setPreviousChatScope] = useState<string | null>(null);
  if (previousChatScope !== chatScope) {
    setPreviousChatScope(chatScope); setMessages([]); setInputText(""); setLoading(Boolean(targetId)); setLoadError(false);
  }

  const generateCustomId = (pId: string) => {
    const now = new Date();
    const timeStr =
      now.getFullYear() +
      "-" +
      String(now.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(now.getDate()).padStart(2, "0") +
      "_" +
      String(now.getHours()).padStart(2, "0") +
      "-" +
      String(now.getMinutes()).padStart(2, "0") +
      "-" +
      String(now.getSeconds()).padStart(2, "0");

    const lastFour = pId.slice(-4);
    return `${timeStr}_msg_${lastFour}`;
  };

  useEffect(() => {
    if (!targetId || !user?.uid) {
      return;
    }
    let active = true;
    const q = query(
      collection(db, "chats", targetId, messageCollection),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!active) return;
        const msgs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        shouldScrollToEndRef.current = true;
        setMessages(msgs);
        setLoading(false);
        setLoadError(false);
      },
      (error) => {
        if (!active) return;
        console.error("Firebase 錯誤：", error);
        setMessages([]);
        setLoadError(true);
        setLoading(false);
      }
    );

    return () => { active = false; unsubscribe(); };
  }, [targetId, messageCollection, user?.uid, retry]);

  const translated = useChatTranslation(messages, language, chatScope);

  const pickImageAndSend = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert(t.resultErrorTitle, t.albumPermissionNeeded);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.5,
    });

    if (result.canceled || !result.assets?.[0]) return;

    await uploadImage(result.assets[0].uri);
  };

  const uploadImage = async (uri: string) => {
    if (!targetId || !user || uploadLock.current) return;
    uploadLock.current = true;
    const scope = chatScope;
    setUploading(true);

    try {
      const blob = await readLocalBlob(uri);
      const filename = createImageUploadFilename();
      const storageRef = ref(storage, `chats/${targetId}/images/${filename}`);
      const uploadTask = uploadBytesResumable(storageRef, blob, {
        contentType: blob.type || "image/jpeg",
        customMetadata: {uploaderUid: user.uid, patientId: targetId},
      });

      const snapshot = await uploadTask;
      const downloadURL = await getDownloadURL(snapshot.ref);
      const customId = generateCustomId(targetId) + "_" + randomUUID();
      await setDoc(doc(db, "chats", targetId, messageCollection, customId), {
        imageUrl: downloadURL,
        senderId: user.uid,
        senderName: senderProfile.displayName || t.caregiver,
        senderAvatarUrl: senderProfile.avatarUrl,
        createdAt: serverTimestamp(),
      });

    } catch (e) {
      console.error("圖片處理失敗", e);
      if (currentScope.current === scope) Alert.alert(t.resultErrorTitle, copy.photoFailed);
    } finally {
      uploadLock.current = false;
      setUploading(false);
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim() || !targetId || !user || sendLock.current) return;
    sendLock.current = true; setSending(true);
    const scope = chatScope;
    try {
      const customId = generateCustomId(targetId) + "_" + randomUUID();

      await setDoc(doc(db, "chats", targetId, messageCollection, customId), {
        text: inputText,
        text_original: inputText,
        senderId: user.uid,
        senderName: senderProfile.displayName || t.caregiver,
        senderAvatarUrl: senderProfile.avatarUrl,
        createdAt: serverTimestamp(),
      });

      if (currentScope.current === scope) setInputText("");
    } catch (e) {
      console.error("發送失敗", e);
      if (currentScope.current === scope) Alert.alert(t.resultErrorTitle, copy.sendFailed);
    } finally {
      sendLock.current = false; setSending(false);
    }
  };

  return (
    <View style={styles.mainContainer}>
      <AppHeader
        title={
          activePatient?.name
            ? language === "zh"
              ? `${activePatient.name}${t.familyLabel}`
              : `${activePatient.name} ${t.familyLabel}`
            : t.chatRoom
        }
        fallbackHref={"/caregiver/chat-list" as Href}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
        style={{ flex: 1, minHeight: 0 }}
      >

      {loadError ? (
        <View style={styles.emptyContainer}>
          <Text accessibilityRole="alert" style={styles.emptySubText}>{copy.loadFailed}</Text>
          <Button
            label={copy.retry}
            variant="secondary"
            icon="refresh"
            onPress={() => { setLoadError(false); setLoading(true); setRetry(value => value + 1); }}
            style={styles.retryButton}
          />
        </View>
      ) : loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>{t.loadingMessages}</Text>
        </View>
      ) : messages.length === 0 ? (
        <ScrollView contentContainerStyle={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <Ionicons name="chatbubbles-outline" size={36} color={colors.primary} />
          </View>
          <Text style={styles.emptyText}>{t.noConversation}</Text>
          <Text style={styles.emptySubText}>
            {t.sendFirstMessage}
          </Text>
        </ScrollView>
      ) : (
        <ScrollView
          style={{ flex: 1, minHeight: 0 }}
          contentInsetAdjustmentBehavior="never"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.chatContainer}
          ref={chatScrollRef}
          onContentSizeChange={() => {
            if (!shouldScrollToEndRef.current) return;
            shouldScrollToEndRef.current = false;
            chatScrollRef.current?.scrollToEnd({ animated: messages.length > 1 });
          }}
        >
          {messages.map((msg) => {
            const isMe = msg.senderId === user?.uid;
            const identity = chatIdentity(msg, profiles, t.caregiver);
            const localizedText = translated.text(msg);
            const originalText = msg.text || msg.text_original || "";
            return (
              <View
                key={msg.id}
                style={[styles.bubbleWrapper, isMe ? styles.myWrapper : styles.otherWrapper]}
              >
                <View style={[styles.identityRow, isMe && styles.identityRowMe]}>
                  {!isMe && (
                    <View style={styles.senderAvatar}>
                      <UserAvatar uri={identity.avatarUrl} name={identity.displayName} uid={msg.senderId} size={32} />
                    </View>
                  )}
                  <View style={[styles.messageColumn, { maxWidth: messageMaxWidth }]}>
                    <Text style={[styles.senderName, isMe && styles.senderNameMe]}>
                      {identity.displayName || t.caregiver}{isMe ? ` · ${t.chatYouLabel}` : ""}
                    </Text>
                    <View style={[styles.bubble, isMe ? styles.myBubble : styles.otherBubble]}>
                  {msg.imageUrl ? (
                    <Image source={{ uri: msg.imageUrl }} style={styles.sentImage} resizeMode="cover" />
                  ) : (
                    <Text style={[styles.mainText, isMe && styles.mainTextMe]}>{localizedText || originalText}</Text>
                  )}
                    </View>
                    <Text style={[styles.timeText, { alignSelf: isMe ? "flex-end" : "flex-start" }]}>
                      {msg.createdAt
                        ? new Date(msg.createdAt.toMillis()).toLocaleTimeString(chatLocales[language], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : ""}
                    </Text>
                  </View>
                  {isMe && (
                    <View style={styles.senderAvatar}>
                      <UserAvatar uri={identity.avatarUrl} name={identity.displayName} uid={msg.senderId} size={32} />
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      <ChatTranslationStatus language={language} {...translated} />
      <View style={styles.inputArea}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.photo}
          accessibilityState={{ disabled: uploading, busy: uploading }}
          onPress={pickImageAndSend}
          style={({ pressed }) => [styles.photoBtn, pressed && styles.photoBtnPressed]}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator size="small" color={colors.textMuted} />
          ) : (
            <Ionicons name="camera-outline" size={26} color={colors.textSecondary} />
          )}
        </Pressable>

        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder={t.inputMessage}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={t.inputMessage}
          editable={!sending && !loading && !loadError && !!user && !!targetId}
          multiline
        />

        <Pressable
          onPress={sendMessage}
          accessibilityRole="button"
          accessibilityLabel={copy.send}
          accessibilityState={{ disabled: !inputText.trim() || sending, busy: sending }}
          style={({ pressed }) => [
            styles.sendBtn,
            pressed && styles.sendBtnPressed,
            !inputText.trim() && styles.sendBtnDisabled,
          ]}
          disabled={!inputText.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color={colors.onPrimary} />
          ) : (
            <Ionicons name="send" size={22} color={colors.onPrimary} style={{ marginLeft: 3 }} />
          )}
        </Pressable>
      </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: colors.surface },

  chatContainer: { padding: spacing.lg, paddingBottom: spacing.xl, flexGrow: 1 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { ...typography.bodySmall, marginTop: spacing.md },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.xxl },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  emptyText: { ...typography.header, textAlign: "center" },
  emptySubText: { ...typography.body, color: colors.textSecondary, textAlign: "center", marginTop: spacing.sm },
  retryButton: { alignSelf: "center", marginTop: spacing.lg },

  bubbleWrapper: { marginBottom: spacing.lg, width: "100%", flexShrink: 0 },
  myWrapper: { alignSelf: "flex-end" },
  otherWrapper: { alignSelf: "flex-start" },
  identityRow: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm },
  identityRowMe: { justifyContent: "flex-end" },
  messageColumn: { flexShrink: 1, minWidth: 60 },
  senderName: { ...typography.caption, flexShrink: 0, fontWeight: "600", marginBottom: spacing.xs, marginLeft: spacing.xs },
  senderNameMe: { textAlign: "right", marginLeft: 0, marginRight: spacing.xs },
  senderAvatar: { flexShrink: 0, width: 32, height: 32 },
  bubble: { paddingVertical: spacing.md - 2, paddingHorizontal: spacing.md + 2, borderRadius: radii.card },
  myBubble: { backgroundColor: colors.primary, borderTopRightRadius: spacing.xs },
  otherBubble: { backgroundColor: colors.surfaceSunken, borderTopLeftRadius: spacing.xs },
  mainText: { ...typography.body },
  mainTextMe: { color: colors.onPrimary },
  sentImage: { width: 220, height: 165, borderRadius: radii.control, maxWidth: "100%" },
  timeText: { ...typography.caption, flexShrink: 0, marginTop: spacing.xs },

  inputArea: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: {
    // No lineHeight: on iOS it pushes the text/placeholder below centre.
    fontSize: typography.body.fontSize,
    color: typography.body.color,
    includeFontPadding: false,
    textAlignVertical: "center",
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.surfaceSunken,
    borderRadius: 24,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 48,
    maxHeight: 120,
  },
  photoBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  photoBtnPressed: { backgroundColor: colors.surfaceSunken },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  sendBtnPressed: { backgroundColor: colors.primaryPressed },
  sendBtnDisabled: { opacity: 0.45 },
});
