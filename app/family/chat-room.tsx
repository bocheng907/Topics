import { AppHeader, Button, EmptyState } from "@/src/ui/components";
import UserAvatar from "@/src/ui/components/UserAvatar";
import { colors, layout, radii, spacing, typography } from "@/src/ui/theme";
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
import { useLocalSearchParams } from "expo-router";
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
import { chatMessageCollection, normalizeChatRoom } from "@/src/chat/rooms";
import { useChatProfiles } from "@/src/chat/useChatProfiles";
import { chatIdentity } from "@/src/chat/chatIdentity";
import { readLocalBlob } from "@/src/media/readLocalBlob";
import { useScreenBottomInset } from "@/src/ui/BottomInsetContext";
import { useKeyboardVisible } from "@/src/ui/useKeyboardVisible";

export default function FamilyChatRoomScreen() {
  const bottomInset = useScreenBottomInset();
  // With the keyboard up the bar sits on the keyboard, so the home-indicator padding is dropped.
  const keyboardVisible = useKeyboardVisible();
  const [inputText, setInputText] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const sendLock = useRef(false);
  const uploadLock = useRef(false);
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);

  const { patientId, room } = useLocalSearchParams<{ patientId: string; room?: string }>();
  const { activePatientId, activePatient } = useActiveCareTarget();
  const { user } = useAuth();
  const { language } = useLanguage();
  const t = translations[language];
  const copy = chatCopy[language];
  const chatScrollRef = useRef<ScrollViewInstance>(null);
  const shouldScrollToEndRef = useRef(true);
  const { width } = useWindowDimensions();
  const messageMaxWidth = Math.min(600, Math.max(120, width - 76));

  const targetId = patientId || activePatientId;
  const roomType = normalizeChatRoom(room);
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
      const imageFolder = roomType === "family" ? "familyImages" : "images";
      const storageRef = ref(storage, `chats/${targetId}/${imageFolder}/${filename}`);
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
        senderName: senderProfile.displayName || t.family,
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
        senderName: senderProfile.displayName || t.family,
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
        left="back"
        fallbackHref="/family/chat-list"
        title={
          roomType === "family"
            ? `${activePatient?.name ? `${activePatient.name} · ` : ""}${t.familyGroupTitle}`
            : activePatient?.name
              ? language === "zh" ? `${activePatient.name}${t.caregiverLabel}` : `${activePatient.name} ${t.caregiverLabel}`
              : t.chatRoom
        }
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
        style={{ flex: 1, minHeight: 0 }}
      >

      {loadError ? (
        <View style={styles.emptyContainer}>
          <Text accessibilityRole="alert" style={styles.errorText}>{copy.loadFailed}</Text>
          <Button
            label={copy.retry}
            variant="secondary"
            icon="refresh"
            onPress={() => { setLoadError(false); setLoading(true); setRetry(value => value + 1); }}
            style={styles.retryBtn}
          />
        </View>
      ) : loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>{t.loadingMessages}</Text>
        </View>
      ) : messages.length === 0 ? (
        <ScrollView contentContainerStyle={styles.emptyContainer}>
          <EmptyState
            icon="chatbubbles-outline"
            title={t.noConversation}
            body={roomType === "family" ? t.familyGroupFirstMessage : t.sendFirstMessage}
          />
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
            const identity = chatIdentity(msg, profiles, t.family);
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
                      {identity.displayName || t.family}{isMe ? ` · ${t.chatYouLabel}` : ""}
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
      <View style={[styles.inputArea, { paddingBottom: spacing.sm + (keyboardVisible ? 0 : bottomInset) }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.photo}
          onPress={pickImageAndSend}
          disabled={uploading}
          style={({ pressed }) => [styles.toolBtn, pressed && styles.toolBtnPressed]}
        >
          {uploading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons name="camera-outline" size={24} color={colors.primary} />
          )}
        </Pressable>

        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder={t.inputMessage}
          placeholderTextColor={colors.textMuted}
          editable={!sending && !loading && !loadError && !!user && !!targetId}
          multiline
        />

        <Pressable
          onPress={sendMessage}
          accessibilityRole="button"
          accessibilityLabel={copy.send}
          style={({ pressed }) => [
            styles.sendBtn,
            !inputText.trim() && styles.sendBtnDisabled,
            pressed && { backgroundColor: colors.primaryPressed },
          ]}
          disabled={!inputText.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color={colors.onPrimary} />
          ) : (
            <Ionicons name="send" size={20} color={colors.onPrimary} style={{ marginLeft: 3 }} />
          )}
        </Pressable>
      </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: colors.canvas },

  chatContainer: { padding: spacing.lg, paddingBottom: spacing.xl, flexGrow: 1 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { ...typography.bodySmall, marginTop: spacing.md },
  emptyContainer: { flexGrow: 1, justifyContent: "center", alignItems: "center", padding: spacing.xl },
  errorText: { ...typography.body, color: colors.danger, textAlign: "center" },
  retryBtn: { alignSelf: "center", marginTop: spacing.lg },

  bubbleWrapper: { marginBottom: spacing.lg, width: "100%", flexShrink: 0 },
  myWrapper: { alignSelf: "flex-end" },
  otherWrapper: { alignSelf: "flex-start" },
  identityRow: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm },
  identityRowMe: { justifyContent: "flex-end" },
  messageColumn: { flexShrink: 1, minWidth: 60 },
  senderName: { ...typography.caption, flexShrink: 0, fontWeight: "600", color: colors.textSecondary, marginBottom: spacing.xs, marginLeft: spacing.xs },
  senderNameMe: { textAlign: "right", marginLeft: 0, marginRight: spacing.xs },
  senderAvatar: { flexShrink: 0, width: 32, height: 32 },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 },
  myBubble: { backgroundColor: colors.primary, borderTopRightRadius: 4 },
  otherBubble: { backgroundColor: colors.surface, borderTopLeftRadius: 4, borderWidth: 1, borderColor: colors.border },
  mainText: { ...typography.body, color: colors.text },
  mainTextMe: { color: colors.onPrimary },
  sentImage: { width: 200, height: 150, borderRadius: radii.control - 2, maxWidth: "100%" },
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
    minHeight: layout.minTouchTarget,
    maxHeight: 120,
  },
  toolBtn: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    borderRadius: layout.minTouchTarget / 2,
    justifyContent: "center",
    alignItems: "center",
  },
  toolBtnPressed: { backgroundColor: colors.primarySoft },
  sendBtn: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    borderRadius: layout.minTouchTarget / 2,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  sendBtnDisabled: { backgroundColor: colors.textDisabled },
});
