// app/(auth)/login.tsx
import { userErrorMessage } from "@/src/ui/userErrorMessages";
import { useAuth } from "@/src/auth/useAuth";
import { PrivacyPolicyLink } from "@/src/privacy/PrivacyPolicyLink";
import { translations } from "@/src/i18n/translations";
import { authCopy } from "@/src/i18n/copy/authCopy";
import { useLanguage } from "@/src/store/LanguageContext";
import { Button, KeyboardAwareScroll, TextField } from "@/src/ui/components";
import { colors, layout, spacing, typography } from "@/src/ui/theme";
import { router, Stack } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function LoginScreen() {
  const { login } = useAuth();
  const { language } = useLanguage();
  const t = translations[language];
  const c = authCopy[language];
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function onLogin() {
    if (loading) return;
    setErrorMessage("");
    if (!email.trim() || !password) {
      setErrorMessage(t.loginRequiredFields);
      Alert.alert(t.prompt, t.loginRequiredFields);
      return;
    }
    try {
      setLoading(true);
      await login(email, password);
      // After sign-in, app/_layout.tsx redirects to "/" which routes by role.
    } catch (e: unknown) {
      const message = userErrorMessage(e, "login", language);
      setErrorMessage(message);
      Alert.alert(t.loginFailed, message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAwareScroll contentContainerStyle={styles.scroll}>
        <View style={styles.column}>
          <View style={styles.heading}>
            <Text style={styles.title} accessibilityRole="header">{t.welcomeBack}</Text>
            <Text style={styles.subtitle}>{t.loginSubtitle}</Text>
          </View>

          <View style={styles.form}>
            <TextField
              label={c.emailLabel}
              placeholder={t.emailPlaceholder}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              value={email}
              onChangeText={setEmail}
              editable={!loading}
              returnKeyType="next"
            />
            <TextField
              label={t.password}
              placeholder={t.passwordPlaceholder}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="password"
              autoComplete="password"
              value={password}
              onChangeText={setPassword}
              editable={!loading}
              returnKeyType="go"
              onSubmitEditing={onLogin}
            />

            {!!errorMessage && (
              <Text accessibilityRole="alert" style={styles.error}>{errorMessage}</Text>
            )}

            <Button label={t.loginNow} size="lg" fullWidth loading={loading} onPress={onLogin} style={styles.submit} />
          </View>

          <View style={styles.footer}>
            <Pressable
              accessibilityRole="link"
              onPress={() => router.push("/(auth)/register")}
              style={({ pressed }) => [styles.switchLink, pressed && styles.pressed]}
            >
              <Text style={styles.switchText}>
                {t.noAccount}
                <Text style={styles.switchAction}>{t.goRegister}</Text>
              </Text>
            </Pressable>
            <PrivacyPolicyLink />
          </View>
        </View>
      </KeyboardAwareScroll>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: spacing.xl, paddingTop: spacing.xxl },
  column: { width: "100%", maxWidth: 480, alignSelf: "center" },
  heading: { gap: spacing.sm, marginBottom: spacing.xxl },
  title: { ...typography.display },
  subtitle: { ...typography.body, color: colors.textSecondary },
  form: { gap: spacing.lg },
  error: { ...typography.bodySmall, color: colors.danger, fontWeight: "600" },
  submit: { marginTop: spacing.sm },
  footer: { marginTop: spacing.xl, alignItems: "center", gap: spacing.xs },
  switchLink: { minHeight: layout.minTouchTarget, justifyContent: "center", paddingHorizontal: spacing.md },
  switchText: { ...typography.body, color: colors.textSecondary, textAlign: "center" },
  switchAction: { color: colors.primary, fontWeight: "700" },
  pressed: { opacity: 0.6 },
});
