import type { Language } from "@/src/i18n/translations";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../theme";
import { Chip, StatusBadge } from "./Feedback";
import type { IconName } from "./types";

/** User / role block shown at the top of the side drawer. */
export function SideDrawerProfile({
  name,
  roleLabel,
  icon = "person",
  detail,
}: {
  name?: string;
  roleLabel: string;
  icon?: IconName;
  /** Optional secondary line, e.g. the active care recipient. */
  detail?: string;
}) {
  return (
    <View style={styles.profile}>
      <View style={styles.avatar}>
        <Ionicons name={icon} size={26} color={colors.primary} />
      </View>
      <View style={styles.profileText}>
        <StatusBadge label={roleLabel} tone="primary" />
        {name ? (
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
        ) : null}
        {detail ? (
          <Text style={styles.detail} numberOfLines={1}>
            {detail}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const LANGUAGE_OPTIONS: { value: Language; label: string }[] = [
  { value: "zh", label: "中文" },
  { value: "en", label: "English" },
  { value: "vi", label: "Tiếng Việt" },
  { value: "id", label: "Bahasa Indonesia" },
];

/** Language chips for the drawer. Labels are endonyms, so they are not translated. */
export function DrawerLanguageSwitcher({ value, onChange }: { value: Language; onChange: (next: Language) => void }) {
  return (
    <View style={styles.languages}>
      {LANGUAGE_OPTIONS.map((option) => (
        <Chip
          key={option.value}
          label={option.label}
          selected={option.value === value}
          onPress={() => onChange(option.value)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  profileText: { flex: 1, minWidth: 0, gap: spacing.xs },
  name: { ...typography.bodyStrong },
  detail: { ...typography.caption },
  languages: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
  },
});
