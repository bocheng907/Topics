import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { router, Stack } from "expo-router";
import { useAuth } from "@/src/auth/useAuth";
import type { Role } from "@/src/auth/AuthProvider";
import { translations } from "@/src/i18n/translations";
import { useLanguage } from "@/src/store/LanguageContext";
import { isValidRegistrationPassword } from "@/src/auth/passwordPolicy";
import { PRIVACY_POLICY_VERSION, privacyCopy } from "@/src/privacy/consent";
import { PrivacyPolicyLink } from "@/src/privacy/PrivacyPolicyLink";

export default function RegisterScreen() {
  const { register } = useAuth();
  const { language } = useLanguage();
  const t = translations[language];
  const privacy = privacyCopy[language];

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("caregiver");
  const [emergencyPhone1, setEmergencyPhone1] = useState("");
  const [emergencyPhone2, setEmergencyPhone2] = useState("");
  const [loading, setLoading] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  async function onRegister() {
    if (loading) return;
    if (!privacyAccepted) {
      Alert.alert(t.prompt, privacy.required);
      return;
    }
    const normalizedName = displayName.normalize("NFKC").trim();
    if (!normalizedName || normalizedName.length > 120) {
      Alert.alert(t.prompt, t.displayNameValidation);
      return;
    }

    const normalizedEmail = email.normalize("NFKC").replace(/\s+/g, "").toLowerCase();
    const emailLooksValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizedEmail);
    if (!emailLooksValid || !isValidRegistrationPassword(password)) {
      Alert.alert(t.prompt, t.registerValidation);
      return;
    }

    if (role === "family" && (!emergencyPhone1.trim() || !emergencyPhone2.trim())) {
      Alert.alert(t.prompt, t.familyPhoneValidation);
      return;
    }

    try {
      setLoading(true);

      await register(normalizedEmail, password, role, {
        privacyConsent: { accepted: privacyAccepted, version: PRIVACY_POLICY_VERSION },
        displayName: normalizedName,
        emergencyPhone1,
        emergencyPhone2,
      });

      router.replace("/");
    } catch (e: any) {
      const weakPassword = e?.code === "auth/weak-password" || e?.code === "auth/password-does-not-meet-requirements";
      Alert.alert(t.registerFailed, e?.code === "privacy/consent-required" ? privacy.required :
        weakPassword ? t.registerValidation : e?.message ?? t.registerFailedFallback);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        padding: 32,
        backgroundColor: "#FFF",
        justifyContent: "center",
      }}
    >
      <Stack.Screen options={{ headerShown: false }} />

      <View style={{ marginBottom: 32 }}>
        <Text style={{ fontSize: 36, fontWeight: "900", color: "#333" }}>
          {t.createAccount}
        </Text>
        <Text style={{ fontSize: 16, color: "#666", marginTop: 8 }}>
          {t.registerSubtitle}
        </Text>
      </View>

      <View style={{ gap: 20 }}>
        <View style={{ gap: 8 }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "800",
              color: "#666",
              marginLeft: 4,
            }}
          >
            {t.role}
          </Text>

          <View
            style={{
              flexDirection: "row",
              gap: 10,
            }}
          >
            {/* 看護 */}
            <Pressable
              onPress={() => setRole("caregiver")}
              style={{
                flex: 1,
                padding: 14,
                borderRadius: 12,
                borderWidth: 2,
                borderColor:
                  role === "caregiver" ? "#007AFF" : "#EEE",
                backgroundColor:
                  role === "caregiver" ? "#E1E9FF" : "#FFF",
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontWeight: "900",
                  color:
                    role === "caregiver" ? "#007AFF" : "#999",
                }}
              >
                {t.caregiver}
              </Text>
            </Pressable>

            {/* 家屬 */}
            <Pressable
              onPress={() => setRole("family")}
              style={{
                flex: 1,
                padding: 14,
                borderRadius: 12,
                borderWidth: 2,
                borderColor:
                  role === "family" ? "#007AFF" : "#EEE",
                backgroundColor:
                  role === "family" ? "#E1E9FF" : "#FFF",
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontWeight: "900",
                  color:
                    role === "family" ? "#007AFF" : "#999",
                }}
              >
                {t.family}
              </Text>
            </Pressable>

            {/* 仲介 */}
            <Pressable
              onPress={() => setRole("agency")}
              style={{
                flex: 1,
                padding: 14,
                borderRadius: 12,
                borderWidth: 2,
                borderColor:
                  role === "agency" ? "#007AFF" : "#EEE",
                backgroundColor:
                  role === "agency" ? "#E1E9FF" : "#FFF",
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontWeight: "900",
                  color:
                    role === "agency" ? "#007AFF" : "#999",
                }}
              >
                {t.agency}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={{ gap: 8 }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "800",
              color: "#666",
              marginLeft: 4,
            }}
          >
            {t.displayName}
          </Text>
          <TextInput
            placeholder={t.displayNamePlaceholder}
            autoCapitalize="words"
            value={displayName}
            onChangeText={setDisplayName}
            maxLength={120}
            style={{
              backgroundColor: "#F2F2F7",
              borderRadius: 14,
              padding: 16,
              fontSize: 16,
              borderWidth: 1,
              borderColor: "#EEE",
            }}
          />
        </View>

        <View style={{ gap: 8 }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "800",
              color: "#666",
              marginLeft: 4,
            }}
          >
            EMAIL
          </Text>
          <TextInput
            placeholder="example@mail.com"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
            style={{
              backgroundColor: "#F2F2F7",
              borderRadius: 14,
              padding: 16,
              fontSize: 16,
              borderWidth: 1,
              borderColor: "#EEE",
            }}
          />
        </View>

        <View style={{ gap: 8 }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "800",
              color: "#666",
              marginLeft: 4,
            }}
          >
            {t.setPassword}
          </Text>
          <TextInput
            placeholder={t.setPasswordPlaceholder}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            value={password}
            onChangeText={setPassword}
            style={{
              backgroundColor: "#F2F2F7",
              borderRadius: 14,
              padding: 16,
              fontSize: 16,
              borderWidth: 1,
              borderColor: "#EEE",
            }}
          />
        </View>

        <Text style={{ fontSize: 13, color: "#666", marginTop: -12 }}>
          {t.setPasswordPlaceholder}
        </Text>

        {role === "family" && (
          <>
            <View style={{ gap: 8 }}>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "800",
                  color: "#666",
                  marginLeft: 4,
                }}
              >
                {t.emergencyPhone1}
              </Text>
              <TextInput
                placeholder="例如：0912345678"
                keyboardType="phone-pad"
                value={emergencyPhone1}
                onChangeText={setEmergencyPhone1}
                style={{
                  backgroundColor: "#F2F2F7",
                  borderRadius: 14,
                  padding: 16,
                  fontSize: 16,
                  borderWidth: 1,
                  borderColor: "#EEE",
                }}
              />
            </View>

            <View style={{ gap: 8 }}>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "800",
                  color: "#666",
                  marginLeft: 4,
                }}
              >
                {t.emergencyPhone2}
              </Text>
              <TextInput
                placeholder="例如：0987654321"
                keyboardType="phone-pad"
                value={emergencyPhone2}
                onChangeText={setEmergencyPhone2}
                style={{
                  backgroundColor: "#F2F2F7",
                  borderRadius: 14,
                  padding: 16,
                  fontSize: 16,
                  borderWidth: 1,
                  borderColor: "#EEE",
                }}
              />
            </View>
          </>
        )}

        <View style={{ gap: 8 }}>
          <PrivacyPolicyLink />
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: privacyAccepted, disabled: loading }}
            accessibilityLabel={privacy.consent} disabled={loading}
            onPress={() => setPrivacyAccepted(value => !value)}
            style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 8 }}>
            <Text accessibilityElementsHidden style={{ fontSize: 23, color: "#005FCC" }}>{privacyAccepted ? "☑" : "☐"}</Text>
            <Text style={{ flex: 1, fontSize: 15, lineHeight: 23, color: "#333" }}>{privacy.consent}</Text>
          </Pressable>
          <Text style={{ fontSize: 12, lineHeight: 19, color: "#666" }}>{privacy.scope}</Text>
        </View>

        <Pressable
          onPress={onRegister}
          disabled={loading || !privacyAccepted}
          style={({ pressed }) => ({
            marginTop: 10,
            padding: 18,
            borderRadius: 16,
            backgroundColor: loading || !privacyAccepted ? "#CCC" : "#007AFF",
            alignItems: "center",
            opacity: pressed ? 0.8 : 1,
          })}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={{ color: "#FFF", fontSize: 18, fontWeight: "900" }}>
              {t.finishRegister}
            </Text>
          )}
        </Pressable>
      </View>

      <Pressable
        onPress={() => router.back()}
        style={{ marginTop: 24, alignSelf: "center" }}
      >
        <Text style={{ color: "#666", fontSize: 15, fontWeight: "600" }}>
          {t.hasAccount}<Text style={{ color: "#007AFF", fontWeight: "900" }}>{t.backLogin}</Text>
        </Text>
      </Pressable>
    </ScrollView>
  );
}
