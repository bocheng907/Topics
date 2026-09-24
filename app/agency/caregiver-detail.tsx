// app/agency/caregiver-detail.tsx

import { db } from "@/firebase/firebaseConfig";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Image,
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

export default function AgencyCaregiverDetailScreen() {
  const insets = useSafeAreaInsets();

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

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      setError(true);
      return;
    }

    let cancelled = false;

    async function loadDetail() {
      try {
        setLoading(true);
        setError(false);

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

  useEffect(() => {
    if (!uid) {
      setServicePatients([]);
      setServiceLoading(false);
      return;
    }

    setServiceLoading(true);

    const serviceRef = collection(
      db,
      "caregiver_service_summaries",
      uid,
      "patients"
    );

    const unsubscribe = onSnapshot(
      serviceRef,
      (snapshot) => {
        const patients = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();

          return {
            id: docSnap.id,
            patientName: String(
              data.patientName ?? "未命名照護對象"
            ),
          };
        });

        setServicePatients(patients);
        setServiceLoading(false);
      },
      (error) => {
        console.log(
          "[agency caregiver services] load failed:",
          error
        );

        setServicePatients([]);
        setServiceLoading(false);
      }
    );

    return unsubscribe;
  }, [uid]);

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

  if (error || !detail) {
    return (
      <View style={styles.container}>
        <View
          style={[
            styles.header,
            { paddingTop: insets.top + 8 },
          ]}
        >
          <Pressable
            style={styles.headerSide}
            onPress={() => router.back()}
          >
            <Ionicons
              name="chevron-back"
              size={30}
              color="#111827"
            />
          </Pressable>

          <Text style={styles.headerTitle}>
            看護詳情
          </Text>

          <View style={styles.headerSide} />
        </View>

        <View style={styles.errorContainer}>
          <Ionicons
            name="alert-circle-outline"
            size={48}
            color="#DC5A5A"
          />

          <Text style={styles.errorTitle}>
            無法讀取看護資料
          </Text>

          <Text style={styles.errorText}>
            請稍後重新整理頁面再試。
          </Text>
        </View>
      </View>
    );
  }

  const createdAtText =
    detail.createdAt?.toDate
      ? detail.createdAt
          .toDate()
          .toLocaleString("zh-TW")
      : "—";

  const avatarText =
    detail.displayName.trim().charAt(0) ||
    detail.email.trim().charAt(0).toUpperCase() ||
    "看";

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 8 },
        ]}
      >
        <Pressable
          style={styles.headerSide}
          onPress={() => router.back()}
        >
          <Ionicons
            name="chevron-back"
            size={30}
            color="#111827"
          />
        </Pressable>

        <Text style={styles.headerTitle}>
          看護詳情
        </Text>

        <View style={styles.headerSide} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.profileSection}>
          {detail.avatarUrl ? (
            <Image
              source={{ uri: detail.avatarUrl }}
              style={styles.avatar}
            />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {avatarText}
              </Text>
            </View>
          )}

          <Text style={styles.name}>
            {detail.displayName ||
              "尚未填寫姓名"}
          </Text>

          <Text style={styles.emailTop}>
            {detail.email}
          </Text>

          <View style={styles.statusBadge}>
            <View style={styles.greenDot} />

            <Text style={styles.statusText}>
              已綁定
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>
          基本資料
        </Text>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>
              姓名
            </Text>

            <Text style={styles.infoValue}>
              {detail.displayName || "尚未填寫"}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>
              聯絡電話
            </Text>

            <Text style={styles.infoValue}>
              {detail.phone || "尚未填寫"}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>
              Email
            </Text>

            <Text style={styles.infoValue}>
              {detail.email || "—"}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>
              綁定日期
            </Text>

            <Text style={styles.infoValue}>
              {createdAtText}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>
          目前服務資訊
        </Text>

        {serviceLoading ? (
          <View style={styles.serviceLoading}>
            <ActivityIndicator
              size="small"
              color="#4F59D5"
            />

            <Text style={styles.serviceLoadingText}>
              讀取服務資訊中...
            </Text>
          </View>
        ) : servicePatients.length > 0 ? (
          <View style={styles.serviceList}>
            {servicePatients.map((patient) => (
              <View
                key={patient.id}
                style={styles.serviceCard}
              >
                <View style={styles.serviceIcon}>
                  <Ionicons
                    name="person-outline"
                    size={28}
                    color="#4F59D5"
                  />
                </View>

                <View style={styles.serviceText}>
                  <Text style={styles.serviceLabel}>
                    照護對象
                  </Text>

                  <Text style={styles.serviceTitle}>
                    {patient.patientName}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyServiceCard}>
            <Ionicons
              name="person-add-outline"
              size={26}
              color="#8B8B93"
            />

            <View style={styles.emptyServiceContent}>
              <Text style={styles.emptyServiceTitle}>
                尚未綁定照護對象
              </Text>

              <Text style={styles.emptyServiceText}>
                此看護目前沒有已綁定的照護對象
              </Text>
            </View>
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
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
    padding: 24,
    paddingBottom: 50,
  },

  profileSection: {
    alignItems: "center",
    marginTop: 18,
    marginBottom: 30,
  },

  avatar: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: "#4F59D5",
    justifyContent: "center",
    alignItems: "center",
  },

  avatarText: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "bold",
  },

  name: {
    marginTop: 12,
    fontSize: 22,
    fontWeight: "bold",
    color: "#111827",
  },

  emailTop: {
    marginTop: 4,
    fontSize: 14,
    color: "#6B7280",
  },

  statusBadge: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ECFDF3",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
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
    fontWeight: "bold",
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 12,
  },

  infoCard: {
    backgroundColor: "#F8F9FC",
    borderRadius: 18,
    paddingHorizontal: 18,
    marginBottom: 28,
  },

  infoRow: {
    paddingVertical: 17,
  },

  infoLabel: {
    color: "#8B8B93",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 5,
  },

  infoValue: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "700",
  },

  divider: {
    height: 1,
    backgroundColor: "#E5E7EB",
  },

  serviceCard: {
    backgroundColor: "#E1E9FF",
    borderRadius: 18,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },

  serviceIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },

  serviceText: {
    flex: 1,
  },

  serviceTitle: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#111827",
  },

  serviceDescription: {
    marginTop: 5,
    fontSize: 14,
    lineHeight: 20,
    color: "#6B7280",
  },

  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 80,
  },

  errorTitle: {
    marginTop: 12,
    fontSize: 20,
    fontWeight: "bold",
    color: "#111827",
  },

  errorText: {
    marginTop: 6,
    color: "#6B7280",
    fontSize: 14,
  },

  serviceList: {
    gap: 12,
  },

  serviceLabel: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "600",
    marginBottom: 3,
  },

  serviceLoading: {
    backgroundColor: "#F8F9FC",
    borderRadius: 18,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  serviceLoadingText: {
    fontSize: 15,
    color: "#6B7280",
  },

  emptyServiceCard: {
    backgroundColor: "#F8F9FC",
    borderRadius: 18,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  emptyServiceContent: {
    flex: 1,
  },

  emptyServiceTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#374151",
  },

  emptyServiceText: {
    marginTop: 4,
    fontSize: 14,
    color: "#8B8B93",
    lineHeight: 20,
  },
});