// app/agency/caregiver-detail.tsx

import { db } from "@/firebase/firebaseConfig";
import type { AgencyReport } from "@/src/agency/agencyReportTypes";
import { useAgencyReports } from "@/src/agency/useAgencyReports";
import { agencyCopy, agencyLocale, type AgencyCopy } from "@/src/i18n/copy/agencyCopy";
import { useLanguage } from "@/src/store/LanguageContext";
import { AppHeader, Card, EmptyState, ListRow, SectionHeader, StatusBadge, type StatusTone } from "@/src/ui/components";
import UserAvatar from "@/src/ui/components/UserAvatar";
import { colors, layout, spacing, typography } from "@/src/ui/theme";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type CaregiverDetail = {
  displayName: string;
  email: string;
  phone: string;
  avatarUrl: string;
  createdAt?: Timestamp | null;
};

type ServicePatient = {
  id: string;
  patientName: string;
};

function getCaregiverReportStatus(
  report: {
    level?: string;
    status?: string;
  },
  c: AgencyCopy
): { label: string; tone: StatusTone } {
  if (report.status === "resolved") {
    return { label: c.resolved, tone: "success" };
  }

  if (report.level === "attention") {
    return { label: c.attention, tone: "warning" };
  }

  return { label: c.pending, tone: "danger" };
}

function getReportPriority(report: AgencyReport) {
  if (report.status === "resolved") {
    return 2;
  }

  if (report.level === "attention") {
    return 1;
  }

  return 0;
}

