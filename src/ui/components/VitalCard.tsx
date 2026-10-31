// src/ui/components/VitalCard.tsx
// Presentation-only vital-sign tile shared by the family home and the health dashboard.
// The screen decides the status (thresholds, staleness); this component only draws it:
// normal stays quiet, abnormal is loud, outdated / no data go grey. Status is always
// shown with an icon + text, never by colour alone.
import React from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, radii, spacing, typography } from "../theme";
import { StatusBadge, type StatusTone } from "./Feedback";
import type { IconName } from "./types";

export type VitalStatus = "normal" | "abnormal" | "outdated" | "nodata";

export type VitalValue = { label?: string; value: string | number; unit?: string };

export type VitalCardProps = {
  title: string;
  status: VitalStatus;
  /** Localised status text shown in the badge. */
  statusLabel: string;
  /** One or more readings; "detailed" shows each in its own column with the unit inline. */
  values: VitalValue[];
  /** Secondary line under the value(s), e.g. unit · time. */
  meta?: string;
  /**
   * "compact": home-screen grid tile (single big value, unit in the meta line).
   * "detailed": dashboard card (labelled value columns, unit next to each value).
   */
  variant?: "compact" | "detailed";
  accessibilityLabel?: string;
  /** Width / padding overrides from the screen's grid. */
  style?: StyleProp<ViewStyle>;
};

const statusLook: Record<VitalStatus, { tone: StatusTone; icon: IconName }> = {
  normal: { tone: "success", icon: "checkmark-circle" },
  abnormal: { tone: "danger", icon: "warning" },
  outdated: { tone: "neutral", icon: "time-outline" },
  nodata: { tone: "neutral", icon: "remove-circle-outline" },
};

export function VitalCard({
  title,
  status,
  statusLabel,
  values,
  meta,
  variant = "compact",
  accessibilityLabel,
  style,
}: VitalCardProps) {
  const look = statusLook[status];
  const isAbnormal = status === "abnormal";
  const isMuted = status === "outdated" || status === "nodata";
  const compact = variant === "compact";
  const valueTone = [isAbnormal && styles.valueAbnormal, isMuted && styles.valueMuted];

  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.card,
        compact ? styles.cardCompact : styles.cardDetailed,
        isAbnormal && styles.cardAbnormal,
        isAbnormal && compact && styles.cardAbnormalCompact,
        status === "nodata" && styles.cardNoData,
        style,
      ]}
    >
      <View style={styles.top}>
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
        <StatusBadge label={statusLabel} tone={look.tone} icon={look.icon} style={isAbnormal ? styles.badgeOnDanger : null} />
      </View>

      {compact ? (
        <Text
          style={[styles.valueCompact, ...valueTone]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {values[0]?.value ?? "--"}
        </Text>
      ) : (
        <View style={styles.values}>
          {values.map((v, index) => (
            <View key={index} style={styles.valueCol}>
              {v.label ? <Text style={styles.valueLabel}>{v.label}</Text> : null}
              <View style={styles.valueRow}>
                <Text
                  style={[styles.valueMain, ...valueTone]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  {v.value}
                </Text>
                {v.unit ? <Text style={styles.valueUnit}>{v.unit}</Text> : null}
              </View>
            </View>
          ))}
        </View>
      )}

      {meta ? (
        <Text style={[styles.meta, compact ? styles.metaCompact : styles.metaDetailed]} numberOfLines={2}>
          {meta}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    minWidth: 0,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cardCompact: { minHeight: 136, padding: spacing.md, borderRadius: radii.card - 2 },
  cardDetailed: { width: "100%", padding: spacing.lg, borderRadius: radii.card },
  cardAbnormal: { backgroundColor: colors.dangerSoft, borderColor: colors.danger, borderWidth: 2 },
  // Compensates the 2px border so the compact tile's content does not shift.
  cardAbnormalCompact: { padding: spacing.md - 1 },
  cardNoData: { backgroundColor: colors.surfaceSunken, borderColor: colors.surfaceSunken },

  top: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.xs },
  title: { ...typography.label, color: colors.textSecondary, flexShrink: 1, paddingTop: 2 },
  badgeOnDanger: { backgroundColor: colors.surface },

  valueCompact: { fontSize: 30, lineHeight: 38, fontWeight: "700", color: colors.text, marginTop: spacing.sm },
  values: { flexDirection: "row", gap: spacing.lg, marginTop: spacing.sm },
  valueCol: { flex: 1, minWidth: 0 },
  valueLabel: { ...typography.caption, color: colors.textSecondary },
  valueRow: { flexDirection: "row", alignItems: "baseline", gap: spacing.xs, flexWrap: "wrap" },
  valueMain: { fontSize: 30, lineHeight: 38, fontWeight: "700", color: colors.text, flexShrink: 1 },
  valueUnit: { ...typography.caption, color: colors.textSecondary },
  valueAbnormal: { color: colors.danger },
  valueMuted: { color: colors.textMuted },

  meta: { ...typography.caption },
  metaCompact: { marginTop: 2 },
  metaDetailed: { marginTop: spacing.xs },
});
