import { db } from "@/firebase/firebaseConfig";
import { useAuth } from "@/src/auth/useAuth";
import { useActiveCareTarget } from "@/src/care-target/useActiveCareTarget";
import { translations } from "@/src/i18n/translations";
import { useLanguage } from "@/src/store/LanguageContext";
import { AppAlert as Alert } from "@/src/ui/AppAlert";
import { Ionicons } from "@expo/vector-icons";
import { router, type Href } from "expo-router";
import { doc, getDocFromServer } from "firebase/firestore";
import { randomUUID } from "expo-crypto";
import { handbookForm, legacyVersion, publishHandbook, versionOf } from "@/src/care-target/reliableWrites";
import { reliabilityCopy } from "@/src/care-target/reliabilityCopy";
import { HandoverStatus } from "@/src/care-target/HandoverStatus";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { AppHeader, Button, Card, EmptyState, KeyboardAwareScroll, TextField } from "@/src/ui/components";
import { colors, layout, radii, spacing, typography } from "@/src/ui/theme";

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
    <View style={styles.screen}>
      <AppHeader title={t.handbook} left="back" fallbackHref={"/family" as Href} />
      <KeyboardAwareScroll contentContainerStyle={styles.content}>
        <Card style={styles.introCard}>
          <View style={styles.introIcon}>
            <Ionicons name="book-outline" size={22} color={colors.primary} />
          </View>
          <View style={styles.introText}>
            <Text style={styles.patientName} numberOfLines={2}>{activePatient?.name ?? "—"}</Text>
            <Text style={styles.description}>{t.handbookDescription}</Text>
          </View>
        </Card>

        {!ready || loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
        ) : loadError ? (
          <EmptyState icon="cloud-offline-outline" title={t.handbookLoadFailed} />
        ) : !activePatientId ? (
          <EmptyState icon="people-outline" title={t.resultNoPatient} />
        ) : (
          <>
            <Text style={styles.hint}>{copy.saveHint}</Text>
            {(conflict || retryNeeded) ? (
              <View accessibilityRole="alert" style={styles.alert}>
                <Ionicons name="alert-circle" size={20} color={colors.danger} />
                <Text style={styles.alertText}>{conflict ? copy.conflict : copy.failed}</Text>
              </View>
            ) : null}
            {conflict ? (
              <Button
                label={copy.reload}
                icon="refresh"
                variant="secondary"
                fullWidth
                onPress={() => Alert.alert(copy.reload, copy.discard,
                  [{ text: t.cancel, style: 'cancel' }, { text: t.confirm, onPress: () => setReload(n => n + 1) }])}
              />
            ) : null}

            <Card style={styles.fieldsCard}>
              {fields.map((field) => (
                <TextField
                  key={field.key}
                  label={field.label}
                  value={form[field.key]}
                  onChangeText={(value) => updateField(field.key, value)}
                  placeholder={field.placeholder}
                  multiline
                  editable={!saving && !retryNeeded}
                  maxLength={2000}
                />
              ))}
            </Card>

            <Button
              label={saving ? t.saving : t.saveHandbook}
              icon="save-outline"
              size="lg"
              fullWidth
              loading={saving}
              disabled={saving || conflict}
              onPress={() => void saveHandbook()}
            />
            <HandoverStatus key={activePatientId} patientId={activePatientId} revision={revision} />
          </>
        )}
      </KeyboardAwareScroll>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { width: "100%", maxWidth: layout.maxContentWidth, alignSelf: "center" },
  introCard: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  introIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  introText: { flex: 1, minWidth: 0, gap: spacing.xs },
  patientName: { ...typography.title },
  description: { ...typography.bodySmall },
  hint: { ...typography.bodySmall, paddingHorizontal: spacing.xs },
  loader: { marginVertical: spacing.xxxl },
  alert: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.control,
    backgroundColor: colors.dangerSoft,
  },
  alertText: { ...typography.body, color: colors.danger, flex: 1 },
  fieldsCard: { gap: spacing.xl },
});
