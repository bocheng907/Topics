import { router } from "expo-router";
import { Pressable, Text } from "react-native";
import { useAuditAccess } from "@/src/auth/useAuditAccess";
import { translations } from "@/src/i18n/translations";
import { useLanguage } from "@/src/store/LanguageContext";
import { SideDrawerRow } from "@/src/ui/components/SideDrawer";

export default function AuditMenuLink({ onNavigate, variant = "menu" }: { onNavigate: () => void; variant?: "menu" | "drawer" }) {
  const { allowed } = useAuditAccess();
  const { language } = useLanguage();
  if (!allowed) return null;
  const open = () => {
    onNavigate(); router.push("/audit-logs" as never);
  };
  if (variant === "drawer") {
    return <SideDrawerRow item={{ key: "audit-logs", icon: "shield-checkmark-outline", label: translations[language].navAuditLogs, onPress: open }} />;
  }
  return <Pressable accessibilityRole="button" onPress={open} style={{ paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 2, borderBottomColor: "#000" }}>
    <Text style={{ color: "#174D64", fontSize: 19, fontWeight: "bold" }}>{translations[language].navAuditLogs}</Text>
  </Pressable>;
}
