import {
  createAgencyReport,
  getAgencyReportContext,
} from "@/src/agency/agencyReportApi";
import { useAuth } from "@/src/auth/useAuth";
import { useActiveCareTarget } from "@/src/care-target/useActiveCareTarget";
import { useLanguage } from "@/src/store/LanguageContext";
import { userErrorMessage } from "@/src/ui/userErrorMessages";
import { AppAlert as Alert } from "@/src/ui/AppAlert";
import { AppHeader, Button, Card, EmptyState, KeyboardAwareScroll, TextField } from "@/src/ui/components";
import { colors, layout, radii, spacing, typography } from "@/src/ui/theme";

import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, {
  useEffect,
  useState,
} from "react";

import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";

type CaregiverOption = {
  caregiverUid: string;
  caregiverName: string;
};

type ReportCategory =
  | "communication"
  | "schedule"
  | "service"
  | "other";

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

    communication: "溝通協調",
    schedule: "排班／出勤",
    service: "服務內容",
    other: "其他",
    selectCategory: "請先選擇問題類型。",

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
    titlePlaceholder:"e.g. Please help coordinate with the caregiver",
    description: "Description",
    descriptionPlaceholder:
      "Describe the issue and what assistance you would like from the agency.",
    submit: "Submit report",
    submitting: "Submitting…",

    communication: "Communication",
    schedule: "Schedule / Attendance",
    service: "Service",
    other: "Other",
    selectCategory: "Please select an issue type.",

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
    titlePlaceholder:  "Ví dụ: Mong được hỗ trợ trao đổi với người chăm sóc",
    description: "Mô tả vấn đề",
    descriptionPlaceholder:
      "Vui lòng mô tả tình hình và nội dung cần đơn vị môi giới hỗ trợ.",
    submit: "Gửi báo cáo",
    submitting: "Đang gửi…",

    communication: "Giao tiếp",
    schedule: "Lịch làm việc / Chấm công",
    service: "Nội dung dịch vụ",
    other: "Khác",
    selectCategory: "Vui lòng chọn loại vấn đề.",

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
       "Contoh: Mohon bantuan berkoordinasi dengan pengasuh",
    description: "Penjelasan masalah",
    descriptionPlaceholder:
      "Jelaskan situasi dan bantuan yang dibutuhkan dari agen.",
    submit: "Kirim laporan",
    submitting: "Mengirim…",

    communication: "Komunikasi",
    schedule: "Jadwal / Kehadiran",
    service: "Layanan",
    other: "Lainnya",
    selectCategory: "Pilih jenis masalah terlebih dahulu.",

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

  const categoryOptions: {
    key: ReportCategory;
    label: string;
  }[] = [
    {
      key: "communication",
      label: t.communication,
    },
    {
      key: "schedule",
      label: t.schedule,
    },
    {
      key: "service",
      label: t.service,
    },
    {
      key: "other",
      label: t.other,
    },
  ];

  const [category, setCategory] =
    useState<ReportCategory | "">("");

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

  const contextScope = `${user?.uid}:${user?.role}:${activePatientId}:${activePatient?.name}:${t.loadFailedText}`;
  const [previousContextScope, setPreviousContextScope] = useState<string | null>(null);
  if (previousContextScope !== contextScope) {
    setPreviousContextScope(contextScope);
    setCaregivers([]);
    setSelectedCaregiverUid("");
    setPatientName(activePatient?.name ?? "");
    setContextLoading(Boolean(user?.role === "family" && activePatientId));
    setContextError("");
  }
  const reporterUid = user?.uid;
  const reporterRole = user?.role;
  useEffect(() => {
    if (
      !reporterUid ||
      reporterRole !== "family" ||
      !activePatientId
    ) return;

    let cancelled = false;

    async function loadContext() {
      try {
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
    reporterUid,
    reporterRole,
    activePatientId,
    activePatient?.name,
    t.loadFailedText,
  ]);



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

    if (!category) {
      Alert.alert(
        t.requiredTitle,
        t.selectCategory
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
        category,
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

      Alert.alert(
        t.sendFailed,
        userErrorMessage(error, "report", language)
      );
    } finally {
      setSubmitting(false);
    }
  }

  const header = (
    <AppHeader title={t.pageTitle} fallbackHref="/family" />
  );

  if (!activePatientId) {
    return (
      <View style={styles.container}>
        {header}
        <EmptyState
          icon="person-outline"
          title={t.noPatientTitle}
          body={t.noPatientText}
          style={styles.centerState}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {header}

      {contextLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : contextError ? (
        <View style={styles.centerState}>
          <View style={styles.errorIcon}>
            <Ionicons name="alert-circle-outline" size={32} color={colors.danger} />
          </View>
          <Text style={styles.stateTitle}>{t.loadFailed}</Text>
          <Text style={styles.stateText}>{contextError}</Text>
        </View>
      ) : caregivers.length === 0 ? (
        <EmptyState
          icon="business-outline"
          title={t.noCaregiverTitle}
          body={t.noCaregiverText}
          style={styles.centerState}
        />
      ) : (
        <KeyboardAwareScroll
          safeAreaBottom={false}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(spacing.xxl, insets.bottom + spacing.xl) },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.field}>
            <Text style={styles.label}>{t.patient}</Text>
            <Card style={styles.infoCard}>
              <View style={styles.infoIcon}>
                <Ionicons name="person-outline" size={22} color={colors.primary} />
              </View>
              <Text style={styles.infoValue}>{patientName || activePatient?.name}</Text>
            </Card>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t.caregiver}</Text>
            <View style={styles.caregiverList}>
              {caregivers.map((caregiver) => {
                const selected = selectedCaregiverUid === caregiver.caregiverUid;
                return (
                  <Pressable
                    key={caregiver.caregiverUid}
                    onPress={() => setSelectedCaregiverUid(caregiver.caregiverUid)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    accessibilityLabel={`${caregiver.caregiverName} ${t.caregiverSuffix}`}
                    style={({ pressed }) => [
                      styles.caregiverCard,
                      selected && styles.optionSelected,
                      pressed && !selected && styles.optionPressed,
                    ]}
                  >
                    <View style={[styles.caregiverIcon, selected && { backgroundColor: colors.primary }]}>
                      <Ionicons name="person" size={20} color={selected ? colors.onPrimary : colors.primary} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.caregiverName}>{caregiver.caregiverName}</Text>
                      <Text style={styles.caregiverRole}>{t.caregiverSuffix}</Text>
                    </View>
                    {selected && <Ionicons name="checkmark-circle" size={24} color={colors.primary} />}
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t.category}</Text>
            <View style={styles.categoryGrid}>
              {categoryOptions.map((item) => {
                const selected = category === item.key;
                return (
                  <Pressable
                    key={item.key}
                    disabled={submitting}
                    onPress={() => setCategory(item.key)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected, disabled: submitting }}
                    style={({ pressed }) => [
                      styles.categoryCard,
                      selected && styles.optionSelected,
                      pressed && !selected && styles.optionPressed,
                    ]}
                  >
                    <View style={[styles.categoryRadio, selected && styles.categoryRadioSelected]}>
                      {selected && <Ionicons name="checkmark" size={15} color={colors.onPrimary} />}
                    </View>
                    <Text style={[styles.categoryText, selected && styles.categoryTextSelected]}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <TextField
            label={t.title}
            value={title}
            onChangeText={setTitle}
            placeholder={t.titlePlaceholder}
            maxLength={200}
          />

          <TextField
            label={t.description}
            value={description}
            onChangeText={setDescription}
            placeholder={t.descriptionPlaceholder}
            maxLength={3000}
            multiline
            inputStyle={styles.descriptionInput}
          />

          <Button
            label={submitting ? t.submitting : t.submit}
            icon="send-outline"
            size="lg"
            fullWidth
            loading={submitting}
            onPress={handleSubmit}
            style={styles.submitButton}
          />
        </KeyboardAwareScroll>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },

  centerState: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: spacing.xl },
  errorIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.dangerSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  stateTitle: { ...typography.header, textAlign: "center" },
  stateText: { ...typography.bodySmall, textAlign: "center", marginTop: spacing.sm, maxWidth: 320 },

  content: {
    padding: layout.screenPaddingX,
    gap: spacing.xl,
    width: "100%",
    maxWidth: layout.maxContentWidth,
    alignSelf: "center",
  },
  field: { gap: spacing.sm },
  label: { ...typography.label },

  infoCard: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  infoValue: { ...typography.bodyStrong, fontSize: 18, flex: 1 },

  caregiverList: { gap: spacing.sm },
  caregiverCard: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  optionPressed: { backgroundColor: colors.surfaceSunken },
  caregiverIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  caregiverName: { ...typography.bodyStrong },
  caregiverRole: { ...typography.caption },

  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  categoryCard: {
    flexGrow: 1,
    flexBasis: "45%",
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  categoryRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.textDisabled,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryRadioSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  categoryText: { ...typography.body, flexShrink: 1 },
  categoryTextSelected: { color: colors.primary, fontWeight: "600" },

  descriptionInput: { minHeight: 160 },
  submitButton: { marginTop: spacing.sm },
});