export default function AgencyCaregiverDetailScreen() {
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();
  const c = agencyCopy[language];

  const { caregiverUid } = useLocalSearchParams<{
    caregiverUid?: string;
  }>();

  const uid = String(caregiverUid ?? "");

  const [detail, setDetail] =
    useState<CaregiverDetail | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState(false);

  const [servicePatients, setServicePatients] =
    useState<ServicePatient[]>([]);

  const [serviceLoading, setServiceLoading] =
    useState(true);

  const {
    reports,
    loading: reportLoading,
  } = useAgencyReports();

  // ==========================================
  // 此看護相關的家庭回報
  // ==========================================
  const caregiverReports = useMemo(() => {
    return reports
      .filter(
        (report) =>
          report.caregiverUid === uid &&
          report.reporterRole === "family"
      )
      .slice()
      .sort((a, b) => {
        const priorityDiff =
          getReportPriority(a) -
          getReportPriority(b);

        if (priorityDiff !== 0) {
          return priorityDiff;
        }

        const aTime =
          a.createdAt?.toMillis?.() ?? 0;

        const bTime =
          b.createdAt?.toMillis?.() ?? 0;

        return bTime - aTime;
      });
  }, [reports, uid]);

  const pendingReportCount =
    caregiverReports.filter(
      (report) =>
        report.status === "open" &&
        report.level === "pending"
    ).length;

  const attentionReportCount =
    caregiverReports.filter(
      (report) =>
        report.status === "open" &&
        report.level === "attention"
    ).length;

  const reportSummary: { label: string; tone: StatusTone } | null =
    pendingReportCount > 0
      ? { label: c.openReports(String(pendingReportCount), c.pending), tone: "danger" }
      : attentionReportCount > 0
      ? { label: c.openReports(String(attentionReportCount), c.attention), tone: "warning" }
      : null;

  // ==========================================
  // 讀取看護基本資料
  // ==========================================
  const [previousUid, setPreviousUid] = useState<string | null>(null);
  if (previousUid !== uid) {
    setPreviousUid(uid);
    setDetail(null);
    setLoading(Boolean(uid));
    setError(!uid);
    setServicePatients([]);
    setServiceLoading(Boolean(uid));
  }
  useEffect(() => {
    if (!uid) return;

    let cancelled = false;

    async function loadDetail() {
      try {
        // 先讀仲介綁定資料
        const membershipRef = doc(
          db,
          "agency_memberships",
          uid
        );

        const membershipSnap =
          await getDoc(membershipRef);

        if (!membershipSnap.exists()) {
          throw new Error(
            "membership-not-found"
          );
        }

        const membership =
          membershipSnap.data();

        // 再讀看護本人維護的 profile
        const profileRef = doc(
          db,
          "caregiver_profiles",
          uid
        );

        const profileSnap =
          await getDoc(profileRef);

        if (cancelled) return;

        if (profileSnap.exists()) {
          const profile =
            profileSnap.data();

          setDetail({
            displayName: String(
              profile.displayName ?? ""
            ),

            email: String(
              profile.email ??
                membership.caregiverEmail ??
                ""
            ),

            phone: String(
              profile.phone ?? ""
            ),

            avatarUrl: String(
              profile.avatarUrl ?? ""
            ),

            createdAt:
              membership.createdAt ?? null,
          });
        } else {
          // 舊看護還沒填 profile
          setDetail({
            displayName: "",

            email: String(
              membership.caregiverEmail ?? ""
            ),

            phone: "",

            avatarUrl: "",

            createdAt:
              membership.createdAt ?? null,
          });
        }
      } catch (err) {
        console.log(
          "[agency caregiver detail] load failed:",
          err
        );

        if (!cancelled) {
          setError(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadDetail();

    return () => {
      cancelled = true;
    };
  }, [uid]);

  // ==========================================
  // 讀取目前服務的照護對象
  // ==========================================
  useEffect(() => {
    if (!uid) return;

    const serviceRef = collection(
      db,
      "caregiver_service_summaries",
      uid,
      "patients"
    );

    const unsubscribe = onSnapshot(
      serviceRef,
      (snapshot) => {
        const patients =
          snapshot.docs.filter(item => item.data().active !== false).map((docSnap) => {
            const data =
              docSnap.data();

            return {
              id: docSnap.id,

              // Empty name falls back to a localized label at render time.
              patientName: String(
                data.patientName ?? ""
              ),
            };
          });

        setServicePatients(patients);
        setServiceLoading(false);
      },

      (serviceError) => {
        console.log(
          "[agency caregiver services] load failed:",
          serviceError
        );

        setServicePatients([]);
        setServiceLoading(false);
      }
    );

    return unsubscribe;
  }, [uid]);

  const header = <AppHeader title={c.caregiverDetailTitle} left="back" fallbackHref="/agency" />;

  // ==========================================
  // Loading
  // ==========================================
  if (loading) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  // ==========================================
  // Error
  // ==========================================
  if (error || !detail) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.centerState}>
          <EmptyState icon="alert-circle-outline" title={c.caregiverLoadError} body={c.retryLater} />
        </View>
      </View>
    );
  }

  const createdAtText =
    detail.createdAt?.toDate
      ? detail.createdAt
          .toDate()
          .toLocaleString(agencyLocale[language])
      : "—";

  return (
    <View style={styles.container}>
      {header}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
      >
        {/* 看護資訊 */}
        <Card style={styles.heroCard}>
          <View style={styles.heroTop}>
            <UserAvatar
              uri={detail.avatarUrl}
              name={detail.displayName.trim() || detail.email}
              uid={uid}
              size={72}
            />

            <View style={styles.heroInfo}>
              <Text style={styles.heroName} numberOfLines={2}>
                {detail.displayName || c.unnamedCaregiver}
              </Text>
              <StatusBadge label={c.bound} tone="success" style={{ marginTop: spacing.xs }} />
            </View>
          </View>

          <View style={styles.metaList}>
            <View style={styles.heroMetaRow}>
              <Ionicons name="call-outline" size={18} color={colors.textSecondary} />
              <Text style={[styles.heroMetaText, !detail.phone && { color: colors.textMuted }]} numberOfLines={1} selectable>
                {detail.phone || c.noPhone}
              </Text>
            </View>

            <View style={styles.heroMetaRow}>
              <Ionicons name="mail-outline" size={18} color={colors.textSecondary} />
              <Text style={styles.heroMetaText} numberOfLines={1} selectable>
                {detail.email || "—"}
              </Text>
            </View>
          </View>
        </Card>

        {/* 家庭回報 */}
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            {c.familyReports}
          </Text>
          {!!reportSummary && <StatusBadge label={reportSummary.label} tone={reportSummary.tone} />}
        </View>

        {reportLoading ? (
          <Card tone="sunken" style={styles.inlineState}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.inlineStateText}>{c.loadingReports}</Text>
          </Card>
        ) : caregiverReports.length === 0 ? (
          <Card tone="sunken">
            <EmptyState
              icon="checkmark-circle-outline"
              title={c.noFamilyReportsTitle}
              body={c.noFamilyReportsBody}
              style={styles.compactEmpty}
            />
          </Card>
        ) : (
          <Card padding={0}>
            {caregiverReports.map((report, index) => {
              const status = getCaregiverReportStatus(report, c);

              return (
                <Pressable
                  key={report.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${report.title}，${status.label}`}
                  style={({ pressed }) => [
                    styles.reportRow,
                    index > 0 && styles.rowBorder,
                    pressed && styles.rowPressed,
                  ]}
                  onPress={() =>
                    router.push({
                      pathname:
                        "/agency/report-detail",
                      params: {
                        reportId:
                          report.id,
                      },
                    } as any)
                  }
                >
                  <View style={styles.reportMain}>
                    <StatusBadge label={status.label} tone={status.tone} />

                    <Text style={styles.reportTitle} numberOfLines={2}>
                      {report.title}
                    </Text>

                    <Text style={styles.reportMeta} numberOfLines={1}>
                      {report.patientName}
                      {" · "}
                      {report.reporterName}
                    </Text>

                    {!!report.description && (
                      <Text style={styles.reportDescription} numberOfLines={2}>
                        {report.description}
                      </Text>
                    )}
                  </View>

                  <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </Pressable>
              );
            })}
          </Card>
        )}

        {/* 目前服務資訊 */}
        <SectionHeader title={c.serviceTitle} />

        {serviceLoading ? (
          <Card tone="sunken" style={styles.inlineState}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.inlineStateText}>{c.loadingService}</Text>
          </Card>
        ) : servicePatients.length > 0 ? (
          <Card padding={0}>
            {servicePatients.map((patient, index) => (
              <View key={patient.id} style={index > 0 ? styles.rowBorder : undefined}>
                <ListRow
                  icon="person-outline"
                  title={patient.patientName || c.unnamedPatient}
                  subtitle={c.careTarget}
                />
              </View>
            ))}
          </Card>
        ) : (
          <Card tone="sunken">
            <EmptyState
              icon="person-add-outline"
              title={c.noServiceTitle}
              body={c.noServiceBody}
              style={styles.compactEmpty}
            />
          </Card>
        )}

        {/* 其他資訊 */}
        <SectionHeader title={c.otherInfo} />

        <Card padding={0}>
          <ListRow icon="calendar-outline" title={c.boundDate} subtitle={createdAtText} />
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },

  centerState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  content: {
    padding: layout.screenPaddingX,
    width: "100%",
    maxWidth: layout.maxContentWidth,
    alignSelf: "center",
  },

  heroCard: {
    gap: spacing.lg,
  },

  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
  },

  heroInfo: {
    flex: 1,
    minWidth: 0,
  },

  heroName: {
    ...typography.title,
  },

  metaList: {
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },

  heroMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },

  heroMetaText: {
    ...typography.body,
    flex: 1,
    minWidth: 0,
  },

  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
  },

  sectionTitle: {
    ...typography.overline,
  },

  inlineState: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },

  inlineStateText: {
    ...typography.body,
    color: colors.textSecondary,
  },

  compactEmpty: {
    paddingVertical: spacing.md,
  },

  reportRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
  },

  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },

  rowPressed: {
    backgroundColor: colors.surfaceSunken,
  },

  reportMain: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },

  reportTitle: {
    ...typography.bodyStrong,
  },

  reportMeta: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },

  reportDescription: {
    ...typography.bodySmall,
  },
});
