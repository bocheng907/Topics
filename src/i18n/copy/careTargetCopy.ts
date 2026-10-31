// UI copy for app/care-target/* screens that is not already in translations.ts
// or src/care-target/invitationCopy.ts.
import type { Language } from "@/src/i18n/translations";

const zh = {
  // leave (moved from app/care-target/leave.tsx)
  leaveTitle: "解除本人照護關聯",
  leaveBody: "只解除你與這位長者的關聯。藥單、照護紀錄與服務摘要會保留；解除後將無法再讀取或新增該長者資料。重新加入需要家屬邀請與核准。",
  leaveConfirm: "確認解除",
  cancel: "取消",
  back: "返回",
  leaveUnavailable: "請先選擇你正在照護的長者。此功能僅供照護員使用。",
  leaveFailed: "解除失敗，請稍後再試。",
  leaveDone: "已解除關聯，共享資料仍保留。",
  leaveNotDeployed: "解除功能後端尚未啟用，資料與關聯未變更。請聯絡管理者。",

  // shared labels
  careTarget: "照護對象",
  yourRole: "你的身分",
  orDivider: "或",
  createSection: "建立新的照護對象",
  createHint: "建立後你會成為主要家屬，並取得一組邀請碼給其他家人或照護員。",
  joinSection: "已經有邀請碼？",
  copyCode: "複製邀請碼",
  copied: "已複製邀請碼",
  inviteSection: "目前邀請碼",
  pendingSection: "待核准申請",
  dangerSection: "管理動作",
};

export type CareTargetCopy = typeof zh;

const en: CareTargetCopy = {
  leaveTitle: "Leave this care recipient",
  leaveBody: "Only your caregiver link is removed. Prescriptions, care records and service summaries remain. You will lose access to this person; rejoining needs a family invitation and approval.",
  leaveConfirm: "Confirm leave",
  cancel: "Cancel",
  back: "Back",
  leaveUnavailable: "Select the person you care for first. This action is for caregivers only.",
  leaveFailed: "Could not leave. Please try again later.",
  leaveDone: "Link removed. Shared records remain.",
  leaveNotDeployed: "The leave service is not enabled yet. Your link and records were not changed. Please contact the administrator.",

  careTarget: "Care recipient",
  yourRole: "Your role",
  orDivider: "or",
  createSection: "Create a new care recipient",
  createHint: "You will become the primary family member and get an invite code for other family members or caregivers.",
  joinSection: "Already have an invite code?",
  copyCode: "Copy invite code",
  copied: "Invite code copied",
  inviteSection: "Current invite code",
  pendingSection: "Pending application",
  dangerSection: "Management actions",
};

const vi: CareTargetCopy = {
  leaveTitle: "Rời người được chăm sóc",
  leaveBody: "Chỉ xóa liên kết người chăm sóc của bạn. Đơn thuốc, hồ sơ chăm sóc và tóm tắt dịch vụ vẫn được giữ lại. Bạn sẽ không xem được hồ sơ người này nữa; muốn tham gia lại cần gia đình mời và duyệt.",
  leaveConfirm: "Xác nhận rời",
  cancel: "Hủy",
  back: "Quay lại",
  leaveUnavailable: "Hãy chọn người bạn đang chăm sóc trước. Chức năng này chỉ dành cho người chăm sóc.",
  leaveFailed: "Không thể rời. Vui lòng thử lại sau.",
  leaveDone: "Đã hủy liên kết. Hồ sơ chung vẫn được giữ lại.",
  leaveNotDeployed: "Dịch vụ này chưa được bật. Liên kết và dữ liệu chưa thay đổi. Hãy liên hệ quản trị viên.",

  careTarget: "Người được chăm sóc",
  yourRole: "Vai trò của bạn",
  orDivider: "hoặc",
  createSection: "Tạo hồ sơ người được chăm sóc",
  createHint: "Bạn sẽ trở thành người nhà chính và nhận mã mời để gửi cho người thân hoặc người chăm sóc.",
  joinSection: "Đã có mã mời?",
  copyCode: "Sao chép mã mời",
  copied: "Đã sao chép mã mời",
  inviteSection: "Mã mời hiện tại",
  pendingSection: "Đơn chờ duyệt",
  dangerSection: "Thao tác quản lý",
};

const id: CareTargetCopy = {
  leaveTitle: "Keluar dari penerima perawatan ini",
  leaveBody: "Hanya hubungan perawat Anda yang dihapus. Resep, catatan perawatan, dan ringkasan layanan tetap tersimpan. Anda tidak bisa lagi mengakses data orang ini; untuk bergabung lagi perlu undangan dan persetujuan keluarga.",
  leaveConfirm: "Konfirmasi keluar",
  cancel: "Batal",
  back: "Kembali",
  leaveUnavailable: "Pilih dulu orang yang Anda rawat. Fitur ini hanya untuk perawat.",
  leaveFailed: "Gagal keluar. Silakan coba lagi nanti.",
  leaveDone: "Hubungan dihapus. Catatan bersama tetap tersimpan.",
  leaveNotDeployed: "Layanan ini belum aktif. Hubungan dan data tidak berubah. Silakan hubungi administrator.",

  careTarget: "Penerima perawatan",
  yourRole: "Peran Anda",
  orDivider: "atau",
  createSection: "Buat penerima perawatan baru",
  createHint: "Anda akan menjadi keluarga utama dan mendapat kode undangan untuk anggota keluarga atau perawat lain.",
  joinSection: "Sudah punya kode undangan?",
  copyCode: "Salin kode undangan",
  copied: "Kode undangan disalin",
  inviteSection: "Kode undangan saat ini",
  pendingSection: "Permohonan menunggu",
  dangerSection: "Tindakan pengelolaan",
};

export const careTargetCopy: Record<Language, CareTargetCopy> = { zh, en, vi, id };
