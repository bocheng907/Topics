// src/calendar/components/EventFormSheet.tsx
// Add / edit event form in a FormSheet (Cancel | title | Save, keyboard-aware, safe-area bottom).
// Purely presentational: the screen owns the form state and the save handler.
import { calendarCopy } from "@/src/i18n/copy/calendarCopy";
import { useLanguage } from "@/src/store/LanguageContext";
import { FormSheet, IconButton, TextField } from "@/src/ui/components";
import { colors, eventColors, layout, radii, spacing, typography } from "@/src/ui/theme";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export type EventFormValues = {
  personName: string;
  title: string;
  location: string;
  color: string;
};

export type EventTimePeriod = "am" | "pm";

export type EventFormSheetProps = {
  visible: boolean;
  editing: boolean;
  values: EventFormValues;
  onChange: (patch: Partial<EventFormValues>) => void;
  date: Date;
  onShiftDate: (diffDays: number) => void;
  hour: number;
  minute: number;
  period: EventTimePeriod;
  onChangeHour: (hour: number) => void;
  onChangeMinute: (minute: number) => void;
  onChangePeriod: (period: EventTimePeriod) => void;
  /** Inline error shown at the top of the form. */
  error?: string;
  saving?: boolean;
  onCancel: () => void;
  onSave: () => void;
};

const HOURS = Array.from({ length: 12 }, (_, index) => index + 1);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

