import * as ImagePicker from "expo-image-picker";
import { randomUUID } from "expo-crypto";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { ScreenScrollView } from "@/src/ui/ScreenLayout";
import { storage, db } from "@/firebase/firebaseConfig";
import { useAuth } from "@/src/auth/useAuth";
import { useLanguage } from "@/src/store/LanguageContext";
import { collection, doc, getDoc, getDocs, limit, query, writeBatch, serverTimestamp, where } from "firebase/firestore";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput } from "react-native";
import { readLocalBlob } from "@/src/media/readLocalBlob";

const copy = {
  zh: {title: "更正個人資料", back: "返回", name: "姓名／顯示名稱",
    phone1: "緊急聯絡電話 1", phone2: "緊急聯絡電話 2",
    note: "Email 與角色涉及帳號身分及權限，不能在此頁直接修改。如需更正，請聯絡智慧醫療團隊。",
    familyRequired: "家屬帳號需保留兩組緊急聯絡電話。", save: "儲存更正",
    saving: "儲存中…", done: "已儲存。", failed: "儲存失敗，請稍後再試。",
    duplicate: "帳號資料不唯一，請聯絡管理員處理。"},
  en: {title: "Correct personal data", back: "Back", name: "Name / display name",
    phone1: "Emergency phone 1", phone2: "Emergency phone 2",
    note: "Email and role identify your account and permissions. Contact the care team to correct them.",
    familyRequired: "Family accounts must keep two emergency phone numbers.",
    save: "Save changes", saving: "Saving…", done: "Saved.",
    failed: "Unable to save. Try again.", duplicate: "The account profile is not unique. Contact an administrator."},
  vi: {title: "Sửa dữ liệu cá nhân", back: "Quay lại", name: "Tên hiển thị",
    phone1: "Số khẩn cấp 1", phone2: "Số khẩn cấp 2",
    note: "Email và vai trò liên quan đến danh tính và quyền. Hãy liên hệ nhóm để sửa.",
    familyRequired: "Tài khoản gia đình phải giữ hai số điện thoại khẩn cấp.",
    save: "Lưu", saving: "Đang lưu…", done: "Đã lưu.",
    failed: "Không thể lưu.", duplicate: "Hồ sơ tài khoản không duy nhất. Hãy liên hệ quản trị viên."},
  id: {title: "Perbaiki data pribadi", back: "Kembali", name: "Nama tampilan",
    phone1: "Telepon darurat 1", phone2: "Telepon darurat 2",
    note: "Email dan peran menentukan identitas dan izin. Hubungi tim untuk mengubahnya.",
    familyRequired: "Akun keluarga harus memiliki dua nomor darurat.",
    save: "Simpan", saving: "Menyimpan…", done: "Tersimpan.",
    failed: "Tidak dapat menyimpan.", duplicate: "Profil akun tidak unik. Hubungi administrator."},
} as const;

