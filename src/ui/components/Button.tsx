import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, radii, spacing, typography } from "../theme";
import type { IconName } from "./types";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "accent";
export type ButtonSize = "md" | "lg";

export type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  /** Leading icon. */
  icon?: IconName;
  fullWidth?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const palette: Record<ButtonVariant, { bg: string; bgPressed: string; fg: string; border?: string }> = {
  primary: { bg: colors.primary, bgPressed: colors.primaryPressed, fg: colors.onPrimary },
  secondary: { bg: colors.surface, bgPressed: colors.primarySoft, fg: colors.primary, border: colors.primaryBorder },
  ghost: { bg: "transparent", bgPressed: colors.primarySoft, fg: colors.primary },
  danger: { bg: colors.danger, bgPressed: colors.dangerPressed, fg: colors.onPrimary },
  /** Reserved for urgent / key actions such as an emergency call. */
  accent: { bg: colors.accent, bgPressed: colors.accentPressed, fg: colors.onAccent },
};

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  icon,
  fullWidth = false,
  accessibilityLabel,
  style,
  testID,
}: ButtonProps) {
  const p = palette[variant];
  const inactive = disabled || loading;
  const lg = size === "lg";

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: lg ? 56 : 48,
          paddingHorizontal: lg ? spacing.xl : 20,
          backgroundColor: pressed && !inactive ? p.bgPressed : p.bg,
          borderColor: p.border ?? "transparent",
        },
        fullWidth ? styles.fullWidth : styles.hug,
        disabled && !loading && styles.disabled,
        style,
      ]}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="small" color={p.fg} />
        ) : icon ? (
          <Ionicons name={icon} size={lg ? 22 : 20} color={p.fg} />
        ) : null}
        <Text style={[styles.label, { color: p.fg, fontSize: lg ? 18 : 17 }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.control,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  hug: { alignSelf: "flex-start" },
  fullWidth: { alignSelf: "stretch" },
  content: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  label: { ...typography.label, lineHeight: 22 },
  disabled: { opacity: 0.45 },
});
