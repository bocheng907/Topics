import React, { createContext, useContext } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * True when the surrounding role layout already keeps the screen clear of the
 * bottom of the device: either the BottomNav sits below the content (and pads
 * the home indicator itself) or the layout pads `insets.bottom` when the nav is
 * hidden. Screens inside such a layout must NOT add `insets.bottom` again.
 * Default false (e.g. agency, root-level screens).
 */
const BottomInsetHandledContext = createContext(false);

export function BottomInsetHandledProvider({ handled = true, children }: { handled?: boolean; children: React.ReactNode }) {
  return <BottomInsetHandledContext.Provider value={handled}>{children}</BottomInsetHandledContext.Provider>;
}

export function useBottomInsetHandled() {
  return useContext(BottomInsetHandledContext);
}

/** The bottom safe-area inset a screen still has to add itself (0 inside the family/caregiver layouts). */
export function useScreenBottomInset() {
  const insets = useSafeAreaInsets();
  return useBottomInsetHandled() ? 0 : insets.bottom;
}
