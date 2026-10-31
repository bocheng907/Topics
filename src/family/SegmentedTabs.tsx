// src/family/SegmentedTabs.tsx
// Small segmented tab control used by family screens (dashboard, prescription list).
// Local to the family area until a shared design-system version exists.
import React from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, layout, radii, spacing, typography } from "@/src/ui/theme";

export type SegmentedTab<K extends string> = { key: K; label: string };

export function SegmentedTabs<K extends string>({ tabs, value, onChange, style }: {
  tabs: readonly SegmentedTab<K>[];
  value: K;
  onChange: (key: K) => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.bar, style]} accessibilityRole="tablist">
      {tabs.map(({ key, label }) => {
        const active = value === key;
        return (
          <Pressable
            key={key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(key)}
            style={({ pressed }) => [styles.tab, active && styles.tabActive, pressed && !active && styles.tabPressed]}
          >
            <Text numberOfLines={2} style={[styles.text, active && styles.textActive]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    gap: spacing.xs,
    padding: spacing.xs,
    borderRadius: radii.control + 2,
    backgroundColor: colors.surfaceSunken,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    minHeight: layout.minTouchTarget,
    borderRadius: radii.control,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: "transparent",
  },
  tabActive: { backgroundColor: colors.surface, borderColor: colors.border },
  tabPressed: { backgroundColor: colors.divider },
  text: { ...typography.bodyStrong, color: colors.textSecondary, textAlign: "center" },
  textActive: { color: colors.primary },
});
