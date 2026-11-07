// src/ui/theme.ts
// OmniCare design tokens. Pure presentation values: no data, no side effects.
// Contrast notes (WCAG, on white #FFFFFF):
//   primary #44709E ≈ 5.1:1 (white text on primary passes AA)
//   accent  #B0552F ≈ 5.0:1, danger #B42318 ≈ 6.4:1, text #1F2A37 ≈ 14:1
import { Platform, type TextStyle, type ViewStyle } from "react-native";

export const colors = {
  // Brand — soft, low-saturation blue
  primary: "#44709E",
  primaryPressed: "#365B82",
  primarySoft: "#EAF1F8",
  primaryBorder: "#BCD0E4",
  onPrimary: "#FFFFFF",

  // Neutrals
  text: "#1F2A37",
  textSecondary: "#4B5563",
  textMuted: "#6B7280",
  textDisabled: "#9CA3AF",
  border: "#D9E0E8",
  divider: "#E8ECF1",
  canvas: "#F4F6F9",
  surface: "#FFFFFF",
  surfaceSunken: "#EEF1F5",
  overlay: "rgba(17, 24, 39, 0.42)",

  // The ONE warm accent — reserved for urgent / key actions (e.g. emergency call)
  accent: "#B0552F",
  accentPressed: "#8F4425",
  accentSoft: "#F8ECE6",
  onAccent: "#FFFFFF",

  // Status — only for status
  danger: "#B42318",
  dangerPressed: "#912018",
  dangerSoft: "#FDECEA",
  warning: "#8A5A00",
  warningSoft: "#FFF4DB",
  success: "#2E7D4F",
  successSoft: "#E6F4EC",

  // Vital "block" tiles (family home): body = calm mid-tone with dark value text,
  // strip = deep shade with white text. Contrast: text #1F2A37 on body ≥ 8:1,
  // white on strip ≥ 5:1.
  vitalNormal: "#A6D9B5",
  vitalNormalStrong: "#2E7D4F",
  vitalAbnormal: "#F5AFA8",
  vitalAbnormalStrong: "#B42318",
  vitalIdle: "#D5DAE1",
  vitalIdleStrong: "#5B6472",
} as const;

export type ColorToken = keyof typeof colors;

/**
 * Calendar event colours picked by users. These hex strings are persisted in
 * Firestore (`event.color`), so the exact values must stay unchanged.
 */
export const eventColors = ["#F4A261", "#B9A0F3", "#73B8F2", "#F6BDC2", "#7EDB68"] as const;

const weight = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
} as const satisfies Record<string, TextStyle["fontWeight"]>;

export const fontWeight = weight;

/** Type scale tuned for elders and caregivers. Body never goes below 16. */
export const typography = {
  display: { fontSize: 28, lineHeight: 36, fontWeight: weight.bold, color: colors.text },
  title: { fontSize: 22, lineHeight: 30, fontWeight: weight.bold, color: colors.text },
  header: { fontSize: 20, lineHeight: 28, fontWeight: weight.semibold, color: colors.text },
  bodyStrong: { fontSize: 17, lineHeight: 26, fontWeight: weight.semibold, color: colors.text },
  body: { fontSize: 17, lineHeight: 26, fontWeight: weight.regular, color: colors.text },
  bodySmall: { fontSize: 15, lineHeight: 22, fontWeight: weight.regular, color: colors.textSecondary },
  label: { fontSize: 15, lineHeight: 20, fontWeight: weight.semibold, color: colors.text },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: weight.regular, color: colors.textMuted },
  overline: { fontSize: 13, lineHeight: 18, fontWeight: weight.semibold, letterSpacing: 0.6, color: colors.textMuted },
} as const satisfies Record<string, TextStyle>;

export type TypographyToken = keyof typeof typography;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radii = {
  control: 10, // inputs, buttons
  card: 14,
  sheet: 20, // top corners of bottom sheets
  pill: 999,
} as const;

function shadow(offsetY: number, blur: number, opacity: number, elevation: number): ViewStyle {
  return Platform.select<ViewStyle>({
    ios: {
      shadowColor: "#0F172A",
      shadowOffset: { width: 0, height: offsetY },
      shadowOpacity: opacity,
      shadowRadius: blur / 2,
    },
    android: { elevation },
    default: { boxShadow: `0px ${offsetY}px ${blur}px rgba(15, 23, 42, ${opacity})` },
  }) as ViewStyle;
}

/** Shadows are only for floating layers. Cards use a 1px border instead. */
export const shadows = {
  drawer: shadow(0, 24, 0.18, 16),
  sheet: shadow(-4, 24, 0.14, 24),
  fab: shadow(4, 12, 0.2, 6),
} as const;

export const layout = {
  headerHeight: 56,
  bottomNavHeight: 64,
  minTouchTarget: 48,
  screenPaddingX: spacing.lg,
  maxContentWidth: 720,
  drawerMaxWidth: 340,
  drawerWidthRatio: 0.84,
} as const;

/** Drawer width rule: min(84% of the screen, 340). */
export function drawerWidth(screenWidth: number) {
  return Math.round(Math.min(screenWidth * layout.drawerWidthRatio, layout.drawerMaxWidth));
}

/** Expands a visual element of `size` to reach the minimum touch target. */
export function hitSlop(size: number, target: number = layout.minTouchTarget) {
  const pad = Math.max(0, Math.ceil((target - size) / 2));
  return { top: pad, bottom: pad, left: pad, right: pad };
}

export const motion = {
  drawerOpenMs: 240,
  drawerCloseMs: 200,
  pressOpacity: 0.85,
} as const;

/** Animated.useNativeDriver is unsupported on react-native-web. */
export const useNativeDriver = Platform.OS !== "web";

export const theme = { colors, eventColors, typography, spacing, radii, shadows, layout, motion } as const;
export default theme;
