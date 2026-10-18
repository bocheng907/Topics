import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { db } from "@/firebase/firebaseConfig";
import { useActiveCareTarget } from "@/src/care-target/useActiveCareTarget";
import { chatMessageCollection, FAMILY_GROUP_COLOR, type CareChatRoom } from "@/src/chat/rooms";
import { translations } from "@/src/i18n/translations";
import { useLanguage } from "@/src/store/LanguageContext";

function useLastMessage(patientId: string | null, room: CareChatRoom) {
  const [message, setMessage] = useState<any>(null);
  useEffect(() => {
    if (!patientId) { setMessage(null); return; }
    const q = query(collection(db, "chats", patientId, chatMessageCollection(room)), orderBy("createdAt", "desc"), limit(1));
    return onSnapshot(q, snap => setMessage(snap.empty ? null : snap.docs[0].data()), () => setMessage(null));
  }, [patientId, room]);
  return message;
}

function preview(message: any, fallback: string) {
  if (!message) return fallback;
  return message.imageUrl ? "[照片]" : message.text || fallback;
}

function time(message: any) {
  return message?.createdAt?.toMillis
    ? new Date(message.createdAt.toMillis()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";
}

export default function FamilyChatListScreen() {
  const { activePatientId, activePatient } = useActiveCareTarget();
  const { language } = useLanguage();
  const t = translations[language];
  const caregiverMessage = useLastMessage(activePatientId, "caregiver");
  const familyMessage = useLastMessage(activePatientId, "family");
  const elderName = activePatient?.name || t.chatRoom;

  const open = (room: CareChatRoom) => router.push({
    pathname: "/family/chat-room",
    params: { patientId: activePatientId ?? "", room },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}><Text style={styles.headerTitle}>{t.chatRoom}</Text></View>
      <ScrollView contentContainerStyle={styles.list}>
        <Pressable disabled={!activePatientId} onPress={() => open("caregiver")} style={({pressed}) => [styles.card, pressed && styles.pressed]}>
          <View style={styles.avatar}><Ionicons name="person" size={28} color="#666" /></View>
          <View style={styles.info}>
            <View style={styles.row}><Text style={styles.title}>{t.caregiverChatTitle}</Text><Text style={styles.time}>{time(caregiverMessage)}</Text></View>
            <Text style={styles.elder}>{elderName}</Text>
            <Text style={styles.preview} numberOfLines={1}>{preview(caregiverMessage, t.noChatRecords)}</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#AAA" />
        </Pressable>

        <Pressable disabled={!activePatientId} onPress={() => open("family")} style={({pressed}) => [styles.card, styles.familyCard, pressed && styles.familyPressed]}>
          <View style={styles.familyAvatar}><Ionicons name="people" size={30} color="#FFF" /></View>
          <View style={styles.info}>
            <View style={styles.row}><Text style={[styles.title, styles.familyTitle]}>{t.familyGroupTitle}</Text><Text style={styles.familyTime}>{time(familyMessage)}</Text></View>
            <Text style={styles.familyElder}>{elderName}</Text>
            <Text style={styles.familyPreview} numberOfLines={1}>{preview(familyMessage, t.familyGroupAutoJoinHint)}</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#FFF" />
        </Pressable>
        <Text style={styles.hint}>{t.familyGroupFixedHint}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F7FC" },
  header: { backgroundColor: FAMILY_GROUP_COLOR, paddingTop: Platform.OS === "ios" ? 62 : 38, paddingBottom: 18, paddingHorizontal: 22 },
  headerTitle: { color: "#FFF", fontSize: 24, fontWeight: "900" },
  list: { padding: 18, gap: 14 },
  card: { minHeight: 106, flexDirection: "row", alignItems: "center", padding: 16, borderRadius: 20, backgroundColor: "#FFF", shadowColor: "#000", shadowOpacity: .08, shadowRadius: 10, elevation: 3 },
  pressed: { backgroundColor: "#F1F1F1" }, familyCard: { backgroundColor: FAMILY_GROUP_COLOR }, familyPressed: { opacity: .88 },
  avatar: { width: 58, height: 58, borderRadius: 29, backgroundColor: "#ECECEF", justifyContent: "center", alignItems: "center", marginRight: 14 },
  familyAvatar: { width: 58, height: 58, borderRadius: 29, backgroundColor: "rgba(255,255,255,.22)", justifyContent: "center", alignItems: "center", marginRight: 14 },
  info: { flex: 1 }, row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  title: { fontSize: 20, fontWeight: "900", color: "#222" }, elder: { color: "#666", marginTop: 2, fontWeight: "700" },
  preview: { color: "#777", marginTop: 7, fontSize: 14 }, time: { color: "#999", fontSize: 12 },
  familyTitle: { color: "#FFF" }, familyElder: { color: "rgba(255,255,255,.86)", marginTop: 2, fontWeight: "700" },
  familyPreview: { color: "rgba(255,255,255,.82)", marginTop: 7, fontSize: 14 }, familyTime: { color: "rgba(255,255,255,.75)", fontSize: 12 },
  hint: { color: "#777", textAlign: "center", lineHeight: 20, paddingHorizontal: 12, marginTop: 4 },
});
