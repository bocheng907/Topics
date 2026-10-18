// Header 右上角的圓形頭像按鈕，點擊進入「我的文章」

import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet } from "react-native";

import { COMMUNITY_COLORS } from "../theme";
import { useCommunityProfile } from "../useCommunityProfile";
import Avatar from "./Avatar";

type Props = {
  onPress: () => void;
  size?: number;
};

export default function ProfileButton({ onPress, size = 36 }: Props) {
  const profile = useCommunityProfile();

  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="我的文章"
      style={({ pressed }) => [
        styles.button,
        { width: size + 4, height: size + 4, borderRadius: (size + 4) / 2 },
        pressed && styles.pressed,
      ]}
    >
      {profile.loaded ? (
        <Avatar name={profile.name} uri={profile.avatarUrl} size={size} />
      ) : (
        <Ionicons name="person-circle" size={size} color={COMMUNITY_COLORS.primary} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COMMUNITY_COLORS.white,
  },
  pressed: {
    opacity: 0.8,
  },
});
