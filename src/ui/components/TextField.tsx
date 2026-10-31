import React, { forwardRef, useState } from "react";
import { Platform, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputInstance, type TextInputProps, type TextStyle, type ViewStyle } from "react-native";
import { colors, radii, spacing, typography } from "../theme";

export type TextFieldProps = Omit<TextInputProps, "style"> & {
  label?: string;
  helper?: string;
  /** Error text; also switches the field into the error state. */
  error?: string;
  required?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: TextInputProps["style"];
};

// react-native-web draws its own focus outline; we draw the ring ourselves.
const webNoOutline = Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null;

// Native draws the focus/error ring as a 2pt border; at rest the field reserves
// that extra 1pt as padding so focusing never changes any geometry. Web draws
// the ring with a box-shadow and needs no reserve.
const RING_INSET = Platform.OS === "web" ? 0 : 1;

export const TextField = forwardRef<TextInputInstance, TextFieldProps>(function TextField(
  { label, helper, error, required, multiline, containerStyle, inputStyle, onFocus, onBlur, editable = true, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const borderColor = error ? colors.danger : focused ? colors.primary : colors.border;

  // iOS: a lineHeight on a single-line TextInput pushes the text and placeholder
  // below the vertical centre, and letterSpacing is also applied to the
  // placeholder. Strip lineHeight from single-line inputs, and only apply a
  // caller's letterSpacing (e.g. code inputs) once there is typed text.
  const { lineHeight, letterSpacing, ...flatInputStyle } = (StyleSheet.flatten(inputStyle) ?? {}) as TextStyle;
  const hasText = typeof rest.value === "string" ? rest.value.length > 0 : Boolean(rest.defaultValue);
  const callerStyle: TextStyle = {
    ...flatInputStyle,
    ...(multiline && lineHeight != null ? { lineHeight } : null),
    ...(hasText && letterSpacing != null ? { letterSpacing } : null),
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <Text style={styles.label}>
          {label}
          {required ? <Text style={{ color: colors.danger }}> *</Text> : null}
        </Text>
      ) : null}
      <View
        style={[
          styles.field,
          { borderColor },
          focused && !error && styles.fieldFocused,
          error && styles.fieldError,
          !editable && styles.fieldDisabled,
        ]}
      >
        <TextInput
          ref={ref}
          {...rest}
          editable={editable}
          multiline={multiline}
          textAlignVertical={multiline ? "top" : "center"}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={rest.accessibilityLabel ?? label}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, multiline && styles.inputMultiline, webNoOutline, callerStyle]}
        />
      </View>
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : helper ? (
        <Text style={styles.helper}>{helper}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { alignSelf: "stretch" },
  label: { ...typography.label, marginBottom: 6 },
  // The field's outer box never changes size on focus/error: native trades
  // 1pt of padding for 1pt of extra border (1+1 -> 2+0), so the frame, the
  // TextInput and the text inside all stay put. overflow:hidden makes iOS
  // paint border + fill on the view's own CALayer instead of two sublayers;
  // otherwise the border sublayer implicitly animates its frame while the
  // fill snaps, and they visibly drift apart while KeyboardAvoidingView's
  // LayoutAnimation moves the form for the keyboard.
  field: {
    minHeight: 52,
    borderWidth: 1,
    padding: RING_INSET,
    borderRadius: radii.control,
    backgroundColor: colors.surface,
    justifyContent: "center",
    ...(Platform.OS === "web" ? null : { overflow: "hidden" as const }),
  },
  fieldFocused: Platform.select({
    web: { boxShadow: `0 0 0 1px ${colors.primary}` },
    default: { borderWidth: 2, padding: 0 },
  }) as ViewStyle,
  fieldError: Platform.select({
    web: { boxShadow: `0 0 0 1px ${colors.danger}` },
    default: { borderWidth: 2, padding: 0 },
  }) as ViewStyle,
  fieldDisabled: { backgroundColor: colors.surfaceSunken },
  // Single-line: no lineHeight (iOS offsets the placeholder downward with it)
  // and no vertical padding -- the native field centres the line inside
  // minHeight on both platforms. includeFontPadding off so Android doesn't add
  // extra space above the glyphs.
  input: {
    fontSize: typography.body.fontSize,
    fontWeight: typography.body.fontWeight,
    color: typography.body.color,
    letterSpacing: 0,
    minHeight: 50 - 2 * RING_INSET,
    paddingHorizontal: spacing.md + 2 - RING_INSET,
    paddingVertical: 0,
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  // Multiline: text starts at the top with equal top/bottom padding.
  inputMultiline: {
    lineHeight: typography.body.lineHeight,
    minHeight: 112 - 2 * RING_INSET,
    paddingTop: spacing.md - RING_INSET,
    paddingBottom: spacing.md - RING_INSET,
    textAlignVertical: "top",
  },
  helper: { ...typography.caption, marginTop: 6 },
  error: { ...typography.caption, color: colors.danger, fontWeight: "600", marginTop: 6 },
});
