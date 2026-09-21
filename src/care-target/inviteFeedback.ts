export const inviteFeedback = {
  zh: { revoked: "邀請碼已撤銷，請向主要家屬索取新碼。", used: "邀請碼已使用，請向主要家屬索取新碼。", askPrimary: "請主要家屬掃描並新增藥單。" },
  en: { revoked: "This invite code was revoked. Ask the primary family member for a new code.", used: "This invite code has been used. Ask the primary family member for a new code.", askPrimary: "Ask the primary family member to scan and add a prescription." },
  vi: { revoked: "Mã mời đã bị thu hồi. Hãy xin mã mới từ người nhà chính.", used: "Mã mời đã được sử dụng. Hãy xin mã mới từ người nhà chính.", askPrimary: "Hãy nhờ người nhà chính quét và thêm đơn thuốc." },
  id: { revoked: "Kode undangan telah dicabut. Minta kode baru kepada keluarga utama.", used: "Kode undangan telah digunakan. Minta kode baru kepada keluarga utama.", askPrimary: "Minta keluarga utama memindai dan menambahkan resep." },
};

export function inviteErrorMessage(error: { details?: { reason?: string } }, language: keyof typeof inviteFeedback, fallback: string, expired: string): string {
  switch (error?.details?.reason) {
    case "revoked": return inviteFeedback[language].revoked;
    case "used": return inviteFeedback[language].used;
    case "expired": return expired;
    default: return fallback;
  }
}
