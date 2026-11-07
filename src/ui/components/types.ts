import type { Ionicons } from "@expo/vector-icons";
import type React from "react";

/** Any valid Ionicons glyph name. */
export type IconName = React.ComponentProps<typeof Ionicons>["name"];
