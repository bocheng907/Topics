// 檢舉彈窗
// 原型是網頁的絕對定位遮罩，這裡改用 React Native 的 Modal

import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { COMMUNITY_COLORS } from "../theme";
import type { ReportReason } from "../types";

type Props = {
  visible: boolean;
  onClose: () => void;
  /** 送出檢舉；detail 為選「其他」時補充的說明 */
  onSubmit: (reason: ReportReason, detail: string) => void;
  submitting?: boolean;
};

const REASONS: ReportReason[] = [
  "廣告或垃圾訊息",
  "攻擊性言論",
  "醫療謠言或錯誤資訊",
  "涉及個人隱私",
  "其他",
];

/** 檢舉說明長度上限 */
const DETAIL_MAX_LENGTH = 200;

export default function ReportModal({ visible, onClose, onSubmit, submitting = false }: Props) {
  const [selectedReason, setSelectedReason] = useState<ReportReason | "">("");
  const [otherText, setOtherText] = useState("");

  const needsDetail = selectedReason === "其他";
  const canSubmit = selectedReason !== "" && (!needsDetail || otherText.trim() !== "");

  // 彈窗關閉後才清空選擇：送出失敗時彈窗還開著，使用者不必重選
  // （依 React 建議在 render 期間比對前一次的 visible，而不是用 effect）
  const [prevVisible, setPrevVisible] = useState(visible);
  if (prevVisible !== visible) {
    setPrevVisible(visible);
    if (!visible) {
      setSelectedReason("");
      setOtherText("");
    }
  }

  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  const handleSubmit = () => {
    if (!canSubmit || submitting) return;
    onSubmit(selectedReason as ReportReason, otherText.trim());
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      {/* 選「其他」要打字時，避免鍵盤蓋住輸入框與按鈕 */}
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.card}>
          <Text style={styles.title}>檢舉這篇文章</Text>
          <Text style={styles.subtitle}>請選擇檢舉原因：</Text>

          <View style={styles.reasonList}>
            {REASONS.map((reason) => {
              const isSelected = selectedReason === reason;
              return (
                <Pressable
                  key={reason}
                  style={styles.reasonRow}
                  onPress={() => setSelectedReason(reason)}
                  hitSlop={4}
                >
                  <View style={[styles.radio, isSelected && styles.radioSelected]}>
                    {isSelected ? <View style={styles.radioDot} /> : null}
                  </View>
                  <Text style={[styles.reasonText, isSelected && styles.reasonTextSelected]}>
                    {reason}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {needsDetail ? (
            <TextInput
              style={styles.detailInput}
              placeholder="請描述檢舉原因..."
              placeholderTextColor={COMMUNITY_COLORS.textLight}
              value={otherText}
              onChangeText={setOtherText}
              multiline
              textAlignVertical="top"
              maxLength={DETAIL_MAX_LENGTH}
            />
          ) : null}

          <View style={styles.actionRow}>
            <Pressable onPress={handleClose} style={styles.cancelBtn} hitSlop={6}>
              <Text style={styles.cancelText}>取消</Text>
            </Pressable>
            <Pressable
              onPress={handleSubmit}
              disabled={!canSubmit || submitting}
              style={[styles.submitBtn, (!canSubmit || submitting) && styles.submitBtnDisabled]}
            >
              <Text
                style={[
                  styles.submitText,
                  (!canSubmit || submitting) && styles.submitTextDisabled,
                ]}
              >
                {submitting ? "送出中..." : "送出檢舉"}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: COMMUNITY_COLORS.white,
    borderRadius: 20,
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: COMMUNITY_COLORS.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: COMMUNITY_COLORS.textSecondary,
    fontWeight: "500",
    marginBottom: 16,
  },
  reasonList: {
    gap: 2,
  },
  reasonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: {
    borderColor: COMMUNITY_COLORS.danger,
  },
  radioDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: COMMUNITY_COLORS.danger,
  },
  reasonText: {
    fontSize: 17,
    color: "#374151",
  },
  reasonTextSelected: {
    color: COMMUNITY_COLORS.text,
    fontWeight: "600",
  },
  detailInput: {
    marginTop: 8,
    height: 88,
    backgroundColor: COMMUNITY_COLORS.surface,
    borderWidth: 1,
    borderColor: COMMUNITY_COLORS.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: COMMUNITY_COLORS.text,
  },
  actionRow: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 12,
  },
  cancelBtn: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 10,
  },
  cancelText: {
    fontSize: 17,
    fontWeight: "700",
    color: COMMUNITY_COLORS.textSecondary,
  },
  submitBtn: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: COMMUNITY_COLORS.danger,
  },
  submitBtnDisabled: {
    backgroundColor: "#FEE2E2",
  },
  submitText: {
    fontSize: 17,
    fontWeight: "700",
    color: COMMUNITY_COLORS.white,
  },
  submitTextDisabled: {
    color: "#FCA5A5",
  },
});
