// 社群畫面共用於家屬端（/family/community）與仲介端（/agency/community）
// 畫面本身放在 src/community/screens，各角色的 app/<group>/community/* 只是轉出
// 這裡依目前所在的路由群組算出社群根路徑，讓畫面內的跳轉留在同一個角色底下

import { useSegments } from "expo-router";
import { useMemo } from "react";

export type CommunityGroup = "family" | "agency";

const COMMUNITY_GROUPS: readonly CommunityGroup[] = ["family", "agency"];

export function useCommunityRoutes() {
  const segments = useSegments() as string[];
  const first = segments[0] ?? "";
  const group: CommunityGroup = (COMMUNITY_GROUPS as readonly string[]).includes(first)
    ? (first as CommunityGroup)
    : "family";

  return useMemo(() => {
    const base = `/${group}/community`;
    return {
      group,
      base,
      feed: base,
      myPosts: `${base}/my-posts`,
      post: (postId: string) => `${base}/${postId}`,
      newPost: (editId?: string) =>
        editId
          ? { pathname: `${base}/new-post`, params: { editId } }
          : `${base}/new-post`,
    };
  }, [group]);
}
