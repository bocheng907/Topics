import { AppAlert as Alert } from "@/src/ui/AppAlert";
import { httpsCallable } from "firebase/functions";
// app/caregiver/agency-binding.tsx

import { functions, db } from "@/firebase/firebaseConfig";
import { useAuth } from "@/src/auth/useAuth";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  doc,
  getDoc,
} from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type AgencyMembership = {
  caregiverUid: string;
  caregiverEmail: string;
  agencyUid: string;
  agencyInviteCode: string;
};

export default function AgencyBindingScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [membership, setMembership] =
    useState<AgencyMembership | null>(null);

  const normalizedCode = useMemo(
    () => code.trim().toUpperCase(),
    [code]
  );

  // 先確認這名看護是否已經綁定仲介
  const scope = `${user?.uid}/${user?.role}`;
  const [previousScope, setPreviousScope] = useState<string | null>(null);
  if (previousScope !== scope) {
    setPreviousScope(scope); setMembership(null); setLoading(user?.role === "caregiver");
  }
  useEffect(() => {
    if (!user || user.role !== "caregiver") {
      return;
    }

    let cancelled = false;

    async function loadMembership() {
      try {

        const membershipRef = doc(
          db,
          "agency_memberships",
          user!.uid
        );

        const snap = await getDoc(membershipRef);

        if (!cancelled) {
          if (snap.exists()) {
            setMembership(
              snap.data() as AgencyMembership
            );
          } else {
            setMembership(null);
          }
        }
      } catch (error) {
        console.log(
          "[agency membership] load failed:",
          error
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadMembership();

    return () => {
      cancelled = true;
    };
  }, [user]);

  async function handleBindAgency() {
    if (!user || user.role !== "caregiver" || submitting) return;
    if (membership) { Alert.alert("提醒", "目前已經綁定仲介"); return; }
    if (!/^[A-Z0-9]{6}$/.test(normalizedCode)) {
      Alert.alert("提醒", "請輸入 6 碼仲介邀請碼"); return;
    }
    setSubmitting(true);
    try {
      const bind = httpsCallable<{code: string}, AgencyMembership>(functions, "bindAgency");
      const result = await bind({code: normalizedCode});
      setMembership(result.data);
      setCode("");
      Alert.alert("綁定成功", "已成功與仲介建立關係");
    } catch {
      Alert.alert("綁定失敗", "請確認邀請碼有效、帳號尚未綁定，或稍後重試。");
    } finally { setSubmitting(false); }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator
          size="large"
          color="#4F59D5"
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 8 },
        ]}
      >
        <Pressable
            style={styles.headerSide}
            onPress={() => {
                if (membership) {
                router.replace("/caregiver" as any);
                } else {
                router.back();
                }
            }}
        >
            <Ionicons
                name="chevron-back"
                size={30}
                color="#111827"
            />
        </Pressable>

        <Text style={styles.headerTitle}>
          看護仲介
        </Text>

        <View style={styles.headerSide} />
      </View>

      <View style={styles.content}>
        {membership ? (
          <>
            <View style={styles.statusIcon}>
              <Ionicons
                name="checkmark-circle"
                size={58}
                color="#16A34A"
              />
            </View>

            <Text style={styles.title}>
              已綁定仲介
            </Text>

            <Text style={styles.subtitle}>
              您目前已與仲介建立管理關係
            </Text>

            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>
                  仲介邀請碼
                </Text>

                <Text style={styles.infoValue}>
                  {membership.agencyInviteCode}
                </Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>
                  綁定狀態
                </Text>

                <View style={styles.activeBadge}>
                  <View style={styles.greenDot} />

                  <Text style={styles.activeText}>
                    已綁定
                  </Text>
                </View>
              </View>
            </View>

            <Text style={styles.note}>
              如需更換或解除仲介，現階段請由管理人員協助處理。
            </Text>

            <Pressable
                style={styles.homeButton}
                onPress={() => router.replace("/caregiver" as any)}
                >
                <Ionicons
                    name="home-outline"
                    size={20}
                    color="#FFFFFF"
                />

                <Text style={styles.homeButtonText}>
                    返回看護首頁
                </Text>
                </Pressable>
          </>
        ) : (
          <>
            <View style={styles.bindIcon}>
              <Ionicons
                name="business-outline"
                size={48}
                color="#4F59D5"
              />
            </View>

            <Text style={styles.title}>
              綁定仲介
            </Text>

            <Text style={styles.subtitle}>
              輸入仲介提供的邀請碼，即可建立綁定關係
            </Text>

            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder="請輸入 6 碼邀請碼"
              placeholderTextColor="#A0A0A0"
              autoCapitalize="characters"
              maxLength={6}
              style={styles.codeInput}
            />

            <Pressable
              onPress={handleBindAgency}
              disabled={
                submitting ||
                normalizedCode.length !== 6
              }
              style={[
                styles.bindButton,
                (submitting ||
                  normalizedCode.length !== 6) &&
                  styles.bindButtonDisabled,
              ]}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.bindButtonText}>
                  確認綁定
                </Text>
              )}
            </Pressable>

            <View style={styles.helpCard}>
              <Ionicons
                name="information-circle-outline"
                size={22}
                color="#4F59D5"
              />

              <Text style={styles.helpText}>
                完成綁定後，仲介將可以看到您與照護工作相關的必要資訊，以及家屬提出的仲介協助事項。
              </Text>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
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

  content: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 56,
  },

  bindIcon: {
    width: 92,
    height: 92,
    borderRadius: 46,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#E1E9FF",
    marginBottom: 20,
  },

  statusIcon: {
    marginBottom: 16,
  },

  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#111827",
  },

  subtitle: {
    fontSize: 15,
    color: "#6B7280",
    marginTop: 8,
    marginBottom: 28,
    textAlign: "center",
  },

  codeInput: {
    width: "100%",
    maxWidth: 460,
    backgroundColor: "#F8F9FC",
    borderWidth: 2,
    borderColor: "#D5D9E8",
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 20,
    textAlign: "center",
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: 6,
    color: "#111827",
  },

  bindButton: {
    width: "100%",
    maxWidth: 460,
    marginTop: 18,
    backgroundColor: "#4F59D5",
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: "center",
  },

  bindButtonDisabled: {
    backgroundColor: "#BFC4E8",
  },

  bindButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
  },

  helpCard: {
    width: "100%",
    maxWidth: 460,
    marginTop: 24,
    backgroundColor: "#F8F9FC",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    gap: 10,
  },

  helpText: {
    flex: 1,
    color: "#6B7280",
    fontSize: 14,
    lineHeight: 21,
  },

  infoCard: {
    width: "100%",
    maxWidth: 460,
    backgroundColor: "#F8F9FC",
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 6,
  },

  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 18,
  },

  infoLabel: {
    fontSize: 16,
    color: "#6B7280",
    fontWeight: "600",
  },

  infoValue: {
    fontSize: 18,
    color: "#111827",
    fontWeight: "bold",
    letterSpacing: 2,
  },

  divider: {
    height: 1,
    backgroundColor: "#E5E7EB",
  },

  activeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  greenDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#16A34A",
  },

  activeText: {
    color: "#16A34A",
    fontSize: 15,
    fontWeight: "bold",
  },

  note: {
    marginTop: 18,
    color: "#8B8B93",
    fontSize: 13,
    textAlign: "center",
  },
  homeButton: {
    marginTop: 24,
    width: "100%",
    maxWidth: 460,
    backgroundColor: "#4F59D5",
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    },

    homeButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "bold",
    },
});
