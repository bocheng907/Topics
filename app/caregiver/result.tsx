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
import { createMedicationReminders } from "@/src/reminders/createMedicationReminders";

type Item = {
  name: string;
  dose: string;
  quantity: string;
  time: string[];
  note: string;
};

function toArray(v: any): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x));
  if (typeof v === "string" && v.trim()) return [v];
  return [];
}

function mapItemFromAnalyze(it: any): Item {
  return {
    name: it.drug_name ?? it.name ?? "（未辨識藥品名稱）",
    dose: it.dosage ?? it.dose ?? "未提供",
    quantity: it.quantity ?? "依醫囑",
    time: toArray(it.usage_zh ?? it.usage ?? it.time),
    note: it.note_zh ?? it.memo ?? "", // ⭐ 關鍵修正
  };
}

function mapItemFromFirestore(it: any): Item {
  return {
    name: it.drug_name_zh ?? it.drug_name ?? it.name ?? "（未辨識藥品名稱）",
    dose: it.dose ?? it.dosage ?? "未提供",
    quantity: it.quantity ?? "依醫囑",
    time: toArray(it.usage_zh ?? it.usage ?? it.time),
    note: it.note_zh ?? it.memo ?? "",
  };
}

function makePrescriptionId(patientId: string, date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");

  const timeString = `${y}-${m}-${d}_${hh}-${mm}-${ss}`;
  const shortId = patientId.slice(-4);

  return `${timeString}_pre_${shortId}`;
}

export default function ResultScreen() {
  const { prescriptionId, imageUrl, draftTitle, analyzeResult } =
    useLocalSearchParams<{
      prescriptionId?: string;
      imageUrl?: string;
      draftTitle?: string;
      analyzeResult?: string;
    }>();

  const { activePatientId } = useActiveCareTarget();
  const { user } = useAuth();

  const [status, setStatus] = useState<"loading" | "done">("loading");
  const [items, setItems] = useState<Item[]>([]);
  const [title, setTitle] = useState("");
  const [imageUri, setImageUri] = useState<string | undefined>(undefined);
  const [globalMemo, setGlobalMemo] = useState("");
  const [saving, setSaving] = useState(false);

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
      setTitle(draftTitle ?? "未命名藥單");
      setGlobalMemo(safe.memo ?? "");
      setItems(medicines.map((it) => mapItemFromAnalyze(it)));
      setStatus("done");
      return;
    }

    if (!prescriptionId) {
      Alert.alert("錯誤", "缺少藥單 ID");
      router.replace("/caregiver");
      return;
    }

    (async () => {
      try {
        const ref = doc(db, "prescriptions", prescriptionId);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          Alert.alert("錯誤", "找不到藥單資料");
          router.replace("/caregiver");
          return;
        }

        const data = snap.data() as any;

        setImageUri(data.sourceImageUrl);
        setTitle(data.title ?? "");
        setGlobalMemo(data.memo ?? "");

        const itemsQ = query(
          collection(db, "prescriptions", prescriptionId, "items"),
          orderBy("__name__", "asc")
        );
        const itemsSnap = await getDocs(itemsQ);

        const mapped = itemsSnap.docs.map((d) => mapItemFromFirestore(d.data()));
        setItems(mapped);

        setStatus("done");
      } catch (e) {
        console.log("read prescription error:", e);
        Alert.alert("讀取失敗", "無法讀取藥單資料");
        router.replace("/caregiver");
      }
    })();
  }, [prescriptionId, isDraftMode, safeAnalyze, imageUrl, draftTitle]);

  async function handlePrimaryAction() {
    if (isDraftMode) {
      if (!user) {
        Alert.alert("尚未登入", "請先登入");
        return;
      }

      if (!activePatientId) {
        Alert.alert("尚未選擇長輩", "請先選擇長輩");
        return;
      }

      const finalTitle = title.trim();
      if (!finalTitle) {
        Alert.alert("請輸入標題", "紀錄標題不能為空白");
        return;
      }

      try {
        setSaving(true);

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

        const prescriptionId = makePrescriptionId(activePatientId);
        const presRef = doc(db, "prescriptions", prescriptionId);

        await setDoc(presRef, {
          createdBy: user.uid,
          patientId: activePatientId,
          sourceImageUrl: safeImageUrl,
          status: "parsed",
          title: finalTitle,
          createdAt: serverTimestamp(),
          clinic_name: safe.clinic_name ?? "",
          visit_date: safe.visit_date ?? "",
          patient_name: safe.patient_name ?? "",
          memo: safe.memo ?? "",
          aiRaw: safe,
        });

        const batch = writeBatch(db);

        for (const it of medicines) {
          const itemRef = doc(collection(db, "prescriptions", presRef.id, "items"));

          batch.set(itemRef, {
            raw: it,
            drug_name_zh: it.drug_name ?? "",
            drug_name: it.drug_name ?? "",
            dose: it.dosage ?? "",
            dosage: it.dosage ?? "",
            quantity: it.quantity ?? "",
            usage_zh: it.usage_zh ?? "",
            memo: it.memo ?? "",
            note_zh: it.memo ?? "",
            drug_name_translated: "",
            note_translated: "",
          });
        }

        await batch.commit();

        console.log("[save] prescriptionId =", presRef.id);
        console.log("[save] createdBy =", user.uid);
        console.log("[save] patientId =", activePatientId);

        await createMedicationReminders({
          patientId: activePatientId,
          prescriptionId: presRef.id,
          items: medicines.map((it) => ({
            drug_name_zh: it.drug_name ?? "",
            dose: it.dosage ?? "",
            time_of_day: it.usage_zh ?? "",
          })),
        });

        router.replace("/caregiver/list");
      } catch (e) {
        console.log("save prescription error:", e);
        Alert.alert("儲存失敗", "無法儲存藥單資料");
      } finally {
        setSaving(false);
      }

      return;
    }

    router.replace("/caregiver/list");
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 90, gap: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: "900", color: "#333" }}>
        {status === "loading" ? "解析中..." : "確認藥單資訊"}
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
            AI 正在努力解析中...
          </Text>
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          <View style={{ gap: 6 }}>
            <Text style={{ fontWeight: "800", fontSize: 16 }}>紀錄標題</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              editable={isDraftMode && !saving}
              placeholder="請輸入紀錄標題"
              style={{
                borderWidth: 1,
                borderColor: "#ccc",
                borderRadius: 8,
                padding: 12,
                backgroundColor: "#f5f5f5",
              }}
            />
          </View>

          <Text style={{ fontSize: 18, fontWeight: "800", marginTop: 8 }}>
            藥品明細
          </Text>

          {items.map((it, idx) => (
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
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "800",
                  color: "#007AFF",
                }}
              >
                {it.name}
              </Text>
              <View style={{ gap: 2 }}>
                <Text style={{ fontSize: 15, color: "#444" }}>
                  用法劑量：{it.dose}
                </Text>
                <Text style={{ fontSize: 15, color: "#444" }}>
                  數量：{it.quantity}
                </Text>
                <Text style={{ fontSize: 15, color: "#444" }}>
                  服用時段：{it.time.join(", ") || "未提供"}
                </Text>
                <Text
                  style={{
                    fontSize: 15,
                    color: it.note ? "#666" : "#CCC",
                    marginTop: 2,
                  }}
                >
                  備註：{it.note || "無"}
                </Text>
              </View>
            </View>
          ))}

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
                  ? "儲存中..."
                  : isDraftMode
                  ? "確認並儲存"
                  : "返回藥單列表"}
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </ScrollView>
  );
}