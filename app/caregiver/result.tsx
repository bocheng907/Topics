import { AppHeader, Button, Card, KeyboardAwareScroll, SectionHeader, TextField } from "@/src/ui/components";
import { colors, layout, radii, spacing, typography } from "@/src/ui/theme";
import { AppAlert as Alert } from "@/src/ui/AppAlert";
import { caregiverCopy } from "@/src/i18n/copy/caregiverCopy";
import PrescriptionWriteGuard from "@/src/care-target/PrescriptionWriteGuard";
import { useEffect, useMemo, useState } from "react";
import { View, Text, Image, ActivityIndicator, StyleSheet } from "react-native";
import { router, useLocalSearchParams, type Href } from "expo-router";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/firebase/firebaseConfig";
import { useActiveCareTarget } from "@/src/care-target/useActiveCareTarget";
import { useAuth } from "@/src/auth/useAuth";
import {
  ensureFirestoreTranslations,
  PRESCRIPTION_ITEM_TRANSLATION_SPECS,
} from "@/src/i18n/dynamicTranslation";
import { createMedicationReminders, inferScheduleTimesFromText } from "@/src/reminders/createMedicationReminders";
import {
  makePrescriptionDocumentId,
  makePrescriptionItemDocumentId,
} from "@/src/data/firestoreDocumentIds";
import { translations, type Language } from "@/src/i18n/translations";
import { useLanguage } from "@/src/store/LanguageContext";

type Item = {
  itemId?: string;
  raw: any;
  name: string;
  dose: string;
  quantity: string;
  time: string[];
  note: string;
};

function toArray(v: any): string[] {
  if (Array.isArray(v)) {
    return v
      .map((x) => String(x).trim())
      .filter(Boolean);
  }

  if (typeof v === "string" && v.trim()) {
    return v
      .split(/[，,]/)
      .map((part) => part.trim())
      .filter(Boolean);
  }

  return [];
}

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

function pickItemName(it: any): string {
  return String(it?.drug_name_zh ?? it?.drug_name ?? it?.name ?? "");
}

function pickItemDose(it: any): string {
  return String(it?.dose ?? it?.dosage ?? "");
}

function pickItemTime(it: any): string[] {
  return toArray(it?.usage_zh ?? it?.usage ?? it?.time_of_day ?? it?.time);
}

function pickItemNote(it: any): string {
  return String(it?.note_zh ?? it?.memo ?? it?.note ?? "");
}

function mapItem(it: any): Item {
  return {
    itemId: it?.itemId,
    raw: it,
    name: pickItemName(it) || "（未辨識藥品名稱）",
    dose: pickItemDose(it) || "未提供",
    quantity: it.quantity ?? "依醫囑",
    time: pickItemTime(it),
    note: pickItemNote(it),
  };
}

function pickLocalizedString(
  item: Item,
  baseName: "drug_name" | "usage" | "note",
  language: Language,
  fallbackValue: string
) {
  const raw = item.raw ?? {};
  const localized = raw[`${baseName}_${language}`];
  const zh = raw[`${baseName}_zh`];
  const base = raw[baseName];

  if (baseName === "drug_name") {
    return String(localized ?? zh ?? base ?? raw.drug_name_translated ?? fallbackValue);
  }

  if (baseName === "note") {
    return String(localized ?? zh ?? raw.memo ?? base ?? raw.note_translated ?? fallbackValue);
  }

  return String(localized ?? zh ?? base ?? fallbackValue);
}

function getDisplayItem(
  item: Item,
  language: Language,
  t: (typeof translations)[Language]
) {
  return {
    name:
      pickLocalizedString(item, "drug_name", language, item.name) ||
      t.unknownMedicine,
    dose: item.dose || t.dosageNotProvided,
    quantity: item.quantity || t.quantityDefault,
    time: toArray(
      pickLocalizedString(item, "usage", language, item.time.join(", "))
    ),
    note: pickLocalizedString(item, "note", language, item.note),
  };
}

function normalizeEditableText(value: string) {
  return value.trim();
}

