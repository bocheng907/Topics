import { Alert, Linking, Pressable, Text } from "react-native";
import { useLanguage } from "@/src/store/LanguageContext";
import { SideDrawerRow } from "@/src/ui/components/SideDrawer";
import { PRIVACY_POLICY_URL, privacyCopy } from "./consent";

export function PrivacyPolicyLink({ variant = "inline" }: { variant?: "inline" | "menu" | "drawer" }) {
  const { language } = useLanguage();
  const text = privacyCopy[language];
  const open = () => {
    void Linking.openURL(PRIVACY_POLICY_URL).catch(() => Alert.alert(text.openFailed));
  };
  if (variant === "drawer") {
    return <SideDrawerRow item={{ key: "privacy-policy", icon: "document-text-outline", label: text.link, onPress: open }} />;
  }
  return <Pressable accessibilityRole="link" onPress={open} style={variant === "menu" ? {
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
