// 分類標籤（圖示 + 分類名稱），用於文章卡片與詳情頁

import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { communityCategoryLabel, communityCopy } from "@/src/i18n/copy/communityCopy";
import { useLanguage } from "@/src/store/LanguageContext";
import { radii } from "@/src/ui/theme";
import { getCategoryStyle } from "../theme";

type Props = {
  category: string;
};

export default function CategoryTag({ category }: Props) {
  const { language } = useLanguage();
  const style = getCategoryStyle(category);

  return (
    <View style={[styles.tag, { backgroundColor: style.bg }]}>
      <Ionicons name={style.icon} size={14} color={style.main} />
      <Text style={[styles.label, { color: style.main }]}>
        {communityCategoryLabel(communityCopy[language], category)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  label: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "600",
  },
});
