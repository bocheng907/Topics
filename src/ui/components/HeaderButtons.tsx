import { translations } from "@/src/i18n/translations";
import { useLanguage } from "@/src/store/LanguageContext";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { colors, layout } from "../theme";
import type { IconName } from "./types";

export type IconButtonProps = {
  icon: IconName;
  onPress?: () => void;
  accessibilityLabel: string;
  color?: string;
  size?: number;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** Square 48x48 icon-only button; the glyph can be smaller than the touch area. */
export function IconButton({ icon, onPress, accessibilityLabel, color = colors.text, size = 24, disabled, style, testID }: IconButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      testID={testID}
      style={({ pressed }) => [styles.iconButton, pressed && styles.pressed, disabled && styles.disabled, style]}
    >
      <Ionicons name={icon} size={size} color={color} />
    </Pressable>
  );
}

type HeaderButtonProps = {
  onPress?: () => void;
  color?: string;
  style?: StyleProp<ViewStyle>;
  /** Overrides the default i18n accessibility label. */
  label?: string;
};

export function BackButton({ onPress, color = colors.primary, style, label }: HeaderButtonProps) {
  const { language } = useLanguage();
  return (
    <IconButton
      icon="chevron-back"
      size={26}
      color={color}
      onPress={onPress}
      accessibilityLabel={label ?? translations[language].uiBack}
      style={style}
      testID="header-back"
    />
  );
}

export function MenuButton({ onPress, color = colors.text, style, label }: HeaderButtonProps) {
  const { language } = useLanguage();
  return (
    <IconButton
      icon="menu"
      size={26}
      color={color}
      onPress={onPress}
      accessibilityLabel={label ?? translations[language].uiOpenMenu}
      style={style}
      testID="header-menu"
    />
  );
}

const styles = StyleSheet.create({
  iconButton: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    borderRadius: layout.minTouchTarget / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { backgroundColor: "rgba(31, 42, 55, 0.08)" },
  disabled: { opacity: 0.4 },
});
