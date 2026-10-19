import { Platform } from "react-native";
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  type User,
} from "firebase/auth";

export function requiresPasswordReauthentication(user: User | null): boolean {
  return !!user?.providerData.some(provider => provider.providerId === "password");
}

export async function reauthenticateUser(user: User, password: string): Promise<void> {
  if (requiresPasswordReauthentication(user)) {
    if (!user.email || !password) {
      throw Object.assign(new Error("Password required."), {code: "auth/missing-password"});
    }
    await reauthenticateWithCredential(user,
      EmailAuthProvider.credential(user.email, password));
    return;
  }
  if (user.providerData.some(provider => provider.providerId === "google.com")) {
    if (Platform.OS !== "web") {
      throw Object.assign(new Error("Google reauthentication is unavailable in Expo Go."),
        {code: "auth/google-sign-in-unavailable"});
    }
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({prompt: "select_account"});
    await reauthenticateWithPopup(user, provider);
    return;
  }
  throw Object.assign(new Error("No supported sign-in provider."),
    {code: "auth/operation-not-supported-in-this-environment"});
}
