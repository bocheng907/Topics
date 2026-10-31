import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, layout, radii, spacing, typography } from "../theme";
import type { IconName } from "./types";

/** Active-tab highlight: a rounded tinted pill behind icon + label (no top indicator bar). */
const PILL_HEIGHT = 52;
const PILL_RADIUS = 16;

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

/** Fade/scale of the active pill. The native driver is not available on web. */
const PILL_ANIM_MS = 180;
const useNativeDriver = Platform.OS !== "web";

export function BottomNav({ items, activeKey, onSelect, safeAreaBottom = true, centerGap, style }: BottomNavProps) {
  const gapIndex = centerGap ? Math.ceil(items.length / 2) : -1;
  const insets = useSafeAreaInsets();
  return (
    <View
      accessibilityRole="tablist"
      style={[styles.bar, { paddingBottom: safeAreaBottom ? insets.bottom : 0 }, style]}
    >
      {items.map((item, index) => (
        <React.Fragment key={item.key}>
          {index === gapIndex ? <View style={{ width: centerGap }} /> : null}
          <NavTab item={item} active={item.key === activeKey} onPress={() => onSelect(item.key)} />
        </React.Fragment>
      ))}
    </View>
  );
}

function NavTab({ item, active, onPress }: { item: BottomNavItem; active: boolean; onPress: () => void }) {
  const progress = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: active ? 1 : 0,
      duration: PILL_ANIM_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver,
    }).start();
  }, [active, progress]);

  const color = active ? colors.primary : colors.textSecondary;
  const pillStyle = {
    opacity: progress,
    transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }],
  };

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={item.badge ? `${item.label} (${item.badge})` : item.label}
      style={styles.item}
    >
      {({ pressed }) => (
        <View style={styles.pill}>
          {/* Pressed feedback for inactive tabs; the active one already has its tinted pill. */}
          {pressed && !active ? <View style={[StyleSheet.absoluteFill, styles.pillPressed]} /> : null}
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.pillActive, pillStyle, pressed && styles.pillActivePressed]} />
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
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Docked bar: flat surface + hairline top border, no shadow.
  bar: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.xs,
  },
  item: {
    flex: 1,
    minWidth: 48,
    height: layout.bottomNavHeight,
    alignItems: "center",
    justifyContent: "center",
  },
  pill: {
    height: PILL_HEIGHT,
    minWidth: 64,
    maxWidth: "100%",
    paddingHorizontal: spacing.md,
    borderRadius: PILL_RADIUS,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  pillActive: { borderRadius: PILL_RADIUS, backgroundColor: colors.primarySoft },
  pillActivePressed: { backgroundColor: colors.primaryBorder },
  pillPressed: { borderRadius: PILL_RADIUS, backgroundColor: colors.surfaceSunken },
  label: { ...typography.caption, color: colors.textSecondary },
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
