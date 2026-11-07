import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, radii, spacing, typography } from "../theme";
import { Button } from "./Button";
import type { IconName } from "./types";

/* ----------------------------------------------------------- StatusBadge */

export type StatusTone = "neutral" | "primary" | "success" | "warning" | "danger";

const badgeTones: Record<StatusTone, { bg: string; fg: string }> = {
  neutral: { bg: colors.surfaceSunken, fg: colors.textSecondary },
  primary: { bg: colors.primarySoft, fg: colors.primary },
  success: { bg: colors.successSoft, fg: colors.success },
  warning: { bg: colors.warningSoft, fg: colors.warning },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
};

export function StatusBadge({ label, tone = "neutral", icon, style }: {
  label: string;
  tone?: StatusTone;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}) {
  const t = badgeTones[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }, style]}>
      {icon ? <Ionicons name={icon} size={14} color={t.fg} /> : <View style={[styles.dot, { backgroundColor: t.fg }]} />}
      <Text style={[styles.badgeText, { color: t.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/* ------------------------------------------------------------------ Chip */

export function Chip({ label, selected = false, onPress, icon, disabled, style }: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const fg = selected ? colors.primary : colors.textSecondary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: !!disabled }}
      hitSlop={{ top: 4, bottom: 4 }}
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.chipSelected : null,
        pressed && !selected && { backgroundColor: colors.surfaceSunken },
        disabled && { opacity: 0.45 },
        style,
      ]}
    >
      {selected ? <Ionicons name="checkmark" size={16} color={fg} /> : icon ? <Ionicons name={icon} size={16} color={fg} /> : null}
      <Text style={[styles.chipText, { color: fg }, selected && styles.chipTextSelected]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/* ------------------------------------------------------------ EmptyState */

export function EmptyState({ icon = "file-tray-outline", title, body, actionLabel, onAction, style }: {
  icon?: IconName;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.empty, style]}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={30} color={colors.primary} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {body ? <Text style={styles.emptyBody}>{body}</Text> : null}
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} variant="secondary" style={styles.emptyAction} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 13, lineHeight: 18, fontWeight: "600" },

  chip: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.primarySoft, borderColor: colors.primaryBorder },
  chipText: { fontSize: 15, lineHeight: 20, fontWeight: "500" },
  chipTextSelected: { fontWeight: "600" },

  empty: { alignItems: "center", paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  emptyTitle: { ...typography.header, textAlign: "center" },
  emptyBody: { ...typography.bodySmall, textAlign: "center", marginTop: spacing.sm, maxWidth: 320 },
  emptyAction: { marginTop: spacing.xl, alignSelf: "center" },
});
