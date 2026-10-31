import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import { useAuth } from "@/src/auth/useAuth";
import type { Role } from "@/src/auth/AuthProvider";
import { translations } from "@/src/i18n/translations";
import { authCopy } from "@/src/i18n/copy/authCopy";
import { useLanguage } from "@/src/store/LanguageContext";
import { isValidRegistrationPassword } from "@/src/auth/passwordPolicy";
import { PRIVACY_POLICY_VERSION, privacyCopy } from "@/src/privacy/consent";
import { PrivacyPolicyLink } from "@/src/privacy/PrivacyPolicyLink";
import { registrationErrorMessage } from "@/src/auth/registrationError";
import { normalizeRegistrationEmail } from "@/src/auth/registrationAccount";
import { Button, KeyboardAwareScroll, TextField, type IconName } from "@/src/ui/components";
import { colors, layout, radii, spacing, typography } from "@/src/ui/theme";

export default function RegisterScreen() {
  const { register } = useAuth();
  const { language } = useLanguage();
  const t = translations[language];
  const privacy = privacyCopy[language];
  const c = authCopy[language];

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("caregiver");
  const [emergencyPhone1, setEmergencyPhone1] = useState("");
  const [emergencyPhone2, setEmergencyPhone2] = useState("");
  const [loading, setLoading] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [registrationError, setRegistrationError] = useState("");

  async function onRegister() {
    if (loading) return;
    setRegistrationError("");
    if (!privacyAccepted) {
      setRegistrationError(privacy.required);
      Alert.alert(t.prompt, privacy.required);
      return;
    }
    const normalizedName = displayName.normalize("NFKC").trim();
    if (!normalizedName || normalizedName.length > 120) {
      setRegistrationError(t.displayNameValidation);
      Alert.alert(t.prompt, t.displayNameValidation);
      return;
    }

    const normalizedEmail = normalizeRegistrationEmail(email);
    const emailLooksValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizedEmail);
    if (!emailLooksValid || !isValidRegistrationPassword(password)) {
      setRegistrationError(t.registerValidation);
      Alert.alert(t.prompt, t.registerValidation);
      return;
    }

    if (role === "family" && (!emergencyPhone1.trim() || !emergencyPhone2.trim())) {
      setRegistrationError(t.familyPhoneValidation);
      Alert.alert(t.prompt, t.familyPhoneValidation);
      return;
    }

    try {
      setLoading(true);

      const extra = {
        privacyConsent: { accepted: privacyAccepted, version: PRIVACY_POLICY_VERSION },
        displayName: normalizedName,
        emergencyPhone1,
        emergencyPhone2,
      };
      await register(normalizedEmail, password, role, extra);

      router.replace("/");
    } catch (e: unknown) {
      const message = registrationErrorMessage(e, t, privacy.required);
      setRegistrationError(message);
      Alert.alert(t.registerFailed, message);
    } finally {
      setLoading(false);
    }
  }

  const roleOptions: { value: Role; label: string; description: string; icon: IconName }[] = [
    { value: "caregiver", label: t.caregiver, description: c.caregiverDesc, icon: "medkit-outline" },
    { value: "family", label: t.family, description: c.familyDesc, icon: "people-outline" },
    { value: "agency", label: t.agency, description: c.agencyDesc, icon: "business-outline" },
  ];

  // Presentation only: show the single validation message next to the field it is about.
  const nameError = registrationError === t.displayNameValidation ? registrationError : undefined;
  const phoneError = registrationError === t.familyPhoneValidation ? registrationError : undefined;
  const generalError = registrationError && !nameError && !phoneError ? registrationError : "";

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAwareScroll contentContainerStyle={styles.scroll}>
        <View style={styles.column}>
          <View style={styles.heading}>
            <Text style={styles.title} accessibilityRole="header">{t.createAccount}</Text>
            <Text style={styles.subtitle}>{t.registerSubtitle}</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.roleGroup} accessibilityRole="radiogroup" accessibilityLabel={t.role}>
              <Text style={styles.groupLabel}>{t.role}</Text>
              {roleOptions.map((option) => {
                const selected = role === option.value;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="radio"
                    accessibilityState={{ selected, checked: selected, disabled: loading }}
                    accessibilityLabel={`${option.label}, ${option.description}`}
                    disabled={loading}
                    onPress={() => setRole(option.value)}
                    style={({ pressed }) => [
                      styles.roleCard,
                      selected && styles.roleCardSelected,
                      pressed && !selected && styles.roleCardPressed,
                    ]}
                  >
                    <View style={[styles.roleIcon, selected && styles.roleIconSelected]}>
                      <Ionicons name={option.icon} size={24} color={selected ? colors.primary : colors.textSecondary} />
                    </View>
                    <View style={styles.roleText}>
                      <Text style={[styles.roleLabel, selected && styles.roleLabelSelected]}>{option.label}</Text>
                      <Text style={styles.roleDesc} numberOfLines={2}>{option.description}</Text>
                    </View>
                    <Ionicons
                      name={selected ? "radio-button-on" : "radio-button-off"}
                      size={24}
                      color={selected ? colors.primary : colors.textDisabled}
                    />
                  </Pressable>
                );
              })}
            </View>

            <TextField
              label={t.displayName}
              autoCapitalize="words"
              value={displayName}
              onChangeText={setDisplayName}
              maxLength={120}
              editable={!loading}
              error={nameError}
            />

            <TextField
              label={c.emailLabel}
              placeholder={c.emailExample}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              value={email}
              onChangeText={value => { setEmail(value); setRegistrationError(""); }}
              editable={!loading}
            />

            <TextField
              label={t.setPassword}
              helper={t.setPasswordPlaceholder}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
              value={password}
              onChangeText={setPassword}
              editable={!loading}
            />

            {role === "family" && (
              <>
                <TextField
                  label={t.emergencyPhone1}
                  placeholder={t.emergencyPhonePlaceholder1}
                  keyboardType="phone-pad"
                  textContentType="telephoneNumber"
                  value={emergencyPhone1}
                  onChangeText={setEmergencyPhone1}
                  editable={!loading}
                  error={phoneError && !emergencyPhone1.trim() ? phoneError : undefined}
                />
                <TextField
                  label={t.emergencyPhone2}
                  placeholder={t.emergencyPhonePlaceholder2}
                  keyboardType="phone-pad"
                  textContentType="telephoneNumber"
                  value={emergencyPhone2}
                  onChangeText={setEmergencyPhone2}
                  editable={!loading}
                  error={phoneError && !emergencyPhone2.trim() ? phoneError : undefined}
                />
              </>
            )}

            <View style={styles.consentBlock}>
              <PrivacyPolicyLink />
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: privacyAccepted, disabled: loading }}
                aria-checked={privacyAccepted}
                aria-disabled={loading}
                accessibilityLabel={privacy.consent}
                disabled={loading}
                onPress={() => setPrivacyAccepted(value => !value)}
                style={({ pressed }) => [styles.consentRow, pressed && styles.pressed]}
              >
                <Ionicons
                  name={privacyAccepted ? "checkbox" : "square-outline"}
                  size={26}
                  color={privacyAccepted ? colors.primary : colors.textMuted}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                />
                <Text style={styles.consentText}>{privacy.consent}</Text>
              </Pressable>
              <Text style={styles.scopeText}>{privacy.scope}</Text>
            </View>

            {generalError ? (
              <Text accessibilityRole="alert" style={styles.error}>{generalError}</Text>
            ) : null}

            <Button
              label={t.finishRegister}
              size="lg"
              fullWidth
              loading={loading}
              disabled={!privacyAccepted}
              onPress={onRegister}
            />
          </View>

          <Pressable
            accessibilityRole="link"
            onPress={() => router.back()}
            style={({ pressed }) => [styles.switchLink, pressed && styles.pressed]}
          >
            <Text style={styles.switchText}>
              {t.hasAccount}
              <Text style={styles.switchAction}>{t.backLogin}</Text>
            </Text>
          </Pressable>
        </View>
      </KeyboardAwareScroll>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: spacing.xl, paddingTop: spacing.xxl },
  column: { width: "100%", maxWidth: 480, alignSelf: "center" },
  heading: { gap: spacing.sm, marginBottom: spacing.xl },
  title: { ...typography.display },
  subtitle: { ...typography.body, color: colors.textSecondary },
  form: { gap: spacing.lg },
  groupLabel: { ...typography.label, marginBottom: spacing.xs },
  roleGroup: { gap: spacing.sm },
  roleCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 72,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  roleCardSelected: { borderWidth: 2, margin: -1, borderColor: colors.primary, backgroundColor: colors.primarySoft },
  roleCardPressed: { backgroundColor: colors.surfaceSunken },
  roleIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceSunken,
  },
  roleIconSelected: { backgroundColor: colors.surface },
  roleText: { flex: 1, minWidth: 0, gap: 2 },
  roleLabel: { ...typography.bodyStrong },
  roleLabelSelected: { color: colors.primary },
  roleDesc: { ...typography.bodySmall },
  consentBlock: { gap: spacing.xs },
  consentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    minHeight: layout.minTouchTarget,
    paddingVertical: spacing.sm,
  },
  consentText: { ...typography.bodySmall, flex: 1, color: colors.text },
  scopeText: { ...typography.caption },
  error: { ...typography.bodySmall, color: colors.danger, fontWeight: "600" },
  switchLink: {
    minHeight: layout.minTouchTarget,
    justifyContent: "center",
    alignSelf: "center",
    paddingHorizontal: spacing.md,
    marginTop: spacing.xl,
  },
  switchText: { ...typography.body, color: colors.textSecondary, textAlign: "center" },
  switchAction: { color: colors.primary, fontWeight: "700" },
  pressed: { opacity: 0.6 },
});
