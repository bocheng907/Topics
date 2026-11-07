// src/i18n/copy/familyCopy.ts
// UI copy for the family-role screens (app/family/*). Use: familyCopy[language].
import type { Language } from "@/src/i18n/translations";

type FamilyCopy = {
  // Home: vitals dashboard
  vitalsTitle: string;
  statusNormal: string;
  statusAbnormal: string;
  statusOutdated: string;
  statusNoData: string;
  abnormalAlert: (count: number) => string;
  justNow: string;
  minutesAgo: (n: number) => string;
  hoursAgo: (n: number) => string;
  daysAgo: (n: number) => string;
  quickActions: string;
  careTargets: string;
  addCareTarget: string;
  switchCareTarget: (name: string) => string;
  // Dashboard chart ranges
  range1w: string;
  range2w: string;
  range1m: string;
  rangeAll: string;
  // Prescription list
  currentMedication: string;
  medicationCount: (n: number) => string;
  medicationWarning: string;
  medicationData: string;
  aiSupplement: string;
  aiMedicationWarning: string;
  recordCount: (n: number) => string;
  // Medication detail
  notProvided: string;
  medicationRecordCount: (n: number) => string;
  drugNamePlaceholder: string;
  dosageLabel: string;
  usageMethodLabel: string;
  usageTimeLabel: string;
  memoLabel: string;
  noMedicationRecords: string;
  // Prescription detail
  clinicLabel: string;
  departmentLabel: string;
  // Prescription edit
  prescriptionBasicInfo: string;
  clinicField: string;
  clinicPlaceholder: string;
  departmentPlaceholder: string;
  feedingTimes: string;
  feedingTimesPlaceholder: string;
  feedingTimesHelper: string;
  // Shared
  retry: string;
};

