// src/caregiver/SegmentedTabs.tsx
// Small segmented control for caregiver screens (two to four options). Presentation only.
import React from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, layout, radii, spacing, typography } from "@/src/ui/theme";

export type SegmentedOption<K extends string> = { key: K; label: string };

export function SegmentedTabs<K extends string>({
  options,
  value,
  onChange,
  disabled,
  style,
}: {
  options: readonly SegmentedOption<K>[];
  value: K;
  onChange: (key: K) => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.track, style]} accessibilityRole="tablist">
      {options.map((option) => {
        const active = option.key === value;
        return (
          <Pressable
            key={option.key}
            onPress={() => onChange(option.key)}
            disabled={disabled}
            accessibilityRole="tab"
            accessibilityState={{ selected: active, disabled: !!disabled }}
            style={({ pressed }) => [
              styles.segment,
              active && styles.segmentActive,
              pressed && !active && styles.segmentPressed,
              disabled && !active && styles.segmentDisabled,
            ]}
          >
            <Text
              style={[styles.label, active && styles.labelActive]}
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Surface strip that hosts SegmentedTabs directly under an AppHeader. */
export function SegmentedTabBar({ children }: { children: React.ReactNode }) {
  return <View style={styles.bar}>{children}</View>;
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface,
    paddingHorizontal: layout.screenPaddingX,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  track: {
    flexDirection: "row",
    backgroundColor: colors.surfaceSunken,
    borderRadius: radii.control,
    padding: 3,
    width: "100%",
    maxWidth: layout.maxContentWidth,
    alignSelf: "center",
  },
  segment: {
    flex: 1,
    minWidth: 0,
    minHeight: layout.minTouchTarget,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    borderRadius: radii.control - 2,
    borderWidth: 1,
    borderColor: "transparent",
  },
  segmentActive: { backgroundColor: colors.surface, borderColor: colors.border },
  segmentPressed: { backgroundColor: colors.border },
  segmentDisabled: { opacity: 0.6 },
  label: { ...typography.bodyStrong, color: colors.textSecondary, textAlign: "center", width: "100%" },
  labelActive: { color: colors.primary },
});
