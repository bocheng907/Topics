// app/agency/index.tsx

import { useAgencyCaregivers } from "@/src/agency/useAgencyCaregivers";
import { useAgencyInvite } from "@/src/agency/useAgencyInvite";
import { useAgencyReports } from "@/src/agency/useAgencyReports";
import { useAuth } from "@/src/auth/useAuth";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import React from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function AgencyHomeScreen() {
  const { user } = useAuth();

  const {
    inviteCode,
    loading: inviteLoading,
    error: inviteError,
  } = useAgencyInvite();

  const {
    caregiverCount,
    loading: caregiverLoading,
  } = useAgencyCaregivers();

  const {
    pendingCount,
    recentReports,
    loading: reportLoading,
  } = useAgencyReports();

  const copyInviteCode = async () => {
    if (!inviteCode) return;

    await Clipboard.setStringAsync(inviteCode);

    Alert.alert(
      "已複製",
      `仲介邀請碼 ${inviteCode} 已複製`
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* 仲介基本資訊 */}
        <View style={styles.userInfo}>
          <Text style={styles.pageTitle}>
            仲介管理
          </Text>

          <Text style={styles.emailText}>
            {user?.email ?? ""}
          </Text>

          <Pressable
            style={styles.inviteBadge}
            onPress={copyInviteCode}
            disabled={!inviteCode}
          >
            <Ionicons
              name="key-outline"
              size={16}
              color="#4F59D5"
            />

            <Text style={styles.inviteBadgeText}>
              {inviteLoading
                ? "邀請碼載入中..."
                : inviteError
                ? "邀請碼建立失敗"
                : `邀請碼：${inviteCode}`}
            </Text>

            {!!inviteCode && (
              <Ionicons
                name="copy-outline"
                size={16}
                color="#6B7280"
              />
            )}
          </Pressable>
        </View>

        {/* 管理概況 */}
        <Text style={styles.sectionTitle}>
          管理概況
        </Text>

        <View style={styles.summaryRow}>
          {/* 旗下看護 */}
          <Pressable
            onPress={() =>
              router.push("/agency/caregivers" as any)
            }
            style={[
              styles.summaryCard,
              { backgroundColor: "#E1E9FF" },
            ]}
          >
            <View
              style={[
                styles.iconBadge,
                { backgroundColor: "#4F59D5" },
              ]}
            >
              <Ionicons
                name="people"
                size={28}
                color="#FFFFFF"
              />
            </View>

            <Text style={styles.cardTitle}>
              旗下看護
            </Text>

            <Text style={styles.cardValue}>
              {caregiverLoading
                ? "..."
                : `${caregiverCount} 人`}
            </Text>

            <Text style={styles.cardLink}>
              查看全部 ›
            </Text>
          </Pressable>

          {/* 待處理回報 */}
          <Pressable
            onPress={() =>
              router.push("/agency/reports" as any)
            }
            style={[
              styles.summaryCard,
              { backgroundColor: "#FEE2E2" },
            ]}
          >
            <View
              style={[
                styles.iconBadge,
                { backgroundColor: "#DC5A5A" },
              ]}
            >
              <Ionicons
                name="alert-circle"
                size={28}
                color="#FFFFFF"
              />
            </View>

            <Text style={styles.cardTitle}>
              待處理回報
            </Text>

            <Text style={styles.cardValue}>
              {reportLoading
                ? "..."
                : `${pendingCount} 件`}
            </Text>

            <Text style={styles.cardLink}>
              查看回報 ›
            </Text>
          </Pressable>
        </View>

        {/* 近期回報 */}
        <Text style={styles.sectionTitle}>
          近期回報
        </Text>

        {reportLoading ? (
          <View style={styles.emptyReportCard}>
            <Text style={styles.emptyTitle}>
              回報載入中...
            </Text>
          </View>
        ) : recentReports.length === 0 ? (
          <View style={styles.emptyReportCard}>
            <View style={styles.emptyIcon}>
              <Ionicons
                name="notifications-outline"
                size={34}
                color="#8B8B9A"
              />
            </View>

            <Text style={styles.emptyTitle}>
              目前沒有新的問題回報
            </Text>

            <Text style={styles.emptyText}>
              家屬提出需要仲介協助的問題後，
              會顯示在這裡。
            </Text>
          </View>
        ) : (
          <View style={styles.reportList}>
            {recentReports.map((report) => {
              const status = getHomeReportStatus(report);

              return (
                <Pressable
                  key={report.id}
                  style={styles.reportCard}
                  onPress={() =>
                    router.push({
                      pathname: "/agency/report-detail",
                      params: {
                        reportId: report.id,
                      },
                    } as any)
                  }
                >
                  <View style={styles.reportIcon}>
                    <Ionicons
                      name="chatbubble-ellipses-outline"
                      size={23}
                      color="#4F59D5"
                    />
                  </View>

                  <View style={styles.reportContent}>
                    <View style={styles.reportTitleRow}>
                      <Text
                        style={styles.reportTitle}
                        numberOfLines={1}
                      >
                        {report.title}
                      </Text>

                      <View
                        style={[
                          styles.reportStatusBadge,
                          {
                            backgroundColor:
                              status.backgroundColor,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.reportStatusDot,
                            {
                              backgroundColor:
                                status.color,
                            },
                          ]}
                        />

                        <Text
                          style={[
                            styles.reportStatusText,
                            {
                              color: status.color,
                            },
                          ]}
                        >
                          {status.label}
                        </Text>
                      </View>
                    </View>

                    <Text
                      style={styles.reportMeta}
                      numberOfLines={1}
                    >
                      {report.caregiverName}
                      {" · "}
                      {report.patientName}
                    </Text>

                    <Text style={styles.reportReporter}>
                      家屬回報
                    </Text>
                  </View>

                  <Ionicons
                    name="chevron-forward"
                    size={21}
                    color="#A1A1AA"
                  />
                </Pressable>
              );
            })}

            <Pressable
              style={styles.viewAllReportsButton}
              onPress={() =>
                router.push("/agency/reports" as any)
              }
            >
              <Text style={styles.viewAllReportsText}>
                查看全部回報
              </Text>

              <Ionicons
                name="arrow-forward"
                size={18}
                color="#4F59D5"
              />
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function getHomeReportStatus(report: {
  level?: string;
  status?: string;
}) {
  if (report.status === "resolved") {
    return {
      label: "已處理",
      color: "#3F8F5F",
      backgroundColor: "#E8F5EC",
    };
  }

  if (report.level === "attention") {
    return {
      label: "需關注",
      color: "#B7791F",
      backgroundColor: "#FFF4D6",
    };
  }

  return {
    label: "待處理",
    color: "#C95353",
    backgroundColor: "#FCECEC",
  };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  scrollContent: {
    paddingTop: 85,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  userInfo: {
    marginBottom: 28,
  },

  pageTitle: {
    fontSize: 34,
    fontWeight: "bold",
    color: "#111827",
    letterSpacing: 1,
  },

  emailText: {
    marginTop: 6,
    fontSize: 15,
    color: "#6B7280",
  },

  inviteBadge: {
    marginTop: 12,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#E1E9FF",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },

  inviteBadgeText: {
    color: "#4F59D5",
    fontSize: 14,
    fontWeight: "700",
  },

  sectionTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 12,
  },

  summaryRow: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 28,
  },

  summaryCard: {
    flex: 1,
    minHeight: 175,
    borderRadius: 20,
    padding: 18,
    justifyContent: "center",
    alignItems: "center",

    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },

  iconBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },

  cardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111827",
    textAlign: "center",
  },

  cardValue: {
    fontSize: 27,
    fontWeight: "900",
    color: "#111827",
    marginTop: 6,
  },

  cardLink: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "600",
    marginTop: 8,
  },

  emptyReportCard: {
    backgroundColor: "#F8F9FC",
    borderRadius: 20,
    paddingVertical: 30,
    paddingHorizontal: 22,
    alignItems: "center",

    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },

  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#EEEFF4",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111827",
    textAlign: "center",
  },

  emptyText: {
    marginTop: 7,
    fontSize: 14,
    lineHeight: 21,
    color: "#7B7B85",
    textAlign: "center",
  },

  reportList: {
    gap: 10,
  },

  reportCard: {
    minHeight: 94,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#E8EAF0",
    flexDirection: "row",
    alignItems: "center",

    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },

  reportIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#EEF0FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  reportContent: {
    flex: 1,
  },

  reportTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
  },

  reportMeta: {
    marginTop: 5,
    fontSize: 14,
    color: "#6B7280",
  },

  reportReporter: {
    marginTop: 4,
    fontSize: 13,
    color: "#8B8F9C",
    fontWeight: "700",
  },

  reportTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  reportStatusBadge: {
    flexShrink: 0,
    minHeight: 26,
    paddingHorizontal: 9,
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  reportStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  reportStatusText: {
    fontSize: 12,
    fontWeight: "900",
  },

  viewAllReportsButton: {
    marginTop: 4,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: "#EEF0FF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },

  viewAllReportsText: {
    color: "#4F59D5",
    fontSize: 15,
    fontWeight: "800",
  },
});