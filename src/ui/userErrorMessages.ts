import type { Language } from "@/src/i18n/translations";

// Only approved copy reaches UI. Never fall back to a provider's message.
export const userErrorCopy = {
  zh: {
    credentials: "Email 或密碼不正確，請重新輸入。", invalidEmail: "請輸入有效的 Email。",
    network: "連線失敗，請確認網路後再試。", busy: "服務忙碌或操作過於頻繁，請稍後再試。",
    disabled: "此帳號目前無法使用，請聯絡服務團隊。", login: "目前無法登入，請稍後再試。",
    ocr: "藥單辨識失敗，請確認圖片清晰後重試。", ocrUnavailable: "辨識服務目前無法使用，請稍後再試。",
    permission: "目前沒有操作權限，請確認登入狀態與照護關聯。",
    taskCreate: "無法建立每日任務，請稍後再試。", taskLoad: "無法載入每日任務，請稍後再試。",
    relation: "照護關聯已變更或尚未完成，請重新載入並確認看護與仲介的綁定。",
    account: "帳號狀態異常，請重新登入；若仍無法操作，請聯絡服務團隊。",
    report: "無法送出問題通報，請稍後再試。",
    details: "問題回報資訊", hideDetails: "收起問題回報資訊", detailsHint: "聯絡服務團隊時，可提供下方診斷碼協助查詢。",
  },
  en: {
    credentials: "Email or password is incorrect. Please try again.", invalidEmail: "Enter a valid email address.",
    network: "Connection failed. Check your network and try again.", busy: "The service is busy or there have been too many attempts. Try again later.",
    disabled: "This account is unavailable. Contact the support team.", login: "Unable to sign in right now. Try again later.",
    ocr: "Unable to recognize the prescription. Check that the photo is clear and try again.", ocrUnavailable: "Prescription recognition is unavailable. Try again later.",
    permission: "You do not currently have permission. Check your sign-in and care membership.",
    taskCreate: "Unable to create daily tasks. Try again later.", taskLoad: "Unable to load daily tasks. Try again later.",
    relation: "Care membership has changed or is incomplete. Reload and check the caregiver's agency connection.",
    account: "There is a problem with your account status. Sign in again or contact support.",
    report: "Unable to submit the care report. Try again later.",
    details: "Problem report information", hideDetails: "Hide problem report information", detailsHint: "Provide the diagnostic code below when contacting support.",
  },
  vi: {
    credentials: "Email hoặc mật khẩu không đúng. Vui lòng thử lại.", invalidEmail: "Vui lòng nhập email hợp lệ.",
    network: "Kết nối thất bại. Kiểm tra mạng và thử lại.", busy: "Dịch vụ đang bận hoặc có quá nhiều yêu cầu. Hãy thử lại sau.",
    disabled: "Tài khoản hiện không thể sử dụng. Vui lòng liên hệ hỗ trợ.", login: "Hiện không thể đăng nhập. Hãy thử lại sau.",
    ocr: "Không thể nhận dạng đơn thuốc. Kiểm tra ảnh rõ nét và thử lại.", ocrUnavailable: "Dịch vụ nhận dạng đơn thuốc hiện không khả dụng. Hãy thử lại sau.",
    permission: "Bạn hiện không có quyền thao tác. Kiểm tra đăng nhập và liên kết chăm sóc.",
    taskCreate: "Không thể tạo nhiệm vụ hằng ngày. Hãy thử lại sau.", taskLoad: "Không thể tải nhiệm vụ hằng ngày. Hãy thử lại sau.",
    relation: "Liên kết chăm sóc đã thay đổi hoặc chưa hoàn tất. Tải lại và kiểm tra liên kết với đơn vị quản lý.",
    account: "Trạng thái tài khoản có vấn đề. Đăng nhập lại hoặc liên hệ hỗ trợ.",
    report: "Không thể gửi báo cáo. Hãy thử lại sau.",
    details: "Thông tin báo cáo sự cố", hideDetails: "Ẩn thông tin báo cáo sự cố", detailsHint: "Cung cấp mã chẩn đoán bên dưới khi liên hệ hỗ trợ.",
  },
  id: {
    credentials: "Email atau kata sandi salah. Silakan coba lagi.", invalidEmail: "Masukkan alamat email yang valid.",
    network: "Koneksi gagal. Periksa jaringan dan coba lagi.", busy: "Layanan sibuk atau terlalu banyak percobaan. Coba lagi nanti.",
    disabled: "Akun ini tidak dapat digunakan saat ini. Hubungi tim dukungan.", login: "Tidak dapat masuk saat ini. Coba lagi nanti.",
    ocr: "Resep tidak dapat dikenali. Pastikan foto jelas dan coba lagi.", ocrUnavailable: "Layanan pengenalan resep tidak tersedia. Coba lagi nanti.",
    permission: "Anda tidak memiliki izin saat ini. Periksa status masuk dan hubungan perawatan.",
    taskCreate: "Tidak dapat membuat tugas harian. Coba lagi nanti.", taskLoad: "Tidak dapat memuat tugas harian. Coba lagi nanti.",
    relation: "Hubungan perawatan berubah atau belum lengkap. Muat ulang dan periksa hubungan pengasuh dengan agensi.",
    account: "Ada masalah dengan status akun. Masuk kembali atau hubungi dukungan.",
    report: "Tidak dapat mengirim laporan. Coba lagi nanti.",
    details: "Informasi laporan masalah", hideDetails: "Sembunyikan informasi laporan masalah", detailsHint: "Berikan kode diagnostik di bawah saat menghubungi dukungan.",
  },
};

export function userErrorMessage(error: unknown, context: "login" | "ocr" | "report", language: Language): string {
  const t = userErrorCopy[language];
  const e = error && typeof error === "object" ? error as { code?: unknown; message?: unknown } : {};
  const code = e.code;
  if (code === "auth/network-request-failed" || code === "ocr/network" || code === "functions/unavailable" || code === "functions/deadline-exceeded" || code === "storage/retry-limit-exceeded") return t.network;
  if (code === "auth/too-many-requests" || code === "ocr/busy" || code === "functions/resource-exhausted") return t.busy;
  if (context === "login") {
    if (["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found", "auth/invalid-login-credentials"].includes(String(code))) return t.credentials;
    if (code === "auth/invalid-email") return t.invalidEmail;
    if (code === "auth/user-disabled") return t.disabled;
  }
  if (context === "ocr") {
    if (code === "ocr/unavailable") return t.ocrUnavailable;
    if (code === "storage/unauthorized" || code === "storage/unauthenticated") return t.permission;
  }
  if (context === "report") {
    if (code === "functions/unauthenticated" || (code === "functions/permission-denied" && e.message === "Active account required.")) return t.account;
    if (code === "functions/failed-precondition" || (code === "functions/permission-denied" && e.message === "Membership changed.")) return t.relation;
    if (code === "functions/permission-denied") return t.permission;
  }
  return t[context];
}
