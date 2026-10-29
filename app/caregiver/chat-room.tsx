import { ScreenHeader } from "@/src/ui/ScreenLayout";
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
import { router, useLocalSearchParams } from "expo-router";
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
      <ScreenHeader style={styles.header}>
        <View style={styles.headerLeft}>
        <Pressable accessibilityRole="button" accessibilityLabel={t.back} onPress={() => router.canGoBack() ? router.back() : router.replace('/caregiver/chat-list')} hitSlop={20} style={styles.backBtn}>
            <Text style={styles.backIcon}>＜</Text>
          </Pressable>
          <Text style={styles.headerTitle}>
            {activePatient?.name
              ? language === "zh"
                ? `${activePatient.name}${t.familyLabel}`
                : `${activePatient.name} ${t.familyLabel}`
              : t.chatRoom}
          </Text>
        </View>
      </ScreenHeader>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
        style={{ flex: 1, minHeight: 0 }}
      >

      {loadError ? (
        <View style={styles.emptyContainer}>
          <Text accessibilityRole="alert" style={styles.emptySubText}>{copy.loadFailed}</Text>
          <Pressable accessibilityRole="button" onPress={() => { setLoadError(false); setLoading(true); setRetry(value => value + 1); }} style={{padding: 16}}>
            <Text>{copy.retry}</Text>
          </Pressable>
        </View>
      ) : loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#9999E5" />
          <Text style={styles.loadingText}>{t.loadingMessages}</Text>
        </View>
      ) : messages.length === 0 ? (
        <ScrollView contentContainerStyle={styles.emptyContainer}>
          <Ionicons name="chatbubbles-outline" size={80} color="#C4C4C4" style={styles.emptyIcon} />
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
                  {!isMe && (identity.avatarUrl ? (
                    <Image source={{ uri: identity.avatarUrl }} style={styles.senderAvatar} />
                  ) : (
                    <View style={[styles.senderAvatar, styles.senderAvatarFallback]}>
                      <Text style={styles.senderAvatarInitial}>{identity.displayName.slice(0, 1) || "?"}</Text>
                    </View>
                  ))}
                  <View style={[styles.messageColumn, { maxWidth: messageMaxWidth }]}>
                    <Text style={[styles.senderName, isMe && styles.senderNameMe]}>
                      {identity.displayName || t.caregiver}{isMe ? ` · ${t.chatYouLabel}` : ""}
                    </Text>
                    <View style={[styles.bubble, isMe ? styles.myBubble : styles.otherBubble]}>
                  {msg.imageUrl ? (
                    <Image source={{ uri: msg.imageUrl }} style={styles.sentImage} resizeMode="cover" />
                  ) : (
                    <Text style={[styles.mainText, isMe && { color: "#FFF" }]}>{localizedText || originalText}</Text>
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
                  {isMe && (identity.avatarUrl ? (
                    <Image source={{ uri: identity.avatarUrl }} style={styles.senderAvatar} />
                  ) : (
                    <View style={[styles.senderAvatar, styles.senderAvatarFallback]}>
                      <Text style={styles.senderAvatarInitial}>{identity.displayName.slice(0, 1) || "?"}</Text>
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      <ChatTranslationStatus language={language} {...translated} />
      <View style={styles.inputArea}>
        <Pressable accessibilityRole="button" accessibilityLabel={copy.photo} onPress={pickImageAndSend} style={styles.photoBtn} disabled={uploading}>
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: "#EEE", borderColor: "#CCC", borderWidth: 1 },
            ]}
          >
            {uploading ? (
              <ActivityIndicator size="small" color="#999" />
            ) : (
              <Ionicons name="camera" size={22} color="#666" />
            )}
          </View>
        </Pressable>

        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder={t.inputMessage}
          editable={!sending && !loading && !loadError && !!user && !!targetId}
          multiline
        />

        <Pressable
          onPress={sendMessage}
          accessibilityRole="button"
          accessibilityLabel={copy.send}
          style={({ pressed }) => [
            styles.sendBtn,
            !inputText.trim() && { opacity: 0.5 },
            pressed && { opacity: 0.7 },
          ]}
          disabled={!inputText.trim() || sending}
        >
          <View style={styles.iconCircle}>
            <Ionicons name="send" size={20} color="#FFF" style={{ marginLeft: 3 }} />
          </View>
        </Pressable>
      </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: "#FFF" },
  header: { flexShrink: 0, backgroundColor: "#9999E5", paddingTop: 12, paddingBottom: 15, paddingHorizontal: 15, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.05)", minHeight: 56 },
  headerLeft: { flexDirection: "row", alignItems: "center", flex: 1, minWidth: 0 },
  backBtn: { padding: 5, marginRight: 5 },
  backIcon: { fontSize: 24, color: "#000", fontWeight: "600" },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#000", marginLeft: 5, flexShrink: 1 },

  chatContainer: { padding: 16, paddingBottom: 24, flexGrow: 1 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 10, color: "#666" },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 40 },
  emptyIcon: { fontSize: 80, marginBottom: 20 },
  emptyText: { fontSize: 20, fontWeight: "700", color: "#333" },
  emptySubText: { fontSize: 16, color: "#999", textAlign: "center", marginTop: 10 },

  bubbleWrapper: { marginBottom: 20, width: "100%", flexShrink: 0 },
  myWrapper: { alignSelf: "flex-end" },
  otherWrapper: { alignSelf: "flex-start" },
  identityRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  identityRowMe: { justifyContent: "flex-end" },
  messageColumn: { flexShrink: 1, minWidth: 60 },
  senderName: { flexShrink: 0, fontSize: 13, lineHeight: 18, fontWeight: "700", color: "#6B7280", marginBottom: 6, marginLeft: 4 },
  senderNameMe: { textAlign: "right", marginLeft: 0, marginRight: 4 },
  senderAvatar: { flexShrink: 0, width: 30, height: 30, borderRadius: 15, backgroundColor: "#EDE9FE" },
  senderAvatarFallback: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#D8D3F2" },
  senderAvatarInitial: { fontSize: 13, fontWeight: "800", color: "#7164C6" },
  bubble: {
    padding: 12,
    borderRadius: 16,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  myBubble: {
    backgroundColor: "#9999E5",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 4,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  otherBubble: {
    backgroundColor: "#F2F2F7",
    borderTopLeftRadius: 4,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  mainText: { fontSize: 17, lineHeight: 25, fontWeight: "600" },
  subText: { fontSize: 14, color: "#666" },
  sentImage: { width: 200, height: 150, borderRadius: 8, maxWidth: "100%" },
  divider: { height: 1, backgroundColor: "rgba(0,0,0,0.1)", marginVertical: 6 },
  timeText: { flexShrink: 0, fontSize: 12, lineHeight: 18, color: "#737373", marginTop: 6 },

  inputArea: {
    flexShrink: 0,
    flexDirection: "row",
    paddingHorizontal: 15,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 25 : 15,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#EEE",
    backgroundColor: "#FFF",
  },
  input: {
    flex: 1,
    minWidth: 0,
    backgroundColor: "#F2F2F7",
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
    minHeight: 40,
    maxHeight: 100,
    fontSize: 16,
  },
  photoBtn: { marginRight: 10, padding: 5 },
  sendBtn: { marginLeft: 10, padding: 5 },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#9999E5",
    justifyContent: "center",
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
});
