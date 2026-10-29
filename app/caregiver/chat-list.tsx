import { ScreenHeader } from "@/src/ui/ScreenLayout";
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
      <ScreenHeader menuSpace style={styles.headerSpacer}><Text style={styles.caregiverName}>{t.chatRoom}</Text></ScreenHeader>

      <ScrollView>
        <Pressable
          onPress={() =>
            router.push({
              pathname: "/caregiver/chat-room",
              params: { patientId: activePatientId ?? "" },
            })
          }
          style={({ pressed }) => [
            styles.chatItem,
            pressed && { backgroundColor: "#F5F5F5" },
          ]}
          disabled={!activePatientId}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {activePatient?.name ? activePatient.name.substring(0, 1) : ""}
            </Text>
          </View>

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
        </Pressable>
        <ChatTranslationStatus language={language} {...translated} />

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF" },
  headerSpacer: { flexShrink: 0, backgroundColor: "#9999E5", paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, width: "100%", borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.05)" },
  chatItem: {
    flexDirection: "row",
    padding: 20,
    alignItems: "center",
  },
  avatar: {
    flexShrink: 0,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#E0E0E0",
    marginRight: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#000",
    fontSize: 24,
    fontWeight: "bold",
  },
  chatInfo: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  chatHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 },
  caregiverName: { fontSize: 20, fontWeight: "900", color: "#000", flexShrink: 1, minWidth: 0 },
  timeText: {
    fontSize: 14,
    color: "#999",
  },
  lastMsgText: {
    fontSize: 16,
    color: "#666",
  },
});
