import {
  createAgencyReport,
  getAgencyReportContext,
} from "@/src/agency/agencyReportApi";
import { useAuth } from "@/src/auth/useAuth";
import { useActiveCareTarget } from "@/src/care-target/useActiveCareTarget";
import { useLanguage } from "@/src/store/LanguageContext";
import { AppAlert as Alert } from "@/src/ui/AppAlert";

import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";

type CaregiverOption = {
  caregiverUid: string;
  caregiverName: string;
};

const copy = {
  zh: {
    pageTitle: "回報照護問題",
    patient: "照護對象",
    caregiver: "回報對象",
    caregiverSuffix: "看護",
    category: "問題類型",
    title: "回報標題",
    titlePlaceholder: "例如：希望協助與看護溝通",
    description: "問題說明",
    descriptionPlaceholder:
      "請簡單說明目前遇到的情況，以及希望仲介協助處理的內容",
    submit: "送出回報",
    submitting: "送出中…",

    medication: "用藥問題",
    communication: "溝通問題",
    care: "照護問題",
    other: "其他",

    noPatientTitle: "尚未選擇照護對象",
    noPatientText: "請先選擇一位照護對象，再進行問題回報。",
    noCaregiverTitle: "目前無法回報給仲介",
    noCaregiverText:
      "這位照護對象目前沒有已綁定仲介的看護。",
    loadFailed: "無法載入回報資料",
    loadFailedText: "請稍後再試一次。",
    requiredTitle: "資料尚未完成",
    selectCaregiver: "請先選擇要回報的看護。",
    enterTitle: "請輸入回報標題。",
    enterDescription: "請輸入問題說明。",
    successTitle: "回報已送出",
    successText: "仲介已收到這筆照護問題回報。",
    backHome: "返回首頁",
    sendFailed: "回報失敗",
    sendFailedDefault: "目前無法送出回報，請稍後再試。",
  },

  en: {
    pageTitle: "Report a Care Issue",
    patient: "Care recipient",
    caregiver: "Caregiver",
    caregiverSuffix: "Caregiver",
    category: "Issue type",
    title: "Report title",
    titlePlaceholder: "e.g. Please help check medication status",
    description: "Description",
    descriptionPlaceholder:
      "Describe the issue and what assistance you would like from the agency.",
    submit: "Submit report",
    submitting: "Submitting…",

    medication: "Medication",
    communication: "Communication",
    care: "Care",
    other: "Other",

    noPatientTitle: "No care recipient selected",
    noPatientText:
      "Select a care recipient before submitting a report.",
    noCaregiverTitle: "No agency caregiver available",
    noCaregiverText:
      "There is currently no caregiver linked to an agency for this care recipient.",
    loadFailed: "Unable to load report information",
    loadFailedText: "Please try again later.",
    requiredTitle: "Incomplete information",
    selectCaregiver: "Please select a caregiver.",
    enterTitle: "Please enter a report title.",
    enterDescription: "Please describe the issue.",
    successTitle: "Report submitted",
    successText: "The agency has received this care report.",
    backHome: "Back to home",
    sendFailed: "Submission failed",
    sendFailedDefault:
      "Unable to submit the report. Please try again later.",
  },

  vi: {
    pageTitle: "Báo cáo vấn đề chăm sóc",
    patient: "Người được chăm sóc",
    caregiver: "Người chăm sóc",
    caregiverSuffix: "Người chăm sóc",
    category: "Loại vấn đề",
    title: "Tiêu đề báo cáo",
    titlePlaceholder: "Ví dụ: Nhờ hỗ trợ kiểm tra việc dùng thuốc",
    description: "Mô tả vấn đề",
    descriptionPlaceholder:
      "Vui lòng mô tả tình hình và nội dung cần đơn vị môi giới hỗ trợ.",
    submit: "Gửi báo cáo",
    submitting: "Đang gửi…",

    medication: "Thuốc",
    communication: "Giao tiếp",
    care: "Chăm sóc",
    other: "Khác",

    noPatientTitle: "Chưa chọn người được chăm sóc",
    noPatientText:
      "Vui lòng chọn người được chăm sóc trước khi gửi báo cáo.",
    noCaregiverTitle: "Hiện chưa thể báo cho đơn vị môi giới",
    noCaregiverText:
      "Hiện không có người chăm sóc đã liên kết với đơn vị môi giới.",
    loadFailed: "Không thể tải thông tin báo cáo",
    loadFailedText: "Vui lòng thử lại sau.",
    requiredTitle: "Thông tin chưa đầy đủ",
    selectCaregiver: "Vui lòng chọn người chăm sóc.",
    enterTitle: "Vui lòng nhập tiêu đề.",
    enterDescription: "Vui lòng nhập mô tả vấn đề.",
    successTitle: "Đã gửi báo cáo",
    successText: "Đơn vị môi giới đã nhận được báo cáo.",
    backHome: "Về trang chủ",
    sendFailed: "Gửi thất bại",
    sendFailedDefault:
      "Hiện không thể gửi báo cáo. Vui lòng thử lại sau.",
  },

  id: {
    pageTitle: "Laporkan Masalah Perawatan",
    patient: "Penerima perawatan",
    caregiver: "Pengasuh",
    caregiverSuffix: "Pengasuh",
    category: "Jenis masalah",
    title: "Judul laporan",
    titlePlaceholder:
      "Contoh: Mohon bantu periksa penggunaan obat",
    description: "Penjelasan masalah",
    descriptionPlaceholder:
      "Jelaskan situasi dan bantuan yang dibutuhkan dari agen.",
    submit: "Kirim laporan",
    submitting: "Mengirim…",

    medication: "Obat",
    communication: "Komunikasi",
    care: "Perawatan",
    other: "Lainnya",

    noPatientTitle: "Belum memilih penerima perawatan",
    noPatientText:
      "Pilih penerima perawatan sebelum membuat laporan.",
    noCaregiverTitle: "Belum dapat melapor ke agen",
    noCaregiverText:
      "Belum ada pengasuh yang terhubung dengan agen.",
    loadFailed: "Gagal memuat informasi laporan",
    loadFailedText: "Silakan coba lagi nanti.",
    requiredTitle: "Informasi belum lengkap",
    selectCaregiver: "Pilih pengasuh terlebih dahulu.",
    enterTitle: "Masukkan judul laporan.",
    enterDescription: "Masukkan penjelasan masalah.",
    successTitle: "Laporan terkirim",
    successText: "Agen telah menerima laporan ini.",
    backHome: "Kembali ke beranda",
    sendFailed: "Gagal mengirim",
    sendFailedDefault:
      "Laporan tidak dapat dikirim. Silakan coba lagi nanti.",
  },
} as const;

