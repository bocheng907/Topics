import { router } from "expo-router";
import { Pressable, Text } from "react-native";
import { useAuditAccess } from "@/src/auth/useAuditAccess";

export default function AuditMenuLink({ onNavigate }: { onNavigate: () => void }) {
  const { allowed } = useAuditAccess();
  if (!allowed) return null;
  return <Pressable accessibilityRole="button" onPress={() => {
    onNavigate(); router.push("/audit-logs" as never);
  }} style={{ paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 2, borderBottomColor: "#000" }}>
    <Text style={{ color: "#174D64", fontSize: 19, fontWeight: "bold" }}>操作紀錄</Text>
  </Pressable>;
}
