import { AppAlert as Alert } from "@/src/ui/AppAlert";
import { AppHeader, Button, Card, Chip, EmptyState, KeyboardAwareScroll, SectionHeader, TextField } from "@/src/ui/components";
import { colors, layout, spacing, typography } from "@/src/ui/theme";
import { emergencyContactsCopy } from "@/src/i18n/copy/accountCopy";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { doc, getDoc, updateDoc } from "firebase/firestore";

import { db } from "@/firebase/firebaseConfig";
import { useActiveCareTarget } from "@/src/care-target/useActiveCareTarget";
import { translations } from "@/src/i18n/translations";
import { useLanguage } from "@/src/store/LanguageContext";
import { usePrimaryFamily } from "@/src/care-target/usePrimaryFamily";

export default function FamilyEmergencyContactsScreen() {
  const { language } = useLanguage();
  const t = translations[language];
  const { ready, linkedCareTargets, activePatientId } = useActiveCareTarget();

  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [phone1, setPhone1] = useState("");
  const [phone2, setPhone2] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const isPrimaryFamily = usePrimaryFamily(selectedPatientId || null);
  const ec = emergencyContactsCopy[language];


  const validSelection = linkedCareTargets.some(item => item.id === selectedPatientId);
  const fallbackId = linkedCareTargets.some(item => item.id === activePatientId) ?
    activePatientId! : linkedCareTargets[0]?.id ?? "";
  if (ready && !validSelection && selectedPatientId !== fallbackId) setSelectedPatientId(fallbackId);
  const [previousPatientId, setPreviousPatientId] = useState(selectedPatientId);
  if (previousPatientId !== selectedPatientId) {
    setPreviousPatientId(selectedPatientId); setPhone1(""); setPhone2("");
    setLoading(Boolean(selectedPatientId));
  }

  useEffect(() => {
    if (!selectedPatientId) {
      return;
    }

    let alive = true;

    (async () => {
      try {
        const snap = await getDoc(doc(db, "patients", selectedPatientId));
        if (!alive) return;

        if (snap.exists()) {
          const data = snap.data() as any;
          setPhone1(String(data.emergencyPhone1 ?? ""));
          setPhone2(String(data.emergencyPhone2 ?? ""));
        }
      } catch (error) {
        console.log("load emergency contacts failed:", error);
        if (alive) Alert.alert(t.resultErrorTitle, t.emergencyContactsLoadFailed);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPatientId]);

  const canSave = useMemo(
    () => !!selectedPatientId && isPrimaryFamily && !loading && !saving,
    [selectedPatientId, isPrimaryFamily, loading, saving]
  );

  const handleSave = async () => {
    if (!selectedPatientId) return;

    const trimmed1 = phone1.trim();
    const trimmed2 = phone2.trim();

    if (!trimmed1 || !trimmed2) {
      Alert.alert(t.prompt, t.familyPhoneValidation);
      return;
    }

    try {
      setSaving(true);
      await updateDoc(doc(db, "patients", selectedPatientId), {
        emergencyPhone1: trimmed1,
        emergencyPhone2: trimmed2,
      });
      setPhone1(trimmed1);
      setPhone2(trimmed2);
      Alert.alert(t.saveSuccessTitle, t.saveSuccessMessage);
    } catch (error) {
      console.log("save emergency contacts failed:", error);
      Alert.alert(t.resultErrorTitle, t.emergencyContactsSaveFailed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader title={t.emergencyPhoneSettings} left="back" fallbackHref={"/family" as Href} />

      <KeyboardAwareScroll contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>{t.emergencyContactsSubtitle}</Text>

        {!ready ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} accessibilityLabel={t.loading} />
        ) : linkedCareTargets.length === 0 ? (
          <Card>
            <EmptyState
              icon="people-outline"
              title={t.emergencyContactsNoPatient}
              actionLabel={t.createCareTarget}
              onAction={() => router.push("/care-target/create" as any)}
            />
          </Card>
        ) : (
          <>
            {linkedCareTargets.length > 1 && (
              <>
                <SectionHeader title={t.emergencyContactsSelectPatient} />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.patientChipsRow}
                  style={styles.patientChipsWrap}
                >
                  {linkedCareTargets.map((patient) => (
                    <Chip
                      key={patient.id}
                      label={patient.name || t.unknown}
                      selected={patient.id === selectedPatientId}
                      onPress={() => setSelectedPatientId(patient.id)}
                      style={styles.patientChip}
                    />
                  ))}
                </ScrollView>
              </>
            )}

            <SectionHeader title={ec.phonesSection} />
            <Card style={styles.card}>
              {loading ? (
                <ActivityIndicator color={colors.primary} style={styles.loader} accessibilityLabel={t.loading} />
              ) : (
                <>
                  <TextField
                    label={t.emergencyPhone1}
                    value={phone1}
                    onChangeText={setPhone1}
                    editable={isPrimaryFamily}
                    keyboardType="phone-pad"
                    autoComplete="tel"
                    placeholder={t.emergencyPhonePlaceholder1}
                  />
                  <TextField
                    label={t.emergencyPhone2}
                    value={phone2}
                    onChangeText={setPhone2}
                    editable={isPrimaryFamily}
                    keyboardType="phone-pad"
                    autoComplete="tel"
                    placeholder={t.emergencyPhonePlaceholder2}
                  />
                </>
              )}
            </Card>

            {!isPrimaryFamily && (
              <Card tone="sunken" style={styles.notice}>
                <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} />
                <Text style={styles.noticeText}>{ec.primaryOnly}</Text>
              </Card>
            )}
            <Button
              label={saving ? t.loading : t.save}
              size="lg"
              fullWidth
              loading={saving}
              disabled={!canSave}
              onPress={handleSave}
              style={styles.saveButton}
            />
          </>
        )}
      </KeyboardAwareScroll>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  content: { gap: 0, width: "100%", maxWidth: layout.maxContentWidth, alignSelf: "center" },
  subtitle: { ...typography.bodySmall, paddingHorizontal: spacing.xs },
  loader: { marginVertical: spacing.xl },
  patientChipsWrap: { flexGrow: 0, flexShrink: 0 },
  patientChipsRow: { flexGrow: 0, gap: spacing.sm, paddingVertical: 2 },
  patientChip: { minHeight: 48 },
  card: { gap: spacing.lg },
  notice: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, marginTop: spacing.lg },
  noticeText: { ...typography.bodySmall, flex: 1 },
  saveButton: { marginTop: spacing.xl },
});