export default function AccountSettingsScreen() {
  const {user} = useAuth();
  const {language} = useLanguage();
  const t = copy[language];
  const extra = {
    zh: {avatar: "選擇頭貼（儲存後生效）", phone: "照護員聯絡電話"},
    en: {avatar: "Choose avatar (save to apply)", phone: "Caregiver phone"},
    vi: {avatar: "Chọn ảnh (lưu để áp dụng)", phone: "Điện thoại người chăm sóc"},
    id: {avatar: "Pilih foto (simpan untuk menerapkan)", phone: "Telepon caregiver"},
  }[language];
  const [avatarUrl, setAvatarUrl] = useState("");
  const [caregiverPhone, setCaregiverPhone] = useState("");
  const [name, setName] = useState("");
  const [phone1, setPhone1] = useState("");
  const [phone2, setPhone2] = useState("");
  const [profileRef, setProfileRef] = useState<any>(null);
  const [busy, setBusy] = useState(true);
  const [status, setStatus] = useState("");
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, "users"),
          where("uid", "==", user?.uid || ""), limit(2)));
        if (!active) return;
        if (snap.size !== 1) {
          setStatus(snap.size > 1 ? t.duplicate : t.failed);
          return;
        }
        const profile = snap.docs[0];
        const data = profile.data();
        setProfileRef(profile.ref);
        setName(String(data.displayName || ""));
        setAvatarUrl(String(data.avatarUrl || ""));
        if (user?.role === "caregiver") {
          const shared = await getDoc(doc(db, "caregiver_profiles", user.uid));
          if (!active) return;
          setCaregiverPhone(String(shared.data()?.phone || ""));
        }
        setPhone1(String(data.emergencyPhone1 || ""));
        setPhone2(String(data.emergencyPhone2 || ""));
      } catch (error) {
        console.warn("[profile] load", error);
        if (active) setStatus(t.failed);
      } finally {
        if (active) setBusy(false);
      }
    })();
    return () => { active = false; };
  }, [t.duplicate, t.failed, user?.uid, user?.role]);

  async function chooseAvatar() {
    if (!user || busy || !profileRef) return;
    setBusy(true);
    setStatus("");
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) throw new Error("Photo permission required");
      const result = await ImagePicker.launchImageLibraryAsync({mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.65});
      if (result.canceled || !result.assets[0]?.uri) return;
      const blob = await readLocalBlob(result.assets[0].uri);
      if (!blob.size || blob.size > 5 * 1024 * 1024) throw new Error("Avatar size limit");
      const contentType = blob.type || "image/jpeg";
      if (!["image/jpeg", "image/png"].includes(contentType)) throw new Error("Unsupported image format");
      const extension = contentType === "image/png" ? "png" : "jpg";
      const object = ref(storage, `profile_images/${user.uid}/${randomUUID()}.${extension}`);
      await uploadBytes(object, blob, {contentType, customMetadata: {uploaderUid: user.uid}});
      setAvatarUrl(await getDownloadURL(object));
    } catch { setStatus(t.failed); } finally { setBusy(false); }
  }

  async function save() {
    if (!user || !profileRef || busy) return;
    const nextName = name.trim();
    const nextPhone1 = phone1.trim();
    const nextPhone2 = phone2.trim();
    if (!nextName || nextName.length > 120 || nextPhone1.length > 64 || nextPhone2.length > 64 || caregiverPhone.trim().length > 64) {
      setStatus(t.failed);
      return;
    }
    if (user?.role === "family" && (!nextPhone1 || !nextPhone2)) {
      setStatus(t.familyRequired);
      return;
    }
    setBusy(true);
    setStatus("");
    try {
      const batch = writeBatch(db);
      batch.update(profileRef, {displayName: nextName, avatarUrl,
        emergencyPhone1: nextPhone1, emergencyPhone2: nextPhone2});
      if (user.role === "caregiver") {
        batch.set(doc(db, "caregiver_profiles", user.uid), {
          caregiverUid: user.uid, profileId: profileRef.id, displayName: nextName,
          avatarUrl, phone: caregiverPhone.trim(), updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
      setName(nextName);
      setPhone1(nextPhone1);
      setPhone2(nextPhone2);
      setStatus(t.done);
    } catch (error) {
      console.warn("[profile] save", error);
      setStatus(t.failed);
    } finally {
      setBusy(false);
    }
  }

  return <ScreenScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
    <Pressable onPress={() => router.back()} disabled={busy}>
      <Text style={styles.link}>{t.back}</Text>
    </Pressable>
    <Text style={styles.title}>{t.title}</Text>
    {busy && !profileRef && <ActivityIndicator />}
    {!!avatarUrl && <Image source={{uri: avatarUrl}} style={{width: 88, height: 88, borderRadius: 44}} />}
    <Pressable onPress={chooseAvatar} disabled={busy || !profileRef}><Text style={styles.link}>{extra.avatar}</Text></Pressable>
    {user?.role === "caregiver" && <>
      <Text style={styles.label}>{extra.phone}</Text>
      <TextInput value={caregiverPhone} onChangeText={setCaregiverPhone} maxLength={64}
        editable={!busy} keyboardType="phone-pad" style={styles.input} />
    </>}
    <Text style={styles.label}>{t.name}</Text>
    <TextInput value={name} onChangeText={setName} maxLength={120}
      editable={!busy} autoComplete="name" style={styles.input} />
    {user?.role === "family" && <>
    <Text style={styles.label}>{t.phone1}</Text>
    <TextInput value={phone1} onChangeText={setPhone1} maxLength={64}
      editable={!busy} keyboardType="phone-pad" autoComplete="tel" style={styles.input} />
    <Text style={styles.label}>{t.phone2}</Text>
    <TextInput value={phone2} onChangeText={setPhone2} maxLength={64}
      editable={!busy} keyboardType="phone-pad" autoComplete="tel" style={styles.input} />
    <Text style={styles.hint}>{t.familyRequired}</Text>
    </>}
    <Text style={styles.note}>{t.note}</Text>
    <Pressable onPress={save} disabled={busy || !profileRef}
      style={[styles.button, (busy || !profileRef) && styles.disabled]}>
      <Text style={styles.buttonText}>{busy ? t.saving : t.save}</Text>
    </Pressable>
    {!!status && <Text accessibilityRole="alert" style={styles.status}>{status}</Text>}
  </ScreenScrollView>;
}
const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 20, gap: 12, maxWidth: 680, width: "100%", alignSelf: "center", paddingBottom: 40 },
  title: {fontSize: 28, fontWeight: "800", marginBottom: 8},
  link: {fontSize: 16, color: "#1264A3"}, label: {fontSize: 15, fontWeight: "600"},
  input: {borderWidth: 1, borderColor: "#777", borderRadius: 10,
    padding: 14, fontSize: 16, backgroundColor: "#FFF"},
  hint: {fontSize: 13, color: "#9A5A00"}, note: {fontSize: 14, lineHeight: 22,
    color: "#555", backgroundColor: "#F3F4F6", padding: 14, borderRadius: 10},
  button: {backgroundColor: "#1264A3", padding: 16, borderRadius: 10, marginTop: 8},
  buttonText: {color: "#FFF", textAlign: "center", fontSize: 16, fontWeight: "700"},
  disabled: {opacity: 0.45}, status: {fontSize: 15, lineHeight: 22},
});
