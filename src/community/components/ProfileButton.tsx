// Header 右上角的圓形頭像按鈕，點擊進入「我的文章」

import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet } from "react-native";

import { useAuth } from "@/src/auth/useAuth";
import { communityCopy } from "@/src/i18n/copy/communityCopy";
import { useLanguage } from "@/src/store/LanguageContext";
import { colors, layout } from "@/src/ui/theme";
import { useCommunityProfile } from "../useCommunityProfile";
import Avatar from "./Avatar";

type Props = {
  onPress: () => void;
  size?: number;
};

export default function ProfileButton({ onPress, size = 34 }: Props) {
  const profile = useCommunityProfile();
  const { user } = useAuth();
  const { language } = useLanguage();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={communityCopy[language].myPosts}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      {profile.loaded ? (
        <Avatar name={profile.name} uri={profile.avatarUrl} uid={user?.uid} size={size} />
      ) : (
        <Ionicons name="person-circle-outline" size={size} color={colors.primary} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    borderRadius: layout.minTouchTarget / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    backgroundColor: colors.surfaceSunken,
  },
});
