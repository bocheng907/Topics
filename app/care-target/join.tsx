import React, { useMemo, useState } from "react";
import { AppAlert as Alert } from "@/src/ui/AppAlert";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/src/auth/useAuth";
import { useActiveCareTarget } from "@/src/care-target/useActiveCareTarget";
import { translations } from "@/src/i18n/translations";
import { useLanguage } from "@/src/store/LanguageContext";
import { joinCareTarget } from "@/src/care-target/careTargetApi";
import JoinRequests from "@/src/care-target/JoinRequests";
import { invitationCopy } from "@/src/care-target/invitationCopy";
import { inviteErrorMessage } from "@/src/care-target/inviteFeedback";
import { joinNavigationCopy } from "@/src/care-target/joinNavigationCopy";
import { AppHeader, Button, KeyboardAwareScroll, TextField } from "@/src/ui/components";
import { colors, layout, spacing, typography } from "@/src/ui/theme";

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

  const leaveTarget = user?.role === "caregiver" ? "/caregiver" : "/";

  return (
    <View style={styles.container}>
      <AppHeader title={t.joinCareTarget} left="back" fallbackHref={leaveTarget as any} />
      <KeyboardAwareScroll contentContainerStyle={styles.content}>
        <View style={styles.intro}>
          <Text style={styles.lead}>{t.askInviteCode}</Text>
          <Text style={styles.helper}>{invitationCopy[language].validity}</Text>
        </View>

        <TextField
          label={t.inviteCode}
          value={code}
          maxLength={8}
          onChangeText={setCode}
          placeholder={t.inviteCodePlaceholder}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="go"
          onSubmitEditing={() => { if (canSubmit) void onJoin(); }}
          inputStyle={styles.codeInput}
        />

        <Button label={t.joinNow} size="lg" fullWidth loading={busy} disabled={!canSubmit} onPress={onJoin} />

        <Button
          label={user?.role === "caregiver" ? joinNavigationCopy[language].later : joinNavigationCopy[language].home}
          variant="ghost"
          fullWidth
          disabled={busy}
          onPress={() => {
            router.replace(leaveTarget);
          }}
        />

        <JoinRequests />
      </KeyboardAwareScroll>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  content: {
    width: "100%",
    maxWidth: layout.maxContentWidth,
    alignSelf: "center",
    gap: spacing.lg,
  },
  intro: { gap: spacing.xs },
  lead: { ...typography.body },
  helper: { ...typography.bodySmall },
  codeInput: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 4,
    minHeight: 60,
  },
});
