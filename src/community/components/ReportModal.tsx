// 檢舉彈窗
// 使用共用 FormSheet（底部表單，鍵盤彈出時自動上推），原因以單選列表呈現

import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { communityCopy, communityReasonLabel } from "@/src/i18n/copy/communityCopy";
import { useLanguage } from "@/src/store/LanguageContext";
import { Button, FormSheet, TextField } from "@/src/ui/components";
import { colors, radii, spacing, typography } from "@/src/ui/theme";
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
  const { language } = useLanguage();
  const c = communityCopy[language];
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
    <FormSheet
      visible={visible}
      title={c.reportTitle}
      onCancel={handleClose}
      cancelLabel={c.cancel}
      footer={
        <Button
          label={submitting ? c.submitting : c.submitReport}
          variant="danger"
          size="lg"
          fullWidth
          loading={submitting}
          disabled={!canSubmit || submitting}
          onPress={handleSubmit}
        />
      }
    >
      <Text style={styles.subtitle}>{c.reportSubtitle}</Text>

      <View style={styles.reasonList} accessibilityRole="radiogroup">
        {REASONS.map((reason, index) => {
          const isSelected = selectedReason === reason;
          return (
            <Pressable
              key={reason}
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected }}
              style={({ pressed }) => [
                styles.reasonRow,
                index > 0 && styles.reasonDivider,
                pressed && styles.reasonPressed,
              ]}
              onPress={() => setSelectedReason(reason)}
            >
              <Ionicons
                name={isSelected ? "radio-button-on" : "radio-button-off"}
                size={24}
                color={isSelected ? colors.primary : colors.textDisabled}
              />
              <Text style={[styles.reasonText, isSelected && styles.reasonTextSelected]}>
                {communityReasonLabel(c, reason)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {needsDetail ? (
        <TextField
          placeholder={c.reportDetailPlaceholder}
          accessibilityLabel={c.reportDetailPlaceholder}
          value={otherText}
          onChangeText={setOtherText}
          multiline
          maxLength={DETAIL_MAX_LENGTH}
          helper={`${otherText.length} / ${DETAIL_MAX_LENGTH}`}
          inputStyle={styles.detailInput}
          autoFocus
        />
      ) : null}
    </FormSheet>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    ...typography.bodySmall,
  },
  reasonList: {
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  reasonRow: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
  },
  reasonDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  reasonPressed: {
    backgroundColor: colors.surfaceSunken,
  },
  reasonText: {
    ...typography.body,
    flex: 1,
  },
  reasonTextSelected: {
    fontWeight: "600",
  },
  detailInput: {
    minHeight: 96,
  },
});