function ResultScreen() {
  const { prescriptionId, imageUrl, draftTitle, analyzeResult } =
    useLocalSearchParams<{
      prescriptionId?: string;
      imageUrl?: string;
      draftTitle?: string;
      analyzeResult?: string;
    }>();

  const { activePatient, activePatientId } = useActiveCareTarget();
  const { user } = useAuth();
  const { language } = useLanguage();
  const t = translations[language];
  const c = caregiverCopy[language];
  const sep = language === "zh" ? "：" : ": ";

  const [status, setStatus] = useState<"loading" | "done">("loading");
  const [items, setItems] = useState<Item[]>([]);
  const [title, setTitle] = useState("");
  const [imageUri, setImageUri] = useState<string | undefined>(undefined);
  const [clinicName, setClinicName] = useState("");
  const [department, setDepartment] = useState("");
  const [globalMemo, setGlobalMemo] = useState("");
  const [saving, setSaving] = useState(false);

  function updateItem(index: number, changes: Partial<Item>) {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...changes } : item
      )
    );
  }

  const isDraftMode = !prescriptionId && !!analyzeResult;
  const safeImageUrl =
    typeof imageUrl === "string" && imageUrl.length > 0
      ? imageUrl
      : "";
  const safeAnalyze = useMemo(() => {
    try {
      return analyzeResult ? JSON.parse(analyzeResult) : null;
    } catch {
      return null;
    }
  }, [analyzeResult]);

  const draftScope = JSON.stringify([isDraftMode, safeAnalyze, safeImageUrl, draftTitle, t.cameraDefaultDraftTitle]);
  const [previousDraftScope, setPreviousDraftScope] = useState<string | null>(null);
  if (previousDraftScope !== draftScope) {
    setPreviousDraftScope(draftScope);
    if (isDraftMode) {
      const safe = safeAnalyze ?? {};

      const rawMeds =
        safe.medicines ??
        safe.items ??
        safe.result?.medicines ??
        safe.result?.items ??
        safe.data?.medicines ??
        safe.data?.items ??
        safe.payload?.medicines ??
        safe.payload?.items ??
        [];

      const medicines: any[] = Array.isArray(rawMeds)
        ? rawMeds
        : rawMeds && typeof rawMeds === "object"
        ? Object.values(rawMeds)
        : [];

      setImageUri(safeImageUrl);

      setTitle(
        String(safe.department ?? "").trim() ||
        draftTitle ||
        t.cameraDefaultDraftTitle
      );

      setClinicName(String(safe.clinic_name ?? safe.clinicName ?? ""));
      setDepartment(String(safe.department ?? ""));
      setGlobalMemo(formatPrescriptionMemo(safe.memo));
      setItems(medicines.map((it) => mapItem(it)));
      setStatus("done");
    }
  }

  useEffect(() => {
    if (isDraftMode) return;

    if (!prescriptionId) {
      Alert.alert(t.resultErrorTitle, t.resultMissingId);
      router.replace(user?.role === "family" ? "/family" : "/caregiver");
      return;
    }

    (async () => {
      try {
        const ref = doc(db, "prescriptions", prescriptionId);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          Alert.alert(t.resultErrorTitle, t.resultNotFound);
          router.replace(user?.role === "family" ? "/family" : "/caregiver");
          return;
        }

        const data = snap.data() as any;

        setImageUri(data.sourceImageUrl);

        setTitle(
          String(data.department ?? "").trim() ||
          data.title ||
          ""
        );

        setClinicName(String(data.clinic_name ?? data.clinicName ?? ""));
        setDepartment(String(data.department ?? ""));
        setGlobalMemo(formatPrescriptionMemo(data.memo));

        const itemsQ = query(
          collection(db, "prescriptions", prescriptionId, "items"),
          orderBy("__name__", "asc")
        );
        const itemsSnap = await getDocs(itemsQ);

        const translatedItems = await Promise.all(
          itemsSnap.docs.map(async (d) => {
            const raw = d.data() as any;
            const translated = await ensureFirestoreTranslations(
              doc(db, "prescriptions", prescriptionId, "items", d.id),
              raw,
              language,
              PRESCRIPTION_ITEM_TRANSLATION_SPECS
            );
            return { ...raw, ...translated, itemId: d.id };
          })
        );
        const mapped = translatedItems.map((item) => mapItem(item));
        setItems(mapped);

        setStatus("done");
      } catch (e) {
        console.log("read prescription error:", e);
        Alert.alert(t.resultReadFailedTitle, t.resultReadFailedMessage);
        router.replace(user?.role === "family" ? "/family" : "/caregiver");
      }
    })();
  }, [prescriptionId, isDraftMode, safeAnalyze, safeImageUrl, draftTitle, language, t, user?.role]);

  async function handlePrimaryAction() {
    if (isDraftMode) {
      if (!user) {
        Alert.alert(t.cameraNotLoggedInTitle, t.resultNotLoggedIn);
        return;
      }

      if (!activePatientId) {
        Alert.alert(t.cameraNoPatientTitle, t.resultNoPatient);
        return;
      }

      const finalTitle = title.trim();
      if (!finalTitle) {
        Alert.alert(t.resultTitleRequiredTitle, t.resultTitleRequiredMessage);
        return;
      }

      try {
        setSaving(true);

        const safe = safeAnalyze ?? {};

        const prescriptionId = makePrescriptionDocumentId({
          patientDocId: activePatientId,
          patientsId: activePatient?.patientsId,
        });
        const presRef = doc(db, "prescriptions", prescriptionId);

        const batch = writeBatch(db);
        batch.set(presRef, {
          createdBy: user.uid,
          patientId: activePatientId,
          patientsId: activePatient?.patientsId ?? "",
          sourceImageUrl: safeImageUrl,
          status: "parsed",
          title: finalTitle,
          createdAt: serverTimestamp(),
          clinic_name: safe.clinic_name ?? "",
          department: safe.department ?? "",
          visit_date: safe.visit_date ?? "",
          patient_name: safe.patient_name ?? "",
          memo: normalizeEditableText(globalMemo),
          aiRaw: safe,
        });

        for (const [itemIndex, item] of items.entries()) {
          const itemId = makePrescriptionItemDocumentId(itemIndex);
          const itemRef = doc(
            db,
            "prescriptions",
            presRef.id,
            "items",
            itemId
          );
          const name = normalizeEditableText(item.name);
          const dose = normalizeEditableText(item.dose);
          const time = item.time.join(",");
          const note = normalizeEditableText(item.note);

          batch.set(itemRef, {
            itemId,
            raw: item.raw,
            drug_name_zh: name,
            drug_name: name,
            dose,
            dosage: dose,
            quantity: item.quantity ?? "",
            usage_zh: time,
            feeding_times: inferScheduleTimesFromText(time),
            memo: note,
            note_zh: note,
            drug_name_translated: "",
            note_translated: "",
          });
        }

        await createMedicationReminders({
          creationBatch: batch,
          patientId: activePatientId,
          prescriptionId: presRef.id,
          items: items.map((item, itemIndex) => ({
            itemId: makePrescriptionItemDocumentId(itemIndex),
            drug_name_zh: normalizeEditableText(item.name),
            dose: normalizeEditableText(item.dose),
            time_of_day: item.time.join(","),
            feeding_times: inferScheduleTimesFromText(item.time.join(",")),
          })),
        });

        await batch.commit();
        router.replace(user?.role === "family" ? "/family/list" : "/caregiver/list");
      } catch (e) {
        console.log("save prescription error:", e);
        Alert.alert(t.resultSaveFailedTitle, t.resultSaveFailedMessage);
      } finally {
        setSaving(false);
      }

      return;
    }

    router.replace(user?.role === "family" ? "/family/list" : "/caregiver/list");
  }

  return (
    <View style={styles.screen}>
      <AppHeader
        title={status === "loading" ? t.resultLoadingTitle : t.resultDoneTitle}
        fallbackHref={(user?.role === "family" ? "/family" : "/caregiver") as Href}
      />
      <KeyboardAwareScroll contentContainerStyle={styles.content}>
        {imageUri && (
          <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />
        )}

        {status === "loading" ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>{t.resultAiLoading}</Text>
          </View>
        ) : (
          <>
            <Card style={styles.cardGap}>
              <TextField
                label={t.recordTitle}
                value={title}
                onChangeText={setTitle}
                editable={isDraftMode && !saving}
                placeholder={t.recordTitlePlaceholder}
              />
              <View style={styles.metaBlock}>
                <Text style={styles.metaText}>{c.clinicLabel}{sep}{clinicName || t.none}</Text>
                <Text style={styles.metaText}>{c.departmentLabel}{sep}{department || t.none}</Text>
              </View>
            </Card>

            <SectionHeader title={t.medicineDetails} />

            {items.map((it, idx) => {
              const displayItem = getDisplayItem(it, language, t);
              const note = displayItem.note;
              const method = displayItem.time[0] || t.notSet;
              const timeDetail = displayItem.time.slice(1).join("，") || t.asDirectedUsage;

              return (
                <Card key={idx} style={styles.cardGap}>
                  {isDraftMode ? (
                    <TextField
                      label={t.medicineName}
                      value={it.name}
                      onChangeText={(name) => updateItem(idx, { name })}
                      editable={!saving}
                      multiline
                      inputStyle={styles.itemNameInput}
                    />
                  ) : (
                    <Text style={styles.itemName}>{displayItem.name}</Text>
                  )}
                  <View>
                    <InfoRow label={t.dosage} value={displayItem.dose} />
                    <InfoRow label={t.quantity} value={displayItem.quantity} />
                    <InfoRow label={t.method} value={method} />
                    <InfoRow label={t.usageTime} value={timeDetail} />
                  </View>
                  {isDraftMode ? (
                    <TextField
                      label={t.medicineNote}
                      value={it.note}
                      onChangeText={(itemNote) => updateItem(idx, { note: itemNote })}
                      editable={!saving}
                      multiline
                      placeholder={t.notePlaceholder}
                      inputStyle={styles.noteInput}
                    />
                  ) : (
                    <Text style={note ? styles.noteText : styles.noteTextEmpty}>
                      {t.medicineNote}{sep}{note || t.none}
                    </Text>
                  )}
                </Card>
              );
            })}

            <TextField
              label={t.prescriptionNote}
              value={globalMemo}
              onChangeText={setGlobalMemo}
              editable={isDraftMode && !saving}
              multiline
              placeholder={t.notePlaceholder}
            />

            <Button
              label={saving ? t.saving : isDraftMode ? t.saveConfirm : t.backToList}
              icon={isDraftMode ? "checkmark" : "list-outline"}
              size="lg"
              fullWidth
              onPress={handlePrimaryAction}
              loading={saving}
              style={styles.primaryButton}
            />
          </>
        )}
      </KeyboardAwareScroll>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { width: "100%", maxWidth: layout.maxContentWidth, alignSelf: "center" },
  image: { width: "100%", height: 220, borderRadius: radii.card, backgroundColor: colors.surfaceSunken },
  loadingBox: { padding: spacing.xxl, alignItems: "center", gap: spacing.md },
  loadingText: { ...typography.body, color: colors.textSecondary, textAlign: "center" },
  cardGap: { gap: spacing.md },
  metaBlock: { gap: 2 },
  metaText: { ...typography.bodySmall },
  itemName: { ...typography.header, color: colors.primary },
  itemNameInput: { fontWeight: "600", color: colors.primary, minHeight: 50 },
  noteInput: { minHeight: 72 },
  infoRow: { flexDirection: "row", gap: spacing.md, paddingVertical: 3 },
  infoLabel: { ...typography.bodySmall, color: colors.textMuted, width: 96 },
  infoValue: { ...typography.bodyStrong, flex: 1 },
  noteText: { ...typography.bodySmall },
  noteTextEmpty: { ...typography.bodySmall, color: colors.textMuted },
  primaryButton: { marginTop: spacing.sm },
});

export default function GuardedResultScreen() {
  return <PrescriptionWriteGuard><ResultScreen /></PrescriptionWriteGuard>;
}
