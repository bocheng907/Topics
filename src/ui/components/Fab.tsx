import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomInsetHandled } from "../BottomInsetContext";
import { colors, radii, shadows, spacing, typography } from "../theme";
import type { IconName } from "./types";

export const FAB_SIZE = 56;
/** Bottom padding a scrolling list needs so the FAB never covers its last item. */
export const FAB_CLEARANCE = FAB_SIZE + spacing.lg + spacing.xl;

export type FabProps = {
  icon: IconName;
  /** When given, renders an extended FAB (icon + text). */
  label?: string;
  onPress: () => void;
  accessibilityLabel?: string;
  tone?: "primary";
  /**
   * The screen already sits above the BottomNav / a layout that pads the home
   * indicator, so the FAB must not add the safe-area inset again. Defaults to
   * what the role layout reports via BottomInsetHandledProvider.
   */
  aboveBottomNav?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Bottom-right floating action button.
 * Position: right = spacing.lg, bottom = spacing.lg (+ insets.bottom only when
 * nothing below the screen already clears the home indicator).
 */
export function Fab({ icon, label, onPress, accessibilityLabel, aboveBottomNav, style, testID }: FabProps) {
  const insets = useSafeAreaInsets();
  const handled = useBottomInsetHandled();
  const clear = aboveBottomNav ?? handled;
  const bottom = spacing.lg + (clear ? 0 : insets.bottom);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        label ? styles.extended : styles.round,
        { bottom },
        pressed && styles.pressed,
        style,
      ]}
    >
      <Ionicons name={icon} size={label ? 24 : 28} color={colors.onPrimary} />
      {label ? (
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    position: "absolute",
    right: spacing.lg,
    height: FAB_SIZE,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    ...shadows.fab,
  },
  round: { width: FAB_SIZE },
  extended: { paddingLeft: spacing.lg, paddingRight: spacing.xl, gap: spacing.sm },
  pressed: { backgroundColor: colors.primaryPressed },
  label: { ...typography.bodyStrong, color: colors.onPrimary },
});
