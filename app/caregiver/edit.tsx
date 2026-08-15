import React, { useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, ScrollView, Pressable, Alert, StyleSheet, StatusBar, KeyboardAvoidingView, Platform, } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useAuthContext } from "@/src/auth/AuthProvider";
import { Ionicons } from "@expo/vector-icons";
import { doc, collection, getDoc, getDocs, query, where, writeBatch, serverTimestamp } from "firebase/firestore";
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
  } catch (e) {
    return [{ itemId: undefined, name: "", dosage: "", usage_type: "", usage_time: "", feeding_times: "", memo: "" }];
  }
}

export default function CaregiverEditScreen() {
  const { id, itemsJson } = useLocalSearchParams<{ id?: string; itemsJson?: string }>();
  const { ready } = useAuthContext();
  const { language } = useLanguage();
  const t = translations[language];
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
      } catch (e) {
        console.log("caregiver edit load items error:", e);
      }
    })();
  }, [id, language]);

  const updateItem = (index: number, field: keyof EditItem, value: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleSave = async () => {
    if (!id) return;
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

        const remindersBatch = writeBatch(db);
        const remindersSnap = await getDocs(
          query(
            collection(db, "medication_reminders"),
            where("prescriptionId", "==", id)
          )
        );

        remindersSnap.docs.forEach((docSnap) => {
          remindersBatch.delete(docSnap.ref);
        });

        await remindersBatch.commit();

        await createMedicationReminders({
          patientId,
          prescriptionId: id,
          items: items.map((it) => ({
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
              onPress: () => router.back(),
            },
          ]
        );
      } catch (reminderError) {
        console.log(
          "medication reminder update error:",
          reminderError
        );

        Alert.alert(
          "藥單已儲存",
          "藥單資料已成功更新，但用藥提醒更新失敗。",
          [
            {
              text: t.confirm,
              onPress: () => router.back(),
            },
          ]
        );
      }
    } catch (e) {
      console.log("caregiver edit save error:", e);
      Alert.alert(t.resultErrorTitle, t.inputFailedCloud);
    }
  };

  if (!ready) return <View style={styles.center}><Text>{t.loading}</Text></View>;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color="#333" /><Text style={styles.backText}>{t.back}</Text>
        </Pressable>
      </View>

      <View style={styles.titleRow}>
        <Text style={styles.pageTitle}>{t.editPrescriptionInfo}</Text>
        <Pressable onPress={handleSave} style={styles.saveBtn}><Text style={styles.saveBtnText}>{t.save}</Text></Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={
            Platform.OS === "ios" ? "interactive" : "on-drag"
          }
        >
        <View style={styles.editCard}>
          <Text style={styles.itemTag}>藥單基本資訊</Text>

          <View style={styles.inputBox}>
            <Text style={styles.label}>{t.recordTitle}</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder={t.recordTitlePlaceholder}
            />
          </View>

          <View style={styles.inputBox}>
            <Text style={styles.label}>診所／醫療機構</Text>
            <TextInput
              style={styles.input}
              value={clinicName}
              onChangeText={setClinicName}
              placeholder="請輸入診所或醫療機構名稱"
            />
          </View>

          <View style={styles.inputBox}>
            <Text style={styles.label}>科別</Text>
            <TextInput
              style={styles.input}
              value={department}
              onChangeText={setDepartment}
              placeholder="請輸入科別"
            />
          </View>
        </View>

        {items.map((it, idx) => (
          <View key={it.itemId ?? idx} style={styles.editCard}>
            <Text style={styles.itemTag}>{t.medicineItem} {idx + 1}</Text>
            <View style={styles.inputBox}><Text style={styles.label}>{t.medicineName}</Text><TextInput style={styles.input} value={it.name} onChangeText={(text) => updateItem(idx, "name", text)} /></View>
            <View style={styles.inputBox}><Text style={styles.label}>{t.dosage}</Text><TextInput style={styles.input} value={it.dosage} onChangeText={(text) => updateItem(idx, "dosage", text)} /></View>
            <View style={styles.inputBox}><Text style={styles.label}>{t.usageExample}</Text><TextInput style={styles.input} value={it.usage_type} onChangeText={(text) => updateItem(idx, "usage_type", text)} /></View>
            <View style={styles.inputBox}><Text style={styles.label}>{t.usageTimeExample}</Text><TextInput style={styles.input} value={it.usage_time} onChangeText={(text) => updateItem(idx, "usage_time", text)} /></View>
            <View style={styles.inputBox}>
              <Text style={styles.label}>自訂餵藥時間</Text>
              <TextInput
                style={styles.input}
                value={it.feeding_times}
                onChangeText={(text) => updateItem(idx, "feeding_times", text)}
                placeholder="例如 08:30, 13:00, 19:30"
                keyboardType="numbers-and-punctuation"
              />
              <Text style={styles.helperText}>可輸入多個時間，以逗號分隔；未設定時沿用藥單自動判斷的時間。</Text>
            </View>
            <View style={styles.inputBox}>
              <Text style={styles.label}>{t.note}</Text>
              <TextInput
                style={[styles.input, styles.memoInput]}
                value={prescriptionMemo}
                multiline
                onChangeText={setPrescriptionMemo}
                placeholder="請輸入藥單備註"
              />
            </View>
          </View>
        ))}
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: { backgroundColor: "#F4E770", height: 100, paddingTop: 50, paddingHorizontal: 15, flexDirection: "row", alignItems: "center" },
  backBtn: { flexDirection: "row", alignItems: "center" },
  backText: { fontSize: 20, fontWeight: "bold", color: "#000", marginLeft: 2 },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 15 },
  pageTitle: { fontSize: 26, fontWeight: "900", color: "#000" },
  saveBtn: { backgroundColor: "#A7C7FF", paddingHorizontal: 18, paddingVertical: 8, borderRadius: 12 },
  saveBtnText: { color: "#0863f6", fontWeight: "bold", fontSize: 16 },
  scrollContent: { padding: 20, gap: 20},
  editCard: { padding: 20, borderRadius: 20, borderWidth: 1, borderColor: "#E0E0E0", backgroundColor: "#fff", gap: 15 },
  itemTag: { color: "#007AFF", fontWeight: "bold", fontSize: 16 },
  inputBox: { gap: 8 },
  label: { fontSize: 15, color: "#666", fontWeight: "600" },
  input: { backgroundColor: "#F5F5F5", padding: 12, borderRadius: 10, fontSize: 16 },
  memoInput: { height: 80, textAlignVertical: "top" },
  helperText: { fontSize: 12, color: "#888", lineHeight: 18 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
});
