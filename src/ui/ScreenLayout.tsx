import React, { forwardRef } from "react";
import { ScrollView, ScrollViewProps, type ScrollViewInstance, StyleSheet, ViewProps } from "react-native";
import { Edge, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * A fixed header that follows the device notch instead of a guessed top offset.
 * @deprecated No screen uses this any more; use `AppHeader` from `@/src/ui/components`.
 * Kept exported only so stale imports keep compiling.
 */
export function ScreenHeader({ style, menuSpace = false, ...props }: ViewProps & { menuSpace?: boolean }) {
  const insets = useSafeAreaInsets();
  return <SafeAreaView
    edges={["top", "left", "right"]}
    {...props}
    style={[style, menuSpace && { paddingRight: 76, minHeight: insets.top + 72 }]}
  />;
}

/** Keep scrolling forms inside the safe area, including on short/landscape screens. */
export const ScreenScrollView = forwardRef<ScrollViewInstance, ScrollViewProps & { edges?: Edge[] }>(
  function ScreenScrollView({ edges = ["top", "bottom", "left", "right"], ...props }, ref) {
    return <SafeAreaView style={styles.screen} edges={edges}>
      <ScrollView automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" {...props} ref={ref} />
    </SafeAreaView>;
  },
);

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: "#FFF" } });
