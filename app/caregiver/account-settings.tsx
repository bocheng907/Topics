import { auth, db, storage } from "@/firebase/firebaseConfig";
import { getUserDocSnapshotByUid } from "@/src/user/getUserDocRefByUid";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/auth/useAuth";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

export default function AccountSettingsScreen() {
  const { user, ready } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [role, setRole] =
    useState<"family" | "caregiver" | "">("");

  const uid =
    user?.uid ??
    auth.currentUser?.uid ??
    "";

  useEffect(() => {
    let mounted = true;

    (async () => {
      // AuthProvider 還沒準備完成時先不要判斷
      if (!ready) {
        return;
      }

      if (!uid) {
        if (mounted) {
          setLoading(false);
        }
        return;
      }

      try {
        setLoading(true);

        const snap =
          await getUserDocSnapshotByUid(uid);

        if (!mounted || !snap) {
          return;
        }

        const data = snap.data() as any;

        setDisplayName(
          String(data.displayName ?? "")
        );

        setAvatarUrl(
          String(data.avatarUrl ?? "")
        );

        // Email：
        // users 文件 → useAuth → Firebase Auth
        const loadedEmail =
          String(
            data.email ??
            user?.email ??
            auth.currentUser?.email ??
            ""
          );

        setAccountEmail(loadedEmail);

        // 不要再「不是 caregiver 就當 family」
        const isCaregiver =
          user?.role === "caregiver" ||
          data.role === "caregiver";

        const isFamily =
          user?.role === "family" ||
          data.role === "family";

        if (isCaregiver) {
          setRole("caregiver");
        } else if (isFamily) {
          setRole("family");
        } else {
          setRole("");
        }

        // 這份檔案是 caregiver 端，
        // 確認是 caregiver 後再讀仲介需要的 profile
        if (isCaregiver) {
          const profileRef = doc(
            db,
            "caregiver_profiles",
            uid
          );

          const profileSnap =
            await getDoc(profileRef);

          if (
            mounted &&
            profileSnap.exists()
          ) {
            const profile =
              profileSnap.data();

            setPhone(
              String(profile.phone ?? "")
            );
          }
        }
      } catch (error) {
        console.log(
          "load account settings failed:",
          error
        );

        Alert.alert(
          "讀取失敗",
          "目前無法讀取帳號設定"
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [
    ready,
    uid,
    user?.role,
    user?.email,
  ]);

  async function chooseAvatar() {
    if (!uid || saving) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("需要相簿權限", "請允許 App 讀取相簿，才能更換頭貼。");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.65,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;

    setSaving(true);
    try {
      const response = await fetch(result.assets[0].uri);
      const blob = await response.blob();
      const avatarRef = ref(storage, `profile_images/${uid}/avatar.jpg`);
      await uploadBytes(avatarRef, blob, { contentType: blob.type || "image/jpeg" });
      const url = await getDownloadURL(avatarRef);
      const snap = await getUserDocSnapshotByUid(uid);
      if (!snap) throw new Error("Profile unavailable");
      await updateDoc(snap.ref, { avatarUrl: url });
      if (role === "caregiver") {
        const profileRef = doc(
            db,
            "caregiver_profiles",
            uid
        );

        const profileSnap = await getDoc(profileRef);

        if (profileSnap.exists()) {
            await updateDoc(profileRef, {
            avatarUrl: url,
            updatedAt: serverTimestamp(),
            });
        }
      }
      setAvatarUrl(url);
      Alert.alert("完成", "頭貼已更新");
    } catch (error) {
      console.log("avatar upload failed:", error);
      Alert.alert("更新失敗", "頭貼目前無法更新，請稍後再試。");
    } finally {
      setSaving(false);
    }
  }

  async function saveProfile() {
    if (!uid || saving) return;
    const name = displayName.trim();
    const cleanPhone = phone.trim();
    if (!name) {
      Alert.alert("請輸入名稱", "顯示名稱不能留白，家庭群組會用這個名稱識別發言者。");
      return;
    }
    if (name.length > 120) {
      Alert.alert("名稱太長", "顯示名稱請控制在 120 個字元內。");
      return;
    }
    if (!cleanPhone) {
      Alert.alert(
        "請輸入聯絡電話",
        "聯絡電話不能留白。"
      );
      return;
    }
    setSaving(true);
    try {
      const snap = await getUserDocSnapshotByUid(uid);
      if (!snap) throw new Error("Profile unavailable");
      await updateDoc(snap.ref, {
        displayName: name,
      });

        // 同步給仲介使用的看護基本資料
        if (role === "caregiver") {
        const profileRef = doc(
            db,
            "caregiver_profiles",
            uid
        );

        const profileSnap = await getDoc(profileRef);

        if (profileSnap.exists()) {
            await updateDoc(profileRef, {
            displayName: name,
            phone: cleanPhone,
            avatarUrl,
            updatedAt: serverTimestamp(),
            });
        } else {
            await setDoc(profileRef, {
            caregiverUid: uid,
            displayName: name,
            email: accountEmail,
            phone: cleanPhone,
            avatarUrl,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            });
        }
        }

        setDisplayName(name);
        setPhone(cleanPhone);

        Alert.alert(
        "完成",
        "帳號設定已儲存"
        );
    } catch (error) {
      console.log("save account settings failed:", error);
      Alert.alert("儲存失敗", "目前無法儲存帳號設定，請稍後再試。");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#7774D9" /></View>;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={16} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color="#111827" />
        </Pressable>
        <Text style={styles.headerTitle}>帳號設定</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.avatarWrap}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Ionicons name="person" size={52} color="#8B78D7" />
            </View>
          )}
          <Pressable style={styles.changeAvatarButton} onPress={chooseAvatar} disabled={saving}>
            <Ionicons name="camera" size={18} color="#FFF" />
            <Text style={styles.changeAvatarText}>更換頭貼</Text>
          </Pressable>
        </View>

        <Text style={styles.label}>顯示名稱</Text>
        <TextInput
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="輸入你的名稱"
          maxLength={120}
          style={styles.input}
        />

        <Text style={styles.label}>聯絡電話</Text>
        <TextInput
          value={phone}
          onChangeText={setPhone}
          placeholder="例如：0912345678"
          keyboardType="phone-pad"
          maxLength={30}
          style={styles.input}
        />

        <Text style={styles.label}>登入帳號</Text>
        <View style={styles.readonlyBox}><Text style={styles.readonlyText}>{accountEmail || "—"}</Text></View>

        <Text style={styles.label}>帳號身分</Text>
        <View style={styles.readonlyBox}>
          <Text style={styles.readonlyText}>{role === "caregiver" ? "看護" : role === "family" ? "家屬" : "—"}</Text>
        </View>

        <Pressable style={[styles.saveButton, saving && styles.disabled]} onPress={saveProfile} disabled={saving}>
          {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveText}>儲存設定</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F7FB" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F7F7FB" },
  header: { height: 62, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, backgroundColor: "#FFF", borderBottomWidth: 1, borderBottomColor: "#ECECF2" },
  backButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerSpacer: { width: 44 },
  headerTitle: { fontSize: 21, fontWeight: "900", color: "#111827" },
  scrollView: {
    flex: 1,
  },

  content: {
    padding: 22,
    paddingBottom: 60,
  },
  avatarWrap: { alignItems: "center", marginBottom: 30 },
  avatar: { width: 112, height: 112, borderRadius: 56 },
  avatarFallback: { alignItems: "center", justifyContent: "center", backgroundColor: "#EEEAFB", borderWidth: 1, borderColor: "#D9D0F3" },
  changeAvatarButton: { marginTop: 12, flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "#8B78D7", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22 },
  changeAvatarText: { color: "#FFF", fontSize: 15, fontWeight: "800" },
  label: { marginTop: 16, marginBottom: 8, color: "#4B5563", fontSize: 15, fontWeight: "800" },
  input: { minHeight: 52, backgroundColor: "#FFF", borderWidth: 1, borderColor: "#D9DCE4", borderRadius: 14, paddingHorizontal: 15, fontSize: 17, color: "#111827" },
  readonlyBox: { minHeight: 52, justifyContent: "center", backgroundColor: "#ECEEF3", borderRadius: 14, paddingHorizontal: 15 },
  readonlyText: { fontSize: 16, color: "#6B7280" },
  saveButton: { marginTop: 32, minHeight: 54, borderRadius: 16, backgroundColor: "#8B78D7", alignItems: "center", justifyContent: "center" },
  disabled: { opacity: 0.55 },
  saveText: { color: "#FFF", fontSize: 18, fontWeight: "900" },
});