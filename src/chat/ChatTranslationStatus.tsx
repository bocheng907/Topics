import React from "react";
import { Pressable, Text, View } from "react-native";
import type { Language } from "../i18n/translations";

export const chatTranslationCopy = {
  zh: { pending: "正在翻譯訊息…", failed: "部分訊息暫時無法翻譯，已保留原文。", retry: "重試翻譯", photo: "[照片]" },
  en: { pending: "Translating messages…", failed: "Some messages could not be translated. Original text is shown.", retry: "Retry translation", photo: "[Photo]" },
  vi: { pending: "Đang dịch tin nhắn…", failed: "Một số tin nhắn chưa dịch được. Đang hiển thị bản gốc.", retry: "Thử dịch lại", photo: "[Ảnh]" },
  id: { pending: "Menerjemahkan pesan…", failed: "Sebagian pesan belum dapat diterjemahkan. Teks asli ditampilkan.", retry: "Coba terjemahkan lagi", photo: "[Foto]" },
};

export function ChatTranslationStatus({ language, pending, failed, retry }: {
  language: Language; pending: boolean; failed: boolean; retry: () => void;
}) {
  if (!pending && !failed) return null;
  const copy = chatTranslationCopy[language];
  return <View style={{ padding: 12, backgroundColor: "#F2F2F7", flexShrink: 0 }}>
    <Text accessibilityLiveRegion="polite" style={{ color: "#41415A", fontSize: 14 }}>{failed ? copy.failed : copy.pending}</Text>
    {failed && <Pressable accessibilityRole="button" onPress={retry} style={{ paddingVertical: 12 }}>
      <Text style={{ color: "#4338A0", fontWeight: "700" }}>{copy.retry}</Text>
    </Pressable>}
  </View>;
}
