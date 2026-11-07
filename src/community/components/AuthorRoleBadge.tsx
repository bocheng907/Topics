// 發文者／留言者身分標籤（家屬／仲介）
// 舊文章、舊留言沒有 authorRole，role 為 undefined 時不顯示

import { StyleSheet, Text, View } from "react-native";
import { communityCopy } from "@/src/i18n/copy/communityCopy";
import { useLanguage } from "@/src/store/LanguageContext";
import { colors, radii } from "@/src/ui/theme";
import type { CommunityAuthorRole } from "../types";

type Props = {
  role?: CommunityAuthorRole;
};

export default function AuthorRoleBadge({ role }: Props) {
  const { language } = useLanguage();
  const c = communityCopy[language];
  if (role !== "family" && role !== "agency") return null;
  const label = role === "family" ? c.roleFamily : c.roleAgency;

  return (
    <View
      style={[styles.badge, role === "agency" && styles.agency]}
      accessibilityLabel={c.roleA11y(label)}
    >
      <Text style={[styles.label, role === "agency" && styles.agencyLabel]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexShrink: 0,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceSunken,
  },
  // 仲介是「專業身分」的提示，用主色淺底與家屬區隔
  agency: {
    backgroundColor: colors.primarySoft,
  },
  label: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  agencyLabel: {
    color: colors.primary,
  },
});
