import React, { useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/src/auth/useAuth";
import { useActiveCareTarget } from "@/src/care-target/useActiveCareTarget";
import { leaveCareTarget } from "@/src/care-target/careTargetApi";
import { useLanguage } from "@/src/store/LanguageContext";
import { AppAlert } from "@/src/ui/AppAlert";
import { ScreenScrollView } from "@/src/ui/ScreenLayout";

const copy = {
  zh: { title: "解除本人照護關聯", body: "只解除你與這位長者的關聯。藥單、照護紀錄與服務摘要會保留；解除後將無法再讀取或新增該長者資料。重新加入需要家屬邀請與核准。", confirm: "確認解除", cancel: "取消", back: "返回", unavailable: "請先選擇你正在照護的長者。此功能僅供照護員使用。", failed: "解除失敗，請稍後再試。", done: "已解除關聯，共享資料仍保留。", notDeployed: "解除功能後端尚未啟用，資料與關聯未變更。請聯絡管理者。" },
  en: { title: "Leave this care target", body: "Remove only your caregiver membership. Prescriptions, care records and service summaries remain. You will lose access to this patient; rejoining needs a family invitation and approval.", confirm: "Confirm leave", cancel: "Cancel", back: "Back", unavailable: "Select a linked patient. This action is for caregivers only.", failed: "Unable to leave. Try again later.", done: "Membership removed. Shared records remain.", notDeployed: "The leave service is not enabled yet. Membership and records were not changed. Contact the administrator." },
  vi: { title: "Rời đối tượng chăm sóc", body: "Chỉ xóa liên kết của bạn. Đơn thuốc, hồ sơ chăm sóc và tóm tắt dịch vụ được giữ lại. Bạn sẽ mất quyền truy cập; tham gia lại cần lời mời và phê duyệt của gia đình.", confirm: "Xác nhận rời", cancel: "Hủy", back: "Quay lại", unavailable: "Chọn người được chăm sóc. Chỉ dành cho người chăm sóc.", failed: "Không thể rời. Thử lại sau.", done: "Đã hủy liên kết. Hồ sơ chung được giữ lại.", notDeployed: "Dịch vụ chưa được bật. Liên kết và dữ liệu chưa thay đổi. Hãy liên hệ quản trị viên." },
  id: { title: "Keluar dari pasien ini", body: "Hanya hapus hubungan caregiver Anda. Resep, catatan perawatan, dan ringkasan layanan tetap ada. Anda kehilangan akses; bergabung kembali memerlukan undangan dan persetujuan keluarga.", confirm: "Konfirmasi keluar", cancel: "Batal", back: "Kembali", unavailable: "Pilih pasien terkait. Hanya untuk caregiver.", failed: "Tidak dapat keluar. Coba lagi nanti.", done: "Hubungan dihapus. Catatan bersama tetap ada.", notDeployed: "Layanan belum aktif. Hubungan dan data tidak berubah. Hubungi administrator." },
};

export default function LeaveCareTargetScreen() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const t = copy[language];
  const { activePatientId, activePatient, forgetCareTarget } = useActiveCareTarget();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const allowed = user?.role === "caregiver" && !!activePatientId;

  async function leave(patientId: string) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      await leaveCareTarget({ patientId });
      // Membership is already removed. Local storage failure must not imply rollback.
      try { await forgetCareTarget(patientId); } catch { /* memory cleared first */ }
      AppAlert.alert(t.title, t.done, [{ text: t.back, onPress: () => router.replace("/care-target/select") }]);
    } catch (e) {
      const code = (e as {code?: string}).code;
      setError(code === "functions/not-found" ? t.notDeployed : t.failed);
    } finally { lock.current = false; setBusy(false); }
  }

  return <ScreenScrollView contentContainerStyle={{ padding: 24, gap: 20 }}>
    <Pressable disabled={busy} onPress={() => router.back()}><Text>{t.back}</Text></Pressable>
    <Text style={{ fontSize: 26, fontWeight: "800" }}>{t.title}</Text>
    <Text style={{ fontSize: 22, fontWeight: "700" }}>{activePatient?.name}</Text>
    <Text style={{ fontSize: 17, lineHeight: 26 }}>{allowed ? t.body : t.unavailable}</Text>
    {!!error && <Text accessibilityRole="alert" style={{ color: "#B42318" }}>{error}</Text>}
    {allowed && <View><Pressable disabled={busy} style={{ padding: 18, backgroundColor: busy ? "#888" : "#B42318", borderRadius: 12 }} onPress={() => {
      const id = activePatientId;
      if (!id) return;
      AppAlert.alert(t.title, `${activePatient?.name ?? ""}\n\n${t.body}`, [
        { text: t.cancel, style: "cancel" },
        { text: t.confirm, style: "destructive", onPress: () => { void leave(id); } },
      ]);
    }}>{busy ? <ActivityIndicator color="white" /> : <Text style={{ color: "white", fontSize: 18, textAlign: "center" }}>{t.confirm}</Text>}</Pressable></View>}
  </ScreenScrollView>;
}
