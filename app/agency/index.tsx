// app/agency/index.tsx

import { useAgencyCaregivers } from "@/src/agency/useAgencyCaregivers";
import { useAgencyInvite } from "@/src/agency/useAgencyInvite";
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
              Alert.alert(
                "問題回報",
                "下一階段會建立回報管理頁面"
              )
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
              0 件
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
});