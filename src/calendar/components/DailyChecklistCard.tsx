// src/calendar/components/DailyChecklistCard.tsx
// Caregiver daily checklist card. Presentational: the screen owns state and Firestore writes.
import { calendarCopy } from "@/src/i18n/copy/calendarCopy";
import { useLanguage } from "@/src/store/LanguageContext";
import { Button, Card, Divider, IconButton, StatusBadge, TextField } from "@/src/ui/components";
import { colors, radii, spacing, typography } from "@/src/ui/theme";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";

export type DailyChecklistRow = { id: string; title: string; completed: boolean };

export type DailyChecklistCardProps = {
  date: Date;
  items: DailyChecklistRow[];
  doneCount: number;
  expanded: boolean;
  onToggleExpanded: () => void;
  error?: string;
  loading?: boolean;
  onRetry?: () => void;
  input: string;
  onChangeInput: (text: string) => void;
  editing: boolean;
  onSubmit: () => void;
  onCancelEdit: () => void;
  onToggleItem: (id: string) => void;
  onEditItem: (id: string) => void;
  onDeleteItem: (id: string) => void;
};

export function DailyChecklistCard({
  date,
  items,
  doneCount,
  expanded,
  onToggleExpanded,
  error,
  loading = false,
  onRetry,
  input,
  onChangeInput,
  editing,
  onSubmit,
  onCancelEdit,
  onToggleItem,
  onEditItem,
  onDeleteItem,
}: DailyChecklistCardProps) {
  const { language } = useLanguage();
  const copy = calendarCopy[language];
  const total = items.length;
  const allDone = total > 0 && doneCount === total;

  return (
    <Card padding={0}>
      <Pressable
        onPress={onToggleExpanded}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        {...(Platform.OS === "web" ? { "aria-expanded": expanded } : {})}
        accessibilityLabel={loading ? copy.checklistLoading : error ? copy.checklistTitle : copy.checklistTitle + ", " + copy.checklistProgressA11y(doneCount, total) + ". " + (expanded ? copy.checklistCollapse : copy.checklistExpand)}
        style={({ pressed }) => [styles.header, pressed && styles.pressed]}
      >
        <View style={styles.headerIcon}>
          <Ionicons name="list-outline" size={20} color={colors.primary} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title} accessibilityRole="header">
            {copy.checklistTitle}
          </Text>
          <Text style={styles.subtitle}>{copy.checklistFor(copy.dayTitle(date))}</Text>
        </View>
        {!loading && !error ? <StatusBadge label={String(doneCount) + "/" + String(total)} tone={allDone ? "success" : "neutral"} icon={allDone ? "checkmark" : undefined} /> : null}
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={22} color={colors.textMuted} />
      </Pressable>

      {expanded ? (
        <>
          <Divider />
          <View style={styles.body}>
            {error ? (
              <View style={styles.errorBox} accessibilityLiveRegion="polite">
                <Ionicons name="alert-circle" size={20} color={colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
            {error && onRetry ? <Button label={copy.retry} variant="ghost" onPress={onRetry} /> : null}

            {loading ? <View style={styles.loading} accessibilityLiveRegion="polite">
              <ActivityIndicator color={colors.primary} /><Text>{copy.checklistLoading}</Text>
            </View> : null}
            {!loading && !error ? <View style={styles.inputRow}>
              <TextField
                label={editing ? copy.checklistEditingLabel : copy.checklistInputLabel}
                value={input}
                onChangeText={onChangeInput}
                placeholder={copy.checklistPlaceholder}
                returnKeyType="done"
                onSubmitEditing={onSubmit}
                containerStyle={styles.input}
              />
              <Button label={editing ? copy.checklistSave : copy.checklistAdd} icon={editing ? "checkmark" : "add"} onPress={onSubmit} style={styles.submit} />
            </View> : null}
            {!loading && !error && editing ? <Button label={copy.checklistCancelEdit} variant="ghost" onPress={onCancelEdit} /> : null}
          </View>

          {loading || error ? null : items.length === 0 ? (
            <Text style={styles.empty}>{copy.checklistEmpty}</Text>
          ) : (
            items.map((item, index) => (
              <View key={item.id}>
                {index > 0 ? <Divider inset={spacing.lg + 28 + spacing.md} /> : <Divider />}
                <View style={styles.row}>
                  <Pressable
                    onPress={() => onToggleItem(item.id)}
                    accessibilityRole="checkbox"
                    accessibilityLabel={item.title}
                    accessibilityState={{ checked: item.completed }}
                    {...(Platform.OS === "web" ? {
                      "aria-checked": item.completed,
                      onKeyDown: (event: { preventDefault: () => void }) => {
                        const keyEvent = event as typeof event & { key?: string; repeat?: boolean };
                        if (keyEvent.key === " " || keyEvent.key === "Spacebar") {
                          keyEvent.preventDefault();
                          if (!keyEvent.repeat) onToggleItem(item.id);
                        }
                      },
                    } : {})}
                    style={({ pressed }) => [styles.check, pressed && styles.pressed]}
                    hitSlop={4}
                  >
                    <Ionicons
                      name={item.completed ? "checkbox" : "square-outline"}
                      size={28}
                      color={item.completed ? colors.success : colors.textMuted}
                    />
                    <Text style={[styles.itemTitle, item.completed && styles.itemTitleDone]}>{item.title}</Text>
                  </Pressable>
                  <IconButton icon="create-outline" color={colors.textSecondary} onPress={() => onEditItem(item.id)} accessibilityLabel={copy.editA11y(item.title)} />
                  <IconButton icon="trash-outline" color={colors.danger} onPress={() => onDeleteItem(item.id)} accessibilityLabel={copy.deleteA11y(item.title)} />
                </View>
              </View>
            ))
          )}
        </>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  pressed: { backgroundColor: colors.surfaceSunken },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 64,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { flex: 1, minWidth: 0 },
  title: { ...typography.bodyStrong },
  subtitle: { ...typography.bodySmall, color: colors.textMuted },

  body: { padding: spacing.lg, gap: spacing.sm },
  loading: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.control,
    backgroundColor: colors.dangerSoft,
  },
  errorText: { ...typography.bodySmall, color: colors.danger, flex: 1 },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm },
  input: { flex: 1 },
  submit: { minHeight: 52 },

  empty: { ...typography.bodySmall, color: colors.textMuted, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  row: { flexDirection: "row", alignItems: "center", paddingRight: spacing.xs },
  check: {
    flex: 1,
    minWidth: 0,
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
    paddingVertical: spacing.sm,
  },
  itemTitle: { ...typography.body, flex: 1, minWidth: 0 },
  itemTitleDone: { color: colors.textMuted, textDecorationLine: "line-through" },
});
