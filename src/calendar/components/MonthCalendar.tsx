// src/calendar/components/MonthCalendar.tsx
// Presentational month grid shared by the family and caregiver calendars.
// Each screen keeps its own state and data; this only renders and reports taps.
import { calendarCopy } from "@/src/i18n/copy/calendarCopy";
import { useLanguage } from "@/src/store/LanguageContext";
import { IconButton } from "@/src/ui/components";
import { colors, layout, radii, spacing, typography } from "@/src/ui/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export type MonthCalendarCell = {
  day: number;
  kind: "prev" | "current" | "next";
  date: Date;
};

export type MonthCalendarProps = {
  month: Date;
  selectedDate: Date;
  cells: MonthCalendarCell[];
  /** Event colours for a given day (one entry per event, already time-sorted). */
  markersFor: (date: Date) => string[];
  pickerOpen: boolean;
  onTogglePicker: () => void;
  onSelectDate: (date: Date) => void;
  onShiftMonth: (diff: number) => void;
  onPickMonth: (year: number, monthIndex: number) => void;
  onToday: () => void;
};

const MAX_DOTS = 3;

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function MonthCalendar({
  month,
  selectedDate,
  cells,
  markersFor,
  pickerOpen,
  onTogglePicker,
  onSelectDate,
  onShiftMonth,
  onPickMonth,
  onToday,
}: MonthCalendarProps) {
  const { language } = useLanguage();
  const copy = calendarCopy[language];
  const today = new Date();
  const [pickerYear, setPickerYear] = useState(month.getFullYear());
  const [lastOpen, setLastOpen] = useState(pickerOpen);
  if (lastOpen !== pickerOpen) {
    setLastOpen(pickerOpen);
    if (pickerOpen) setPickerYear(month.getFullYear());
  }

  const isViewingToday = sameDay(selectedDate, today);
  const rows: MonthCalendarCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  return (
    <View style={styles.root}>
      <View style={styles.nav}>
        <IconButton icon="chevron-back" color={colors.primary} onPress={() => onShiftMonth(-1)} accessibilityLabel={copy.prevMonth} />
        <Pressable
          onPress={onTogglePicker}
          accessibilityRole="button"
          accessibilityLabel={`${copy.monthTitle(month.getFullYear(), month.getMonth())}, ${copy.pickMonth}`}
          accessibilityState={{ expanded: pickerOpen }}
          style={({ pressed }) => [styles.titleButton, pressed && styles.pressed]}
        >
          <Text style={styles.title} numberOfLines={1}>
            {copy.monthTitle(month.getFullYear(), month.getMonth())}
          </Text>
          <Ionicons name={pickerOpen ? "chevron-up" : "chevron-down"} size={18} color={colors.textSecondary} />
        </Pressable>
        <IconButton icon="chevron-forward" color={colors.primary} onPress={() => onShiftMonth(1)} accessibilityLabel={copy.nextMonth} />
        <Pressable
          onPress={onToday}
          accessibilityRole="button"
          accessibilityState={{ selected: isViewingToday }}
          style={({ pressed }) => [styles.todayButton, pressed && styles.pressed]}
        >
          <Text style={styles.todayText}>{copy.today}</Text>
        </Pressable>
      </View>

      {pickerOpen ? (
        <View style={styles.picker}>
          <View style={styles.pickerYearRow}>
            <IconButton icon="chevron-back" color={colors.primary} onPress={() => setPickerYear((y) => y - 1)} accessibilityLabel={copy.prevYear} />
            <Text style={styles.pickerYear}>{pickerYear}</Text>
            <IconButton icon="chevron-forward" color={colors.primary} onPress={() => setPickerYear((y) => y + 1)} accessibilityLabel={copy.nextYear} />
          </View>
          <View style={styles.pickerGrid}>
            {copy.monthShort.map((label, index) => {
              const active = pickerYear === month.getFullYear() && index === month.getMonth();
              return (
                <Pressable
                  key={label}
                  onPress={() => onPickMonth(pickerYear, index)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={copy.monthTitle(pickerYear, index)}
                  style={({ pressed }) => [styles.pickerCell, active && styles.pickerCellActive, pressed && !active && styles.pressed]}
                >
                  <Text style={[styles.pickerCellText, active && styles.pickerCellTextActive]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={styles.weekRow} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {copy.weekdaysShort.map((label) => (
          <Text key={label} style={styles.weekText} numberOfLines={1}>
            {label}
          </Text>
        ))}
      </View>

      {rows.map((row, rowIndex) => (
        <View key={`row-${rowIndex}`} style={styles.gridRow}>
          {row.map((cell) => {
            const isSelected = sameDay(cell.date, selectedDate);
            const isToday = sameDay(cell.date, today);
            const outside = cell.kind !== "current";
            const markers = markersFor(cell.date);
            const extra = markers.length - MAX_DOTS;
            return (
              <Pressable
                key={`${cell.kind}-${cell.day}`}
                onPress={() => onSelectDate(cell.date)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`${isToday ? `${copy.today}, ` : ""}${copy.dayA11y(cell.date, markers.length)}`}
                style={({ pressed }) => [styles.cell, pressed && !isSelected && styles.cellPressed]}
              >
                <View style={[styles.dayCircle, isToday && !isSelected && styles.dayCircleToday, isSelected && styles.dayCircleSelected]}>
                  <Text
                    style={[
                      styles.dayText,
                      outside && styles.dayTextOutside,
                      isToday && styles.dayTextToday,
                      isSelected && styles.dayTextSelected,
                    ]}
                  >
                    {cell.day}
                  </Text>
                </View>
                <View style={styles.dots}>
                  {markers.slice(0, MAX_DOTS).map((color, i) => (
                    <View key={i} style={[styles.dot, { backgroundColor: color }]} />
                  ))}
                  {extra > 0 ? <Text style={styles.more}>+</Text> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const DAY_SIZE = 38;

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },
  nav: { flexDirection: "row", alignItems: "center", minHeight: 56, gap: spacing.xs },
  titleButton: {
    flex: 1,
    minWidth: 0,
    minHeight: layout.minTouchTarget,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    borderRadius: radii.control,
    paddingHorizontal: spacing.sm,
  },
  title: { ...typography.header, flexShrink: 1 },
  pressed: { backgroundColor: colors.surfaceSunken },
  todayButton: {
    minHeight: 40,
    minWidth: layout.minTouchTarget,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.xs,
  },
  todayText: { ...typography.label, color: colors.primary },

  picker: {
    backgroundColor: colors.surfaceSunken,
    borderRadius: radii.control,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  pickerYearRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.lg },
  pickerYear: { ...typography.header, minWidth: 72, textAlign: "center" },
  pickerGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: spacing.xs },
  pickerCell: {
    width: "25%",
    minHeight: layout.minTouchTarget,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.control,
  },
  pickerCellActive: { backgroundColor: colors.primary },
  pickerCellText: { ...typography.body },
  pickerCellTextActive: { color: colors.onPrimary, fontWeight: "700" },

  weekRow: { flexDirection: "row", paddingVertical: spacing.xs },
  weekText: { flex: 1, textAlign: "center", ...typography.overline, letterSpacing: 0 },

  gridRow: { flexDirection: "row" },
  cell: {
    flex: 1,
    minHeight: 58,
    alignItems: "center",
    paddingTop: spacing.xs,
    borderRadius: radii.control,
  },
  cellPressed: { backgroundColor: colors.surfaceSunken },
  dayCircle: {
    width: DAY_SIZE,
    height: DAY_SIZE,
    borderRadius: DAY_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  dayCircleToday: { borderWidth: 2, borderColor: colors.primary },
  dayCircleSelected: { backgroundColor: colors.primary },
  dayText: { fontSize: 17, lineHeight: 22, color: colors.text, fontWeight: "500" },
  dayTextOutside: { color: colors.textDisabled },
  dayTextToday: { color: colors.primary, fontWeight: "700" },
  dayTextSelected: { color: colors.onPrimary, fontWeight: "700" },
  dots: { height: 10, marginTop: 3, flexDirection: "row", alignItems: "center", gap: 3 },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  more: { fontSize: 12, lineHeight: 12, fontWeight: "700", color: colors.textMuted },
});
