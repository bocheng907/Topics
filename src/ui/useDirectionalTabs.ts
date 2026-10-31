import { router, type Href } from "expo-router";
import { useCallback, useMemo, useState } from "react";

export type DirectionalTab = {
  /** Key used by BottomNav (matches the last route segment, e.g. "family" for the index screen). */
  key: string;
  /** Stack route name of the screen ("index", "calendar", ...). */
  routeName: string;
  href: string;
};

type SlideAnimation = "slide_from_right" | "slide_from_left";

/**
 * Bottom-nav tab switching for a Stack layout, with the slide direction following tab order.
 *
 * - The first tab (home) stays at the bottom of the stack: going home dismisses back to it, so
 *   the current tab slides out to the right (the reverse of its `slide_from_right`).
 * - Tab -> tab replaces the current tab, so hopping between tabs never piles up history.
 *   The new screen slides in from the right when it is to the right, otherwise from the left.
 * - From home (or a non-tab screen that shows the bar) the tab is pushed from the right.
 *
 * Only tab routes get the directional animation; every other screen keeps the layout default.
 */
export function useDirectionalTabs(tabs: DirectionalTab[], activeKey: string) {
  const [animation, setAnimation] = useState<SlideAnimation>("slide_from_right");

  const tabRouteNames = useMemo(() => new Set(tabs.map((tab) => tab.routeName)), [tabs]);
  const homeRouteName = tabs[0]?.routeName;

  /** Extra Stack options for `route`; empty for non-tab routes. */
  const tabAnimationFor = useCallback(
    (routeName: string): { animation?: SlideAnimation } => {
      if (!tabRouteNames.has(routeName)) return {};
      // Home is the left-most tab, so whenever it has to be pushed it comes in from the left.
      if (routeName === homeRouteName) return { animation: "slide_from_left" };
      return { animation };
    },
    [animation, homeRouteName, tabRouteNames]
  );

  const selectTab = useCallback(
    (key: string) => {
      const from = tabs.findIndex((tab) => tab.key === activeKey);
      const to = tabs.findIndex((tab) => tab.key === key);
      if (to < 0 || to === from) return;
      const href = tabs[to].href as Href;

      // When popping a tab back to home, the popped tab must be slide_from_right so that its
      // reverse animation moves it out to the right.
      const next: SlideAnimation = to === 0 || from < 0 || to > from ? "slide_from_right" : "slide_from_left";
      setAnimation(next);

      // Navigate on the next tick so the updated animation option is committed to the native
      // screens before the transition starts.
      setTimeout(() => {
        if (to === 0) router.dismissTo(href);
        else if (from > 0) router.replace(href);
        else router.push(href);
      }, 0);
    },
    [activeKey, tabs]
  );

  return { tabAnimationFor, selectTab };
}
