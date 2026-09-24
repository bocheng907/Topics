// app/agency/caregivers.tsx

import {
  AgencyCaregiver,
  useAgencyCaregivers,
} from "@/src/agency/useAgencyCaregivers";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Image,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function getAvatarText(caregiver: AgencyCaregiver) {
  const name = caregiver.displayName.trim();

  if (name) {
    return name.charAt(0);
  }

  const email = caregiver.caregiverEmail.trim();

  if (email) {
    return email.charAt(0).toUpperCase();
  }

  return "看";
}

export default function AgencyCaregiversScreen() {
  const insets = useSafeAreaInsets();

  const {
    caregivers,
    caregiverCount,
    loading,
    error,
  } = useAgencyCaregivers();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 8 },
        ]}
      >
        <View style={styles.headerSide}>
          <Ionicons
            name="chevron-back"
            size={30}
            color="#111827"
            onPress={() => router.back()}
          />
        </View>

        <Text style={styles.headerTitle}>
          旗下看護
        </Text>

        <View style={styles.headerSide}>
          {!loading && !error && (
            <Text style={styles.headerCount}>
              {caregiverCount}
            </Text>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator
            size="large"
            color="#4F59D5"
          />

          <Text style={styles.loadingText}>
            載入旗下看護...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <View style={styles.errorIcon}>
            <Ionicons
              name="alert-circle-outline"
              size={42}
              color="#DC5A5A"
            />
          </View>

          <Text style={styles.emptyTitle}>
            無法讀取旗下看護
          </Text>

          <Text style={styles.emptyText}>
            請稍後重新整理頁面再試。
          </Text>
        </View>
      ) : caregivers.length === 0 ? (
        <View style={styles.centerContainer}>
          <View style={styles.emptyIcon}>
            <Ionicons
              name="people-outline"
              size={48}
              color="#4F59D5"
            />
          </View>

          <Text style={styles.emptyTitle}>
            尚未綁定看護
          </Text>

          <Text style={styles.emptyText}>
            看護輸入您的仲介邀請碼並完成綁定後，
            就會顯示在這裡。
          </Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        >
          <View style={styles.summaryRow}>
            <Text style={styles.summaryText}>
              共 {caregiverCount} 位看護
            </Text>
          </View>

          {caregivers.map((caregiver) => (
            <Pressable
              key={caregiver.caregiverUid}
              style={styles.caregiverCard}
              onPress={() =>
                router.push({
                  pathname: "/agency/caregiver-detail",
                  params: {
                    caregiverUid: caregiver.caregiverUid,
                  },
                } as any)
              }
            >
              {caregiver.avatarUrl ? (
                <Image
                  source={{ uri: caregiver.avatarUrl }}
                  style={styles.avatar}
                />
              ) : (
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {getAvatarText(caregiver)}
                  </Text>
                </View>
              )}

              <View style={styles.caregiverInfo}>
                <Text style={styles.caregiverName}>
                  {caregiver.displayName || "尚未填寫姓名"}
                </Text>

                <Text
                  style={styles.caregiverEmail}
                  numberOfLines={1}
                >
                  {caregiver.caregiverEmail || "未提供 Email"}
                </Text>

                <View style={styles.statusRow}>
                  <View style={styles.greenDot} />

                  <Text style={styles.statusText}>
                    已綁定
                  </Text>
                </View>
              </View>

              <Ionicons
                name="chevron-forward"
                size={24}
                color="#A0A0A0"
              />
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  header: {
    backgroundColor: "#E1E9FF",
    paddingBottom: 14,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
  },

  headerSide: {
    width: 48,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
  },

  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 22,
    fontWeight: "bold",
    color: "#111827",
  },

  headerCount: {
    minWidth: 30,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 15,
    backgroundColor: "#4F59D5",
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "bold",
    textAlign: "center",
  },

  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    paddingBottom: 80,
  },

  loadingText: {
    marginTop: 14,
    color: "#6B7280",
    fontSize: 15,
  },

  emptyIcon: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#E1E9FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 18,
  },

  errorIcon: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#FEE2E2",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 18,
  },

  emptyTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#111827",
  },

  emptyText: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 23,
    color: "#6B7280",
    textAlign: "center",
  },

  listContent: {
    padding: 18,
    paddingBottom: 40,
  },

  summaryRow: {
    marginBottom: 12,
  },

  summaryText: {
    fontSize: 15,
    color: "#6B7280",
    fontWeight: "600",
  },

  caregiverCard: {
    backgroundColor: "#F8F9FC",
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",

    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },

  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#4F59D5",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },

  avatarText: {
    color: "#FFFFFF",
    fontSize: 23,
    fontWeight: "bold",
  },

  caregiverInfo: {
    flex: 1,
  },

  caregiverEmail: {
    marginTop: 3,
    fontSize: 17,
    fontWeight: "bold",
    color: "#111827",
  },

  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 6,
  },

  greenDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#16A34A",
  },

  statusText: {
    color: "#16A34A",
    fontSize: 14,
    fontWeight: "700",
  },

  caregiverName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111827",
  },
});