// src/calendar/components/DayAgenda.tsx
// Selected-day agenda: heading, time-sorted event cards and an empty state.
import { calendarCopy } from "@/src/i18n/copy/calendarCopy";
import { useLanguage } from "@/src/store/LanguageContext";
import { Button, Card, EmptyState, IconButton } from "@/src/ui/components";
import { colors, layout, radii, spacing, typography } from "@/src/ui/theme";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

/* ------------------------------------------------------------- DayAgenda */

export function DayAgenda({
  date,
  count,
  onAdd,
  children,
}: {
  date: Date;
  count: number;
  onAdd: () => void;
  children?: React.ReactNode;
}) {
  const { language } = useLanguage();
  const copy = calendarCopy[language];
  return (
    <View style={styles.agenda}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle} accessibilityRole="header">
            {copy.dayTitle(date)}
          </Text>
          {count > 0 ? <Text style={styles.headerCount}>{copy.eventsCount(count)}</Text> : null}
        </View>
        {count > 0 ? <Button label={copy.addEvent} icon="add" variant="ghost" onPress={onAdd} /> : null}
      </View>
      {count > 0 ? (
        <View style={styles.list}>{children}</View>
      ) : (
        <Card padding={0}>
          <EmptyState
            icon="calendar-clear-outline"
            title={copy.emptyTitle}
            body={copy.emptyBody}
            actionLabel={copy.addEvent}
            onAction={onAdd}
            style={styles.empty}
          />
        </Card>
      )}
    </View>
  );
}

/* ----------------------------------------------------------- EventCard */

export type AgendaEventCardProps = {
  /** e.g. "7:00" */
  time: string;
  /** Localised AM / PM label. */
  period: string;
  color: string;
  title: string;
  person?: string;
  location?: string;
  description?: string;
  completed: boolean;
  onToggleComplete: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

export function AgendaEventCard({
  time,
  period,
  color,
  title,
  person,
  location,
  description,
  completed,
  onToggleComplete,
  onEdit,
  onDelete,
}: AgendaEventCardProps) {
  const { language } = useLanguage();
  const copy = calendarCopy[language];

  return (
    <Card padding={0}>
      <View style={styles.cardRow}>
        <View style={styles.timeCol}>
          <Text style={[styles.time, completed && styles.mutedText]}>{time}</Text>
          <Text style={styles.period}>{period}</Text>
        </View>
        <View style={[styles.bar, { backgroundColor: color }]} />
        <View style={styles.main}>
          <Pressable
            onPress={onEdit}
            accessibilityRole="button"
            accessibilityLabel={copy.editA11y(title)}
            style={({ pressed }) => [styles.body, pressed && styles.bodyPressed]}
          >
            <Text style={[styles.title, completed && styles.titleDone]}>{title}</Text>
            {person ? <MetaLine icon="person-outline" text={person} /> : null}
            {location ? <MetaLine icon="location-outline" text={location} /> : null}
            {description ? <Text style={styles.description}>{description}</Text> : null}
          </Pressable>

          <View style={styles.actions}>
            <Pressable
              onPress={onToggleComplete}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: completed }}
              accessibilityLabel={completed ? copy.markUndoneA11y(title) : copy.markDoneA11y(title)}
              style={({ pressed }) => [styles.toggle, completed && styles.toggleDone, pressed && styles.bodyPressed]}
            >
              <Ionicons
                name={completed ? "checkmark-circle" : "ellipse-outline"}
                size={22}
                color={completed ? colors.success : colors.textMuted}
              />
              <Text style={[styles.toggleText, completed && { color: colors.success }]} numberOfLines={1}>
                {completed ? copy.done : copy.markDone}
              </Text>
            </Pressable>
            <View style={styles.spacer} />
            <IconButton icon="create-outline" color={colors.textSecondary} onPress={onEdit} accessibilityLabel={copy.editA11y(title)} />
            <IconButton icon="trash-outline" color={colors.danger} onPress={onDelete} accessibilityLabel={copy.deleteA11y(title)} />
          </View>
        </View>
      </View>
    </Card>
  );
}

function MetaLine({ icon, text }: { icon: React.ComponentProps<typeof Ionicons>["name"]; text: string }) {
  return (
    <View style={styles.meta}>
      <Ionicons name={icon} size={16} color={colors.textMuted} style={styles.metaIcon} />
      <Text style={styles.metaText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  agenda: { gap: spacing.md },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.xs, minHeight: 48 },
  headerText: { flex: 1, minWidth: 0 },
  headerTitle: { ...typography.header },
  headerCount: { ...typography.bodySmall, color: colors.textMuted },
  list: { gap: spacing.md },
  empty: { paddingVertical: spacing.xl },

  cardRow: { flexDirection: "row", alignItems: "stretch" },
  timeCol: { width: 68, alignItems: "center", paddingTop: spacing.lg, paddingHorizontal: spacing.xs },
  time: { ...typography.bodyStrong, fontVariant: ["tabular-nums"] },
  period: { ...typography.caption },
  bar: { width: 5, borderRadius: radii.pill, marginVertical: spacing.md },
  main: { flex: 1, minWidth: 0 },
  body: { paddingTop: spacing.md, paddingBottom: spacing.xs, paddingHorizontal: spacing.md, gap: spacing.xs, borderRadius: radii.control },
  bodyPressed: { backgroundColor: colors.surfaceSunken },
  title: { ...typography.bodyStrong, flexShrink: 1 },
  titleDone: { color: colors.textMuted, textDecorationLine: "line-through" },
  mutedText: { color: colors.textMuted },
  meta: { flexDirection: "row", alignItems: "flex-start", gap: spacing.xs },
  metaIcon: { marginTop: 3 },
  metaText: { ...typography.bodySmall, flex: 1, minWidth: 0 },
  description: { ...typography.bodySmall, color: colors.textSecondary },

  actions: { flexDirection: "row", alignItems: "center", paddingLeft: spacing.sm, paddingRight: spacing.xs, paddingBottom: spacing.xs },
  toggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    minHeight: layout.minTouchTarget,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    flexShrink: 1,
  },
  toggleDone: { backgroundColor: colors.successSoft },
  toggleText: { ...typography.label, color: colors.textSecondary, flexShrink: 1 },
  spacer: { flex: 1 },
});
