import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, layout, radii, typography } from "../theme";
import type { IconName } from "./types";

export type BottomNavItem = {
  key: string;
  icon: IconName;
  /** Optional filled glyph for the active state (e.g. "home" vs "home-outline"). */
  activeIcon?: IconName;
  label: string;
  badge?: number;
};

export type BottomNavProps = {
  items: BottomNavItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  /** Set false when rendered inside a container that already pads the bottom inset. */
  safeAreaBottom?: boolean;
  /** Reserves an empty slot of this width in the middle (e.g. for a floating emergency button). */
  centerGap?: number;
  style?: StyleProp<ViewStyle>;
};

export function BottomNav({ items, activeKey, onSelect, safeAreaBottom = true, centerGap, style }: BottomNavProps) {
  const gapIndex = centerGap ? Math.ceil(items.length / 2) : -1;
  const insets = useSafeAreaInsets();
  return (
    <View
      accessibilityRole="tablist"
      style={[styles.bar, { paddingBottom: safeAreaBottom ? insets.bottom : 0 }, style]}
    >
      {items.map((item, index) => {
        const active = item.key === activeKey;
        const color = active ? colors.primary : colors.textMuted;
        return (
          <React.Fragment key={item.key}>
          {index === gapIndex ? <View style={{ width: centerGap }} /> : null}
          <Pressable
            onPress={() => onSelect(item.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={item.badge ? `${item.label} (${item.badge})` : item.label}
            style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
          >
            <View style={[styles.indicator, active && styles.indicatorActive]} />
            <View>
              <Ionicons name={active ? item.activeIcon ?? item.icon : item.icon} size={24} color={color} />
              {item.badge ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.badge > 99 ? "99+" : item.badge}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.label, { color }, active && styles.labelActive]} numberOfLines={1}>
              {item.label}
            </Text>
          </Pressable>
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  item: {
    flex: 1,
    height: layout.bottomNavHeight,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  itemPressed: { backgroundColor: colors.surfaceSunken },
  indicator: {
    position: "absolute",
    top: 0,
    width: 28,
    height: 3,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    backgroundColor: "transparent",
  },
  indicatorActive: { backgroundColor: colors.primary },
  label: { ...typography.caption, color: colors.textMuted },
  labelActive: { fontWeight: "600" },
  badge: {
    position: "absolute",
    top: -4,
    right: -10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.surface,
  },
  badgeText: { color: colors.onPrimary, fontSize: 11, lineHeight: 13, fontWeight: "700" },
});
