import { db } from "@/firebase/firebaseConfig";
import { useAuth } from "@/src/auth/useAuth";
import { useActiveCareTarget } from "@/src/care-target/useActiveCareTarget";
import { translations } from "@/src/i18n/translations";
import { useLanguage } from "@/src/store/LanguageContext";
import { AppAlert as Alert } from "@/src/ui/AppAlert";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { doc, getDocFromServer } from "firebase/firestore";
import { randomUUID } from "expo-crypto";
import { handbookForm, legacyVersion, publishHandbook, versionOf } from "@/src/care-target/reliableWrites";
import { reliabilityCopy } from "@/src/care-target/reliabilityCopy";
import { HandoverStatus } from "@/src/care-target/HandoverStatus";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type CareHandbookForm = {
  dailyRoutine: string;
  medicationNotes: string;
  dietNotes: string;
  mobilityNotes: string;
  hygieneNotes: string;
  sleepNotes: string;
  communicationNotes: string;
  emergencyNotes: string;
  otherNotes: string;
};

type FormField = keyof CareHandbookForm;

const EMPTY_FORM: CareHandbookForm = {
  dailyRoutine: "",
  medicationNotes: "",
  dietNotes: "",
  mobilityNotes: "",
  hygieneNotes: "",
  sleepNotes: "",
  communicationNotes: "",
  emergencyNotes: "",
  otherNotes: "",
};

