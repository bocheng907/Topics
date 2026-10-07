// 分類標籤（圖示 + 分類名稱），用於文章卡片與詳情頁

import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { getCategoryStyle } from "../theme";

type Props = {
  category: string;
};

export default function CategoryTag({ category }: Props) {
  const style = getCategoryStyle(category);

  return (
    <View style={[styles.tag, { backgroundColor: style.bg }]}>
      <Ionicons name={style.icon} size={13} color={style.main} />
      <Text style={[styles.label, { color: style.main }]}>{category}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
  },
});
