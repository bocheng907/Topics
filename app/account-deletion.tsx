import { auth, functions } from "@/firebase/firebaseConfig";
import { signOut } from "@/src/auth/auditSession";
import { useAuth } from "@/src/auth/useAuth";
import { useLanguage } from "@/src/store/LanguageContext";
import { router } from "expo-router";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const copy = {
  zh: {
    title: "刪除帳號",
    pendingTitle: "帳號已排定刪除",
    warning: "重新驗證後，帳號會進入 30 天緩衝期並立即登出。到期後將刪除帳號、個人資料與本人建立或上傳的內容；其他成員的共享照護資料會保留。",
    pending: "在刪除日前可重新驗證並取消。緩衝期內登入只會看到此頁。",
    scheduled: "預計刪除時間",
    password: "請輸入目前密碼以重新驗證",
    request: "確認申請刪除",
    cancelDeletion: "取消帳號刪除",
    back: "返回",
    authFailed: "重新驗證失敗，請確認密碼後再試。",
    requestDone: "刪除申請已建立，帳號將在 30 天後刪除。",
    cancelDone: "已取消帳號刪除，請重新登入。",
    failed: "操作失敗，請稍後再試。",
  },
  en: {
    title: "Delete account", pendingTitle: "Account scheduled for deletion",
    warning: "After verification, your account enters a 30-day grace period and you are signed out. Your account, personal data, and uploaded media are then deleted. Shared care data remains available to other members.",
    pending: "You can verify again and cancel before the deletion date. During the grace period, sign-in only opens this page.",
    scheduled: "Scheduled deletion", password: "Enter your current password",
    request: "Schedule account deletion", cancelDeletion: "Cancel deletion",
    back: "Back", authFailed: "Verification failed. Check your password.",
    requestDone: "Deletion scheduled for 30 days from now.",
    cancelDone: "Deletion cancelled. Please sign in again.",
    failed: "The operation failed. Please try again.",
  },
  vi: {
    title: "Xóa tài khoản", pendingTitle: "Tài khoản đã được lên lịch xóa",
    warning: "Sau khi xác minh, tài khoản sẽ có thời gian chờ 30 ngày và bạn sẽ đăng xuất. Sau đó tài khoản, dữ liệu cá nhân và tệp tải lên sẽ bị xóa; dữ liệu chăm sóc dùng chung vẫn được giữ lại.",
    pending: "Bạn có thể xác minh lại và hủy trước ngày xóa.",
    scheduled: "Thời gian dự kiến xóa", password: "Nhập mật khẩu hiện tại",
    request: "Xác nhận xóa tài khoản", cancelDeletion: "Hủy xóa tài khoản",
    back: "Quay lại", authFailed: "Xác minh thất bại. Vui lòng kiểm tra mật khẩu.",
    requestDone: "Đã lên lịch xóa tài khoản sau 30 ngày.",
    cancelDone: "Đã hủy xóa. Vui lòng đăng nhập lại.",
    failed: "Thao tác thất bại. Vui lòng thử lại.",
  },
  id: {
    title: "Hapus akun", pendingTitle: "Akun dijadwalkan untuk dihapus",
    warning: "Setelah verifikasi, akun masuk masa tenggang 30 hari dan Anda akan keluar. Setelah itu akun, data pribadi, dan media unggahan dihapus; data perawatan bersama tetap tersedia bagi anggota lain.",
    pending: "Anda dapat memverifikasi ulang dan membatalkan sebelum tanggal penghapusan.",
    scheduled: "Jadwal penghapusan", password: "Masukkan kata sandi saat ini",
    request: "Jadwalkan penghapusan", cancelDeletion: "Batalkan penghapusan",
    back: "Kembali", authFailed: "Verifikasi gagal. Periksa kata sandi Anda.",
    requestDone: "Penghapusan dijadwalkan 30 hari dari sekarang.",
    cancelDone: "Penghapusan dibatalkan. Silakan masuk kembali.",
    failed: "Operasi gagal. Silakan coba lagi.",
  },
};

export default function AccountDeletionScreen() {
  const {user} = useAuth();
  const {language} = useLanguage();
  const t = copy[language];
  const pending = user?.accountStatus === "pending_deletion";
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const scheduled = useMemo(() => user?.deletionScheduledFor?.toLocaleString(),
    [user?.deletionScheduledFor]);

  async function reauthenticate() {
    const currentUser = auth.currentUser;
    if (!currentUser?.email || !password) throw new Error("missing-credential");
    const credential = EmailAuthProvider.credential(currentUser.email, password);
    await reauthenticateWithCredential(currentUser, credential);
    await currentUser.getIdToken(true);
  }

  async function submit() {
    setBusy(true);
    try {
      await reauthenticate();
      const callableName = pending ?
        "cancelAccountDeletion" : "requestAccountDeletion";
      await httpsCallable(functions, callableName)({});
      await signOut(auth);
      Alert.alert("", pending ? t.cancelDone : t.requestDone, [
        {text: "OK", onPress: () => router.replace("/(auth)/login")},
      ]);
    } catch (error: any) {
      const isAuthError = String(error?.code || "").startsWith("auth/") ||
        error?.message === "missing-credential";
      Alert.alert("", isAuthError ? t.authFailed : t.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{pending ? t.pendingTitle : t.title}</Text>
        <View style={styles.warningBox}>
          <Text style={styles.warningText}>{pending ? t.pending : t.warning}</Text>
          {pending && scheduled ? (
            <Text style={styles.scheduled}>{t.scheduled}：{scheduled}</Text>
          ) : null}
        </View>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder={t.password}
          secureTextEntry
          autoCapitalize="none"
          editable={!busy}
          style={styles.input}
        />
        <Pressable
          onPress={submit}
          disabled={busy || !password}
          style={[styles.primary, (busy || !password) && styles.disabled]}
        >
          {busy ? <ActivityIndicator color="#fff" /> : (
            <Text style={styles.primaryText}>
              {pending ? t.cancelDeletion : t.request}
            </Text>
          )}
        </Pressable>
        {!pending ? (
          <Pressable onPress={() => router.back()} style={styles.back}>
            <Text style={styles.backText}>{t.back}</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {flex: 1, backgroundColor: "#fff"},
  content: {padding: 24, paddingTop: 72, gap: 20},
  title: {fontSize: 28, fontWeight: "900", color: "#161616"},
  warningBox: {backgroundColor: "#FFF1F1", borderColor: "#E33B3B",
    borderWidth: 1, borderRadius: 12, padding: 16, gap: 12},
  warningText: {fontSize: 16, lineHeight: 24, color: "#6B1F1F"},
  scheduled: {fontSize: 16, fontWeight: "800", color: "#8B1D1D"},
  input: {borderWidth: 1, borderColor: "#B8B8B8", borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 14, fontSize: 16},
  primary: {backgroundColor: "#C92A2A", minHeight: 52, borderRadius: 10,
    alignItems: "center", justifyContent: "center", paddingHorizontal: 16},
  disabled: {opacity: 0.45},
  primaryText: {color: "#fff", fontSize: 17, fontWeight: "800"},
  back: {minHeight: 48, alignItems: "center", justifyContent: "center"},
  backText: {fontSize: 16, color: "#444", fontWeight: "700"},
});
