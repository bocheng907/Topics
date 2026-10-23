import { Alert, Linking, Pressable, Text } from "react-native";
import { useLanguage } from "@/src/store/LanguageContext";
import { PRIVACY_POLICY_URL, privacyCopy } from "./consent";

export function PrivacyPolicyLink({ variant = "inline" }: { variant?: "inline" | "menu" }) {
  const { language } = useLanguage();
  const text = privacyCopy[language];
  return <Pressable accessibilityRole="link" onPress={() => {
    void Linking.openURL(PRIVACY_POLICY_URL).catch(() => Alert.alert(text.openFailed));
  }} style={variant === "menu" ? {
    paddingHorizontal: 20, paddingVertical: 16, minHeight: 48,
    borderBottomWidth: 2, borderBottomColor: "#000", alignSelf: "stretch",
  } : { paddingVertical: 12 }}>
    <Text style={{ color: "#005FCC", textDecorationLine: "underline",
      fontSize: variant === "menu" ? 18 : 15,
      fontWeight: variant === "menu" ? "700" : "400",
      lineHeight: variant === "menu" ? 25 : 22, flexShrink: 1,
    }}>{text.link}</Text>
  </Pressable>;
}
