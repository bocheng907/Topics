import React, { useMemo, useState } from "react";
import { AppAlert as Alert } from "@/src/ui/AppAlert";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/src/auth/useAuth";
import { useActiveCareTarget } from "@/src/care-target/useActiveCareTarget";
import { translations } from "@/src/i18n/translations";
import { useLanguage } from "@/src/store/LanguageContext";
import { joinCareTarget } from "@/src/care-target/careTargetApi";
import JoinRequests from "@/src/care-target/JoinRequests";
import { invitationCopy } from "@/src/care-target/invitationCopy";
import { inviteErrorMessage } from "@/src/care-target/inviteFeedback";

export default function CareTargetJoinScreen() {
  const { user } = useAuth();
  const { setActivePatientId } = useActiveCareTarget();
  const { language } = useLanguage();
  const t = translations[language];
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const normalizedCode = useMemo(() => code.trim().toUpperCase(), [code]);
  const canSubmit = normalizedCode.length >= 4 && normalizedCode.length <= 8 && !busy;

  const onJoin = async () => {
    if (!user || !normalizedCode || busy) return;
    setBusy(true);

    try {
      const { data: result } = await joinCareTarget({ code: normalizedCode });

      if (result.status !== "approved" && !result.alreadyJoined) {
        Alert.alert(t.prompt, result.status === "pending" ? invitationCopy[language].submitted : invitationCopy[language].error);
        return;
      }

      if (result.alreadyJoined) {
        await setActivePatientId(result.patientId);
        Alert.alert(t.prompt, t.alreadyJoined, [
          {
            text: t.goUse,
            onPress: async () => {
              const home = user.role === "caregiver" ? "/caregiver" : "/family";
              router.replace(home as any);
            },
          },
        ]);
        return;
      }

      await setActivePatientId(result.patientId);

      Alert.alert(t.joinSuccess, t.selectCareTarget, [
        {
          text: t.startUse,
          onPress: async () => {
            const home = user.role === "caregiver" ? "/caregiver" : "/family";
            router.replace(home as any);
          },
        },
      ]);
    } catch (e: any) {
      console.log("join patient error:", e);

      if (e?.code === "functions/not-found" || e?.code === "functions/invalid-argument") {
        Alert.alert(t.invalidInviteCode, inviteErrorMessage(e, language, t.checkInviteCode, t.inviteExpired));
        return;
      }
      if (e?.code === "functions/permission-denied") {
        Alert.alert(
          t.joinFailed,
          t.inviteJoinDenied
        );
        return;
      }

      Alert.alert(t.joinFailed, t.tryLater);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 90, gap: 24 }}>
      <JoinRequests />
      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 28, fontWeight: "900" }}>{t.joinCareTarget}</Text>
        <Text style={{ fontSize: 16, color: "#666" }}>{t.askInviteCode}</Text>
        <Text style={{ color: "#666" }}>{invitationCopy[language].validity}</Text>
      </View>

      <View style={{ gap: 12 }}>
        <TextInput
          value={code}
          maxLength={8}
          onChangeText={setCode}
          placeholder={t.inviteCodePlaceholder}
          autoCapitalize="characters"
          style={{
            borderWidth: 1,
            borderColor: "#007AFF",
            borderRadius: 12,
            padding: 20,
            fontSize: 24,
            fontWeight: "800",
            textAlign: "center",
            letterSpacing: 4,
            backgroundColor: "#F9FBFF",
          }}
        />
      </View>

      <Pressable
        onPress={onJoin}
        disabled={!canSubmit}
        style={{ backgroundColor: canSubmit ? "#007AFF" : "#CCC", padding: 18, borderRadius: 12 }}
      >
        <Text style={{ color: "#FFF", textAlign: "center", fontWeight: "900", fontSize: 18 }}>
          {t.joinNow}
        </Text>
      </Pressable>

      <Pressable
          onPress={() => {
          router.replace("/caregiver");
        }}
        style={({ pressed }) => ({
          marginTop: 10,
          padding: 12,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Text
          style={{
            color: "#666",
            textAlign: "center",
            fontWeight: "700",
            fontSize: 16,
          }}
        >
          稍後再綁定
        </Text>
      </Pressable>
    </ScrollView>
  );
}
