// 社群頭像：沿用共用 UserAvatar（有圖顯示圖片，否則依 uid 上色的姓名首字）
// 文章／留言目前只存 authorUid / authorName，沒有頭像網址，因此他人頭像會顯示字首。

import UserAvatar from "@/src/ui/components/UserAvatar";

type Props = {
  name: string;
  size?: number;
  uri?: string;
  uid?: string;
};

export default function Avatar({ name, size = 32, uri, uid }: Props) {
  return <UserAvatar name={name} uri={uri} uid={uid} size={size} />;
}
