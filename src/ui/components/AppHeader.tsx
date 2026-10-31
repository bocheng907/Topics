import { router, type Href } from "expo-router";
import React from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDrawer } from "../DrawerContext";
import { colors, layout, spacing, typography } from "../theme";
import { BackButton, MenuButton } from "./HeaderButtons";

export type AppHeaderProps = {
  title: string;
  subtitle?: string;
  /** "back" (default), "menu", "none", or any custom node. */
  left?: "back" | "menu" | "none" | React.ReactNode;
  /** Defaults to router.back(), or router.replace(fallbackHref) when there is no history. */
  onBack?: () => void;
  fallbackHref?: Href;
  /** Defaults to opening the role drawer from DrawerContext (no-op outside a provider). */
  onMenu?: () => void;
  /** Right-side actions (e.g. IconButton / Button variant="ghost"). */
  right?: React.ReactNode;
  variant?: "surface" | "primary";
  /** Set false when the header is not at the very top of the screen. */
  safeAreaTop?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Unified top bar: fixed 56pt row, left control + left-aligned title, optional actions. */
export function AppHeader({
  title,
  subtitle,
  left = "back",
  onBack,
  fallbackHref = "/" as Href,
  onMenu,
  right,
  variant = "surface",
  safeAreaTop = true,
  style,
}: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  const drawer = useDrawer();
  const isPrimary = variant === "primary";
  const fg = isPrimary ? colors.onPrimary : colors.text;

  const handleBack = () => {
    if (onBack) return onBack();
    if (router.canGoBack()) router.back();
    else router.replace(fallbackHref);
  };

  let leftNode: React.ReactNode = null;
  if (left === "back") leftNode = <BackButton onPress={handleBack} color={isPrimary ? colors.onPrimary : colors.primary} />;
  else if (left === "menu") leftNode = <MenuButton onPress={onMenu ?? drawer.open} color={fg} />;
  else if (left !== "none") leftNode = left;

  return (
    <View
      style={[
        styles.root,
        { paddingTop: safeAreaTop ? insets.top : 0, paddingLeft: insets.left, paddingRight: insets.right },
        isPrimary ? styles.primary : styles.surface,
        style,
      ]}
    >
      <View style={[styles.row, !leftNode && styles.rowNoLeft]}>
        {leftNode ? <View style={styles.side}>{leftNode}</View> : null}
        <View style={styles.titleBox}>
          <Text
            style={[styles.title, { color: fg }, subtitle ? styles.titleCompact : null]}
            numberOfLines={1}
            accessibilityRole="header"
          >
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: isPrimary ? colors.primarySoft : colors.textMuted }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right ? <View style={[styles.side, styles.right]}>{right}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: "100%" },
  surface: {
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  primary: { backgroundColor: colors.primary },
  row: {
    height: layout.headerHeight,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.xs,
  },
  rowNoLeft: { paddingLeft: spacing.md },
  side: { flexDirection: "row", alignItems: "center" },
  right: { marginLeft: spacing.xs },
  titleBox: { flex: 1, minWidth: 0, justifyContent: "center", paddingHorizontal: spacing.xs },
  title: { ...typography.header },
  titleCompact: { fontSize: 18, lineHeight: 24 },
  subtitle: { ...typography.caption },
});
