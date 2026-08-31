import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Image,
  ActivityIndicator,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
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

export default function ResultScreen() {
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

  useEffect(() => {
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
      return;
    }

    if (!prescriptionId) {
      Alert.alert(t.resultErrorTitle, t.resultMissingId);
      router.replace("/caregiver");
      return;
    }

    (async () => {
      try {
        const ref = doc(db, "prescriptions", prescriptionId);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          Alert.alert(t.resultErrorTitle, t.resultNotFound);
          router.replace("/caregiver");
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
        router.replace("/caregiver");
      }
    })();
  }, [prescriptionId, isDraftMode, safeAnalyze, safeImageUrl, draftTitle, language, t]);

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

        await setDoc(presRef, {
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

        const batch = writeBatch(db);

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

        await batch.commit();

        await createMedicationReminders({
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

        router.replace("/caregiver/list");
      } catch (e) {
        console.log("save prescription error:", e);
        Alert.alert(t.resultSaveFailedTitle, t.resultSaveFailedMessage);
      } finally {
        setSaving(false);
      }

      return;
    }

    router.replace("/caregiver/list");
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 90, paddingBottom: 160, gap: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: "900", color: "#333" }}>
        {status === "loading" ? t.resultLoadingTitle : t.resultDoneTitle}
      </Text>

      {imageUri && (
        <Image
          source={{ uri: imageUri }}
          style={{
            width: "100%",
            height: 200,
            borderRadius: 12,
            backgroundColor: "#eee",
          }}
          resizeMode="contain"
        />
      )}

      {status === "loading" ? (
        <View style={{ padding: 40, alignItems: "center" }}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={{ marginTop: 10, opacity: 0.6 }}>
            {t.resultAiLoading}
          </Text>
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          <View style={{ gap: 6 }}>
            <Text style={{ fontWeight: "800", fontSize: 16 }}>{t.recordTitle}</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              editable={isDraftMode && !saving}
              placeholder={t.recordTitlePlaceholder}
              style={{
                borderWidth: 1,
                borderColor: "#ccc",
                borderRadius: 8,
                padding: 12,
                backgroundColor: "#f5f5f5",
              }}
            />
          </View>

          <View style={{ gap: 4 }}>
            <Text style={{ fontSize: 15, color: "#666" }}>
              診所：{clinicName || t.none}
            </Text>

            <Text style={{ fontSize: 15, color: "#666" }}>
              科別：{department || t.none}
            </Text>
          </View>

          <Text style={{ fontSize: 18, fontWeight: "800", marginTop: 8 }}>
            {t.medicineDetails}
          </Text>

          {items.map((it, idx) => {
            const displayItem = getDisplayItem(it, language, t);
            const note = displayItem.note;

            const method =
              displayItem.time[0] || t.notSet;

            const timeDetail =
              displayItem.time.slice(1).join("，") ||
              t.asDirectedUsage;

            return (
              <View
                key={idx}
                style={{
                  padding: 16,
                  borderWidth: 1,
                  borderColor: "#eee",
                  borderRadius: 12,
                  backgroundColor: "#fff",
                  gap: 6,
                }}
              >
                {isDraftMode ? (
                  <TextInput
                    value={it.name}
                    onChangeText={(name) => updateItem(idx, { name })}
                    editable={!saving}
                    multiline
                    style={{
                      fontSize: 18,
                      fontWeight: "800",
                      color: "#007AFF",
                      padding: 0,
                    }}
                  />
                ) : (
                  <Text
                    style={{
                      fontSize: 18,
                      fontWeight: "800",
                      color: "#007AFF",
                    }}
                  >
                    {displayItem.name}
                  </Text>
                )}
                <View style={{ gap: 2 }}>

                  <Text style={{ fontSize: 15, color: "#444" }}>
                    {t.dosage}：{displayItem.dose}
                  </Text>
                  <Text style={{ fontSize: 15, color: "#444" }}>
                    {t.quantity}：{displayItem.quantity}
                  </Text>
                  <Text style={{ fontSize: 15, color: "#444" }}>
                    {t.method}：{method}
                  </Text>
                  <Text style={{ fontSize: 15, color: "#444" }}>
                    {t.usageTime}：{timeDetail}
                  </Text>
                  {isDraftMode ? (
                    <View style={{ marginTop: 8, gap: 6 }}>
                      <Text style={{ fontSize: 15, color: "#666" }}>{t.medicineNote}</Text>
                      <TextInput
                        value={it.note}
                        onChangeText={(itemNote) => updateItem(idx, { note: itemNote })}
                        editable={!saving}
                        multiline
                        placeholder={t.notePlaceholder}
                        style={{
                          minHeight: 64,
                          padding: 10,
                          borderRadius: 8,
                          backgroundColor: "#F5F5F5",
                          color: "#333",
                          textAlignVertical: "top",
                        }}
                      />
                    </View>
                  ) : (
                    <Text
                      style={{
                        fontSize: 15,
                        color: note ? "#666" : "#CCC",
                        marginTop: 2,
                      }}
                    >
                      {t.medicineNote}：{note || t.none}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}

          <View style={{ gap: 6, marginTop: 4 }}>
            <Text style={{ fontWeight: "800", fontSize: 16 }}>{t.prescriptionNote}</Text>
            <TextInput
              value={globalMemo}
              onChangeText={setGlobalMemo}
              editable={isDraftMode && !saving}
              multiline
              placeholder={t.notePlaceholder}
              style={{
                minHeight: 80,
                borderWidth: 1,
                borderColor: "#ccc",
                borderRadius: 8,
                padding: 12,
                backgroundColor: isDraftMode ? "#fff" : "#f5f5f5",
                color: globalMemo ? "#333" : "#999",
                textAlignVertical: "top",
              }}
            />
          </View>

          <View style={{ marginTop: 20, gap: 12 }}>
            <Pressable
              onPress={handlePrimaryAction}
              style={{
                padding: 18,
                backgroundColor: "#007AFF",
                borderRadius: 12,
                opacity: saving ? 0.6 : 1,
              }}
              disabled={saving}
            >
              <Text
                style={{
                  color: "#fff",
                  textAlign: "center",
                  fontWeight: "800",
                  fontSize: 18,
                }}
              >
                {saving
                  ? t.saving
                  : isDraftMode
                  ? t.saveConfirm
                  : t.backToList}
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </ScrollView>
  );
}
