// 社群頭像：沿用共用 UserAvatar（有圖顯示圖片，否則依 uid 上色的姓名首字）
// 新文章／留言會存 authorAvatarUrl；舊資料沒有頭像網址，就顯示字首。

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
