// 影片播放元件
// SDK 55 起 expo-av 已移除，改用 expo-video。
// expo-video 的 useVideoPlayer 是 hook，不能在條件式渲染的函式中呼叫，
// 因此包成獨立元件，讓呼叫端可以安全地在任何位置使用。

import { useVideoPlayer, VideoView } from "expo-video";
import type { StyleProp, ViewStyle } from "react-native";

type Props = {
  uri: string;
  style?: StyleProp<ViewStyle>;
  /** 是否顯示原生播放控制列（進度條、播放鍵） */
  nativeControls?: boolean;
  /** 載入後是否自動播放 */
  autoPlay?: boolean;
};

export default function VideoPlayerView({
  uri,
  style,
  nativeControls = true,
  autoPlay = false,
}: Props) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = false;
    if (autoPlay) {
      instance.play();
    }
  });

  return (
    <VideoView
      style={style}
      player={player}
      // 對應舊版 expo-av 的 ResizeMode.CONTAIN
      contentFit="contain"
      nativeControls={nativeControls}
      allowsPictureInPicture={false}
    />
  );
}