export function EventFormSheet({
  visible,
  editing,
  values,
  onChange,
  date,
  onShiftDate,
  hour,
  minute,
  period,
  onChangeHour,
  onChangeMinute,
  onChangePeriod,
  error,
  saving = false,
  onCancel,
  onSave,
}: EventFormSheetProps) {
  const { language } = useLanguage();
  const copy = calendarCopy[language];
  const periodLabel = period === "am" ? copy.am : copy.pm;
  const timeSummary = language === "zh" ? `${periodLabel} ${hour}:${pad2(minute)}` : `${hour}:${pad2(minute)} ${periodLabel}`;

  return (
    <FormSheet
      visible={visible}
      title={editing ? copy.formTitleEdit : copy.formTitleNew}
      cancelLabel={copy.cancel}
      saveLabel={copy.save}
      onCancel={onCancel}
      onSave={onSave}
      saving={saving}
    >
      {error ? (
        <View style={styles.errorBox} accessibilityLiveRegion="polite" accessibilityRole="alert">
          <Ionicons name="alert-circle" size={20} color={colors.danger} style={styles.errorIcon} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* 1. Title */}
      <TextField
        label={copy.titleLabel}
        value={values.title}
        onChangeText={(text) => onChange({ title: text })}
        placeholder={copy.titlePlaceholder}
        returnKeyType="done"
        maxLength={80}
      />

      {/* 2. Date */}
      <View>
        <Text style={styles.label}>{copy.dateLabel}</Text>
        <View style={styles.dateRow}>
          <IconButton icon="chevron-back" color={colors.primary} onPress={() => onShiftDate(-1)} accessibilityLabel={copy.prevDay} />
          <View style={styles.dateValue}>
            <Ionicons name="calendar-outline" size={20} color={colors.primary} />
            <Text style={styles.dateText} numberOfLines={2}>
              {copy.dayTitle(date)}
            </Text>
          </View>
          <IconButton icon="chevron-forward" color={colors.primary} onPress={() => onShiftDate(1)} accessibilityLabel={copy.nextDay} />
        </View>
      </View>

      {/* 3. Time */}
      <View>
        <View style={styles.labelRow}>
          <Text style={styles.label}>{copy.timeLabel}</Text>
          <Text style={styles.timeSummary} accessibilityLiveRegion="polite">
            {timeSummary}
          </Text>
        </View>
        <View style={styles.segment} accessibilityRole="radiogroup">
          {(["am", "pm"] as const).map((value) => {
            const active = period === value;
            return (
              <Pressable
                key={value}
                onPress={() => onChangePeriod(value)}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                style={({ pressed }) => [styles.segmentItem, active && styles.segmentItemActive, pressed && !active && styles.pressed]}
              >
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{value === "am" ? copy.am : copy.pm}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.subLabel}>{copy.hourLabel}</Text>
        <OptionGrid options={HOURS} value={hour} onChange={onChangeHour} render={(h) => String(h)} />
        <Text style={styles.subLabel}>{copy.minuteLabel}</Text>
        <OptionGrid options={MINUTES} value={minute} onChange={onChangeMinute} render={(m) => pad2(m)} />
      </View>

      {/* 4. Person & location */}
      <TextField
        label={copy.personLabel}
        value={values.personName}
        onChangeText={(text) => onChange({ personName: text })}
        placeholder={copy.personPlaceholder}
        helper={copy.personHelper}
        returnKeyType="done"
      />
      <TextField
        label={copy.locationLabel}
        value={values.location}
        onChangeText={(text) => onChange({ location: text })}
        placeholder={copy.locationPlaceholder}
        returnKeyType="done"
      />

      {/* 5. Colour */}
      <View>
        <Text style={styles.label}>{copy.colorLabel}</Text>
        <Text style={styles.helper}>{copy.colorHelper}</Text>
        <View style={styles.swatches} accessibilityRole="radiogroup">
          {eventColors.map((color, index) => {
            const selected = values.color === color;
            const name = copy.colorNames[index] ?? color;
            return (
              <Pressable
                key={color}
                onPress={() => onChange({ color })}
                accessibilityRole="radio"
                accessibilityLabel={name}
                accessibilityState={{ checked: selected }}
                style={({ pressed }) => [styles.swatchItem, pressed && styles.pressed]}
              >
                <View style={[styles.swatchRing, selected && styles.swatchRingSelected]}>
                  <View style={[styles.swatch, { backgroundColor: color }]}>
                    {selected ? <Ionicons name="checkmark" size={22} color={colors.text} /> : null}
                  </View>
                </View>
                <Text style={[styles.swatchLabel, selected && styles.swatchLabelSelected]} numberOfLines={1}>
                  {name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </FormSheet>
  );
}

function OptionGrid({
  options,
  value,
  onChange,
  render,
}: {
  options: number[];
  value: number;
  onChange: (value: number) => void;
  render: (value: number) => string;
}) {
  return (
    <View style={styles.grid} accessibilityRole="radiogroup">
      {options.map((option) => {
        const active = option === value;
        return (
          <View key={option} style={styles.gridCell}>
            <Pressable
              onPress={() => onChange(option)}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              style={({ pressed }) => [styles.option, active && styles.optionActive, pressed && !active && styles.pressed]}
            >
              <Text style={[styles.optionText, active && styles.optionTextActive]}>{render(option)}</Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const SWATCH = 44;

const styles = StyleSheet.create({
  label: { ...typography.label, marginBottom: 6 },
  labelRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 },
  subLabel: { ...typography.caption, marginTop: spacing.md, marginBottom: spacing.xs },
  helper: { ...typography.caption, marginTop: -2, marginBottom: spacing.sm },
  pressed: { backgroundColor: colors.surfaceSunken },

  errorBox: {
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.control,
    backgroundColor: colors.dangerSoft,
  },
  errorIcon: { marginTop: 3 },
  errorText: { ...typography.body, color: colors.danger, flex: 1 },

  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.control,
    minHeight: 52,
  },
  dateValue: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  dateText: { ...typography.bodyStrong, flexShrink: 1, textAlign: "center" },

  timeSummary: { ...typography.header, color: colors.primary, fontVariant: ["tabular-nums"] },
  segment: {
    flexDirection: "row",
    backgroundColor: colors.surfaceSunken,
    borderRadius: radii.control,
    padding: 3,
    gap: 3,
  },
  segmentItem: {
    flex: 1,
    minHeight: layout.minTouchTarget,
    borderRadius: radii.control - 2,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentItemActive: { backgroundColor: colors.primary },
  segmentText: { ...typography.bodyStrong, color: colors.textSecondary },
  segmentTextActive: { color: colors.onPrimary },

  grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -3 },
  gridCell: { width: `${100 / 6}%`, padding: 3 },
  option: {
    minHeight: layout.minTouchTarget,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  optionActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  optionText: { ...typography.body, fontVariant: ["tabular-nums"] },
  optionTextActive: { color: colors.onPrimary, fontWeight: "700" },

  swatches: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  swatchItem: { alignItems: "center", minWidth: 64, paddingVertical: spacing.xs, borderRadius: radii.control, flexGrow: 1 },
  swatchRing: {
    width: SWATCH + 8,
    height: SWATCH + 8,
    borderRadius: (SWATCH + 8) / 2,
    borderWidth: 3,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  swatchRingSelected: { borderColor: colors.primary },
  swatch: {
    width: SWATCH,
    height: SWATCH,
    borderRadius: SWATCH / 2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  swatchLabel: { ...typography.caption, marginTop: 2 },
  swatchLabelSelected: { color: colors.text, fontWeight: "700" },
});
