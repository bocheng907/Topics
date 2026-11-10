import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import type { SnapshotStatus } from "@/src/data/useScopedSnapshot";
import { translations, type Language } from "@/src/i18n/translations";
import { colors, spacing, typography } from "../theme";
import { Button } from "./Button";

const copy: Record<Language, { cached: string; failed: string; retry: string }> = {
  zh: { cached: "顯示暫存資料，正在確認更新。", failed: "無法更新資料，請檢查網路後重試。", retry: "重新載入" },
  en: { cached: "Showing cached data while checking for updates.", failed: "Could not update the data. Check your connection and try again.", retry: "Reload" },
  vi: { cached: "Đang hiển thị dữ liệu đã lưu và kiểm tra cập nhật.", failed: "Không cập nhật được dữ liệu. Hãy kiểm tra kết nối và thử lại.", retry: "Tải lại" },
  id: { cached: "Menampilkan data tersimpan sambil memeriksa pembaruan.", failed: "Data tidak dapat diperbarui. Periksa koneksi lalu coba lagi.", retry: "Muat ulang" },
};

export function DataLoadFeedback({ status, language, retry, idleText }: {
  status: SnapshotStatus; language: Language; retry: () => void; idleText?: string;
}) {
  if (status === "ready") return null;
  return <View style={styles.container} accessibilityLiveRegion="polite">
    {status === "loading" || status === "cached" ? <ActivityIndicator color={colors.primary} /> : null}
    <Text style={styles.text}>{status === "loading" ? translations[language].loading : status === "cached" ? copy[language].cached : status === "error" ? copy[language].failed : idleText ?? translations[language].noSelectedPatient}</Text>
    {status === "error" ? <Button label={copy[language].retry} variant="ghost" onPress={retry} /> : null}
  </View>;
}

const styles = StyleSheet.create({
  container: { alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.lg },
  text: { ...typography.bodySmall, textAlign: "center", color: colors.textSecondary },
});
