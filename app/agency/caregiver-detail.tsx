// app/agency/caregiver-detail.tsx

import { db } from "@/firebase/firebaseConfig";
import type { AgencyReport } from "@/src/agency/agencyReportTypes";
import { useAgencyReports } from "@/src/agency/useAgencyReports";
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
  Image,
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

function getCaregiverReportStatus(report: {
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

  const reportSummary =
    pendingReportCount > 0
      ? {
          label: `${pendingReportCount} 件待處理`,
          color: "#C95353",
          backgroundColor: "#FCECEC",
        }
      : attentionReportCount > 0
      ? {
          label: `${attentionReportCount} 件需關注`,
          color: "#B7791F",
          backgroundColor: "#FFF4D6",
        }
      : null;

  // ==========================================
  // 讀取看護基本資料
  // ==========================================
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

  // ==========================================
  // 讀取目前服務的照護對象
  // ==========================================
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
        const patients =
          snapshot.docs.map((docSnap) => {
            const data =
              docSnap.data();

            return {
              id: docSnap.id,

              patientName: String(
                data.patientName ??
                  "未命名照護對象"
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

  // ==========================================
  // Loading
  // ==========================================
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

  // ==========================================
  // Error
  // ==========================================
  if (error || !detail) {
    return (
      <View style={styles.container}>
        <View
          style={[
            styles.header,
            {
              paddingTop:
                insets.top + 8,
            },
          ]}
        >
          <Pressable
            style={styles.headerSide}
            onPress={() =>
              router.back()
            }
          >
            <Ionicons
              name="chevron-back"
              size={30}
              color="#111827"
            />
          </Pressable>

          <Text
            style={styles.headerTitle}
          >
            看護詳情
          </Text>

          <View
            style={styles.headerSide}
          />
        </View>

        <View
          style={styles.errorContainer}
        >
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
    detail.displayName
      .trim()
      .charAt(0) ||
    detail.email
      .trim()
      .charAt(0)
      .toUpperCase() ||
    "看";

  return (
    <View style={styles.container}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop:
              insets.top + 8,
          },
        ]}
      >
        <Pressable
          style={styles.headerSide}
          onPress={() =>
            router.back()
          }
        >
          <Ionicons
            name="chevron-back"
            size={30}
            color="#111827"
          />
        </Pressable>

        <Text
          style={styles.headerTitle}
        >
          看護詳情
        </Text>

        <View
          style={styles.headerSide}
        />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={
          styles.content
        }
      >
        {/* =====================================
            看護資訊
        ===================================== */}
        <View
          style={styles.caregiverHero}
        >
          {detail.avatarUrl ? (
            <Image
              source={{
                uri: detail.avatarUrl,
              }}
              style={styles.heroAvatar}
            />
          ) : (
            <View
              style={[
                styles.heroAvatar,
                styles.heroAvatarFallback,
              ]}
            >
              <Text
                style={
                  styles.heroAvatarText
                }
              >
                {avatarText}
              </Text>
            </View>
          )}

          <View
            style={styles.heroInfo}
          >
            <View
              style={
                styles.heroNameRow
              }
            >
              <Text
                style={styles.heroName}
                numberOfLines={1}
              >
                {detail.displayName ||
                  "尚未填寫姓名"}
              </Text>

              <View
                style={styles.boundBadge}
              >
                <View
                  style={styles.boundDot}
                />

                <Text
                  style={styles.boundText}
                >
                  已綁定
                </Text>
              </View>
            </View>

            <View
              style={styles.heroMetaRow}
            >
              <Ionicons
                name="call-outline"
                size={15}
                color="#62697A"
              />

              <Text
                style={
                  styles.heroMetaText
                }
                numberOfLines={1}
              >
                {detail.phone ||
                  "尚未填寫電話"}
              </Text>
            </View>

            <View
              style={styles.heroMetaRow}
            >
              <Ionicons
                name="mail-outline"
                size={15}
                color="#62697A"
              />

              <Text
                style={
                  styles.heroMetaText
                }
                numberOfLines={1}
              >
                {detail.email || "—"}
              </Text>
            </View>
          </View>
        </View>

        {/* =====================================
            家庭回報
        ===================================== */}
        <View
          style={styles.sectionTitleRow}
        >
          <Text
            style={styles.sectionTitle}
          >
            家庭回報
          </Text>

          {!!reportSummary && (
            <View
              style={[
                styles.reportSummaryBadge,
                {
                  backgroundColor:
                    reportSummary.backgroundColor,
                },
              ]}
            >
              <Text
                style={[
                  styles.reportSummaryText,
                  {
                    color:
                      reportSummary.color,
                  },
                ]}
              >
                {reportSummary.label}
              </Text>
            </View>
          )}
        </View>

        {reportLoading ? (
          <View
            style={
              styles.reportEmptyCard
            }
          >
            <ActivityIndicator
              size="small"
              color="#4F59D5"
            />

            <Text
              style={
                styles.reportEmptyText
              }
            >
              讀取家庭回報中...
            </Text>
          </View>
        ) : caregiverReports.length ===
          0 ? (
          <View
            style={
              styles.reportEmptyCard
            }
          >
            <Ionicons
              name="checkmark-circle-outline"
              size={30}
              color="#8B8B93"
            />

            <View
              style={
                styles.reportEmptyContent
              }
            >
              <Text
                style={
                  styles.reportEmptyTitle
                }
              >
                目前沒有家庭回報
              </Text>

              <Text
                style={
                  styles.reportEmptyText
                }
              >
                此看護目前沒有需要仲介協助處理的家庭回報
              </Text>
            </View>
          </View>
        ) : (
          <View
            style={styles.reportList}
          >
            {caregiverReports.map(
              (report) => {
                const status =
                  getCaregiverReportStatus(
                    report
                  );

                return (
                  <Pressable
                    key={report.id}
                    style={
                      styles.reportCard
                    }
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
                    <View
                      style={
                        styles.reportMain
                      }
                    >
                      <View
                        style={
                          styles.reportTitleRow
                        }
                      >
                        <Text
                          style={
                            styles.reportTitle
                          }
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
                                color:
                                  status.color,
                              },
                            ]}
                          >
                            {status.label}
                          </Text>
                        </View>
                      </View>

                      <Text
                        style={
                          styles.reportMeta
                        }
                        numberOfLines={1}
                      >
                        {report.patientName}
                        {" · "}
                        {report.reporterName}
                      </Text>

                      {!!report.description && (
                        <Text
                          style={
                            styles.reportDescription
                          }
                          numberOfLines={2}
                        >
                          {
                            report.description
                          }
                        </Text>
                      )}
                    </View>

                    <Ionicons
                      name="chevron-forward"
                      size={21}
                      color="#A1A1AA"
                    />
                  </Pressable>
                );
              }
            )}
          </View>
        )}

        {/* =====================================
            目前服務資訊
        ===================================== */}
        <Text
          style={[
            styles.sectionTitle,
            styles.sectionSpacing,
          ]}
        >
          目前服務資訊
        </Text>

        {serviceLoading ? (
          <View
            style={
              styles.serviceLoading
            }
          >
            <ActivityIndicator
              size="small"
              color="#4F59D5"
            />

            <Text
              style={
                styles.serviceLoadingText
              }
            >
              讀取服務資訊中...
            </Text>
          </View>
        ) : servicePatients.length >
          0 ? (
          <View
            style={styles.serviceList}
          >
            {servicePatients.map(
              (patient) => (
                <View
                  key={patient.id}
                  style={
                    styles.serviceCard
                  }
                >
                  <View
                    style={
                      styles.serviceIcon
                    }
                  >
                    <Ionicons
                      name="person-outline"
                      size={28}
                      color="#4F59D5"
                    />
                  </View>

                  <View
                    style={
                      styles.serviceText
                    }
                  >
                    <Text
                      style={
                        styles.serviceLabel
                      }
                    >
                      照護對象
                    </Text>

                    <Text
                      style={
                        styles.serviceTitle
                      }
                    >
                      {
                        patient.patientName
                      }
                    </Text>
                  </View>
                </View>
              )
            )}
          </View>
        ) : (
          <View
            style={
              styles.emptyServiceCard
            }
          >
            <Ionicons
              name="person-add-outline"
              size={26}
              color="#8B8B93"
            />

            <View
              style={
                styles.emptyServiceContent
              }
            >
              <Text
                style={
                  styles.emptyServiceTitle
                }
              >
                尚未綁定照護對象
              </Text>

              <Text
                style={
                  styles.emptyServiceText
                }
              >
                此看護目前沒有已綁定的照護對象
              </Text>
            </View>
          </View>
        )}

        {/* =====================================
            其他資訊
        ===================================== */}
        <Text
          style={[
            styles.sectionTitle,
            styles.sectionSpacing,
          ]}
        >
          其他資訊
        </Text>

        <View
          style={styles.otherInfoCard}
        >
          <Text
            style={
              styles.otherInfoLabel
            }
          >
            仲介綁定日期
          </Text>

          <Text
            style={
              styles.otherInfoValue
            }
          >
            {createdAtText}
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

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },

  // ==============================
  // Header
  // ==============================
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

  // ==============================
  // 看護資訊色塊
  // ==============================
  caregiverHero: {
    backgroundColor: "#E1E9FF",
    borderRadius: 22,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
    marginBottom: 26,
  },

  heroAvatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
  },

  heroAvatarFallback: {
    backgroundColor: "#4F59D5",
    alignItems: "center",
    justifyContent: "center",
  },

  heroAvatarText: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "900",
  },

  heroInfo: {
    flex: 1,
    marginLeft: 16,
    minWidth: 0,
  },

  heroNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },

  heroName: {
    flex: 1,
    fontSize: 20,
    fontWeight: "900",
    color: "#111827",
  },

  boundBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#ECFDF3",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 14,
  },

  boundDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#16A34A",
  },

  boundText: {
    color: "#16A34A",
    fontSize: 12,
    fontWeight: "800",
  },

  heroMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 5,
  },

  heroMetaText: {
    flex: 1,
    fontSize: 14,
    color: "#62697A",
    fontWeight: "600",
  },

  // ==============================
  // Section
  // ==============================
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 12,
  },

  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },

  sectionTitleRowTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111827",
  },

  sectionSpacing: {
    marginTop: 30,
  },

  // ==============================
  // 家庭回報
  // ==============================
  reportSummaryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },

  reportSummaryText: {
    fontSize: 12,
    fontWeight: "900",
  },

  reportList: {
    gap: 12,
  },

  reportCard: {
    minHeight: 96,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E8EAF0",
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,

    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },

  reportMain: {
    flex: 1,
  },

  reportTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  reportTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
  },

  reportMeta: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: "700",
    color: "#4F59D5",
  },

  reportDescription: {
    marginTop: 5,
    fontSize: 13,
    lineHeight: 19,
    color: "#6B7280",
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

  reportEmptyCard: {
    minHeight: 90,
    backgroundColor: "#F8F9FC",
    borderRadius: 18,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  reportEmptyContent: {
    flex: 1,
  },

  reportEmptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#374151",
  },

  reportEmptyText: {
    marginTop: 3,
    fontSize: 14,
    lineHeight: 20,
    color: "#8B8B93",
  },

  // ==============================
  // 服務資訊
  // ==============================
  serviceList: {
    gap: 12,
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

  serviceLabel: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "600",
    marginBottom: 3,
  },

  serviceTitle: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#111827",
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

  // ==============================
  // 其他資訊
  // ==============================
  otherInfoCard: {
    backgroundColor: "#F8F9FC",
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },

  otherInfoLabel: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "600",
  },

  otherInfoValue: {
    flexShrink: 1,
    fontSize: 14,
    color: "#111827",
    fontWeight: "700",
    textAlign: "right",
  },

  // ==============================
  // Error
  // ==============================
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
});