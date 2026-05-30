import { db } from "@/firebase/firebaseConfig";
import { useAuth } from "@/src/auth/useAuth";
import { useActiveCareTarget } from "@/src/care-target/useActiveCareTarget";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Timestamp,
} from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type CareNote = {
  id: string;
  patientDocId: string;
  patientId: string;
  caregiverUid: string;
  title: string;
  content: string;
  language: string;
  isPinned: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

const CARE_NOTES_COLLECTION = "care_notes";

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function createCareNoteId(patientId: string) {
  const now = new Date();

  const yyyy = now.getFullYear();
  const mm = pad2(now.getMonth() + 1);
  const dd = pad2(now.getDate());
  const hh = pad2(now.getHours());
  const mi = pad2(now.getMinutes());
  const ss = pad2(now.getSeconds());

  const patientLast4 = patientId.slice(-4);

  return `${yyyy}-${mm}-${dd}_${hh}-${mi}-${ss}_note_${patientLast4}`;
}

export default function CaregiverNotebookScreen() {
  const { user } = useAuth();
  const { activePatientId, activePatient, ready } = useActiveCareTarget();

  const [notes, setNotes] = useState<CareNote[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingNote, setEditingNote] = useState<CareNote | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.uid || !activePatientId) {
      setNotes([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const q = query(
      collection(db, CARE_NOTES_COLLECTION),
      where("patientDocId", "==", activePatientId),
      where("caregiverUid", "==", user.uid)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<CareNote, "id">),
        }));

        setNotes(rows);
        setLoading(false);
      },
      (error) => {
        console.log("care notes snapshot failed:", error);
        setNotes([]);
        setLoading(false);
        Alert.alert("讀取失敗", "目前無法讀取記事本資料");
      }
    );

    return () => unsub();
  }, [user?.uid, activePatientId]);

  const sortedNotes = useMemo(() => {
    return [...notes].sort((a, b) => {
      if (a.isPinned !== b.isPinned) {
        return a.isPinned ? -1 : 1;
      }

      const aTime = a.updatedAt?.toMillis?.() ?? a.createdAt?.toMillis?.() ?? 0;
      const bTime = b.updatedAt?.toMillis?.() ?? b.createdAt?.toMillis?.() ?? 0;

      return bTime - aTime;
    });
  }, [notes]);

  function openCreateModal() {
    if (!activePatientId) {
      Alert.alert("提醒", "請先選擇照顧對象");
      return;
    }

    setEditingNote(null);
    setTitle("");
    setContent("");
    setIsPinned(false);
    setModalVisible(true);
  }

  function openEditModal(note: CareNote) {
    setEditingNote(note);
    setTitle(note.title);
    setContent(note.content);
    setIsPinned(note.isPinned);
    setModalVisible(true);
  }

  function closeModal() {
    if (saving) return;

    setModalVisible(false);
    setEditingNote(null);
    setTitle("");
    setContent("");
    setIsPinned(false);
  }

  async function handleSave() {
    if (!user?.uid) {
      Alert.alert("提醒", "請先登入");
      return;
    }

    if (!activePatientId) {
      Alert.alert("提醒", "請先選擇照顧對象");
      return;
    }

    const cleanTitle = title.trim();
    const cleanContent = content.trim();

    if (!cleanTitle && !cleanContent) {
      Alert.alert("提醒", "請至少輸入標題或內容");
      return;
    }

    setSaving(true);

    try {
      if (editingNote) {
        await updateDoc(doc(db, CARE_NOTES_COLLECTION, editingNote.id), {
          title: cleanTitle || "未命名記事",
          content: cleanContent,
          isPinned,
          language: "zh-TW",
          updatedAt: serverTimestamp(),
        });
      } else {
        const fullPatientId =
          String((activePatient as any)?.patientsId ?? "").trim() ||
          activePatientId;

        const noteId = createCareNoteId(fullPatientId);

        await setDoc(doc(db, CARE_NOTES_COLLECTION, noteId), {
          patientDocId: activePatientId,
          patientId: fullPatientId,
          caregiverUid: user.uid,
          title: cleanTitle || "未命名記事",
          content: cleanContent,
          language: "zh-TW",
          isPinned,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      closeModal();
    } catch (error) {
      console.log("save care note failed:", error);
      Alert.alert("儲存失敗", "目前無法儲存記事，請稍後再試");
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(note: CareNote) {
    Alert.alert("刪除記事", "確定要刪除這篇記事嗎？", [
      { text: "取消", style: "cancel" },
      {
        text: "刪除",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteDoc(doc(db, CARE_NOTES_COLLECTION, note.id));
          } catch (error) {
            console.log("delete care note failed:", error);
            Alert.alert("刪除失敗", "目前無法刪除記事");
          }
        },
      },
    ]);
  }

  async function togglePinned(note: CareNote) {
    try {
      await updateDoc(doc(db, CARE_NOTES_COLLECTION, note.id), {
        isPinned: !note.isPinned,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.log("toggle care note pinned failed:", error);
      Alert.alert("更新失敗", "目前無法更新置頂狀態");
    }
  }

  function formatTime(note: CareNote) {
    const time = note.updatedAt?.toDate?.() ?? note.createdAt?.toDate?.();

    if (!time) return "尚未同步時間";

    return time.toLocaleString("zh-TW", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const patientName = activePatient?.name ?? "目前長輩";

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={26} color="#111827" />
        </Pressable>

        <View style={styles.headerTextGroup}>
          <Text style={styles.title}>照護記事</Text>
          <Text style={styles.subtitle}>記錄長輩的飲食、情緒、用藥與提醒</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.patientCard}>
          <Text style={styles.patientLabel}>目前照顧對象</Text>
          <Text style={styles.patientName}>
            {activePatientId ? patientName : "尚未選擇長輩"}
          </Text>
        </View>

        <Pressable
          style={[
            styles.addButton,
            !activePatientId && styles.addButtonDisabled,
          ]}
          onPress={openCreateModal}
          disabled={!activePatientId}
        >
          <Text style={styles.addButtonText}>＋ 新增記事</Text>
        </Pressable>

        {!ready || loading ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>讀取中...</Text>
          </View>
        ) : !activePatientId ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>尚未選擇照顧對象</Text>
            <Text style={styles.emptyText}>
              請先回到首頁選擇一位長輩，再新增記事。
            </Text>
          </View>
        ) : sortedNotes.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>目前沒有任何照護記事</Text>
            <Text style={styles.emptyText}>
              可以記錄長輩今天的飲食、情緒、用藥或特殊注意事項。
            </Text>
          </View>
        ) : (
          <View style={styles.notesList}>
            {sortedNotes.map((note) => (
              <View key={note.id} style={styles.noteCard}>
                <View style={styles.noteTopRow}>
                  <Pressable
                    style={styles.noteTitleArea}
                    onPress={() => openEditModal(note)}
                  >
                    <Text style={styles.noteTitle} numberOfLines={1}>
                      {note.isPinned ? "📌 " : ""}
                      {note.title || "未命名記事"}
                    </Text>
                    <Text style={styles.noteTime}>
                      更新時間：{formatTime(note)}
                    </Text>
                  </Pressable>

                  <Pressable
                    style={styles.iconButton}
                    onPress={() => togglePinned(note)}
                  >
                    <Text style={styles.iconText}>
                      {note.isPinned ? "取消" : "置頂"}
                    </Text>
                  </Pressable>
                </View>

                <Pressable onPress={() => openEditModal(note)}>
                  <Text style={styles.noteContent} numberOfLines={3}>
                    {note.content || "沒有內容"}
                  </Text>
                </Pressable>

                <View style={styles.noteActions}>
                  <Pressable
                    style={styles.editButton}
                    onPress={() => openEditModal(note)}
                  >
                    <Text style={styles.editButtonText}>編輯</Text>
                  </Pressable>

                  <Pressable
                    style={styles.deleteButton}
                    onPress={() => handleDelete(note)}
                  >
                    <Text style={styles.deleteButtonText}>刪除</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editingNote ? "編輯記事" : "新增記事"}
            </Text>

            <Text style={styles.inputLabel}>標題</Text>
            <TextInput
              style={styles.titleInput}
              value={title}
              onChangeText={setTitle}
              placeholder="例如：今天飲食狀況"
              placeholderTextColor="#9CA3AF"
            />

            <Text style={styles.inputLabel}>內容</Text>
            <TextInput
              style={styles.contentInput}
              value={content}
              onChangeText={setContent}
              placeholder="可以記錄長輩狀況、注意事項、提醒..."
              placeholderTextColor="#9CA3AF"
              multiline
              textAlignVertical="top"
            />

            <Pressable
              style={styles.pinRow}
              onPress={() => setIsPinned((prev) => !prev)}
            >
              <View style={[styles.checkbox, isPinned && styles.checkboxActive]}>
                {isPinned && <Text style={styles.checkboxText}>✓</Text>}
              </View>
              <Text style={styles.pinText}>置頂這篇記事</Text>
            </Pressable>

            <View style={styles.modalActions}>
              <Pressable
                style={styles.cancelButton}
                onPress={closeModal}
                disabled={saving}
              >
                <Text style={styles.cancelButtonText}>取消</Text>
              </Pressable>

              <Pressable
                style={styles.saveButton}
                onPress={handleSave}
                disabled={saving}
              >
                <Text style={styles.saveButtonText}>
                  {saving ? "儲存中..." : "儲存"}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAFAFA",
  },
  header: {
    paddingTop: 58,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: "#7BC6F9",
    flexDirection: "row",
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.72)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  headerTextGroup: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: "900",
    color: "#000000",
    letterSpacing: 1,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: "700",
    color: "#1F2937",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  patientCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    borderLeftWidth: 8,
    borderLeftColor: "#7BC6F9",
    marginBottom: 14,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
  },
  patientLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#666666",
    marginBottom: 4,
  },
  patientName: {
    fontSize: 21,
    fontWeight: "900",
    color: "#000000",
  },
  addButton: {
    backgroundColor: "#7BC6F9",
    paddingVertical: 15,
    borderRadius: 18,
    alignItems: "center",
    marginBottom: 18,
    shadowColor: "#7BC6F9",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 4,
  },
  addButtonDisabled: {
    backgroundColor: "#BDBDBD",
    shadowOpacity: 0,
    elevation: 0,
  },
  addButtonText: {
    color: "#000000",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 1,
  },
  emptyBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingVertical: 38,
    paddingHorizontal: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#EEEEEE",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#000000",
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#666666",
    textAlign: "center",
    lineHeight: 22,
  },
  notesList: {
    gap: 14,
  },
  noteCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#EEEEEE",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  noteTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  noteTitleArea: {
    flex: 1,
  },
  noteTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#000000",
  },
  noteTime: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: "600",
    color: "#888888",
  },
  iconButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#E6F4FF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D7ECFF",
  },
  iconText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#4A90E2",
  },
  noteContent: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    lineHeight: 23,
  },
  noteActions: {
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  editButton: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    backgroundColor: "#E6F4FF",
    borderRadius: 14,
  },
  editButtonText: {
    color: "#4A90E2",
    fontWeight: "900",
  },
  deleteButton: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    backgroundColor: "#FEE2E2",
    borderRadius: 14,
  },
  deleteButtonText: {
    color: "#DC2626",
    fontWeight: "900",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 26,
    padding: 22,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#000000",
    marginBottom: 18,
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: "900",
    color: "#555555",
    marginBottom: 8,
    marginLeft: 4,
  },
  titleInput: {
    backgroundColor: "#F7F7F7",
    borderWidth: 1,
    borderColor: "#EEEEEE",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: "700",
    color: "#000000",
    marginBottom: 16,
  },
  contentInput: {
    minHeight: 150,
    backgroundColor: "#F7F7F7",
    borderWidth: 1,
    borderColor: "#EEEEEE",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: "600",
    color: "#000000",
    marginBottom: 16,
  },
  pinRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#7BC6F9",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  checkboxActive: {
    backgroundColor: "#7BC6F9",
  },
  checkboxText: {
    color: "#000000",
    fontSize: 16,
    fontWeight: "900",
  },
  pinText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#374151",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#F3F4F6",
    borderRadius: 14,
  },
  cancelButtonText: {
    color: "#374151",
    fontSize: 16,
    fontWeight: "900",
  },
  saveButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: "#7BC6F9",
    borderRadius: 14,
  },
  saveButtonText: {
    color: "#000000",
    fontSize: 16,
    fontWeight: "900",
  },
});