import { AppHeader, Card } from "@/src/ui/components";
import { colors, layout, spacing, typography } from "@/src/ui/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { router } from "expo-router";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/firebase/firebaseConfig";
import { useActiveCareTarget } from "@/src/care-target/useActiveCareTarget";
import { translations } from "@/src/i18n/translations";
import { useLanguage } from "@/src/store/LanguageContext";
import { useAuth } from "@/src/auth/useAuth";
import { useChatTranslation } from "@/src/chat/useChatTranslation";
import { ChatTranslationStatus, chatTranslationCopy } from "@/src/chat/ChatTranslationStatus";
import { chatLocales } from "@/src/chat/chatTranslation";
import { chatIdentity } from "@/src/chat/chatIdentity";
import { useChatProfiles } from "@/src/chat/useChatProfiles";
import UserAvatar from "@/src/ui/components/UserAvatar";

export default function CaregiverChatListScreen() {
  const { activePatientId, activePatient } = useActiveCareTarget();
  const { language } = useLanguage();
  const { user } = useAuth();
  const t = translations[language];
  const [lastMessage, setLastMessage] = useState<any>(null);
  const scope = `${user?.uid}/${activePatientId}/messages`;
  const [previousPatient, setPreviousPatient] = useState(scope);
  if (previousPatient !== scope) { setPreviousPatient(scope); setLastMessage(null); }
  const translated = useChatTranslation(lastMessage ? [lastMessage] : [], language, scope);
  // 最後一則訊息若是對方傳的，顯示對方頭像（與聊天室同一份 getChatProfiles 結果）；否則顯示長輩字首
  const { profiles } = useChatProfiles(user?.uid, activePatientId, "caregiver", lastMessage ? [lastMessage] : []);
  const counterpart = lastMessage?.senderId && lastMessage.senderId !== user?.uid
    ? { ...chatIdentity(lastMessage, profiles, activePatient?.name ?? ""), uid: lastMessage.senderId as string }
    : null;

  useEffect(() => {
    if (!activePatientId || !user?.uid) {
      return;
    }

    let active = true;
    const q = query(
      collection(db, "chats", activePatientId, "messages"),
      orderBy("createdAt", "desc"),
      limit(1)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        if (!active) return;
        if (!snap.empty) {
          setLastMessage({ ...snap.docs[0].data(), id: snap.docs[0].id });
        } else {
          setLastMessage(null);
        }
      },
      (error) => {
        if (!active) return;
        console.log("caregiver chat-list snapshot failed:", error);
        setLastMessage(null);
      }
    );

    return () => { active = false; unsub(); };
  }, [activePatientId, user?.uid]);



  return (
    <View style={styles.container}>
      <AppHeader title={t.chatRoom} left="menu" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card padding={0}>
        <Pressable
          onPress={() =>
            router.push({
              pathname: "/caregiver/chat-room",
              params: { patientId: activePatientId ?? "" },
            })
          }
          style={({ pressed }) => [
            styles.chatItem,
            pressed && styles.chatItemPressed,
            !activePatientId && styles.chatItemDisabled,
          ]}
          disabled={!activePatientId}
          accessibilityRole="button"
          accessibilityState={{ disabled: !activePatientId }}
        >
          <UserAvatar
            uri={counterpart?.avatarUrl}
            name={counterpart?.displayName || activePatient?.name}
            uid={counterpart?.uid || activePatientId}
            size={56}
          />

          <View style={styles.chatInfo}>
            <View style={styles.chatHeader}>
              <Text style={styles.caregiverName}>
                {activePatient?.name
                  ? language === "zh"
                    ? `${activePatient.name}${t.familyLabel}`
                    : `${activePatient.name} ${t.familyLabel}`
                  : t.chatRoom}
              </Text>

              <Text style={styles.timeText}>
                {lastMessage?.createdAt?.toMillis
                  ? new Date(lastMessage.createdAt.toMillis()).toLocaleTimeString(chatLocales[language], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : ""}
              </Text>
            </View>

            <Text style={styles.lastMsgText} numberOfLines={1}>
              {lastMessage
                ? lastMessage.imageUrl
                  ? chatTranslationCopy[language].photo
                  : translated.text(lastMessage)
                : t.noChatRecords}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={colors.textMuted} />
        </Pressable>
        </Card>
        <ChatTranslationStatus language={language} {...translated} />

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  scrollContent: {
    padding: layout.screenPaddingX,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
    width: "100%",
    maxWidth: layout.maxContentWidth,
    alignSelf: "center",
  },
  chatItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 88,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  chatItemPressed: { backgroundColor: colors.surfaceSunken },
  chatItemDisabled: { opacity: 0.5 },
  chatInfo: { flex: 1, minWidth: 0, gap: spacing.xs },
  chatHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 },
  caregiverName: { ...typography.bodyStrong, fontSize: 18, flexShrink: 1, minWidth: 0 },
  timeText: { ...typography.caption },
  lastMsgText: { ...typography.bodySmall },
});
