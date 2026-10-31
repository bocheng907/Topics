import { translations } from "@/src/i18n/translations";
import { useLanguage } from "@/src/store/LanguageContext";
import React from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type KeyboardAvoidingViewProps,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useScreenBottomInset } from "../BottomInsetContext";
import { colors, layout, radii, shadows, spacing, typography } from "../theme";

const kavBehavior: KeyboardAvoidingViewProps["behavior"] =
  Platform.OS === "ios" ? "padding" : Platform.OS === "android" ? "height" : undefined;

/* ---------------------------------------------------- KeyboardAwareScroll */

export type KeyboardAwareScrollProps = ScrollViewProps & {
  /** Extra offset for content above the KeyboardAvoidingView (e.g. a header). */
  keyboardVerticalOffset?: number;
  /** Adds bottom spacing + the safe-area inset (unless the BottomNav already clears it) to the scroll content. */
  safeAreaBottom?: boolean;
};

/** Scrollable form body that keeps the focused input above the keyboard. */
export function KeyboardAwareScroll({
  keyboardVerticalOffset = 0,
  safeAreaBottom = true,
  contentContainerStyle,
  children,
  ...rest
}: KeyboardAwareScrollProps) {
  // 0 when the BottomNav below this screen already clears the home indicator.
  const bottomInset = useScreenBottomInset();
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={kavBehavior} keyboardVerticalOffset={keyboardVerticalOffset}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        {...rest}
        contentContainerStyle={[
          styles.scrollContent,
          safeAreaBottom && { paddingBottom: spacing.xl + bottomInset },
          contentContainerStyle,
        ]}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* -------------------------------------------------------------- FormSheet */

export type FormSheetProps = {
  visible: boolean;
  title: string;
  onCancel: () => void;
  onSave?: () => void;
  cancelLabel?: string;
  saveLabel?: string;
  saving?: boolean;
  saveDisabled?: boolean;
  /** Force full-screen; otherwise full-screen only on short screens (< 640pt tall). */
  fullScreen?: boolean;
  /** Pinned below the scroll area (e.g. a destructive "delete" button). */
  footer?: React.ReactNode;
  children: React.ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

/**
 * Bottom-sheet form container with a cancel / title / save bar.
 * Becomes full-screen on short phones; centred dialog on wide web screens.
 */
export function FormSheet({
  visible,
  title,
  onCancel,
  onSave,
  cancelLabel,
  saveLabel,
  saving = false,
  saveDisabled = false,
  fullScreen,
  footer,
  children,
  contentContainerStyle,
}: FormSheetProps) {
  const { language } = useLanguage();
  const t = translations[language];
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isFull = fullScreen ?? height < 640;
  const isWide = Platform.OS === "web" && width >= 768;
  const saveInactive = saveDisabled || saving;

  const sheetStyle: StyleProp<ViewStyle> = isFull
    ? [styles.sheetFull, { paddingTop: insets.top }]
    : isWide
      ? [styles.sheet, styles.sheetDialog, { maxHeight: Math.min(height * 0.85, 760) }]
      : [styles.sheet, { maxHeight: height * 0.92 }];

  return (
    <Modal
      visible={visible}
      transparent={!isFull}
      animationType={isWide ? "fade" : "slide"}
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <View style={[styles.backdrop, isFull && styles.backdropFull, isWide && styles.backdropCenter]}>
        {!isFull ? <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityLabel={cancelLabel ?? t.cancel} /> : null}
        <KeyboardAvoidingView behavior={kavBehavior} style={isFull ? styles.flex : styles.kavSheet} pointerEvents="box-none">
          <View style={sheetStyle} accessibilityViewIsModal>
            {!isFull && !isWide ? <View style={styles.grabber} /> : null}
            <View style={styles.bar}>
              <Pressable
                onPress={onCancel}
                accessibilityRole="button"
                style={({ pressed }) => [styles.barButton, pressed && styles.barPressed]}
              >
                <Text style={styles.cancelText}>{cancelLabel ?? t.cancel}</Text>
              </Pressable>
              <Text style={styles.barTitle} numberOfLines={1} accessibilityRole="header">
                {title}
              </Text>
              {onSave ? (
                <Pressable
                  onPress={onSave}
                  disabled={saveInactive}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: saveInactive, busy: saving }}
                  style={({ pressed }) => [styles.barButton, styles.saveButton, pressed && styles.barPressed]}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Text style={[styles.saveText, saveDisabled && { color: colors.textDisabled }]}>{saveLabel ?? t.save}</Text>
                  )}
                </Pressable>
              ) : (
                <View style={styles.barButton} />
              )}
            </View>
            <ScrollView
              style={isFull ? styles.flex : styles.sheetScroll}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
              contentContainerStyle={[styles.sheetContent, !footer && { paddingBottom: spacing.xl + insets.bottom }, contentContainerStyle]}
            >
              {children}
            </ScrollView>
            {footer ? <View style={[styles.footer, { paddingBottom: spacing.md + insets.bottom }]}>{footer}</View> : null}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { padding: spacing.lg, gap: spacing.lg },

  backdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: "flex-end" },
  backdropFull: { backgroundColor: colors.surface },
  backdropCenter: { justifyContent: "center", alignItems: "center", padding: spacing.xl },
  kavSheet: { width: "100%", alignItems: "center" },

  sheet: {
    width: "100%",
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    overflow: "hidden",
    ...shadows.sheet,
  },
  sheetDialog: { maxWidth: 560, borderRadius: radii.sheet },
  sheetFull: { flex: 1, width: "100%", backgroundColor: colors.surface },
  sheetScroll: { flexGrow: 0, flexShrink: 1 },
  sheetContent: { padding: spacing.lg, gap: spacing.lg },

  grabber: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginTop: spacing.sm,
  },
  bar: {
    height: layout.headerHeight,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  barButton: {
    minWidth: 72,
    minHeight: layout.minTouchTarget,
    paddingHorizontal: spacing.md,
    borderRadius: radii.control,
    justifyContent: "center",
  },
  saveButton: { alignItems: "flex-end" },
  barPressed: { backgroundColor: colors.surfaceSunken },
  barTitle: { ...typography.header, fontSize: 18, flex: 1, minWidth: 0, textAlign: "center" },
  cancelText: { ...typography.body, color: colors.textSecondary },
  saveText: { ...typography.bodyStrong, color: colors.primary },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    backgroundColor: colors.surface,
  },
});
