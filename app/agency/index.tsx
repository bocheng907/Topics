// app/agency/index.tsx

import { useAgencyCaregivers } from "@/src/agency/useAgencyCaregivers";
import { useAgencyInvite } from "@/src/agency/useAgencyInvite";
import { useAgencyReports } from "@/src/agency/useAgencyReports";
import type { AgencyReport } from "@/src/agency/agencyReportTypes";
import { useAuth } from "@/src/auth/useAuth";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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
      color: "#DC5A5A",
      type: "pending" as const,
    };
  }

  // 沒有待處理，才顯示需關注
  if (attentionCount > 0) {
    return {
      count: attentionCount,
      color: "#D39A2C",
      type: "attention" as const,
    };
  }

  // 沒有未處理問題 → 不顯示 badge
  return null;
}

function formatBadgeCount(count: number) {
  return count > 99 ? "99+" : String(count);
}

export default function AgencyHomeScreen() {
  const { user } = useAuth();

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

        {/* 旗下看護 */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>
              旗下看護
            </Text>

            <Text style={styles.sectionSubtitle}>
              查看旗下看護目前的服務與回報狀態
            </Text>
          </View>

          <Text style={styles.caregiverCount}>
            {caregiverLoading
              ? "..."
              : `${caregiverCount} 人`}
          </Text>
        </View>

        {/* 狀態說明 */}
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View
              style={[
                styles.legendDot,
                { backgroundColor: "#DC5A5A" },
              ]}
            />

            <Text style={styles.legendText}>
              待處理
            </Text>
          </View>

          <View style={styles.legendItem}>
            <View
              style={[
                styles.legendDot,
                { backgroundColor: "#D39A2C" },
              ]}
            />

            <Text style={styles.legendText}>
              需關注
            </Text>
          </View>

          <Text style={styles.legendNormal}>
            無標記表示目前正常
          </Text>
        </View>

        {caregiverLoading || reportLoading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator
              size="small"
              color="#4F59D5"
            />

            <Text style={styles.loadingText}>
              讀取旗下看護中...
            </Text>
          </View>
        ) : caregiverError ? (
          <View style={styles.emptyCard}>
            <Ionicons
              name="alert-circle-outline"
              size={34}
              color="#8B8B93"
            />

            <Text style={styles.emptyTitle}>
              無法讀取旗下看護
            </Text>

            <Text style={styles.emptyText}>
              請稍後重新整理頁面再試。
            </Text>
          </View>
        ) : caregivers.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons
              name="people-outline"
              size={38}
              color="#8B8B93"
            />

            <Text style={styles.emptyTitle}>
              尚未有旗下看護
            </Text>

            <Text style={styles.emptyText}>
              將上方邀請碼提供給看護，
              綁定後就會顯示在這裡。
            </Text>
          </View>
        ) : (
          <View style={styles.caregiverList}>
            {caregivers.map((caregiver) => {
              const badge = getCaregiverReportBadge(
                caregiver.caregiverUid,
                reports
              );

              const avatarText =
                caregiver.displayName
                  .trim()
                  .charAt(0) ||
                caregiver.caregiverEmail
                  .trim()
                  .charAt(0)
                  .toUpperCase() ||
                "看";

              return (
                <Pressable
                  key={caregiver.id}
                  style={styles.caregiverCard}
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
                  <View style={styles.avatarWrap}>
                    {caregiver.avatarUrl ? (
                      <Image
                        source={{
                          uri: caregiver.avatarUrl,
                        }}
                        style={styles.caregiverAvatar}
                      />
                    ) : (
                      <View
                        style={[
                          styles.caregiverAvatar,
                          styles.avatarFallback,
                        ]}
                      >
                        <Text
                          style={styles.avatarText}
                        >
                          {avatarText}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.caregiverInfo}>
                    <Text
                      style={styles.caregiverName}
                      numberOfLines={1}
                    >
                      {caregiver.displayName ||
                        "尚未填寫姓名"}
                    </Text>

                    <Text
                      style={styles.caregiverEmail}
                      numberOfLines={1}
                    >
                      {caregiver.caregiverEmail}
                    </Text>

                    {!!caregiver.phone && (
                      <Text
                        style={styles.caregiverPhone}
                        numberOfLines={1}
                      >
                        {caregiver.phone}
                      </Text>
                    )}
                  </View>

                  {!!badge && (
                    <View
                      style={[
                        styles.notificationBadge,
                        {
                          backgroundColor:
                            badge.color,
                        },
                      ]}
                    >
                      <Text
                        style={
                          styles.notificationBadgeText
                        }
                      >
                        {formatBadgeCount(
                          badge.count
                        )}
                      </Text>
                    </View>
                  )}

                  <Ionicons
                    name="chevron-forward"
                    size={22}
                    color="#A1A1AA"
                  />
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
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
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 12,
  },

  sectionSubtitle: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    color: "#7B7B85",
  },

  caregiverCount: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: "800",
    color: "#4F59D5",
  },

  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 18,
  },

  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  legendText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6B7280",
  },

  legendNormal: {
    fontSize: 12,
    color: "#9CA3AF",
  },

  caregiverList: {
    gap: 12,
  },

  caregiverCard: {
    minHeight: 96,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E7E9EF",
    paddingHorizontal: 16,
    paddingVertical: 14,
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

  avatarWrap: {
    marginRight: 13,
  },

  caregiverAvatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
  },

  avatarFallback: {
    backgroundColor: "#E1E9FF",
    alignItems: "center",
    justifyContent: "center",
  },

  avatarText: {
    color: "#4F59D5",
    fontSize: 22,
    fontWeight: "900",
  },

  caregiverInfo: {
    flex: 1,
    minWidth: 0,
  },

  caregiverName: {
    fontSize: 17,
    fontWeight: "900",
    color: "#111827",
  },

  caregiverEmail: {
    marginTop: 5,
    fontSize: 13,
    color: "#6B7280",
  },

  caregiverPhone: {
    marginTop: 3,
    fontSize: 13,
    color: "#8B8B93",
  },

  notificationBadge: {
    minWidth: 25,
    height: 25,
    borderRadius: 13,
    paddingHorizontal: 7,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 7,
  },

  notificationBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
  },

  loadingCard: {
    minHeight: 90,
    borderRadius: 18,
    backgroundColor: "#F8F9FC",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },

  loadingText: {
    color: "#6B7280",
    fontSize: 14,
    fontWeight: "600",
  },

  emptyCard: {
    minHeight: 150,
    borderRadius: 20,
    backgroundColor: "#F8F9FC",
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },

  emptyTitle: {
    marginTop: 10,
    fontSize: 17,
    fontWeight: "800",
    color: "#374151",
  },

  emptyText: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    color: "#8B8B93",
  },
});