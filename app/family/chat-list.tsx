import { AppHeader } from "@/src/ui/components";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { db } from "@/firebase/firebaseConfig";
import { useActiveCareTarget } from "@/src/care-target/useActiveCareTarget";
import { chatMessageCollection, type CareChatRoom } from "@/src/chat/rooms";
import { colors, layout, radii, spacing, typography } from "@/src/ui/theme";
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

  const renderRoom = (
    room: CareChatRoom,
    icon: "person" | "people",
    title: string,
    message: any,
    translated: typeof caregiverTranslation,
    fallback: string,
  ) => (
    <Pressable
      disabled={!activePatientId}
      onPress={() => open(room)}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${elderName}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed, !activePatientId && styles.disabled]}
    >
      <View style={styles.avatar}>
        <Ionicons name={icon} size={26} color={colors.primary} />
      </View>
      <View style={styles.info}>
        <View style={styles.row}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <Text style={styles.time}>{time(message, language)}</Text>
        </View>
        <Text style={styles.elder} numberOfLines={1}>{elderName}</Text>
        <Text style={styles.preview} numberOfLines={1}>{preview(message, translated, fallback)}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <AppHeader title={t.chatRoom} left="menu" />
      <ScrollView contentContainerStyle={styles.list}>
        {renderRoom("caregiver", "person", t.caregiverChatTitle, caregiverMessage, caregiverTranslation, t.noChatRecords)}
        <ChatTranslationStatus language={language} {...caregiverTranslation} />

        {renderRoom("family", "people", t.familyGroupTitle, familyMessage, familyTranslation, t.familyGroupAutoJoinHint)}
        <ChatTranslationStatus language={language} {...familyTranslation} />
        <Text style={styles.hint}>{t.familyGroupFixedHint}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  list: { padding: spacing.lg, gap: spacing.md, width: "100%", maxWidth: layout.maxContentWidth, alignSelf: "center" },
  card: {
    minHeight: 96,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pressed: { backgroundColor: colors.surfaceSunken },
  disabled: { opacity: 0.5 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primarySoft, justifyContent: "center", alignItems: "center" },
  info: { flex: 1, minWidth: 0 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm },
  title: { ...typography.bodyStrong, fontSize: 18, flexShrink: 1 },
  elder: { ...typography.bodySmall, marginTop: 2 },
  preview: { ...typography.bodySmall, color: colors.textMuted, marginTop: spacing.xs },
  time: { ...typography.caption },
  hint: { ...typography.bodySmall, color: colors.textMuted, textAlign: "center", paddingHorizontal: spacing.md, marginTop: spacing.xs },
});
