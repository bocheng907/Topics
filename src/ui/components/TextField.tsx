import React, { forwardRef, useState } from "react";
import { Platform, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputInstance, type TextInputProps, type ViewStyle } from "react-native";
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

export const TextField = forwardRef<TextInputInstance, TextFieldProps>(function TextField(
  { label, helper, error, required, multiline, containerStyle, inputStyle, onFocus, onBlur, editable = true, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const borderColor = error ? colors.danger : focused ? colors.primary : colors.border;

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
          style={[styles.input, multiline && styles.inputMultiline, webNoOutline, inputStyle]}
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
  field: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: radii.control,
    backgroundColor: colors.surface,
    justifyContent: "center",
  },
  // A 1px border plus a 1px ring keeps the text from shifting on focus.
  fieldFocused: Platform.select({
    web: { boxShadow: `0 0 0 1px ${colors.primary}` },
    default: { borderWidth: 2, margin: -1 },
  }) as ViewStyle,
  fieldError: Platform.select({
    web: { boxShadow: `0 0 0 1px ${colors.danger}` },
    default: { borderWidth: 2, margin: -1 },
  }) as ViewStyle,
  fieldDisabled: { backgroundColor: colors.surfaceSunken },
  input: {
    ...typography.body,
    minHeight: 50,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.md,
  },
  inputMultiline: { minHeight: 112, paddingTop: spacing.md },
  helper: { ...typography.caption, marginTop: 6 },
  error: { ...typography.caption, color: colors.danger, fontWeight: "600", marginTop: 6 },
});
