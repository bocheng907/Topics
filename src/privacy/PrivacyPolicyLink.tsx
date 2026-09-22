import { Alert, Linking, Pressable, Text } from "react-native";
import { useLanguage } from "@/src/store/LanguageContext";
import { PRIVACY_POLICY_URL, privacyCopy } from "./consent";

export function PrivacyPolicyLink() {
  const { language } = useLanguage();
  const text = privacyCopy[language];
  return <Pressable accessibilityRole="link" onPress={() => {
    void Linking.openURL(PRIVACY_POLICY_URL).catch(() => Alert.alert(text.openFailed));
  }} style={{ paddingVertical: 12 }}>
    <Text style={{ color: "#005FCC", textDecorationLine: "underline", fontSize: 15 }}>{text.link}</Text>
  </Pressable>;
}
