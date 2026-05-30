import { Feather, Ionicons } from "@expo/vector-icons";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { db } from "@/firebase/firebaseConfig";

type DailyChecklistItem = {
  id: string;
  patientId?: string;
  dateKey?: string;
  title?: string;
  isCompleted?: boolean;
  createdBy?: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
  completedAt?: Timestamp | null;
  completedBy?: string;
  source?: "default" | "custom";
  sortOrder?: number;
};

type Props = {
  patientId?: string | null;
  selectedDate: Date;
  caregiverUid?: string | null;
};

const DAILY_CHECKLIST_COLLECTION = "daily_checklist_items";

const DEFAULT_DAILY_CHECKLIST_TITLES = [
  "運動30分鐘",
  "喝水1000cc",
  "晚間關懷",
];

function pad2(value: number | string) {
  return String(value).padStart(2, "0");
}

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate()
  )}`;
}

export default function DailyChecklistCard({
  patientId,
  selectedDate,
  caregiverUid,
}: Props) {
  const [items, setItems] = useState<DailyChecklistItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [dailyInput, setDailyInput] = useState("");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const seededKeysRef = useRef<Set<string>>(new Set());

  const selectedDateKey = useMemo(
    () => formatDateKey(selectedDate),
    [selectedDate]
  );

  const sortedItems = useMemo(() => {
    const activeDefaultIds = patientId
      ? DEFAULT_DAILY_CHECKLIST_TITLES.map((_, index) => {
          return `${patientId}_${selectedDateKey}_default_${index}`;
        })
      : [];

    return [...items]
      .filter((item) => {
        if (item.source !== "default") {
          return true;
        }

        return activeDefaultIds.includes(item.id);
      })
      .sort((left, right) => {
        if (left.isCompleted !== right.isCompleted) {
          return left.isCompleted ? 1 : -1;
        }

        const leftOrder = left.sortOrder ?? 999;
        const rightOrder = right.sortOrder ?? 999;

        if (leftOrder !== rightOrder) {
          return leftOrder - rightOrder;
        }

        const leftTime = left.createdAt?.toMillis?.() ?? 0;
        const rightTime = right.createdAt?.toMillis?.() ?? 0;

        return leftTime - rightTime;
      });
  }, [items, patientId, selectedDateKey]);

  const completedCount = sortedItems.filter(
    (item: DailyChecklistItem) => item.isCompleted
  ).length;

  async function seedDefaultItems(
    targetPatientId: string,
    dateKey: string,
    uid: string,
    currentItems: DailyChecklistItem[]
  ) {
    const seedKey = `${targetPatientId}_${dateKey}_${DEFAULT_DAILY_CHECKLIST_TITLES.join(
      "_"
    )}`;

    if (seededKeysRef.current.has(seedKey)) {
      return;
    }

    seededKeysRef.current.add(seedKey);

    try {
      await Promise.all(
        DEFAULT_DAILY_CHECKLIST_TITLES.map((title, index) => {
          const itemId = `${targetPatientId}_${dateKey}_default_${index}`;

          const existingItem = currentItems.find((item) => item.id === itemId);

          if (!existingItem) {
            return setDoc(doc(db, DAILY_CHECKLIST_COLLECTION, itemId), {
              patientId: targetPatientId,
              dateKey,
              title,
              isCompleted: false,
              createdBy: uid,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              completedAt: null,
              completedBy: "",
              source: "default",
              sortOrder: index,
            });
          }

          if (existingItem.title !== title) {
            return updateDoc(doc(db, DAILY_CHECKLIST_COLLECTION, itemId), {
              title,
              updatedAt: serverTimestamp(),
            });
          }

          return Promise.resolve();
        })
      );
    } catch (error) {
      console.log("seed daily checklist failed:", error);
      Alert.alert("儲存失敗", "目前無法建立每日清單，請確認 Firestore 權限");
    }
  }

  useEffect(() => {
    if (!patientId || !caregiverUid) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const q = query(
      collection(db, DAILY_CHECKLIST_COLLECTION),
      where("patientId", "==", patientId),
      where("dateKey", "==", selectedDateKey)
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<DailyChecklistItem, "id">),
        }));

        setItems(rows);
        setLoading(false);

        void seedDefaultItems(patientId, selectedDateKey, caregiverUid, rows);
      },
      (error) => {
        console.log("daily checklist snapshot failed:", error);
        setItems([]);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [patientId, caregiverUid, selectedDateKey]);

  function resetForm() {
    setDailyInput("");
    setEditingItemId(null);
  }

  async function handleSaveItem() {
    if (!patientId || !caregiverUid) {
      Alert.alert("提醒", "請先選擇照顧對象");
      return;
    }

    const cleanTitle = dailyInput.trim();

    if (!cleanTitle) {
      Alert.alert("提醒", "請輸入每日清單事項");
      return;
    }

    try {
      if (editingItemId) {
        await updateDoc(doc(db, DAILY_CHECKLIST_COLLECTION, editingItemId), {
          title: cleanTitle,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, DAILY_CHECKLIST_COLLECTION), {
          patientId,
          dateKey: selectedDateKey,
          title: cleanTitle,
          isCompleted: false,
          createdBy: caregiverUid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          completedAt: null,
          completedBy: "",
          source: "custom",
          sortOrder: 999,
        });
      }

      resetForm();
    } catch (error) {
      console.log("save daily checklist item failed:", error);
      Alert.alert("儲存失敗", "目前無法儲存每日清單，請確認 Firestore 權限");
    }
  }

  function handleEditItem(item: DailyChecklistItem) {
    setDailyInput(item.title || "");
    setEditingItemId(item.id);
    setExpanded(true);
  }

  function handleDeleteItem(item: DailyChecklistItem) {
    Alert.alert("刪除事項", `確定要刪除「${item.title || "未命名事項"}」嗎？`, [
      { text: "取消", style: "cancel" },
      {
        text: "刪除",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteDoc(doc(db, DAILY_CHECKLIST_COLLECTION, item.id));
          } catch (error) {
            console.log("delete daily checklist item failed:", error);
            Alert.alert("刪除失敗", "目前無法刪除每日清單事項");
          }
        },
      },
    ]);
  }

  async function handleToggleCompleted(item: DailyChecklistItem) {
    if (!caregiverUid) return;

    const nextIsCompleted = !item.isCompleted;

    setItems((prevItems: DailyChecklistItem[]) =>
      prevItems.map((current: DailyChecklistItem) =>
        current.id === item.id
          ? { ...current, isCompleted: nextIsCompleted }
          : current
      )
    );

    try {
      await updateDoc(doc(db, DAILY_CHECKLIST_COLLECTION, item.id), {
        isCompleted: nextIsCompleted,
        completedAt: nextIsCompleted ? serverTimestamp() : null,
        completedBy: nextIsCompleted ? caregiverUid : "",
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.log("toggle daily checklist item failed:", error);

      setItems((prevItems: DailyChecklistItem[]) =>
        prevItems.map((current: DailyChecklistItem) =>
          current.id === item.id
            ? { ...current, isCompleted: item.isCompleted }
            : current
        )
      );

      Alert.alert("更新失敗", "目前無法更新完成狀態");
    }
  }

  return (
    <View style={styles.card}>
      <Pressable
        style={styles.collapsedHeader}
        onPress={() => setExpanded((prev) => !prev)}
      >
        <View style={styles.headerLeft}>
          <Text style={styles.title}>每日清單</Text>
          <Text style={styles.subtitle}>{selectedDateKey} 必做事項</Text>
        </View>

        <View style={styles.headerRight}>
          <View style={styles.progressPill}>
            <Text style={styles.progressText}>
              {completedCount}/{sortedItems.length || 0}
            </Text>
          </View>

          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={22}
            color="#5F4B32"
          />
        </View>
      </Pressable>

      {!expanded ? (
        <Text style={styles.collapsedHint}>點擊展開查看今日必做事項</Text>
      ) : (
        <View style={styles.expandedArea}>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={dailyInput}
              onChangeText={setDailyInput}
              placeholder="新增每日事項，例如：散步 10 分鐘"
              placeholderTextColor="#9CA3AF"
            />

            <Pressable style={styles.saveButton} onPress={handleSaveItem}>
              <Text style={styles.saveButtonText}>
                {editingItemId ? "更新" : "新增"}
              </Text>
            </Pressable>
          </View>

          {editingItemId && (
            <Pressable style={styles.cancelEditButton} onPress={resetForm}>
              <Text style={styles.cancelEditText}>取消編輯</Text>
            </Pressable>
          )}

          {loading ? (
            <Text style={styles.emptyText}>每日清單讀取中...</Text>
          ) : sortedItems.length === 0 ? (
            <Text style={styles.emptyText}>目前沒有每日清單事項</Text>
          ) : (
            <View style={styles.itemList}>
              {sortedItems.map((item: DailyChecklistItem) => (
                <View key={item.id} style={styles.itemRow}>
                  <Pressable
                    style={[
                      styles.completeButton,
                      item.isCompleted && styles.completeButtonDone,
                    ]}
                    onPress={() => handleToggleCompleted(item)}
                  >
                    <Text
                      style={[
                        styles.completeButtonText,
                        item.isCompleted && styles.completeButtonTextDone,
                      ]}
                    >
                      {item.isCompleted ? "已完成" : "未完成"}
                    </Text>
                  </Pressable>

                  <Text
                    style={[
                      styles.itemTitle,
                      item.isCompleted && styles.itemTitleDone,
                    ]}
                    numberOfLines={2}
                  >
                    {item.title || "未命名事項"}
                  </Text>

                  <Pressable
                    style={styles.iconButton}
                    onPress={() => handleEditItem(item)}
                  >
                    <Feather name="edit-2" size={16} color="#5F4B32" />
                  </Pressable>

                  <Pressable
                    style={styles.iconButton}
                    onPress={() => handleDeleteItem(item)}
                  >
                    <Ionicons name="trash-outline" size={18} color="#C2410C" />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 4,
    padding: 16,
    borderRadius: 18,
    backgroundColor: "#FFF8F0",
    borderWidth: 1,
    borderColor: "#F7D7B7",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  collapsedHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  title: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "900",
    color: "#2A2118",
  },
  subtitle: {
    marginTop: 3,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "600",
    color: "#7A6A58",
  },
  collapsedHint: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: "700",
    color: "#8A5A44",
  },
  progressPill: {
    minWidth: 52,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#F67578",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  progressText: {
    fontSize: 14,
    lineHeight: 17,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  expandedArea: {
    marginTop: 14,
  },
  inputRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  input: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F0D0B0",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: "600",
    color: "#2A2118",
  },
  saveButton: {
    minWidth: 58,
    borderRadius: 12,
    backgroundColor: "#F67578",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  cancelEditButton: {
    alignSelf: "flex-end",
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  cancelEditText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#8A5A44",
  },
  emptyText: {
    paddingVertical: 10,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    color: "#7A6A58",
    textAlign: "center",
  },
  itemList: {
    gap: 8,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#F2DFCC",
    padding: 10,
  },
  completeButton: {
    minWidth: 68,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#FFF1E6",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  completeButtonDone: {
    backgroundColor: "#2E7D32",
  },
  completeButtonText: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "900",
    color: "#8A5A44",
  },
  completeButtonTextDone: {
    color: "#FFFFFF",
  },
  itemTitle: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
    color: "#2A2118",
  },
  itemTitleDone: {
    color: "#8B8B8B",
    textDecorationLine: "line-through",
  },
  iconButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#FFF1E6",
    alignItems: "center",
    justifyContent: "center",
  },
});