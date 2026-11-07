import React, { createContext, useContext } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * True when the BottomNav is shown below the current screen: the nav pads the
 * home indicator itself, so the screen must NOT add `insets.bottom` again.
 * False everywhere else (nav hidden for the route, agency, root-level screens):
 * nothing is reserved by the layout, the screen runs to the bottom edge and its
 * scroll content / fixed bottom bars add `insets.bottom` themselves.
 */
const BottomInsetHandledContext = createContext(false);

export function BottomInsetHandledProvider({ handled = true, children }: { handled?: boolean; children: React.ReactNode }) {
  return <BottomInsetHandledContext.Provider value={handled}>{children}</BottomInsetHandledContext.Provider>;
}

export function useBottomInsetHandled() {
  return useContext(BottomInsetHandledContext);
}

/** The bottom safe-area inset a screen still has to add itself (0 only above a visible BottomNav). */
export function useScreenBottomInset() {
  const insets = useSafeAreaInsets();
  return useBottomInsetHandled() ? 0 : insets.bottom;
}