export const familyCopy: Record<Language, FamilyCopy> = {
  zh: {
    vitalsTitle: "健康數據",
    statusNormal: "正常",
    statusAbnormal: "異常",
    statusOutdated: "未更新",
    statusNoData: "尚無資料",
    abnormalAlert: (n) => `${n} 項數據異常，請留意`,
    justNow: "剛剛",
    minutesAgo: (n) => `${n} 分鐘前`,
    hoursAgo: (n) => `${n} 小時前`,
    daysAgo: (n) => `${n} 天前`,
    quickActions: "常用功能",
    careTargets: "照護對象",
    addCareTarget: "新增照護對象",
    switchCareTarget: (name) => `切換到 ${name}`,
    range1w: "1 週",
    range2w: "2 週",
    range1m: "1 個月",
    rangeAll: "全部",
    currentMedication: "目前持續服用中",
    medicationCount: (n) => `共 ${n} 種藥物`,
    medicationWarning: "用藥資訊僅供參考，請以醫師或藥師指示為準",
    medicationData: "藥單資料",
    aiSupplement: "AI 補充",
    aiMedicationWarning: "此資訊僅供參考，請勿自行停藥或更改用藥",
    recordCount: (n) => `共 ${n} 筆紀錄`,
    notProvided: "未提供",
    medicationRecordCount: (n) => `共 ${n} 筆用藥紀錄`,
    drugNamePlaceholder: "藥品名稱",
    dosageLabel: "用法劑量",
    usageMethodLabel: "使用方式",
    usageTimeLabel: "服用時段",
    memoLabel: "備註",
    noMedicationRecords: "目前沒有用藥紀錄",
    clinicLabel: "診所",
    departmentLabel: "科別",
    prescriptionBasicInfo: "藥單基本資訊",
    clinicField: "診所／醫療機構",
    clinicPlaceholder: "請輸入診所或醫療機構名稱",
    departmentPlaceholder: "請輸入科別",
    feedingTimes: "自訂餵藥時間",
    feedingTimesPlaceholder: "例如 08:30, 13:00, 19:30",
    feedingTimesHelper: "可輸入多個時間，以逗號分隔；未設定時沿用藥單自動判斷的時間。",
    retry: "重試",
  },
  en: {
    vitalsTitle: "Vital signs",
    statusNormal: "Normal",
    statusAbnormal: "Abnormal",
    statusOutdated: "Not updated",
    statusNoData: "No data yet",
    abnormalAlert: (n) => (n === 1 ? "1 reading is abnormal. Please check." : `${n} readings are abnormal. Please check.`),
    justNow: "Just now",
    minutesAgo: (n) => (n === 1 ? "1 min ago" : `${n} min ago`),
    hoursAgo: (n) => (n === 1 ? "1 hour ago" : `${n} hours ago`),
    daysAgo: (n) => (n === 1 ? "1 day ago" : `${n} days ago`),
    quickActions: "Quick actions",
    careTargets: "Care recipients",
    addCareTarget: "Add care recipient",
    switchCareTarget: (name) => `Switch to ${name}`,
    range1w: "1 week",
    range2w: "2 weeks",
    range1m: "1 month",
    rangeAll: "All",
    currentMedication: "Currently taking",
    medicationCount: (n) => (n === 1 ? "1 medication" : `${n} medications`),
    medicationWarning: "Medication information is for reference only. Follow your doctor or pharmacist.",
    medicationData: "Prescription data",
    aiSupplement: "AI supplement",
    aiMedicationWarning: "For reference only. Do not stop or change medication on your own.",
    recordCount: (n) => (n === 1 ? "1 record" : `${n} records`),
    notProvided: "Not provided",
    medicationRecordCount: (n) => (n === 1 ? "1 medication record" : `${n} medication records`),
    drugNamePlaceholder: "Medication name",
    dosageLabel: "Dosage",
    usageMethodLabel: "How to take",
    usageTimeLabel: "When to take",
    memoLabel: "Notes",
    noMedicationRecords: "No medication records yet",
    clinicLabel: "Clinic",
    departmentLabel: "Department",
    prescriptionBasicInfo: "Prescription details",
    clinicField: "Clinic / medical facility",
    clinicPlaceholder: "Enter the clinic or facility name",
    departmentPlaceholder: "Enter the department",
    feedingTimes: "Custom medication times",
    feedingTimesPlaceholder: "e.g. 08:30, 13:00, 19:30",
    feedingTimesHelper: "Separate multiple times with commas. If empty, times detected from the prescription are used.",
    retry: "Retry",
  },
  vi: {
    vitalsTitle: "Chỉ số sức khỏe",
    statusNormal: "Bình thường",
    statusAbnormal: "Bất thường",
    statusOutdated: "Chưa cập nhật",
    statusNoData: "Chưa có dữ liệu",
    abnormalAlert: (n) => `${n} chỉ số bất thường, vui lòng lưu ý`,
    justNow: "Vừa xong",
    minutesAgo: (n) => `${n} phút trước`,
    hoursAgo: (n) => `${n} giờ trước`,
    daysAgo: (n) => `${n} ngày trước`,
    quickActions: "Chức năng thường dùng",
    careTargets: "Người được chăm sóc",
    addCareTarget: "Thêm người được chăm sóc",
    switchCareTarget: (name) => `Chuyển sang ${name}`,
    range1w: "1 tuần",
    range2w: "2 tuần",
    range1m: "1 tháng",
    rangeAll: "Tất cả",
    currentMedication: "Đang sử dụng",
    medicationCount: (n) => `${n} loại thuốc`,
    medicationWarning: "Thông tin thuốc chỉ để tham khảo, vui lòng làm theo chỉ dẫn của bác sĩ hoặc dược sĩ.",
    medicationData: "Dữ liệu đơn thuốc",
    aiSupplement: "AI bổ sung",
    aiMedicationWarning: "Chỉ để tham khảo, không tự ý ngừng hoặc thay đổi thuốc.",
    recordCount: (n) => `${n} bản ghi`,
    notProvided: "Chưa cung cấp",
    medicationRecordCount: (n) => `${n} bản ghi dùng thuốc`,
    drugNamePlaceholder: "Tên thuốc",
    dosageLabel: "Liều dùng",
    usageMethodLabel: "Cách dùng",
    usageTimeLabel: "Thời điểm uống",
    memoLabel: "Ghi chú",
    noMedicationRecords: "Chưa có bản ghi dùng thuốc",
    clinicLabel: "Phòng khám",
    departmentLabel: "Khoa",
    prescriptionBasicInfo: "Thông tin đơn thuốc",
    clinicField: "Phòng khám / cơ sở y tế",
    clinicPlaceholder: "Nhập tên phòng khám hoặc cơ sở y tế",
    departmentPlaceholder: "Nhập khoa",
    feedingTimes: "Giờ cho uống thuốc tùy chỉnh",
    feedingTimesPlaceholder: "Ví dụ 08:30, 13:00, 19:30",
    feedingTimesHelper: "Có thể nhập nhiều giờ, cách nhau bằng dấu phẩy. Nếu để trống sẽ dùng giờ tự nhận diện từ đơn thuốc.",
    retry: "Thử lại",
  },
  id: {
    vitalsTitle: "Data kesehatan",
    statusNormal: "Normal",
    statusAbnormal: "Tidak normal",
    statusOutdated: "Belum diperbarui",
    statusNoData: "Belum ada data",
    abnormalAlert: (n) => `${n} data tidak normal, mohon diperhatikan`,
    justNow: "Baru saja",
    minutesAgo: (n) => `${n} menit lalu`,
    hoursAgo: (n) => `${n} jam lalu`,
    daysAgo: (n) => `${n} hari lalu`,
    quickActions: "Fitur utama",
    careTargets: "Penerima perawatan",
    addCareTarget: "Tambah penerima perawatan",
    switchCareTarget: (name) => `Beralih ke ${name}`,
    range1w: "1 minggu",
    range2w: "2 minggu",
    range1m: "1 bulan",
    rangeAll: "Semua",
    currentMedication: "Sedang dikonsumsi",
    medicationCount: (n) => `${n} jenis obat`,
    medicationWarning: "Informasi obat hanya sebagai referensi. Ikuti petunjuk dokter atau apoteker.",
    medicationData: "Data resep",
    aiSupplement: "Tambahan AI",
    aiMedicationWarning: "Hanya referensi. Jangan menghentikan atau mengubah obat sendiri.",
    recordCount: (n) => `${n} catatan`,
    notProvided: "Tidak tersedia",
    medicationRecordCount: (n) => `${n} catatan obat`,
    drugNamePlaceholder: "Nama obat",
    dosageLabel: "Dosis",
    usageMethodLabel: "Cara pakai",
    usageTimeLabel: "Waktu minum",
    memoLabel: "Catatan",
    noMedicationRecords: "Belum ada catatan obat",
    clinicLabel: "Klinik",
    departmentLabel: "Poli",
    prescriptionBasicInfo: "Informasi resep",
    clinicField: "Klinik / fasilitas kesehatan",
    clinicPlaceholder: "Masukkan nama klinik atau fasilitas kesehatan",
    departmentPlaceholder: "Masukkan poli",
    feedingTimes: "Waktu minum obat khusus",
    feedingTimesPlaceholder: "Contoh 08:30, 13:00, 19:30",
    feedingTimesHelper: "Pisahkan beberapa waktu dengan koma. Jika kosong, waktu dari resep akan digunakan.",
    retry: "Coba lagi",
  },
};

/** Relative "x hours ago" label from an existing timestamp (ms). */
export function relativeTimeLabel(copy: FamilyCopy, ts: number, now: number) {
  const diff = Math.max(0, now - ts);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return copy.justNow;
  if (minutes < 60) return copy.minutesAgo(minutes);
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return copy.hoursAgo(hours);
  return copy.daysAgo(Math.floor(hours / 24));
}
