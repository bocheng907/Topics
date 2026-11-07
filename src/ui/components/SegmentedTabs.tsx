// src/ui/components/SegmentedTabs.tsx
// Shared segmented control (two to four options). Presentation only: the screen owns the value.
// Replaces the former src/family/SegmentedTabs.tsx and src/caregiver/SegmentedTabs.tsx.
import React from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, layout, radii, spacing, typography } from "../theme";

export type SegmentedOption<K extends string> = { key: K; label: string };

export type SegmentedTabsProps<K extends string> = {
  options: readonly SegmentedOption<K>[];
  value: K;
  onChange: (key: K) => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function SegmentedTabs<K extends string>({ options, value, onChange, disabled, style }: SegmentedTabsProps<K>) {
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

/** Surface strip that hosts SegmentedTabs directly under an AppHeader (centred on wide screens). */
export function SegmentedTabBar({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.bar}>
      <View style={styles.barInner}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface,
    paddingHorizontal: layout.screenPaddingX,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  barInner: { width: "100%", maxWidth: layout.maxContentWidth, alignSelf: "center" },
  // alignSelf "stretch" (not width 100%) so callers can add marginHorizontal without overflow.
  track: {
    flexDirection: "row",
    alignSelf: "stretch",
    gap: 2,
    padding: 3,
    borderRadius: radii.control + 2,
    backgroundColor: colors.surfaceSunken,
  },
  segment: {
    flex: 1,
    minWidth: 0,
    minHeight: layout.minTouchTarget,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    borderRadius: radii.control - 1,
    borderWidth: 1,
    borderColor: "transparent",
  },
  segmentActive: { backgroundColor: colors.surface, borderColor: colors.border },
  segmentPressed: { backgroundColor: colors.border },
  segmentDisabled: { opacity: 0.6 },
  label: { ...typography.bodyStrong, color: colors.textSecondary, textAlign: "center", width: "100%" },
  labelActive: { color: colors.primary },
});
