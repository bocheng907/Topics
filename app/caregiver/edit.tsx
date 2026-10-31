import { AppHeader, Button, Card, KeyboardAwareScroll, TextField } from "@/src/ui/components";
import { colors, layout, spacing, typography } from "@/src/ui/theme";
import { caregiverCopy } from "@/src/i18n/copy/caregiverCopy";
import PrescriptionWriteGuard from "@/src/care-target/PrescriptionWriteGuard";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, View, Text, StyleSheet, StatusBar } from "react-native";
import { AppAlert as Alert } from "@/src/ui/AppAlert";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { useAuthContext } from "@/src/auth/AuthProvider";
import { doc, collection, getDoc, getDocs, query, writeBatch, serverTimestamp } from "firebase/firestore";
import { db } from "@/firebase/firebaseConfig";
import { createMedicationReminders, inferScheduleTimesFromText, normalizeExplicitScheduleTimes } from "@/src/reminders/createMedicationReminders";
import {
  ensureFirestoreTranslations,
  PRESCRIPTION_ITEM_TRANSLATION_SPECS,
} from "@/src/i18n/dynamicTranslation";
import { pickLocalizedString, translations, type Language } from "@/src/i18n/translations";
import { useLanguage } from "@/src/store/LanguageContext";

type EditItem = {
  itemId?: string;
  name: string;
  dosage: string;
  usage_type: string;
  usage_time: string;
  feeding_times: string;
  memo: string;
};

function formatPrescriptionMemo(value: any): string {
  if (typeof value === "string") {
    return value;
  }

  if (!value || typeof value !== "object") {
    return "";
  }

  return [
    value.doctor_instructions,
    value.precautions,
    value.refill_info,
    value.other,
  ]
    .filter(
      (item): item is string =>
        typeof item === "string" && item.trim().length > 0
    )
    .join("；");
}

function safeParseItems(itemsJson: string | undefined, language: Language): EditItem[] {
  if (!itemsJson) return [{ itemId: undefined, name: "", dosage: "", usage_type: "", usage_time: "", feeding_times: "", memo: "" }];
  try {
    const data = JSON.parse(itemsJson);
    return data.map((it: any) => {
      const usage = pickLocalizedString(it.raw ?? it, "usage", language, it.usage_zh ?? it.usage ?? it.time_of_day ?? it.time ?? "");
      const parts = String(usage ?? "")
        .split(/[，,]/)
        .map((part) => part.trim())
        .filter(Boolean);
      return {
        itemId: it.itemId ?? it.id ?? undefined,
        name: pickLocalizedString(it.raw ?? it, "drug_name", language, it.drug_name_zh ?? it.drug_name ?? it.name ?? ""),
        dosage: it.dose ?? it.dosage ?? "",
        usage_type: parts[0] || "",
        usage_time: parts.slice(1).join("，") || "",
        feeding_times: (Array.isArray(it.feeding_times) ? it.feeding_times : inferScheduleTimesFromText(String(usage ?? ""))).join(", "),
        memo: pickLocalizedString(it.raw ?? it, "note", language, it.note_zh ?? it.memo ?? it.note ?? ""),
      };
    });
  } catch {
    return [{ itemId: undefined, name: "", dosage: "", usage_type: "", usage_time: "", feeding_times: "", memo: "" }];
  }
}

