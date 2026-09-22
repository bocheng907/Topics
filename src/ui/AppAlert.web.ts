import type { AlertButton } from "react-native";

// Web's react-native Alert is a no-op. All callers here use at most two buttons.
export const AppAlert = {
  alert(title: string, message?: string, buttons?: AlertButton[]) {
    if (typeof window === "undefined") return;
    const text = [title, message].filter(Boolean).join("\n\n");
    const action = buttons?.find(button => button.style !== "cancel");
    const cancel = buttons?.find(button => button.style === "cancel");
    if (cancel) {
      if (window.confirm(text)) action?.onPress?.();
      else cancel.onPress?.();
    } else {
      window.alert(text);
      action?.onPress?.();
    }
  },
};
