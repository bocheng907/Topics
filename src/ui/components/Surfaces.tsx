import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewProps, type ViewStyle } from "react-native";
import { colors, radii, spacing, typography } from "../theme";
import type { IconName } from "./types";

/* ------------------------------------------------------------------ Card */

export type CardProps = ViewProps & {
  /** When given, the card becomes pressable with a pressed state. */
  onPress?: () => void;
  /** "default" white surface; "sunken" for quiet secondary content; "selected" uses primarySoft. */
  tone?: "default" | "sunken" | "selected";
  /** Inner padding; defaults to spacing.lg. Pass 0 to host ListRows edge-to-edge. */
  padding?: number;
  accessibilityLabel?: string;
};

export function Card({ onPress, tone = "default", padding = spacing.lg, style, children, accessibilityLabel, ...rest }: CardProps) {
  const toneStyle = tone === "sunken" ? styles.cardSunken : tone === "selected" ? styles.cardSelected : null;
  if (!onPress) {
    return (
      <View {...rest} style={[styles.card, toneStyle, { padding }, style]}>
        {children}
      </View>
    );
  }
  return (
    <Pressable
      {...rest}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.card, toneStyle, { padding }, pressed && styles.cardPressed, style as StyleProp<ViewStyle>]}
    >
      {children}
    </Pressable>
  );
}

/* --------------------------------------------------------------- Divider */

export function Divider({ inset = 0, style }: { inset?: number | boolean; style?: StyleProp<ViewStyle> }) {
  const left = inset === true ? spacing.lg + 28 + spacing.md : inset === false ? 0 : inset;
  return <View style={[styles.divider, { marginLeft: left }, style]} accessibilityElementsHidden importantForAccessibility="no" />;
}

/* --------------------------------------------------------- SectionHeader */

export function SectionHeader({ title, actionLabel, onAction, style }: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.section, style]}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {title}
      </Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} accessibilityRole="button" hitSlop={12} style={({ pressed }) => pressed && { opacity: 0.6 }}>
          <Text style={styles.sectionAction}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/* --------------------------------------------------------------- ListRow */

export type ListRowProps = {
  title: string;
  subtitle?: string;
  icon?: IconName;
  /** Small text value shown on the right (e.g. current setting). */
  value?: string;
  /** "chevron" (default when pressable), "none", or a custom node such as a Switch. */
  right?: "chevron" | "none" | React.ReactNode;
  onPress?: () => void;
  tone?: "default" | "danger";
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export function ListRow({ title, subtitle, icon, value, right, onPress, tone = "default", disabled, accessibilityLabel, style }: ListRowProps) {
  const danger = tone === "danger";
  const fg = danger ? colors.danger : colors.text;
  const resolvedRight = right ?? (onPress ? "chevron" : "none");

  const content = (
    <>
      {icon ? (
        <View style={[styles.rowIcon, danger && { backgroundColor: colors.dangerSoft }]}>
          <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.primary} />
        </View>
      ) : null}
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: fg }]} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.rowSubtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text style={styles.rowValue} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {resolvedRight === "chevron" ? (
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      ) : resolvedRight === "none" ? null : (
        resolvedRight
      )}
    </>
  );

  if (!onPress) return <View style={[styles.row, style]}>{content}</View>;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed, disabled && { opacity: 0.45 }, style]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  cardSunken: { backgroundColor: colors.surfaceSunken, borderColor: colors.surfaceSunken },
  cardSelected: { backgroundColor: colors.primarySoft, borderColor: colors.primaryBorder },
  cardPressed: { backgroundColor: colors.surfaceSunken },

  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, alignSelf: "stretch" },

  section: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
  },
  sectionTitle: { ...typography.overline },
  sectionAction: { ...typography.label, color: colors.primary },

  row: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
  },
  rowPressed: { backgroundColor: colors.surfaceSunken },
  rowIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { ...typography.body },
  rowSubtitle: { ...typography.bodySmall, color: colors.textMuted, marginTop: 2 },
  rowValue: { ...typography.bodySmall, maxWidth: "40%" },
});
