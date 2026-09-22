export const PRIVACY_POLICY_VERSION = "2026-09-12.v1";
export const PRIVACY_POLICY_URL = "https://smart-care-system-1a41e.web.app/privacy/2026-09-12-v1";

export type PrivacyConsent = { accepted: boolean; version: string };

export function assertPrivacyConsent(consent?: PrivacyConsent): void {
  if (consent?.accepted !== true || consent.version !== PRIVACY_POLICY_VERSION) {
    throw Object.assign(new Error("Please read and agree to the current privacy policy."), {
      code: "privacy/consent-required",
    });
  }
}

export const privacyCopy = {
  zh: {
    link: "閱讀隱私權政策（繁體中文）",
    consent: "我已閱讀隱私權政策，並同意其中明確列出的帳號及服務必要資料處理事項。",
    required: "請先閱讀並勾選同意隱私權政策，才能註冊。",
    openFailed: "無法開啟政策頁，請稍後再試。",
    scope: "此同意不代表其他當事人同意，也不取代健康資料及 AI 處理所需的個別告知與合法依據。",
  },
  en: {
    link: "Read Privacy Policy (Traditional Chinese)",
    consent: "I have read the Privacy Policy and agree to the account and essential service data processing explicitly described in it.",
    required: "Please read and agree to the Privacy Policy before registering.",
    openFailed: "Unable to open the policy. Please try again later.",
    scope: "This does not represent consent from other people or replace the notices and legal basis required for health data and AI processing.",
  },
  vi: {
    link: "Đọc chính sách quyền riêng tư (tiếng Trung phồn thể)",
    consent: "Tôi đã đọc chính sách quyền riêng tư và đồng ý với việc xử lý dữ liệu tài khoản và dữ liệu cần thiết cho dịch vụ được nêu rõ trong chính sách.",
    required: "Vui lòng đọc và đồng ý với chính sách quyền riêng tư trước khi đăng ký.",
    openFailed: "Không thể mở chính sách. Vui lòng thử lại sau.",
    scope: "Sự đồng ý này không thay thế sự đồng ý của người khác hoặc các thông báo và cơ sở pháp lý cần thiết cho dữ liệu sức khỏe và xử lý AI.",
  },
  id: {
    link: "Baca Kebijakan Privasi (bahasa Mandarin tradisional)",
    consent: "Saya telah membaca Kebijakan Privasi dan menyetujui pemrosesan data akun dan layanan esensial yang dijelaskan secara tegas di dalamnya.",
    required: "Harap baca dan setujui Kebijakan Privasi sebelum mendaftar.",
    openFailed: "Kebijakan tidak dapat dibuka. Silakan coba lagi nanti.",
    scope: "Persetujuan ini tidak mewakili orang lain atau menggantikan pemberitahuan dan dasar hukum yang diperlukan untuk data kesehatan dan pemrosesan AI.",
  },
};
