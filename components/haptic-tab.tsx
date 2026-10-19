// Expo 範本殘留元件，只有進不去的 app/(tabs) 路由群組在使用。
// SDK 56 起 expo-router 不再相容 react-navigation，只要專案有任何地方
// import '@react-navigation/*'，Metro 就會直接拒絕打包整個 App。
// 這裡改用 React Native 原生的 Pressable，移除違規的 import。
// 註：這個檔案與 app/(tabs) 都是範本死碼，建議整批刪除（見升級報告）。
import * as Haptics from 'expo-haptics';
import { Pressable, type PressableProps } from 'react-native';

export function HapticTab(props: PressableProps) {
  return (
    <Pressable
      {...props}
      onPressIn={(ev) => {
        if (process.env.EXPO_OS === 'ios') {
          // Add a soft haptic feedback when pressing down on the tabs.
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        props.onPressIn?.(ev);
      }}
    />
  );
}
