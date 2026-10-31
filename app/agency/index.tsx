// app/agency/index.tsx

import { useAgencyCaregivers } from "@/src/agency/useAgencyCaregivers";
import { useAgencyInvite } from "@/src/agency/useAgencyInvite";
import { useAgencyReports } from "@/src/agency/useAgencyReports";
import type { AgencyReport } from "@/src/agency/agencyReportTypes";
import { useAuth } from "@/src/auth/useAuth";
import { agencyCopy } from "@/src/i18n/copy/agencyCopy";
import { translations } from "@/src/i18n/translations";
import { useLanguage } from "@/src/store/LanguageContext";
import { AppAlert as Alert } from "@/src/ui/AppAlert";
import { AppHeader, Card, EmptyState, ListRow } from "@/src/ui/components";
import UserAvatar from "@/src/ui/components/UserAvatar";
import { colors, layout, radii, spacing, typography } from "@/src/ui/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

function getCaregiverReportBadge(
  caregiverUid: string,
  reports: AgencyReport[]
) {
  const caregiverReports = reports.filter(
    (report) =>
      report.caregiverUid === caregiverUid &&
      report.status === "open"
  );

  const pendingCount = caregiverReports.filter(
    (report) => report.level === "pending"
  ).length;

  const attentionCount = caregiverReports.filter(
    (report) => report.level === "attention"
  ).length;

  // 待處理優先
  if (pendingCount > 0) {
    return {
      count: pendingCount,
      type: "pending" as const,
    };
  }

  // 沒有待處理，才顯示需關注
  if (attentionCount > 0) {
    return {
      count: attentionCount,
      type: "attention" as const,
    };
  }

  // 沒有未處理問題 → 不顯示 badge
  return null;
}

function formatBadgeCount(count: number) {
  return count > 99 ? "99+" : String(count);
}

const BADGE_TONE = {
  pending: { bg: colors.danger, fg: colors.onPrimary },
  attention: { bg: colors.warningSoft, fg: colors.warning },
} as const;

