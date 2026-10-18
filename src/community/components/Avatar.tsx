// 姓名首字頭像
// 原型用外部假頭像服務（i.pravatar.cc），真實使用者沒有頭像欄位，
// 因此改用「姓名首字 + 依名字決定的底色」，與家屬端主畫面切換長輩的頭像作法一致

// 有頭像網址（users.avatarUrl）時改顯示圖片
import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";

type Props = {
  name: string;
  size?: number;
  uri?: string;
};

/** 依名字決定底色，讓同一個人每次顯示的顏色固定 */
const AVATAR_COLORS = ["#4A90E2", "#52B788", "#F4A261", "#7C6FE0", "#E07A8B", "#4FB3BF"];

function pickColor(name: string): string {
  if (!name) return "#9CA3AF";
  let sum = 0;
  for (let i = 0; i < name.length; i += 1) {
    sum += name.charCodeAt(i);
  }
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

export default function Avatar({ name, size = 32, uri }: Props) {
  const initial = name?.trim()?.charAt(0) || "?";

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="cover"
        transition={150}
      />
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: pickColor(name),
        },
      ]}
    >
      <Text style={[styles.initial, { fontSize: size * 0.45 }]}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  initial: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
});