function CaregiverEditScreen() {
  const { id, itemsJson } = useLocalSearchParams<{ id?: string; itemsJson?: string }>();
  const { ready } = useAuthContext();
  const { language } = useLanguage();
  const t = translations[language];
  const c = caregiverCopy[language];
  const [saving, setSaving] = useState(false);
  const initialItems = useMemo(() => safeParseItems(itemsJson, language), [itemsJson, language]);
  const [items, setItems] = useState<EditItem[]>(initialItems);
  const [title, setTitle] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [department, setDepartment] = useState("");
  const [prescriptionMemo, setPrescriptionMemo] = useState("");

  useEffect(() => {
    if (!id) return;

    (async () => {
      try {
        const presRef = doc(db, "prescriptions", id);
        const presSnap = await getDoc(presRef);

        if (presSnap.exists()) {
          const prescription = presSnap.data() as any;

          setTitle(String(prescription.title ?? ""));

          setClinicName(
            String(
              prescription.clinic_name ??
              prescription.clinicName ??
              ""
            )
          );

          setDepartment(
            String(prescription.department ?? "")
          );

          setPrescriptionMemo(
            formatPrescriptionMemo(prescription.memo)
          );
        }

        const itemsSnap = await getDocs(
          query(collection(db, "prescriptions", id, "items"))
        );
        const translatedItems = await Promise.all(
          itemsSnap.docs.map(async (docSnap) => {
            const raw = docSnap.data() as any;
            const translated = await ensureFirestoreTranslations(
              doc(db, "prescriptions", id, "items", docSnap.id),
              raw,
              language,
              PRESCRIPTION_ITEM_TRANSLATION_SPECS
            );
            return { id: docSnap.id, data: { ...raw, ...translated } };
          })
        );
        const fetchedItems: EditItem[] = translatedItems.map((docSnap) => {
          const it = docSnap.data as any;
          const usage = pickLocalizedString(it, "usage", language, it.usage_zh ?? it.usage ?? it.time_of_day ?? it.time ?? "");
          const parts = String(usage ?? "")
            .split(/[，,]/)
            .map((part) => part.trim())
            .filter(Boolean);

          return {
            itemId: docSnap.id,
            name: pickLocalizedString(it, "drug_name", language, it.drug_name_zh ?? it.drug_name ?? it.name ?? ""),
            dosage: it.dose ?? it.dosage ?? "",
            usage_type: parts[0] || "",
            usage_time: parts.slice(1).join("，") || "",
            feeding_times: (Array.isArray(it.feeding_times) ? it.feeding_times : inferScheduleTimesFromText(String(usage ?? ""))).join(", "),
            memo: pickLocalizedString(it, "note", language, it.note_zh ?? it.memo ?? it.note ?? ""),
          };
        });

        if (fetchedItems.length > 0) {
          setItems(fetchedItems);
        }
      } catch (error) {
        console.log("caregiver edit load items error:", error);
      }
    })();
  }, [id, language]);

  const updateItem = (index: number, field: keyof EditItem, value: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleSave = async () => {
    if (!id || saving) return;
    setSaving(true);
    try {
      const batch = writeBatch(db);
      const presRef = doc(db, "prescriptions", id);
      batch.update(presRef, {
        title: title.trim(),
        clinic_name: clinicName.trim(),
        department: department.trim(),
        memo: prescriptionMemo.trim(),
        updatedAt: serverTimestamp(),
      });

      items.forEach((it) => {
        if (!it.itemId) return;

        const itemRef = doc(db, "prescriptions", id, "items", it.itemId);
        const combinedUsage = `${it.usage_type}${it.usage_time ? "," + it.usage_time : ""}`;

        batch.update(itemRef, {
          drug_name_zh: it.name,
          drug_name: it.name,
          dose: it.dosage,
          dosage: it.dosage,
          usage_zh: combinedUsage,
          feeding_times: normalizeExplicitScheduleTimes(it.feeding_times),
          note_zh: it.memo,
          memo: it.memo,
          updatedAt: serverTimestamp(),
        });
      });

      await batch.commit();

      try {
        const presSnap = await getDoc(presRef);
        const patientId = String(presSnap.data()?.patientId ?? "");

        await createMedicationReminders({
          patientId,
          prescriptionId: id,
          items: items.map((it) => ({
            itemId: it.itemId,
            drug_name_zh: it.name,
            dose: it.dosage,
            time_of_day: `${it.usage_type}${
              it.usage_time ? "," + it.usage_time : ""
            }`,
            feeding_times: normalizeExplicitScheduleTimes(it.feeding_times),
          })),
        });

        Alert.alert(
          t.saveSuccessTitle,
          t.saveSuccessMessage,
          [
            {
              text: t.confirm,
              onPress: () => router.canGoBack() ? router.back() : router.replace("/caregiver/list"),
            },
          ]
        );
      } catch (reminderError) {
        console.log(
          "medication reminder update error:",
          reminderError
        );

        Alert.alert(
          c.editSavedReminderFailedTitle,
          c.editSavedReminderFailedMessage,
          [
            {
              text: t.confirm,
              onPress: () => router.canGoBack() ? router.back() : router.replace("/caregiver/list"),
            },
          ]
        );
      }
    } catch (e) {
      console.log("caregiver edit save error:", e);
      Alert.alert(t.resultErrorTitle, t.inputFailedCloud);
    } finally {
      setSaving(false);
    }
  };

  const header = (
    <AppHeader
      title={t.editPrescriptionInfo}
      fallbackHref={"/caregiver/list" as Href}
      right={ready ? <Button label={t.save} variant="ghost" onPress={handleSave} loading={saving} disabled={!id} /> : undefined}
    />
  );

  if (!ready) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.centerText}>{t.loading}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      {header}

      <KeyboardAwareScroll contentContainerStyle={styles.scrollContent}>
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>{c.editBasicInfo}</Text>
          <TextField
            label={t.recordTitle}
            value={title}
            onChangeText={setTitle}
            placeholder={t.recordTitlePlaceholder}
          />
          <TextField
            label={c.editClinicLabel}
            value={clinicName}
            onChangeText={setClinicName}
            placeholder={c.editClinicPlaceholder}
          />
          <TextField
            label={c.departmentLabel}
            value={department}
            onChangeText={setDepartment}
            placeholder={c.editDepartmentPlaceholder}
          />
          <TextField
            label={t.prescriptionNote}
            value={prescriptionMemo}
            multiline
            placeholder={t.notePlaceholder}
            onChangeText={setPrescriptionMemo}
          />
        </Card>

        {items.map((it, idx) => (
          <Card key={it.itemId ?? idx} style={styles.card}>
            <Text style={styles.cardTitle}>{t.medicineItem} {idx + 1}</Text>
            <TextField label={t.medicineName} value={it.name} onChangeText={(text) => updateItem(idx, "name", text)} />
            <TextField label={t.dosage} value={it.dosage} onChangeText={(text) => updateItem(idx, "dosage", text)} />
            <TextField label={t.usageExample} value={it.usage_type} onChangeText={(text) => updateItem(idx, "usage_type", text)} />
            <TextField label={t.usageTimeExample} value={it.usage_time} onChangeText={(text) => updateItem(idx, "usage_time", text)} />
            <TextField
              label={c.editFeedingTimesLabel}
              value={it.feeding_times}
              onChangeText={(text) => updateItem(idx, "feeding_times", text)}
              placeholder={c.editFeedingTimesPlaceholder}
              keyboardType="numbers-and-punctuation"
              helper={c.editFeedingTimesHelper}
            />
            <TextField
              label={t.note}
              value={it.memo}
              multiline
              onChangeText={(text) => updateItem(idx, "memo", text)}
              placeholder={t.notePlaceholder}
            />
          </Card>
        ))}

        <Button label={t.save} size="lg" fullWidth onPress={handleSave} loading={saving} disabled={!id} />
      </KeyboardAwareScroll>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: spacing.md },
  centerText: { ...typography.body, color: colors.textSecondary },
  scrollContent: { width: "100%", maxWidth: layout.maxContentWidth, alignSelf: "center" },
  card: { gap: spacing.lg },
  cardTitle: { ...typography.header, color: colors.primary },
});

export default function GuardedCaregiverEditScreen() {
  return <PrescriptionWriteGuard><CaregiverEditScreen /></PrescriptionWriteGuard>;
}
