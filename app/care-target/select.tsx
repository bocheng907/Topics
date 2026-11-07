import { useEffect, useState } from "react";
import { AppAlert as Alert } from "@/src/ui/AppAlert";
import { View, Text, Pressable, ActivityIndicator, ScrollView, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/auth/useAuth";
import { useActiveCareTarget } from "@/src/care-target/useActiveCareTarget";
import { careTargetCopy } from "@/src/i18n/copy/careTargetCopy";
import { translations } from "@/src/i18n/translations";
import { useLanguage } from "@/src/store/LanguageContext";
import { AppHeader, Button, StatusBadge } from "@/src/ui/components";
import { colors, layout, radii, spacing, typography } from "@/src/ui/theme";
import * as Clipboard from "expo-clipboard";

type CareTarget = {
  id: string;
  name: string;
  notes?: string;
  inviteCode: string;
};

export default function CareTargetSelectScreen() {
  const { user, ready } = useAuth();
  const { language } = useLanguage();
  const t = translations[language];
  const ct = careTargetCopy[language];
  const insets = useSafeAreaInsets();
  const {
    ready: ctReady,
    activePatientId,
    linkedCareTargets,
    setActivePatientId,
  } = useActiveCareTarget();

  const [submittingId, setSubmittingId] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace("/(auth)/login" as any);
  }, [ready, user]);

  const goHome = () => {
    const home = user?.role === "caregiver" ? "/caregiver" : "/family";
    router.replace(home as any);
  };

  const copyToClipboard = async (code: string | undefined) => {
    if (!code) {
      Alert.alert(t.prompt, t.noInviteCodeToCopy);
      return;
    }
    await Clipboard.setStringAsync(code);
    Alert.alert(t.copySuccess, `${t.inviteCode} ${code} ${t.inviteCodeCopied}`);
  };

  async function pick(id: string) {
    if (!user || submittingId !== null) return;
    try {
      setSubmittingId(id);
      await setActivePatientId(id);
      const home = user.role === "caregiver" ? "/caregiver" : "/family";
      router.replace(home as any);
    } catch {
      Alert.alert(t.resultErrorTitle, t.switchTargetFailed);
    } finally {
      setSubmittingId(null);
    }
  }

  return (
    <View style={styles.container}>
      {/* The previous screen may be login, so "back" always returns to the role home. */}
      <AppHeader title={t.selectCareTarget} left="back" onBack={goHome} />

      {!ctReady ? (
        <ActivityIndicator style={{ flex: 1 }} color={colors.primary} />
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: spacing.xxl + insets.bottom }]}>
          {(linkedCareTargets as CareTarget[]).map((target) => {
            const isSelected = target.id === activePatientId;
            const isSubmitting = submittingId === target.id;
            return (
              <View key={target.id} style={[styles.card, isSelected && styles.cardSelected]}>
                <Pressable
                  disabled={submittingId !== null}
                  onPress={() => pick(target.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected, busy: isSubmitting }}
                  accessibilityLabel={isSelected ? `${target.name}，${t.active}` : target.name}
                  style={({ pressed }) => [styles.cardMain, pressed && styles.cardPressed]}
                >
                  <View style={styles.nameRow}>
                    <Text style={[styles.name, isSelected && { color: colors.primary }]} numberOfLines={2}>
                      {target.name}
                    </Text>
                    {isSubmitting ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : isSelected ? (
                      <StatusBadge label={t.active} tone="primary" icon="checkmark" />
                    ) : (
                      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                    )}
                  </View>

                  <Text style={[styles.notes, !target.notes && { color: colors.textDisabled }]} numberOfLines={2}>
                    {target.notes ? `${t.note}：${target.notes}` : t.noNote}
                  </Text>
                </Pressable>

                <View style={styles.codeRow}>
                  <View style={styles.codeText}>
                    <Text style={styles.codeLabel}>{t.inviteCode}</Text>
                    <Text style={styles.code} selectable>{target.inviteCode}</Text>
                  </View>
                  <Button
                    label={t.copy}
                    icon="copy-outline"
                    variant="secondary"
                    onPress={() => copyToClipboard(target.inviteCode)}
                    accessibilityLabel={ct.copyCode}
                  />
                </View>
              </View>
            );
          })}

          <View style={styles.actions}>
            <Button label={t.addCareTarget} icon="add" size="lg" fullWidth onPress={() => router.push("/care-target/create")} />
            <Button
              label={t.joinByInviteCode}
              icon="key-outline"
              variant="secondary"
              size="lg"
              fullWidth
              onPress={() => router.push("/care-target/join")}
            />
            <Button label={t.home} variant="ghost" fullWidth onPress={goHome} />
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  content: {
    padding: layout.screenPaddingX,
    gap: spacing.md,
    width: "100%",
    maxWidth: layout.maxContentWidth,
    alignSelf: "center",
  },
  card: {
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  cardSelected: { borderColor: colors.primary, borderWidth: 2 },
  cardMain: { padding: spacing.lg, gap: spacing.xs },
  cardPressed: { backgroundColor: colors.surfaceSunken },
  nameRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  name: { ...typography.title, flex: 1, minWidth: 0 },
  notes: { ...typography.bodySmall },
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    backgroundColor: colors.canvas,
  },
  codeText: { flex: 1, minWidth: 0 },
  codeLabel: { ...typography.caption },
  code: { ...typography.bodyStrong, letterSpacing: 2, color: colors.text },
  actions: { gap: spacing.md, marginTop: spacing.lg },
});
