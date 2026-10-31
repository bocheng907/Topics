import { AppAlert as Alert } from "@/src/ui/AppAlert";
import { AppHeader, Button, Card, Divider, KeyboardAwareScroll, ListRow, StatusBadge, TextField } from "@/src/ui/components";
import { colors, spacing, typography } from "@/src/ui/theme";
import { caregiverCopy } from "@/src/i18n/copy/caregiverCopy";
import { useLanguage } from "@/src/store/LanguageContext";
import { httpsCallable } from "firebase/functions";
// app/caregiver/agency-binding.tsx

import { functions, db } from "@/firebase/firebaseConfig";
import { useAuth } from "@/src/auth/useAuth";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  doc,
  getDoc,
} from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from "react-native";

type AgencyMembership = {
  caregiverUid: string;
  caregiverEmail: string;
  agencyUid: string;
  agencyInviteCode: string;
};

export default function AgencyBindingScreen() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const c = caregiverCopy[language];

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [membership, setMembership] =
    useState<AgencyMembership | null>(null);

  const normalizedCode = useMemo(
    () => code.trim().toUpperCase(),
    [code]
  );

  // 先確認這名看護是否已經綁定仲介
  const scope = `${user?.uid}/${user?.role}`;
  const [previousScope, setPreviousScope] = useState<string | null>(null);
  if (previousScope !== scope) {
    setPreviousScope(scope); setMembership(null); setLoading(user?.role === "caregiver");
  }
  useEffect(() => {
    if (!user || user.role !== "caregiver") {
      return;
    }

    let cancelled = false;

    async function loadMembership() {
      try {

        const membershipRef = doc(
          db,
          "agency_memberships",
          user!.uid
        );

        const snap = await getDoc(membershipRef);

        if (!cancelled) {
          if (snap.exists()) {
            setMembership(
              snap.data() as AgencyMembership
            );
          } else {
            setMembership(null);
          }
        }
      } catch (error) {
        console.log(
          "[agency membership] load failed:",
          error
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadMembership();

    return () => {
      cancelled = true;
    };
  }, [user]);

  async function handleBindAgency() {
    if (!user || user.role !== "caregiver" || submitting) return;
    if (membership) { Alert.alert(c.agencyNotice, c.agencyAlreadyBound); return; }
    if (!/^[A-Z0-9]{6}$/.test(normalizedCode)) {
      Alert.alert(c.agencyNotice, c.agencyEnterCode); return;
    }
    setSubmitting(true);
    try {
      const bind = httpsCallable<{code: string}, AgencyMembership>(functions, "bindAgency");
      const result = await bind({code: normalizedCode});
      setMembership(result.data);
      setCode("");
      Alert.alert(c.agencyBindSuccessTitle, c.agencyBindSuccessMessage);
    } catch {
      Alert.alert(c.agencyBindFailedTitle, c.agencyBindFailedMessage);
    } finally { setSubmitting(false); }
  }

  // Same back behaviour as before: once bound, go to the caregiver home.
  const header = (
    <AppHeader
      title={c.agencyTitle}
      onBack={membership ? () => router.replace("/caregiver" as any) : undefined}
      fallbackHref={"/caregiver" as any}
    />
  );

  if (loading) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  const codeInvalid = normalizedCode.length !== 6;

  return (
    <View style={styles.container}>
      {header}

      <KeyboardAwareScroll contentContainerStyle={styles.content}>
        {membership ? (
          <>
            <View style={styles.hero}>
              <View style={[styles.heroIcon, styles.heroIconSuccess]}>
                <Ionicons name="checkmark-circle" size={44} color={colors.success} />
              </View>
              <Text style={styles.title}>{c.agencyBoundTitle}</Text>
              <Text style={styles.subtitle}>{c.agencyBoundSubtitle}</Text>
            </View>

            <Card padding={0}>
              <ListRow
                title={c.agencyInviteCodeLabel}
                right={<Text style={styles.infoValue}>{membership.agencyInviteCode}</Text>}
              />
              <Divider inset={spacing.lg} />
              <ListRow
                title={c.agencyStatusLabel}
                right={<StatusBadge label={c.agencyStatusBound} tone="success" />}
              />
            </Card>

            <Text style={styles.note}>{c.agencyChangeNote}</Text>

            <Button
              label={c.agencyBackHome}
              icon="home-outline"
              size="lg"
              fullWidth
              onPress={() => router.replace("/caregiver" as any)}
            />
          </>
        ) : (
          <>
            <View style={styles.hero}>
              <View style={styles.heroIcon}>
                <Ionicons name="business-outline" size={40} color={colors.primary} />
              </View>
              <Text style={styles.title}>{c.agencyBindTitle}</Text>
              <Text style={styles.subtitle}>{c.agencyBindSubtitle}</Text>
            </View>

            <TextField
              label={c.agencyCodeLabel}
              value={code}
              onChangeText={setCode}
              placeholder={c.agencyCodePlaceholder}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
              returnKeyType="done"
              onSubmitEditing={handleBindAgency}
              inputStyle={styles.codeInput}
            />

            <Button
              label={c.agencyConfirmBind}
              size="lg"
              fullWidth
              onPress={handleBindAgency}
              loading={submitting}
              disabled={submitting || codeInvalid}
            />

            <Card tone="sunken" style={styles.helpCard}>
              <Ionicons name="information-circle-outline" size={22} color={colors.textSecondary} />
              <Text style={styles.helpText}>{c.agencyHelp}</Text>
            </Card>
          </>
        )}
      </KeyboardAwareScroll>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  content: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    paddingTop: spacing.xxl,
  },
  hero: { alignItems: "center", marginBottom: spacing.sm },
  heroIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    marginBottom: spacing.lg,
  },
  heroIconSuccess: { backgroundColor: colors.successSoft },
  title: { ...typography.title, textAlign: "center" },
  subtitle: { ...typography.body, color: colors.textSecondary, marginTop: spacing.sm, textAlign: "center" },
  codeInput: { textAlign: "center", fontSize: 26, lineHeight: 32, fontWeight: "700", letterSpacing: 6, minHeight: 60 },
  helpCard: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  helpText: { ...typography.bodySmall, flex: 1 },
  infoValue: { ...typography.bodyStrong, letterSpacing: 2 },
  note: { ...typography.bodySmall, textAlign: "center" },
});
