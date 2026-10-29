import { ScreenHeader } from "@/src/ui/ScreenLayout";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { db } from "@/firebase/firebaseConfig";
import { useActiveCareTarget } from "@/src/care-target/useActiveCareTarget";
import { chatMessageCollection, FAMILY_GROUP_COLOR, type CareChatRoom } from "@/src/chat/rooms";
import { translations } from "@/src/i18n/translations";
import { useLanguage } from "@/src/store/LanguageContext";
import { useAuth } from "@/src/auth/useAuth";
import { useChatTranslation } from "@/src/chat/useChatTranslation";
import { ChatTranslationStatus, chatTranslationCopy } from "@/src/chat/ChatTranslationStatus";
import { chatLocales } from "@/src/chat/chatTranslation";
import type { Language } from "@/src/i18n/translations";

function useLastMessage(patientId: string | null, room: CareChatRoom) {
  const { user } = useAuth();
  const [message, setMessage] = useState<any>(null);
  const scope = `${user?.uid}/${patientId}/${room}`;
  const [previousScope, setPreviousScope] = useState(scope);
  if (previousScope !== scope) { setPreviousScope(scope); setMessage(null); }
  useEffect(() => {
    if (!patientId || !user?.uid) return;
    let active = true;
    const q = query(collection(db, "chats", patientId, chatMessageCollection(room)), orderBy("createdAt", "desc"), limit(1));
    const unsubscribe = onSnapshot(q, snap => {
      if (active) setMessage(snap.empty ? null : { ...snap.docs[0].data(), id: snap.docs[0].id });
    }, () => { if (active) setMessage(null); });
    return () => { active = false; unsubscribe(); };
  }, [patientId, room, user?.uid]);
  return message;
}

function time(message: any, language: Language) {
  return message?.createdAt?.toMillis
    ? new Date(message.createdAt.toMillis()).toLocaleTimeString(chatLocales[language], { hour: "2-digit", minute: "2-digit" })
    : "";
}

export default function FamilyChatListScreen() {
  const { activePatientId, activePatient } = useActiveCareTarget();
  const { language } = useLanguage();
  const { user } = useAuth();
  const t = translations[language];
  const caregiverMessage = useLastMessage(activePatientId, "caregiver");
  const familyMessage = useLastMessage(activePatientId, "family");
  const caregiverTranslation = useChatTranslation(caregiverMessage ? [caregiverMessage] : [], language, `${user?.uid}/${activePatientId}/messages`);
  const familyTranslation = useChatTranslation(familyMessage ? [familyMessage] : [], language, `${user?.uid}/${activePatientId}/familyMessages`);
  const preview = (message: any, translated: typeof caregiverTranslation, fallback: string) =>
    !message ? fallback : message.imageUrl ? chatTranslationCopy[language].photo : translated.text(message) || fallback;
  const elderName = activePatient?.name || t.chatRoom;

  const open = (room: CareChatRoom) => router.push({
    pathname: "/family/chat-room",
    params: { patientId: activePatientId ?? "", room },
  });

  return (
    <View style={styles.container}>
      <ScreenHeader menuSpace style={styles.header}><Text style={styles.headerTitle}>{t.chatRoom}</Text></ScreenHeader>
      <ScrollView contentContainerStyle={styles.list}>
        <Pressable disabled={!activePatientId} onPress={() => open("caregiver")} style={({pressed}) => [styles.card, pressed && styles.pressed]}>
          <View style={styles.avatar}><Ionicons name="person" size={28} color="#666" /></View>
          <View style={styles.info}>
            <View style={styles.row}><Text style={styles.title}>{t.caregiverChatTitle}</Text><Text style={styles.time}>{time(caregiverMessage, language)}</Text></View>
            <Text style={styles.elder}>{elderName}</Text>
            <Text style={styles.preview} numberOfLines={1}>{preview(caregiverMessage, caregiverTranslation, t.noChatRecords)}</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#AAA" />
        </Pressable>
        <ChatTranslationStatus language={language} {...caregiverTranslation} />

        <Pressable disabled={!activePatientId} onPress={() => open("family")} style={({pressed}) => [styles.card, styles.familyCard, pressed && styles.familyPressed]}>
          <View style={styles.familyAvatar}><Ionicons name="people" size={30} color="#FFF" /></View>
          <View style={styles.info}>
            <View style={styles.row}><Text style={[styles.title, styles.familyTitle]}>{t.familyGroupTitle}</Text><Text style={styles.familyTime}>{time(familyMessage, language)}</Text></View>
            <Text style={styles.familyElder}>{elderName}</Text>
            <Text style={styles.familyPreview} numberOfLines={1}>{preview(familyMessage, familyTranslation, t.familyGroupAutoJoinHint)}</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#FFF" />
        </Pressable>
        <ChatTranslationStatus language={language} {...familyTranslation} />
        <Text style={styles.hint}>{t.familyGroupFixedHint}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F7FC" },
  header: { backgroundColor: FAMILY_GROUP_COLOR, paddingTop: 12, paddingBottom: 18, paddingHorizontal: 22 },
  headerTitle: { color: "#FFF", fontSize: 24, fontWeight: "900" },
  list: { padding: 18, gap: 14 },
  card: { minHeight: 106, flexDirection: "row", alignItems: "center", padding: 16, borderRadius: 20, backgroundColor: "#FFF", shadowColor: "#000", shadowOpacity: .08, shadowRadius: 10, elevation: 3 },
  pressed: { backgroundColor: "#F1F1F1" }, familyCard: { backgroundColor: FAMILY_GROUP_COLOR }, familyPressed: { opacity: .88 },
  avatar: { width: 58, height: 58, borderRadius: 29, backgroundColor: "#ECECEF", justifyContent: "center", alignItems: "center", marginRight: 14 },
  familyAvatar: { width: 58, height: 58, borderRadius: 29, backgroundColor: "rgba(255,255,255,.22)", justifyContent: "center", alignItems: "center", marginRight: 14 },
  info: { flex: 1, minWidth: 0 }, row: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8 },
  title: { flexShrink: 1, fontSize: 20, fontWeight: "900", color: "#222" }, elder: { color: "#666", marginTop: 2, fontWeight: "700" },
  preview: { color: "#777", marginTop: 7, fontSize: 14 }, time: { color: "#999", fontSize: 12 },
  familyTitle: { color: "#FFF" }, familyElder: { color: "rgba(255,255,255,.86)", marginTop: 2, fontWeight: "700" },
  familyPreview: { color: "rgba(255,255,255,.82)", marginTop: 7, fontSize: 14 }, familyTime: { color: "rgba(255,255,255,.75)", fontSize: 12 },
  hint: { color: "#777", textAlign: "center", lineHeight: 20, paddingHorizontal: 12, marginTop: 4 },
});
