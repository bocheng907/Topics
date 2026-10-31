import { auth, functions } from "@/firebase/firebaseConfig";
import { AppAlert as Alert } from "@/src/ui/AppAlert";
import { signOut } from "@/src/auth/auditSession";
import { useAuth } from "@/src/auth/useAuth";
import { useLanguage } from "@/src/store/LanguageContext";
import { router, type Href } from "expo-router";
import { httpsCallable } from "firebase/functions";
import { reauthenticateUser, requiresPasswordReauthentication } from "@/src/auth/reauthenticate";
import { accountDeletionCopy } from "@/src/i18n/copy/accountCopy";
import { AppHeader, Button, Card, Divider, KeyboardAwareScroll, SectionHeader, StatusBadge, TextField, type IconName } from "@/src/ui/components";
import { colors, layout, spacing, typography } from "@/src/ui/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

export default function AccountDeletionScreen() {
  const {user} = useAuth();
  const {language} = useLanguage();
  const t = accountDeletionCopy[language];
  const pending = user?.accountStatus === "pending_deletion";
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const passwordRequired = requiresPasswordReauthentication(auth.currentUser);
  const scheduled = useMemo(() => user?.deletionScheduledFor?.toLocaleString(),
    [user?.deletionScheduledFor]);

  async function reauthenticate() {
    const currentUser = auth.currentUser;
    if (!currentUser || (passwordRequired && !password)) {
      throw new Error("missing-credential");
    }
    await reauthenticateUser(currentUser, password);
    await currentUser.getIdToken(true);
  }

  async function submit() {
    setBusy(true);
    try {
      await reauthenticate();
      const callableName = pending ?
        "cancelAccountDeletion" : "requestAccountDeletion";
      await httpsCallable(functions, callableName)({});
      await signOut(auth);
      Alert.alert("", pending ? t.cancelDone : t.requestDone, [
        {text: "OK", onPress: () => router.replace("/(auth)/login")},
      ]);
    } catch (error: any) {
      const isAuthError = String(error?.code || "").startsWith("auth/") ||
        error?.message === "missing-credential";
      Alert.alert("", isAuthError ? t.authFailed : t.failed);
    } finally {
      setBusy(false);
    }
  }

  const facts: { icon: IconName; title: string; body: string }[] = [
    { icon: "time-outline", title: t.graceTitle, body: t.graceBody },
    { icon: "log-out-outline", title: t.signOutTitle, body: t.signOutBody },
    { icon: "trash-outline", title: t.deletedTitle, body: t.deletedBody },
    { icon: "people-outline", title: t.keptTitle, body: t.keptBody },
  ];
  const submitDisabled = busy || (passwordRequired && !password);

  return (
    <View style={styles.screen}>
      {/* Pending accounts can only reach this page, so there is nowhere to go back to. */}
      <AppHeader
        title={pending ? t.pendingTitle : t.title}
        left={pending ? "none" : "back"}
        fallbackHref={"/" as Href}
        onBack={busy ? () => {} : undefined}
      />
      <KeyboardAwareScroll contentContainerStyle={styles.content}>
        {pending ? (
          <>
            <Card style={styles.pendingCard}>
              <StatusBadge label={t.pendingBadge} tone="warning" icon="time-outline" />
              <Text style={styles.body}>{t.pending}</Text>
            </Card>
            {scheduled ? (
              <Card padding={0} style={styles.block}>
                <View style={styles.scheduledRow}>
                  <Text style={styles.scheduledLabel}>{t.scheduled}</Text>
                  <Text style={styles.scheduledValue}>{scheduled}</Text>
                </View>
              </Card>
            ) : null}
          </>
        ) : (
          <>
            <SectionHeader title={t.beforeSection} style={styles.firstSection} />
            <Card padding={0}>
              {facts.map((fact, index) => (
                <View key={fact.title}>
                  {index > 0 ? <Divider inset={spacing.lg + 36 + spacing.md} /> : null}
                  <View style={styles.fact}>
                    <View style={styles.factIcon}>
                      <Ionicons name={fact.icon} size={20} color={colors.textSecondary} />
                    </View>
                    <View style={styles.factText}>
                      <Text style={styles.factTitle}>{fact.title}</Text>
                      <Text style={styles.factBody}>{fact.body}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </Card>
          </>
        )}

        <SectionHeader title={t.verifySection} />
        <Card style={styles.verifyCard}>
          {passwordRequired ? (
            <TextField
              label={t.password}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              editable={!busy}
            />
          ) : (
            <Text style={styles.body}>{t.verifyHintOther}</Text>
          )}
        </Card>

        <View style={styles.actions}>
          {/* Danger colour is reserved for the one irreversible action; cancelling a deletion is restorative. */}
          <Button
            label={pending ? t.cancelDeletion : t.request}
            variant={pending ? "primary" : "danger"}
            size="lg"
            fullWidth
            loading={busy}
            disabled={submitDisabled}
            onPress={submit}
          />
          {!pending ? (
            <Button
              label={t.keepAccount}
              variant="secondary"
              size="lg"
              fullWidth
              disabled={busy}
              onPress={() => router.back()}
            />
          ) : null}
        </View>
      </KeyboardAwareScroll>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { gap: 0, width: "100%", maxWidth: layout.maxContentWidth, alignSelf: "center" },
  firstSection: { paddingTop: spacing.sm },
  body: { ...typography.body },
  pendingCard: { gap: spacing.md },
  block: { marginTop: spacing.lg },
  scheduledRow: { padding: spacing.lg, gap: spacing.xs },
  scheduledLabel: { ...typography.bodySmall },
  scheduledValue: { ...typography.header },
  fact: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, padding: spacing.lg },
  factIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceSunken,
    alignItems: "center",
    justifyContent: "center",
  },
  factText: { flex: 1, gap: 2 },
  factTitle: { ...typography.bodyStrong },
  factBody: { ...typography.bodySmall },
  verifyCard: { gap: spacing.md },
  actions: { marginTop: spacing.xl, gap: spacing.md },
});