export default function ReportCareIssueScreen() {
  const insets = useSafeAreaInsets();

  const { user } = useAuth();
  const { language } = useLanguage();

  const {
    activePatientId,
    activePatient,
  } = useActiveCareTarget();

  const t = copy[language];

  const [
    caregivers,
    setCaregivers,
  ] = useState<CaregiverOption[]>([]);

  const [
    selectedCaregiverUid,
    setSelectedCaregiverUid,
  ] = useState("");

  const [
    patientName,
    setPatientName,
  ] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] =
    useState("");

  const [
    contextLoading,
    setContextLoading,
  ] = useState(true);

  const [
    contextError,
    setContextError,
  ] = useState("");

  const [submitting, setSubmitting] =
    useState(false);

  useEffect(() => {
    if (
      !user ||
      user.role !== "family" ||
      !activePatientId
    ) {
      setCaregivers([]);
      setSelectedCaregiverUid("");
      setPatientName(
        activePatient?.name ?? ""
      );
      setContextLoading(false);
      return;
    }

    let cancelled = false;

    async function loadContext() {
      try {
        setContextLoading(true);
        setContextError("");

        const result =
          await getAgencyReportContext({
            patientId: activePatientId!,
          });

        if (cancelled) return;

        setPatientName(
          result.data.patientName ||
            activePatient?.name ||
            ""
        );

        const nextCaregivers =
          result.data.caregivers ?? [];

        setCaregivers(nextCaregivers);

        if (nextCaregivers.length === 1) {
          setSelectedCaregiverUid(
            nextCaregivers[0].caregiverUid
          );
        } else {
          setSelectedCaregiverUid("");
        }
      } catch (error) {
        console.log(
          "[agency report context] load failed:",
          error
        );

        if (!cancelled) {
          setCaregivers([]);
          setSelectedCaregiverUid("");
          setContextError(
            t.loadFailedText
          );
        }
      } finally {
        if (!cancelled) {
          setContextLoading(false);
        }
      }
    }

    loadContext();

    return () => {
      cancelled = true;
    };
  }, [
    user?.uid,
    user?.role,
    activePatientId,
    activePatient?.name,
    t.loadFailedText,
  ]);

  const selectedCaregiver = useMemo(
    () =>
      caregivers.find(
        (item) =>
          item.caregiverUid ===
          selectedCaregiverUid
      ) ?? null,
    [
      caregivers,
      selectedCaregiverUid,
    ]
  );


  async function handleSubmit() {
    if (
      !user ||
      user.role !== "family" ||
      !activePatientId ||
      submitting
    ) {
      return;
    }

    if (!selectedCaregiverUid) {
      Alert.alert(
        t.requiredTitle,
        t.selectCaregiver
      );
      return;
    }

    const cleanTitle = title.trim();
    const cleanDescription =
      description.trim();

    if (!cleanTitle) {
      Alert.alert(
        t.requiredTitle,
        t.enterTitle
      );
      return;
    }

    if (!cleanDescription) {
      Alert.alert(
        t.requiredTitle,
        t.enterDescription
      );
      return;
    }

    try {
      setSubmitting(true);

      await createAgencyReport({
        patientId: activePatientId,
        caregiverUid: selectedCaregiverUid,
        title: cleanTitle,
        description: cleanDescription,
      });

      Alert.alert(
        t.successTitle,
        t.successText,
        [
          {
            text: t.backHome,
            onPress: () => {
              router.replace(
                "/family" as any
              );
            },
          },
        ]
      );
    } catch (error: any) {
      console.log(
        "[agency report] create failed:",
        error
      );

      let message =
        t.sendFailedDefault;

      if (
        error?.code ===
        "functions/failed-precondition"
      ) {
        message =
          error?.message ||
          t.sendFailedDefault;
      }

      if (
        error?.code ===
        "functions/permission-denied"
      ) {
        message =
          error?.message ||
          t.sendFailedDefault;
      }

      Alert.alert(
        t.sendFailed,
        message
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!activePatientId) {
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
            onPress={() => router.back()}
          >
            <Ionicons
              name="chevron-back"
              size={30}
              color="#111827"
            />
          </Pressable>

          <Text style={styles.headerTitle}>
            {t.pageTitle}
          </Text>

          <View
            style={styles.headerSide}
          />
        </View>

        <View
          style={styles.centerState}
        >
          <Ionicons
            name="person-outline"
            size={58}
            color="#4F59D5"
          />

          <Text
            style={styles.stateTitle}
          >
            {t.noPatientTitle}
          </Text>

          <Text
            style={styles.stateText}
          >
            {t.noPatientText}
          </Text>
        </View>
      </View>
    );
  }

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
          onPress={() => router.back()}
        >
          <Ionicons
            name="chevron-back"
            size={30}
            color="#111827"
          />
        </Pressable>

        <Text style={styles.headerTitle}>
          {t.pageTitle}
        </Text>

        <View
          style={styles.headerSide}
        />
      </View>

      {contextLoading ? (
        <View
          style={styles.centerState}
        >
          <ActivityIndicator
            size="large"
            color="#4F59D5"
          />
        </View>
      ) : contextError ? (
        <View
          style={styles.centerState}
        >
          <Ionicons
            name="alert-circle-outline"
            size={58}
            color="#DC2626"
          />

          <Text
            style={styles.stateTitle}
          >
            {t.loadFailed}
          </Text>

          <Text
            style={styles.stateText}
          >
            {contextError}
          </Text>
        </View>
      ) : caregivers.length === 0 ? (
        <View
          style={styles.centerState}
        >
          <Ionicons
            name="business-outline"
            size={58}
            color="#4F59D5"
          />

          <Text
            style={styles.stateTitle}
          >
            {t.noCaregiverTitle}
          </Text>

          <Text
            style={styles.stateText}
          >
            {t.noCaregiverText}
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.content,
            {
              paddingBottom:
                Math.max(
                  40,
                  insets.bottom + 30
                ),
            },
          ]}
          showsVerticalScrollIndicator={
            false
          }
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.label}>
            {t.patient}
          </Text>

          <View style={styles.infoCard}>
            <View
              style={styles.infoIcon}
            >
              <Ionicons
                name="person-outline"
                size={24}
                color="#4F59D5"
              />
            </View>

            <Text
              style={styles.infoValue}
            >
              {patientName ||
                activePatient?.name}
            </Text>
          </View>

          <Text style={styles.label}>
            {t.caregiver}
          </Text>

          <View
            style={
              styles.caregiverList
            }
          >
            {caregivers.map(
              (caregiver) => {
                const selected =
                  selectedCaregiverUid ===
                  caregiver.caregiverUid;

                return (
                  <Pressable
                    key={
                      caregiver.caregiverUid
                    }
                    onPress={() =>
                      setSelectedCaregiverUid(
                        caregiver.caregiverUid
                      )
                    }
                    style={[
                      styles.caregiverCard,
                      selected &&
                        styles.caregiverCardSelected,
                    ]}
                  >
                    <View
                      style={
                        styles.caregiverIcon
                      }
                    >
                      <Ionicons
                        name="person"
                        size={22}
                        color={
                          selected
                            ? "#FFFFFF"
                            : "#4F59D5"
                        }
                      />
                    </View>

                    <View
                      style={{ flex: 1 }}
                    >
                      <Text
                        style={
                          styles.caregiverName
                        }
                      >
                        {
                          caregiver.caregiverName
                        }
                      </Text>

                      <Text
                        style={
                          styles.caregiverRole
                        }
                      >
                        {
                          t.caregiverSuffix
                        }
                      </Text>
                    </View>

                    {selected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={25}
                        color="#4F59D5"
                      />
                    )}
                  </Pressable>
                );
              }
            )}
          </View>

          <Text style={styles.label}>
            {t.title}
          </Text>

          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={
              t.titlePlaceholder
            }
            maxLength={200}
            style={styles.input}
          />

          <Text style={styles.label}>
            {t.description}
          </Text>

          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder={
              t.descriptionPlaceholder
            }
            maxLength={3000}
            multiline
            textAlignVertical="top"
            style={[
              styles.input,
              styles.descriptionInput,
            ]}
          />

          <Pressable
            onPress={handleSubmit}
            disabled={submitting}
            style={[
              styles.submitButton,
              submitting &&
                styles.submitButtonDisabled,
            ]}
          >
            {submitting ? (
              <ActivityIndicator
                color="#FFFFFF"
              />
            ) : (
              <>
                <Ionicons
                  name="send-outline"
                  size={21}
                  color="#FFFFFF"
                />

                <Text
                  style={
                    styles.submitText
                  }
                >
                  {t.submit}
                </Text>
              </>
            )}
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F8FC",
  },

  header: {
    minHeight: 68,
    paddingBottom: 12,
    paddingHorizontal: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#ECECF2",
    flexDirection: "row",
    alignItems: "flex-end",
  },

  headerSide: {
    width: 46,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },

  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "900",
    color: "#111827",
    paddingBottom: 10,
  },

  scrollView: {
    flex: 1,
  },

  content: {
    padding: 20,
  },

  label: {
    fontSize: 15,
    fontWeight: "800",
    color: "#374151",
    marginBottom: 9,
    marginTop: 18,
  },

  infoCard: {
    minHeight: 66,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  infoIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#EEF0FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  infoValue: {
    fontSize: 17,
    fontWeight: "800",
    color: "#111827",
  },

  caregiverList: {
    gap: 10,
  },

  caregiverCard: {
    minHeight: 72,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  caregiverCardSelected: {
    borderColor: "#4F59D5",
    backgroundColor: "#F3F4FF",
  },

  caregiverIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#4F59D5",
    alignItems: "center",
    justifyContent: "center",
  },

  caregiverName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
  },

  caregiverRole: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 3,
  },

  input: {
    borderWidth: 1,
    borderColor: "#E1E1E8",
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#111827",
  },

  descriptionInput: {
    minHeight: 140,
  },

  submitButton: {
    height: 58,
    borderRadius: 16,
    backgroundColor: "#4F59D5",
    marginTop: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },

  submitButtonDisabled: {
    opacity: 0.6,
  },

  submitText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "900",
  },

  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 36,
  },

  stateTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#111827",
    marginTop: 15,
    textAlign: "center",
  },

  stateText: {
    fontSize: 15,
    lineHeight: 22,
    color: "#6B7280",
    marginTop: 8,
    textAlign: "center",
  },
});