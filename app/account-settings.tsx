import * as ImagePicker from "expo-image-picker";
import { randomUUID } from "expo-crypto";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage, db } from "@/firebase/firebaseConfig";
import { useAuth } from "@/src/auth/useAuth";
import { useLanguage } from "@/src/store/LanguageContext";
import { collection, doc, getDoc, getDocs, limit, query, writeBatch, serverTimestamp, where } from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import type { Href } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { readLocalBlob } from "@/src/media/readLocalBlob";
import { accountSettingsCopy } from "@/src/i18n/copy/accountCopy";
import { AppHeader, Button, Card, KeyboardAwareScroll, SectionHeader, TextField, UserAvatar } from "@/src/ui/components";
import { colors, layout, radii, spacing, typography } from "@/src/ui/theme";

export default function AccountSettingsScreen() {
  const {user, ready} = useAuth();
  const {language} = useLanguage();
  const t = accountSettingsCopy[language];
  const [avatarUrl, setAvatarUrl] = useState("");
  const [caregiverPhone, setCaregiverPhone] = useState("");
  const [name, setName] = useState("");
  const [phone1, setPhone1] = useState("");
  const [phone2, setPhone2] = useState("");
  const [profileRef, setProfileRef] = useState<any>(null);
  const [busy, setBusy] = useState(true);
  const [status, setStatus] = useState("");
  useEffect(() => {
    if (!ready || !user?.uid) return;
    let active = true;
    (async () => {
      setBusy(true);
      setStatus("");
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
  }, [ready, t.duplicate, t.failed, user?.uid, user?.role]);

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

  const locked = busy || !profileRef;
  const statusOk = status === t.done;

  return (
    <View style={styles.screen}>
      {/* Leaving is blocked while an upload or save is in flight, as before. */}
      <AppHeader title={t.title} left="back" fallbackHref={"/" as Href} onBack={busy ? () => {} : undefined} />
      <KeyboardAwareScroll contentContainerStyle={styles.content}>
        {busy && !profileRef ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>{t.loading}</Text>
          </View>
        ) : null}

        <Card style={styles.avatarCard}>
          <UserAvatar uri={avatarUrl} name={name} uid={user?.uid} size={88} />
          <Button
            label={t.changeAvatar}
            icon="camera-outline"
            variant="secondary"
            onPress={chooseAvatar}
            disabled={locked}
            style={styles.avatarButton}
          />
          <Text style={styles.avatarHint}>{t.avatarHint}</Text>
        </Card>

        <SectionHeader title={t.basicSection} />
        <Card style={styles.fieldCard}>
          <TextField label={t.name} value={name} onChangeText={setName} maxLength={120}
            editable={!busy} autoComplete="name" />
        </Card>

        {user?.role === "caregiver" ? (
          <>
            <SectionHeader title={t.contactSection} />
            <Card style={styles.fieldCard}>
              <TextField label={t.caregiverPhone} value={caregiverPhone} onChangeText={setCaregiverPhone}
                maxLength={64} editable={!busy} keyboardType="phone-pad" />
            </Card>
          </>
        ) : null}

        {user?.role === "family" ? (
          <>
            <SectionHeader title={t.emergencySection} />
            <Card style={styles.fieldCard}>
              <TextField label={t.phone1} value={phone1} onChangeText={setPhone1} maxLength={64}
                editable={!busy} keyboardType="phone-pad" autoComplete="tel" required />
              <TextField label={t.phone2} value={phone2} onChangeText={setPhone2} maxLength={64}
                editable={!busy} keyboardType="phone-pad" autoComplete="tel" required
                helper={t.familyRequired} />
            </Card>
          </>
        ) : null}

        <SectionHeader title={t.accountSection} />
        <Card tone="sunken" style={styles.noteCard}>
          <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} />
          <Text style={styles.noteText}>{t.note}</Text>
        </Card>

        {status ? (
          <View accessibilityRole="alert" style={[styles.status, statusOk ? styles.statusOk : styles.statusError]}>
            <Ionicons name={statusOk ? "checkmark-circle" : "alert-circle"} size={20}
              color={statusOk ? colors.success : colors.danger} />
            <Text style={[styles.statusText, { color: statusOk ? colors.success : colors.danger }]}>{status}</Text>
          </View>
        ) : null}

        <Button
          label={busy && profileRef ? t.saving : t.save}
          size="lg"
          fullWidth
          loading={busy && !!profileRef}
          disabled={locked}
          onPress={save}
          style={styles.saveButton}
        />
      </KeyboardAwareScroll>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { gap: 0, width: "100%", maxWidth: layout.maxContentWidth, alignSelf: "center" },
  loading: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.md },
  loadingText: { ...typography.body, color: colors.textSecondary },
  avatarCard: { alignItems: "center", gap: spacing.md, paddingVertical: spacing.xl },
  avatarButton: { alignSelf: "center" },
  avatarHint: { ...typography.bodySmall, color: colors.textMuted, textAlign: "center" },
  fieldCard: { gap: spacing.lg },
  noteCard: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  noteText: { ...typography.bodySmall, flex: 1 },
  status: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radii.control,
  },
  statusOk: { backgroundColor: colors.successSoft },
  statusError: { backgroundColor: colors.dangerSoft },
  statusText: { ...typography.bodyStrong, flex: 1 },
  saveButton: { marginTop: spacing.xl },
});
