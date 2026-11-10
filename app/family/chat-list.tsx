import { AppHeader } from "@/src/ui/components";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useActiveCareTarget } from "@/src/care-target/useActiveCareTarget";
import { type CareChatRoom } from "@/src/chat/rooms";
import { useLastChatMessage } from "@/src/chat/useLastChatMessage";
import { chatCopy } from "@/src/chat/chatCopy";
import type { SnapshotStatus } from "@/src/data/useScopedSnapshot";
import { DataLoadFeedback } from "@/src/ui/components/DataLoadFeedback";
import { colors, layout, radii, spacing, typography } from "@/src/ui/theme";
import { translations } from "@/src/i18n/translations";
import { useLanguage } from "@/src/store/LanguageContext";
import { useAuth } from "@/src/auth/useAuth";
import { useChatTranslation } from "@/src/chat/useChatTranslation";
import { ChatTranslationStatus, chatTranslationCopy } from "@/src/chat/ChatTranslationStatus";
import { chatLocales } from "@/src/chat/chatTranslation";
import type { Language } from "@/src/i18n/translations";
import { chatIdentity } from "@/src/chat/chatIdentity";
import { useChatProfiles } from "@/src/chat/useChatProfiles";
import UserAvatar from "@/src/ui/components/UserAvatar";

function time(message: any, language: Language) {
  return message?.createdAt?.toMillis
    ? new Date(message.createdAt.toMillis()).toLocaleTimeString(chatLocales[language], { hour: "2-digit", minute: "2-digit" })
    : "";
}

export default function FamilyChatListScreen() {
  const { activePatientId, activePatient, ready: targetReady } = useActiveCareTarget();
  const { language } = useLanguage();
  const { user } = useAuth();
  const t = translations[language];
  const caregiverLast = useLastChatMessage(activePatientId, "caregiver", targetReady);
  const familyLast = useLastChatMessage(activePatientId, "family", targetReady);
  const caregiverMessage = caregiverLast.data;
  const familyMessage = familyLast.data;
  const caregiverTranslation = useChatTranslation(caregiverMessage ? [caregiverMessage] : [], language, `${user?.uid}/${activePatientId}/messages`);
  const familyTranslation = useChatTranslation(familyMessage ? [familyMessage] : [], language, `${user?.uid}/${activePatientId}/familyMessages`);
  const preview = (message: any, translated: typeof caregiverTranslation, fallback: string, status: SnapshotStatus) =>
    message ? (message.imageUrl ? chatTranslationCopy[language].photo : translated.text(message) || fallback)
      : status === "loading" || status === "cached" ? t.loadingMessages : status === "error" ? chatCopy[language].loadFailed
      : status === "idle" ? t.noSelectedPatient : fallback;
  const elderName = activePatient?.name || t.chatRoom;
  // 照服員對話：最後一則若是對方傳的，顯示對方頭像（與聊天室同一份 getChatProfiles 結果）
  const { profiles: caregiverProfiles } = useChatProfiles(
    user?.uid, activePatientId, "caregiver", caregiverMessage ? [caregiverMessage] : []);
  const caregiverCounterpart = caregiverMessage?.senderId && caregiverMessage.senderId !== user?.uid
    ? { ...chatIdentity(caregiverMessage, caregiverProfiles, ""), uid: caregiverMessage.senderId as string }
    : null;

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
    status: SnapshotStatus,
  ) => (
    <Pressable
      disabled={!activePatientId}
      onPress={() => open(room)}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${elderName}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed, !activePatientId && styles.disabled]}
    >
      {room === "caregiver" && caregiverCounterpart ? (
        <UserAvatar
          uri={caregiverCounterpart.avatarUrl}
          name={caregiverCounterpart.displayName}
          uid={caregiverCounterpart.uid}
          size={52}
        />
      ) : (
        <View style={styles.avatar}>
          <Ionicons name={icon} size={26} color={colors.primary} />
        </View>
      )}
      <View style={styles.info}>
        <View style={styles.row}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <Text style={styles.time}>{time(message, language)}</Text>
        </View>
        <Text style={styles.elder} numberOfLines={1}>{elderName}</Text>
        <Text style={styles.preview} numberOfLines={1}>{preview(message, translated, fallback, status)}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <AppHeader title={t.chatRoom} left="menu" />
      <ScrollView contentContainerStyle={styles.list}>
        {renderRoom("caregiver", "person", t.caregiverChatTitle, caregiverMessage, caregiverTranslation, t.noChatRecords, caregiverLast.status)}
        <DataLoadFeedback status={caregiverLast.status === "error" || caregiverLast.status === "cached" ? caregiverLast.status : "ready"} language={language} retry={caregiverLast.retry} />
        <ChatTranslationStatus language={language} {...caregiverTranslation} />

        {renderRoom("family", "people", t.familyGroupTitle, familyMessage, familyTranslation, t.familyGroupAutoJoinHint, familyLast.status)}
        <DataLoadFeedback status={familyLast.status === "error" || familyLast.status === "cached" ? familyLast.status : "ready"} language={language} retry={familyLast.retry} />
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