export default function FamilyHandbookScreen() {
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();
  const t = translations[language];
  const { user } = useAuth();
  const { ready, activePatient, activePatientId } = useActiveCareTarget();
  const [form, setForm] = useState<CareHandbookForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const baseline = useRef({ revision: '', legacy: legacyVersion(undefined) });
  const pending = useRef<{ revision: string; form: CareHandbookForm } | null>(null);
  const [revision, setRevision] = useState('');
  const [conflict, setConflict] = useState(false);
  const [retryNeeded, setRetryNeeded] = useState(false);
  const [reload, setReload] = useState(0);
  const copy = reliabilityCopy[language];
  const scope = useRef('');
  const generation = useRef(0);
  const loadScope = `${user?.uid}/${activePatientId}/${ready}/${reload}`;
  const [previousLoadScope, setPreviousLoadScope] = useState<string | null>(null);
  if (previousLoadScope !== loadScope) {
    setPreviousLoadScope(loadScope);
    setForm(EMPTY_FORM); setLoadError(false); setConflict(false);
    setRetryNeeded(false); setRevision(''); setLoading(Boolean(ready && activePatientId));
  }

  const fields: { key: FormField; label: string; placeholder: string }[] = [
    { key: "dailyRoutine", label: t.dailyRoutine, placeholder: t.dailyRoutinePlaceholder },
    { key: "medicationNotes", label: t.medicationNotes, placeholder: t.medicationNotesPlaceholder },
    { key: "dietNotes", label: t.dietNotes, placeholder: t.dietNotesPlaceholder },
    { key: "mobilityNotes", label: t.mobilityNotes, placeholder: t.mobilityNotesPlaceholder },
    { key: "hygieneNotes", label: t.hygieneNotes, placeholder: t.hygieneNotesPlaceholder },
    { key: "sleepNotes", label: t.sleepNotes, placeholder: t.sleepNotesPlaceholder },
    { key: "communicationNotes", label: t.communicationNotes, placeholder: t.communicationNotesPlaceholder },
    { key: "emergencyNotes", label: t.emergencyNotes, placeholder: t.emergencyNotesPlaceholder },
    { key: "otherNotes", label: t.otherNotes, placeholder: t.otherNotesPlaceholder },
  ];

  useEffect(() => {
    let cancelled = false;
    generation.current += 1;
    scope.current = `${user?.uid}/${activePatientId}`;
    pending.current = null;
    baseline.current = { revision: '', legacy: legacyVersion(undefined) };

    if (!ready || !activePatientId) {
      return () => {
        cancelled = true;
      };
    }

    void getDocFromServer(doc(db, "patients", activePatientId, "care_handbook", "main"))
      .then((snapshot) => {
        if (cancelled) return;
        const data = snapshot.data();
        baseline.current = { revision: versionOf(data), legacy: legacyVersion(data) };
        setRevision(versionOf(data));
        setForm(handbookForm(data));
      })
      .catch((error: unknown) => {
        console.error("Failed to load care handbook:", error);
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      scope.current = '';
      generation.current += 1;
    };
  }, [activePatientId, ready, reload, user?.uid]);

  const updateField = (key: FormField, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const saveHandbook = async () => {
    if (savingRef.current || loading || loadError || conflict) return;
    if (!user) {
      Alert.alert(t.resultErrorTitle, t.resultNotLoggedIn);
      return;
    }
    if (!activePatientId) {
      Alert.alert(t.resultErrorTitle, t.resultNoPatient);
      return;
    }

    const trimmedForm = Object.fromEntries(
      Object.entries(form).map(([key, value]) => [key, value.trim()])
    ) as CareHandbookForm;

    const submittedScope = scope.current;
    const submittedGeneration = generation.current;
    try {
      savingRef.current = true;
      setSaving(true);
      pending.current ??= { revision: randomUUID(), form: trimmedForm };
      const operation = pending.current;
      await publishHandbook(db, activePatientId, user.uid, operation.form,
        baseline.current.revision, baseline.current.legacy, operation.revision);
      if (scope.current !== submittedScope || generation.current !== submittedGeneration) return;
      baseline.current = { revision: operation.revision, legacy: '' };
      setRevision(operation.revision);
      pending.current = null;
      setRetryNeeded(false);
      setForm(trimmedForm);
      Alert.alert(t.handbookSavedTitle, t.handbookSavedMessage, [
        {
          text: t.confirm,
          onPress: () => {
            Alert.alert(t.handbookNotifyCaregiverTitle, t.handbookNotifyCaregiverMessage, [
              { text: t.handbookNotifyLater, style: "cancel" },
              {
                text: t.handbookGoToChat,
                onPress: () =>
                  router.push({
                    pathname: "/family/chat-room",
                    params: { patientId: activePatientId },
                  }),
              },
            ]);
          },
        },
      ]);
    } catch (error: unknown) {
      if (scope.current !== submittedScope || generation.current !== submittedGeneration) return;
      console.error("Failed to save care handbook:", error);
      if ((error as { code?: string }).code === 'care/conflict') {
        pending.current = null;
        setRetryNeeded(false);
        setConflict(true);
        Alert.alert(t.resultErrorTitle, copy.conflict);
      } else {
        setRetryNeeded(true);
        Alert.alert(t.resultErrorTitle, copy.failed);
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
    >
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={12}>
          <Ionicons name="chevron-back" size={28} color="#2F2F2F" />
          <Text style={styles.backText}>{t.back}</Text>
        </Pressable>
        <Text style={styles.title}>{t.handbook}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 48 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.introCard}>
          <Text style={styles.patientName}>{activePatient?.name ?? "—"}</Text>
          <Text style={styles.description}>{t.handbookDescription}</Text>
        </View>

        {!ready || loading ? (
          <ActivityIndicator size="large" color="#F5A623" style={styles.loader} />
        ) : loadError ? (
          <Text style={styles.errorText}>{t.handbookLoadFailed}</Text>
        ) : !activePatientId ? (
          <Text style={styles.errorText}>{t.resultNoPatient}</Text>
        ) : (
          <>
            <Text style={styles.description}>{copy.saveHint}</Text>
            {(conflict || retryNeeded) && <Text accessibilityRole="alert" style={styles.errorText}>{conflict ? copy.conflict : copy.failed}</Text>}
            {conflict && <Pressable accessibilityRole="button" onPress={() => Alert.alert(copy.reload, copy.discard,
              [{ text: t.cancel, style: 'cancel' }, { text: t.confirm, onPress: () => setReload(n => n + 1) }])}>
              <Text style={styles.errorText}>{copy.reload}</Text>
            </Pressable>}
            {fields.map((field) => (
              <View key={field.key} style={styles.inputCard}>
                <Text style={styles.fieldLabel}>{field.label}</Text>
                <TextInput
                  value={form[field.key]}
                  onChangeText={(value) => updateField(field.key, value)}
                  placeholder={field.placeholder}
                  placeholderTextColor="#9CA3AF"
                  multiline
                  editable={!saving && !retryNeeded}
                  maxLength={2000}
                  textAlignVertical="top"
                  style={styles.input}
                />
              </View>
            ))}

            <Pressable
              style={({ pressed }) => [
                styles.saveButton,
                (pressed || saving) && styles.saveButtonPressed,
              ]}
              onPress={() => void saveHandbook()}
              disabled={saving || conflict}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Ionicons name="save-outline" size={22} color="#FFFFFF" />
              )}
              <Text style={styles.saveButtonText}>{saving ? t.saving : t.saveHandbook}</Text>
            </Pressable>
            <HandoverStatus key={activePatientId} patientId={activePatientId} revision={revision} />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F7F7" },
  header: { minHeight: 86, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: "#FFFFFF", flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#E5E7EB", flexWrap: "wrap", gap: 8 },
  backButton: { flexDirection: "row", alignItems: "center", flexShrink: 1, minHeight: 44, maxWidth: "100%" },
  backText: { color: "#2F2F2F", fontSize: 16, fontWeight: "600", flexShrink: 1 },
  title: { fontSize: 22, fontWeight: "800", color: "#242424", flex: 1, minWidth: 0, textAlign: "center" },
  headerSpacer: { width: 28 },
  content: { padding: 18 },
  introCard: {
    backgroundColor: "#FFF5E3",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F5C66F",
    padding: 18,
    marginBottom: 18,
  },
  patientName: { fontSize: 22, fontWeight: "800", color: "#8A5400", marginBottom: 8 },
  description: { fontSize: 15, lineHeight: 22, color: "#604A2A" },
  loader: { marginVertical: 48 },
  errorText: { textAlign: "center", color: "#B42318", fontSize: 16, marginVertical: 36 },
  inputCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E4E8",
    padding: 16,
    marginBottom: 14,
  },
  fieldLabel: { fontSize: 17, fontWeight: "700", color: "#333333", marginBottom: 10 },
  input: {
    minHeight: 92,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D9DCE1",
    backgroundColor: "#FAFAFA",
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontSize: 16,
    lineHeight: 23,
    color: "#222222",
  },
  saveButton: { minHeight: 56, borderRadius: 14, backgroundColor: "#F5A623", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, marginTop: 8, paddingHorizontal: 12, paddingVertical: 12 },
  saveButtonPressed: { opacity: 0.68 },
  saveButtonText: { color: "#FFFFFF", fontSize: 18, fontWeight: "800", flexShrink: 1, textAlign: "center" },
});