export default function AgencyHomeScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { language } = useLanguage();
  const t = translations[language];
  const c = agencyCopy[language];

  const {
    inviteCode,
    loading: inviteLoading,
    error: inviteError,
  } = useAgencyInvite();

  const {
    caregivers,
    caregiverCount,
    loading: caregiverLoading,
    error: caregiverError,
  } = useAgencyCaregivers();

  const {
    reports,
    loading: reportLoading,
  } = useAgencyReports();

  const copyInviteCode = async () => {
    if (!inviteCode) return;

    await Clipboard.setStringAsync(inviteCode);

    Alert.alert(c.copiedTitle, c.copiedBody(inviteCode));
  };

  return (
    <View style={styles.container}>
      <AppHeader title={t.agencyHomeTitle} left="menu" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + spacing.xxl }]}
      >
        {/* 仲介帳號與邀請碼 */}
        {!!user?.email && (
          <Text style={styles.emailText} numberOfLines={1}>
            {user.email}
          </Text>
        )}

        <Pressable
          style={({ pressed }) => [styles.inviteCard, pressed && !!inviteCode && styles.inviteCardPressed]}
          onPress={copyInviteCode}
          disabled={!inviteCode}
          accessibilityRole="button"
          accessibilityLabel={inviteCode ? `${c.copyInvite} ${inviteCode}` : c.inviteLabel}
        >
          <View style={styles.inviteText}>
            <Text style={styles.inviteLabel}>{c.inviteLabel}</Text>
            {inviteLoading ? (
              <Text style={styles.inviteStatus}>{c.inviteLoading}</Text>
            ) : inviteError ? (
              <Text style={[styles.inviteStatus, { color: colors.danger }]}>{c.inviteError}</Text>
            ) : (
              <Text style={styles.inviteCode} selectable>
                {inviteCode}
              </Text>
            )}
            <Text style={styles.inviteHint}>{c.inviteHint}</Text>
          </View>
          {!!inviteCode && (
            <View style={styles.copyIcon}>
              <Ionicons name="copy-outline" size={22} color={colors.primary} />
            </View>
          )}
        </Pressable>

        {/* 回報統計入口 */}
        <Card padding={0} style={styles.analyticsCard}>
          <ListRow
            icon="bar-chart-outline"
            title={c.analyticsTitle}
            subtitle={c.analyticsSubtitle}
            onPress={() => router.push("/agency/analytics" as any)}
          />
        </Card>

        {/* 旗下看護 */}
        <View style={styles.sectionHeader}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.sectionTitle} accessibilityRole="header">
              {c.caregiversTitle}
            </Text>
            <Text style={styles.sectionSubtitle}>{c.caregiversSubtitle}</Text>
          </View>

          <Text style={styles.caregiverCount}>
            {caregiverLoading ? "…" : c.caregiverCount(caregiverCount)}
          </Text>
        </View>

        {/* 狀態說明 */}
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.danger }]} />
            <Text style={styles.legendText}>{c.pending}</Text>
          </View>

          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.warning }]} />
            <Text style={styles.legendText}>{c.attention}</Text>
          </View>

          <Text style={styles.legendNormal}>{c.legendNormal}</Text>
        </View>

        {caregiverLoading || reportLoading ? (
          <Card tone="sunken" style={styles.loadingCard}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loadingText}>{c.loadingCaregivers}</Text>
          </Card>
        ) : caregiverError ? (
          <EmptyState icon="alert-circle-outline" title={c.caregiversErrorTitle} body={c.retryLater} />
        ) : caregivers.length === 0 ? (
          <EmptyState icon="people-outline" title={c.noCaregiversTitle} body={c.noCaregiversBody} />
        ) : (
          <Card padding={0}>
            {caregivers.map((caregiver, index) => {
              const badge = getCaregiverReportBadge(
                caregiver.caregiverUid,
                reports
              );

              const name = caregiver.displayName || c.unnamedCaregiver;
              const badgeLabel = badge ? c.openReports(formatBadgeCount(badge.count), c[badge.type]) : "";

              return (
                <Pressable
                  key={caregiver.id}
                  style={({ pressed }) => [
                    styles.caregiverRow,
                    index > 0 && styles.caregiverRowBorder,
                    pressed && styles.caregiverRowPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={badgeLabel ? `${name}，${badgeLabel}` : name}
                  onPress={() =>
                    router.push({
                      pathname:
                        "/agency/caregiver-detail",
                      params: {
                        caregiverUid:
                          caregiver.caregiverUid,
                      },
                    } as any)
                  }
                >
                  <UserAvatar
                    uri={caregiver.avatarUrl}
                    name={caregiver.displayName.trim() || caregiver.caregiverEmail}
                    uid={caregiver.caregiverUid}
                    size={52}
                  />

                  <View style={styles.caregiverInfo}>
                    <Text style={styles.caregiverName} numberOfLines={1}>
                      {name}
                    </Text>

                    <Text style={styles.caregiverMeta} numberOfLines={1}>
                      {caregiver.caregiverEmail}
                    </Text>

                    {!!caregiver.phone && (
                      <Text style={styles.caregiverMeta} numberOfLines={1}>
                        {caregiver.phone}
                      </Text>
                    )}
                  </View>

                  {!!badge && (
                    <View style={[styles.countBadge, { backgroundColor: BADGE_TONE[badge.type].bg }]}>
                      <Text style={[styles.countBadgeText, { color: BADGE_TONE[badge.type].fg }]}>
                        {formatBadgeCount(badge.count)}
                      </Text>
                    </View>
                  )}

                  <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </Pressable>
              );
            })}
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },

  scrollContent: {
    paddingTop: spacing.lg,
    paddingHorizontal: layout.screenPaddingX,
    width: "100%",
    maxWidth: layout.maxContentWidth,
    alignSelf: "center",
  },

  emailText: {
    ...typography.bodySmall,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },

  inviteCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primarySoft,
  },

  inviteCardPressed: {
    backgroundColor: colors.surface,
  },

  inviteText: {
    flex: 1,
    minWidth: 0,
  },

  inviteLabel: {
    ...typography.label,
    color: colors.textSecondary,
  },

  inviteCode: {
    ...typography.display,
    color: colors.primary,
    letterSpacing: 3,
    marginTop: spacing.xs,
  },

  inviteStatus: {
    ...typography.bodyStrong,
    marginTop: spacing.xs,
    color: colors.textSecondary,
  },

  inviteHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },

  copyIcon: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    borderRadius: layout.minTouchTarget / 2,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },

  analyticsCard: {
    marginTop: spacing.lg,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.lg,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },

  sectionTitle: {
    ...typography.title,
  },

  sectionSubtitle: {
    ...typography.bodySmall,
    marginTop: 2,
  },

  caregiverCount: {
    ...typography.bodyStrong,
    color: colors.primary,
    marginTop: spacing.xs,
  },

  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.md,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xs,
  },

  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  legendText: {
    ...typography.label,
    color: colors.textSecondary,
  },

  legendNormal: {
    ...typography.caption,
  },

  caregiverRow: {
    minHeight: 88,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
  },

  caregiverRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },

  caregiverRowPressed: {
    backgroundColor: colors.surfaceSunken,
  },

  caregiverInfo: {
    flex: 1,
    minWidth: 0,
  },

  caregiverName: {
    ...typography.bodyStrong,
  },

  caregiverMeta: {
    ...typography.bodySmall,
    color: colors.textMuted,
    marginTop: 2,
  },

  countBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },

  countBadgeText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
  },

  loadingCard: {
    minHeight: 88,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },

  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
