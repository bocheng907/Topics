import { AppHeader, Button, Card, EmptyState, FormSheet, IconButton, TextField } from "@/src/ui/components";
import { colors, layout, radii, spacing, typography } from "@/src/ui/theme";
import { caregiverCopy } from "@/src/i18n/copy/caregiverCopy";
import { AppAlert as Alert } from "@/src/ui/AppAlert";
import { Ionicons } from "@expo/vector-icons";
import type { Href } from "expo-router";
import {
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
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { db } from "@/firebase/firebaseConfig";
import { useAuth } from "@/src/auth/useAuth";
import { useActiveCareTarget } from "@/src/care-target/useActiveCareTarget";
import { makeCareNoteDocumentId } from "@/src/data/firestoreDocumentIds";
import {
  ensureFirestoreTranslations,
  pickDynamicLocalizedString,
} from "@/src/i18n/dynamicTranslation";
import { useLanguage } from "@/src/store/LanguageContext";
import { useScreenBottomInset } from "@/src/ui/BottomInsetContext";

type CareNote = {
  id: string;
  title: string;
  content: string;
  title_en?: string;
  title_vi?: string;
  title_id?: string;
  content_en?: string;
  content_vi?: string;
  content_id?: string;
  pinned: boolean;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
  createdBy: string;
  caregiverId: string;
  patientId: string;
};

type NoteForm = {
  title: string;
  content: string;
  pinned: boolean;
};

const emptyForm: NoteForm = {
  title: "",
  content: "",
  pinned: false,
};

function formatUpdatedAt(value?: Timestamp | null) {
  if (!value?.toDate) return "--/-- --:--";

  const date = value.toDate();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");

  return `${month}/${day} ${hour}:${minute}`;
}

function getNoteTime(note: CareNote) {
  return note.updatedAt?.toMillis?.() ?? note.createdAt?.toMillis?.() ?? 0;
}

export default function CaregiverNotebookScreen() {
  const bottomInset = useScreenBottomInset();
  const { user } = useAuth();
  const { activePatientId, activePatient, ready } = useActiveCareTarget();
  const { language } = useLanguage();
  const c = caregiverCopy[language];

  const [notes, setNotes] = useState<CareNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingNote, setEditingNote] = useState<CareNote | null>(null);
  const [form, setForm] = useState<NoteForm>(emptyForm);
  const dataScope = `${ready}/${user?.uid}/${activePatientId}`;
  const [previousScope, setPreviousScope] = useState<string | null>(null);
  if (previousScope !== dataScope) {
    setPreviousScope(dataScope); setNotes([]);
    setLoading(Boolean(ready && activePatientId && user?.uid));
    setModalVisible(false); setEditingNote(null); setForm(emptyForm);
  }

  const sortedNotes = useMemo(() => {
    return [...notes].sort((left, right) => {
      if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;
      return getNoteTime(right) - getNoteTime(left);
    });
  }, [notes]);

  useEffect(() => {
    if (!ready) return;

    if (!activePatientId || !user?.uid) {
      return;
    }


    const notesRef = query(
      collection(db, "care_notes"),
      where("patientDocId", "==", activePatientId),
      where("caregiverUid", "==", user.uid)
    );
    const unsubscribe = onSnapshot(
      notesRef,
      (snap) => {
        const rows = snap.docs.map((docSnap) => {
          const data = docSnap.data() as Partial<CareNote>;
          return {
            id: docSnap.id,
            title: data.title ?? "",
            content: data.content ?? "",
            title_en: data.title_en ?? "",
            title_vi: data.title_vi ?? "",
            title_id: data.title_id ?? "",
            content_en: data.content_en ?? "",
            content_vi: data.content_vi ?? "",
            content_id: data.content_id ?? "",
            pinned: (data as any).isPinned === true,
            createdAt: data.createdAt ?? null,
            updatedAt: data.updatedAt ?? null,
            createdBy: (data as any).caregiverUid ?? "",
            caregiverId: (data as any).caregiverUid ?? "",
            patientId: (data as any).patientDocId ?? activePatientId,
          };
        });

        setNotes(rows);
        setLoading(false);
      },
      (error) => {
        console.log("care notes snapshot failed:", error);
        setNotes([]);
        setLoading(false);
        Alert.alert(c.noteLoadFailedTitle, c.noteLoadFailedMessage);
      }
    );

    return () => unsubscribe();
  }, [activePatientId, ready, user?.uid]);

  useEffect(() => {
    if (!activePatientId || language === "zh") return;

    notes.forEach((note) => {
      void ensureFirestoreTranslations(
        doc(db, "care_notes", note.id),
        note,
        language,
        [
          { baseName: "title", sourceKeys: ["title"] },
          { baseName: "content", sourceKeys: ["content"] },
        ]
      );
    });
  }, [activePatientId, language, notes]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingNote(null);
  };

  const openCreateModal = () => {
    resetForm();
    setModalVisible(true);
  };

  const openEditModal = (note: CareNote) => {
    setEditingNote(note);
    setForm({
      title: note.title,
      content: note.content,
      pinned: note.pinned,
    });
    setModalVisible(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalVisible(false);
    resetForm();
  };

  const saveNote = async () => {
    if (!user?.uid) {
      Alert.alert(c.noteNotLoggedInTitle, c.noteNotLoggedInMessage);
      return;
    }

    if (!activePatientId) {
      Alert.alert(c.noteNoPatient);
      return;
    }

    const title = form.title.trim();
    const content = form.content.trim();

    if (!title) {
      Alert.alert(c.noteTitleRequiredTitle, c.noteTitleRequiredMessage);
      return;
    }

    try {
      setSaving(true);

      if (editingNote) {
        await updateDoc(doc(db, "care_notes", editingNote.id), {
          title,
          content,
          isPinned: form.pinned,
          language,
          updatedAt: serverTimestamp(),
        });
      } else {
        const noteDocId = makeCareNoteDocumentId({
          patientDocId: activePatientId,
          patientsId: activePatient?.patientsId,
        });
        await setDoc(
          doc(db, "care_notes", noteDocId),
          {
            patientDocId: activePatientId,
            patientId: activePatient?.patientsId ?? "",
            caregiverUid: user.uid,
            title,
            content,
            language,
            isPinned: form.pinned,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }
        );
      }

      setModalVisible(false);
      resetForm();
    } catch (error) {
      console.log("save care note failed:", error);
      Alert.alert(c.noteSaveFailedTitle, c.noteSaveFailedMessage);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (note: CareNote) => {
    Alert.alert(c.noteDeleteTitle, c.noteDeleteMessage, [
      { text: c.cancel, style: "cancel" },
      {
        text: c.delete,
        style: "destructive",
        onPress: async () => {
          if (!activePatientId) return;

          try {
            await deleteDoc(doc(db, "care_notes", note.id));
          } catch (error) {
            console.log("delete care note failed:", error);
            Alert.alert(c.noteDeleteFailedTitle, c.noteDeleteFailedMessage);
          }
        },
      },
    ]);
  };

  const togglePinned = async (note: CareNote) => {
    if (!activePatientId) return;

    try {
      await updateDoc(doc(db, "care_notes", note.id), {
        isPinned: !note.pinned,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.log("toggle care note pinned failed:", error);
      Alert.alert(c.notePinFailedTitle, c.notePinFailedMessage);
    }
  };

  const patientName = activePatient?.name || c.notePatientFallback;

  const header = (
    <AppHeader title={c.noteTitle} subtitle={c.noteSubtitle} fallbackHref={"/caregiver" as Href} />
  );

  if (!ready || loading) {
    return (
      <View style={styles.screen}>
        {header}
        <View style={styles.loadingScreen}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {header}

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: spacing.xxl + bottomInset }]} showsVerticalScrollIndicator={false}>
        {!activePatientId ? (
          <EmptyState icon="person-outline" title={c.noteNoPatient} />
        ) : (
          <>
            <View style={styles.patientRow}>
              <View style={styles.patientText}>
                <Text style={styles.patientLabel}>{c.notePatientLabel}</Text>
                <Text style={styles.patientName} numberOfLines={1}>{patientName}</Text>
              </View>
              <Button label={c.noteAdd} icon="add" onPress={openCreateModal} />
            </View>

            <View style={styles.noteList}>
              {sortedNotes.length === 0 ? (
                <Card>
                  <EmptyState
                    icon="create-outline"
                    title={c.noteEmpty}
                    actionLabel={c.noteAdd}
                    onAction={openCreateModal}
                  />
                </Card>
              ) : (
                sortedNotes.map((note) => {
                  const localizedTitle = pickDynamicLocalizedString(
                    note,
                    "title",
                    language,
                    ["title"],
                    note.title
                  );
                  const localizedContent = pickDynamicLocalizedString(
                    note,
                    "content",
                    language,
                    ["content"],
                    note.content
                  );

                  return (
                    <Card key={note.id} tone={note.pinned ? "selected" : "default"} style={styles.noteCard}>
                      <View style={styles.noteHeader}>
                        <View style={styles.noteTitleWrap}>
                          {note.pinned ? (
                            <View style={styles.pinnedTag}>
                              <Ionicons name="bookmark" size={14} color={colors.primary} />
                              <Text style={styles.pinnedTagText}>{c.notePinned}</Text>
                            </View>
                          ) : null}
                          <Text style={styles.noteTitle} numberOfLines={2}>{localizedTitle}</Text>
                          <Text style={styles.noteTime}>
                            {c.noteUpdatedAt}{language === "zh" ? "：" : ": "}{formatUpdatedAt(note.updatedAt)}
                          </Text>
                        </View>

                        <IconButton
                          icon={note.pinned ? "bookmark" : "bookmark-outline"}
                          color={note.pinned ? colors.primary : colors.textSecondary}
                          accessibilityLabel={note.pinned ? c.noteUnpin : c.notePin}
                          onPress={() => togglePinned(note)}
                        />
                      </View>

                      <Text style={localizedContent ? styles.noteContent : styles.noteContentEmpty}>
                        {localizedContent || c.noteNoContent}
                      </Text>

                      <View style={styles.noteActions}>
                        <Button label={c.edit} variant="secondary" icon="create-outline" onPress={() => openEditModal(note)} />
                        <Button
                          label={c.delete}
                          variant="ghostDanger"
                          icon="trash-outline"
                          onPress={() => confirmDelete(note)}
                          accessibilityLabel={`${c.delete} ${localizedTitle}`}
                        />
                      </View>
                    </Card>
                  );
                })
              )}
            </View>
          </>
        )}
      </ScrollView>

      <FormSheet
        visible={modalVisible}
        title={editingNote ? c.noteEditTitle : c.noteAdd}
        onCancel={closeModal}
        onSave={saveNote}
        cancelLabel={c.cancel}
        saveLabel={c.save}
        saving={saving}
      >
        <TextField
          label={c.noteFieldTitle}
          required
          value={form.title}
          onChangeText={(title) => setForm((prev) => ({ ...prev, title }))}
          placeholder={c.noteFieldTitlePlaceholder}
        />
        <TextField
          label={c.noteFieldContent}
          value={form.content}
          onChangeText={(content) => setForm((prev) => ({ ...prev, content }))}
          placeholder={c.noteFieldContentPlaceholder}
          multiline
          inputStyle={styles.contentInput}
        />
        <Pressable
          style={({ pressed }) => [styles.checkboxRow, pressed && { backgroundColor: colors.surfaceSunken }]}
          onPress={() => setForm((prev) => ({ ...prev, pinned: !prev.pinned }))}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: form.pinned }}
        >
          <View style={[styles.checkbox, form.pinned && styles.checkboxChecked]}>
            {form.pinned && <Ionicons name="checkmark" size={18} color={colors.onPrimary} />}
          </View>
          <Text style={styles.checkboxText}>{c.notePinThis}</Text>
        </Pressable>
      </FormSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  loadingScreen: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: {
    paddingHorizontal: layout.screenPaddingX,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    width: "100%",
    maxWidth: layout.maxContentWidth,
    alignSelf: "center",
  },
  patientRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  patientText: { flex: 1, minWidth: 160 },
  patientLabel: { ...typography.overline },
  patientName: { ...typography.title },
  noteList: { gap: spacing.md },
  noteCard: { gap: spacing.md },
  noteHeader: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  noteTitleWrap: { flex: 1, minWidth: 0 },
  pinnedTag: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 2 },
  pinnedTagText: { ...typography.caption, color: colors.primary, fontWeight: "600" },
  noteTitle: { ...typography.header },
  noteTime: { ...typography.caption, marginTop: 2 },
  noteContent: { ...typography.body, color: colors.textSecondary },
  noteContentEmpty: { ...typography.body, color: colors.textMuted },
  noteActions: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  contentInput: { minHeight: 150 },
  checkboxRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radii.control,
    paddingHorizontal: spacing.xs,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: { backgroundColor: colors.primary },
  checkboxText: { ...typography.body, flexShrink: 1 },
});
