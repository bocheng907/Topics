import { translations } from "@/src/i18n/translations";
import { useLanguage } from "@/src/store/LanguageContext";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  BackHandler,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, drawerWidth, motion, radii, shadows, spacing, typography, useNativeDriver } from "../theme";
import type { IconName } from "./types";

export type SideDrawerItem = {
  key: string;
  icon: IconName;
  label: string;
  onPress: () => void;
  tone?: "default" | "danger";
  /** Count or short text shown as a pill on the right. */
  badge?: number | string;
};

export type SideDrawerSection = {
  title?: string;
  items: SideDrawerItem[];
};

export type SideDrawerProps = {
  open: boolean;
  onClose: () => void;
  /** User / role block at the top. */
  header?: React.ReactNode;
  sections: SideDrawerSection[];
  /** Pinned at the bottom (e.g. language switch, sign-out). */
  footer?: React.ReactNode;
  /** Highlights the item for the current page. */
  activeKey?: string;
  side?: "left" | "right";
};

/**
 * Shared navigation drawer for family / caregiver / agency.
 * Render it as the last child of a full-screen container so it overlays the page.
 */
export function SideDrawer({ open, onClose, header, sections, footer, activeKey, side = "left" }: SideDrawerProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();
  const panelWidth = drawerWidth(width);
  const [mounted, setMounted] = useState(open);
  const progress = useRef(new Animated.Value(open ? 1 : 0)).current;

  useEffect(() => {
    if (open) setMounted(true);
    Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration: open ? motion.drawerOpenMs : motion.drawerCloseMs,
      easing: open ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver,
    }).start(({ finished }) => {
      if (finished && !open) setMounted(false);
    });
  }, [open, progress]);

  // Android hardware back closes the drawer instead of leaving the page.
  useEffect(() => {
    if (!open || Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [open, onClose]);

  // Escape closes it on web.
  useEffect(() => {
    if (!open || Platform.OS !== "web" || typeof window === "undefined") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted) return null;

  const hidden = side === "left" ? -panelWidth : panelWidth;
  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [hidden, 0] });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={open ? "auto" : "none"}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.overlay, { opacity: progress }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={translations[language].uiCloseMenu}
        />
      </Animated.View>

      <Animated.View
        accessibilityViewIsModal
        style={[
          styles.panel,
          side === "left" ? styles.panelLeft : styles.panelRight,
          { width: panelWidth, paddingTop: insets.top, transform: [{ translateX }] },
        ]}
      >
        {header ? <View style={styles.header}>{header}</View> : null}
        <ScrollView style={styles.flex} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {sections.map((section, sectionIndex) => (
            <View key={section.title ?? `section-${sectionIndex}`} style={sectionIndex > 0 && styles.sectionGap}>
              {section.title ? <Text style={styles.sectionTitle}>{section.title}</Text> : null}
              {section.items.map((item) => (
                <DrawerRow key={item.key} item={item} active={item.key === activeKey} />
              ))}
            </View>
          ))}
        </ScrollView>
        {footer ? <View style={[styles.footer, { paddingBottom: spacing.md + insets.bottom }]}>{footer}</View> : <View style={{ height: insets.bottom }} />}
      </Animated.View>
    </View>
  );
}

function DrawerRow({ item, active }: { item: SideDrawerItem; active: boolean }) {
  const danger = item.tone === "danger";
  const fg = danger ? colors.danger : active ? colors.primary : colors.text;
  return (
    <Pressable
      onPress={item.onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={item.badge != null ? `${item.label} (${item.badge})` : item.label}
      style={({ pressed }) => [styles.row, active && styles.rowActive, pressed && !active && styles.rowPressed]}
    >
      <Ionicons name={item.icon} size={22} color={danger ? colors.danger : active ? colors.primary : colors.textSecondary} />
      <Text style={[styles.rowLabel, { color: fg }, active && styles.rowLabelActive]} numberOfLines={1}>
        {item.label}
      </Text>
      {item.badge != null && item.badge !== 0 ? (
        <View style={[styles.badge, danger && { backgroundColor: colors.danger }]}>
          <Text style={styles.badgeText}>{item.badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  overlay: { backgroundColor: colors.overlay },
  panel: {
    position: "absolute",
    top: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    ...shadows.drawer,
  },
  panelLeft: { left: 0, borderTopRightRadius: radii.sheet, borderBottomRightRadius: radii.sheet },
  panelRight: { right: 0, borderTopLeftRadius: radii.sheet, borderBottomLeftRadius: radii.sheet },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  scrollContent: { paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  sectionGap: { marginTop: spacing.lg },
  sectionTitle: { ...typography.overline, paddingHorizontal: spacing.md, paddingBottom: spacing.xs },
  row: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radii.control,
  },
  rowActive: { backgroundColor: colors.primarySoft },
  rowPressed: { backgroundColor: colors.surfaceSunken },
  rowLabel: { ...typography.body, flex: 1 },
  rowLabelActive: { fontWeight: "600" },
  badge: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 7,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: colors.onPrimary, fontSize: 13, lineHeight: 16, fontWeight: "700" },
  footer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
});
