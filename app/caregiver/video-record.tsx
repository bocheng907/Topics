import { AppHeader, Button, Card, EmptyState, IconButton, KeyboardAwareScroll, SegmentedTabs, StatusBadge, TextField } from "@/src/ui/components";
import { colors, layout, radii, spacing, typography } from "@/src/ui/theme";
import { caregiverCopy, formatLongDate } from "@/src/i18n/copy/caregiverCopy";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppAlert as Alert } from "@/src/ui/AppAlert";
import { Ionicons } from '@expo/vector-icons';
import VideoPlayerView from '@/src/media/VideoPlayerView';
import { recordCopy } from '@/src/media/recordCopy';
import * as ImagePicker from 'expo-image-picker';
import { randomUUID } from 'expo-crypto';
import { router, useNavigation, type Href } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

// Firebase 相關
import { db, storage } from '@/firebase/firebaseConfig';
import { useAuth } from '@/src/auth/useAuth';
import { useActiveCareTarget } from '@/src/care-target/useActiveCareTarget';
import {
  ensureAbnormalRecordEntryTranslation,
  ensureFirestoreTranslations,
  pickDynamicLocalizedString,
} from '@/src/i18n/dynamicTranslation';
import { translations, type Language } from '@/src/i18n/translations';
import { useLanguage } from '@/src/store/LanguageContext';
import { arrayRemove, arrayUnion, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { createMediaUploadFilename } from '@/firebase/uploadFilename';
import { readLocalBlob } from "@/src/media/readLocalBlob";
import { useScreenBottomInset } from "@/src/ui/BottomInsetContext";

function pickAbnormalTitle(record: any, language: Language) {
  return pickDynamicLocalizedString(record, 'title', language, ['titleZh', 'titleOriginal'], record?.titleOriginal ?? '');
}

function pickAbnormalNotes(record: any, language: Language) {
  return pickDynamicLocalizedString(record, 'notes', language, ['notesZh', 'notesOriginal'], record?.notesOriginal ?? '');
}

function pickAbnormalEntryNotes(entry: any, language: Language) {
  return pickDynamicLocalizedString(entry, 'notes', language, ['notesZh', 'notesOriginal'], entry?.notesOriginal ?? '');
}

export default function AbnormalRecordScreen() {
  const bottomInset = useScreenBottomInset();
  const { user } = useAuth();
  const { activePatientId } = useActiveCareTarget();
  const { language } = useLanguage();
  const t = translations[language];
  const mediaCopy = recordCopy[language];
  const c = caregiverCopy[language];
  const insets = useSafeAreaInsets();
  
  const navigation = useNavigation();
  useEffect(() => {
    navigation.getParent()?.setOptions({ tabBarStyle: { display: 'none' } });
    return () => {
      navigation.getParent()?.setOptions({ tabBarStyle: { display: 'flex' } });
    };
  }, [navigation]);

  // --- 畫面與資料狀態 ---
  const [currentView, setCurrentView] = useState<'list' | 'detail' | 'folder' | 'create' | 'folderEntryDetail' | 'createFolderEntry' | 'edit' | 'editFolderEntry'>('list');
  const [records, setRecords] = useState<any[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [selectedFolderEntry, setSelectedFolderEntry] = useState<any>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [createFormType, setCreateFormType] = useState<'single' | 'folder'>('single');
  const [isDoctorMode, setIsDoctorMode] = useState(false);

  // --- 表單輸入狀態 ---
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // ==========================================
  // 1. 抓取 Firebase 異常紀錄
  // ==========================================
  useEffect(() => {
    if (!activePatientId) return;
    const q = query(
      collection(db, 'abnormal_records'),
      where('patientId', '==', activePatientId)
    );
    const unsub = onSnapshot(q, (snap) => {
      const fetchedRecords = [...snap.docs]
        .sort((a, b) => (b.data().createdAt?.toMillis?.() ?? 0) - (a.data().createdAt?.toMillis?.() ?? 0))
        .map(doc => {
        const data = doc.data();
        const dateObj = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
        const dateStr = `${dateObj.getFullYear()}年 ${dateObj.getMonth() + 1}月 ${dateObj.getDate()}日`;
        return { id: doc.id, ...data, displayDate: dateStr };
      });
      setRecords(fetchedRecords);
    });
    return unsub;
  }, [activePatientId]);

  const [previousRecords, setPreviousRecords] = useState(records);
  if (previousRecords !== records) {
    setPreviousRecords(records);
    if (selectedRecord) {
      const updatedRecord = records.find(r => r.id === selectedRecord.id);
      if (updatedRecord) {
        setSelectedRecord(updatedRecord);
        if (selectedFolderEntry) {
          const updatedEntry = updatedRecord.entries?.find((entry: any) => entry.entryId === selectedFolderEntry.entryId);
          if (updatedEntry) setSelectedFolderEntry(updatedEntry);
        }
      }
    }
  }

  useEffect(() => {
    if (
      language === 'zh' ||
      !selectedRecord?.id ||
      !['detail', 'folder', 'folderEntryDetail'].includes(currentView)
    ) {
      return;
    }

    void ensureFirestoreTranslations(
      doc(db, 'abnormal_records', selectedRecord.id),
      selectedRecord,
      language,
      [
        { baseName: 'title', sourceKeys: ['titleZh', 'titleOriginal'] },
        { baseName: 'notes', sourceKeys: ['notesZh', 'notesOriginal'] },
      ]
    );
  }, [currentView, language, selectedRecord]);

  useEffect(() => {
    if (
      language === 'zh' ||
      currentView !== 'folderEntryDetail' ||
      !selectedRecord?.id ||
      !selectedFolderEntry?.entryId
    ) {
      return;
    }

    void ensureAbnormalRecordEntryTranslation(
      db,
      doc(db, 'abnormal_records', selectedRecord.id),
      selectedFolderEntry,
      language
    );
  }, [currentView, language, selectedFolderEntry, selectedRecord?.id]);

  // ==========================================
  // 2. 拍攝或選擇媒體
  // ==========================================
  const openCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return Alert.alert(t.warning, t.cameraPermissionMessage);
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images', 'videos'],
      videoMaxDuration: 60,
      quality: 0.7,
    });
    if (!result.canceled && result.assets) {
      setMediaUri(result.assets[0].uri);
      setMediaType(result.assets[0].type === 'video' ? 'video' : 'image');
    }
  };

  const openGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return Alert.alert(t.warning, t.cameraAlbumPermissionMessage);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      videoMaxDuration: 60,
      quality: 0.7,
    });
    if (!result.canceled && result.assets) {
      setMediaUri(result.assets[0].uri);
      setMediaType(result.assets[0].type === 'video' ? 'video' : 'image');
    }
  };

  const handlePickMedia = () => {
    // Web file picker supports choosing local images/videos; native retains camera choice.
    if (Platform.OS === 'web') { void openGallery(); return; }
    Alert.alert(t.method, t.cameraStartAnalyze, [
      { text: t.cameraTakePhoto, onPress: openCamera },
      { text: t.cameraPickImage, onPress: openGallery },
      { text: t.cancel, style: 'cancel' }
    ]);
  };

  const uploadMediaFile = async (uri: string) => {
    if (!user) {
      throw new Error('Sign in before uploading media');
    }
    if (!activePatientId) {
      throw new Error('Missing active patient id');
    }

    const blob = await readLocalBlob(uri);
    const extension = mediaType === 'video' ? 'mp4' : 'jpg';
    
    const fileName = createMediaUploadFilename(extension);
    
    const storageRef = ref(storage, `abnormal_media/${activePatientId}/${fileName}`);
    await uploadBytes(storageRef, blob, {
      contentType: blob.type || (mediaType === 'video' ? 'video/mp4' : 'image/jpeg'),
      customMetadata: {uploaderUid: user.uid, patientId: activePatientId},
    });
    return await getDownloadURL(storageRef);
  };

  // ==========================================
  // 3. 儲存/建立紀錄
  // ==========================================
  const getCustomDocId = () => {
    if (!activePatientId) {
      throw new Error('Missing active patient id');
    }

    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
    const shortId = activePatientId.slice(-4);
    return `${timeStr}_abnormal_${shortId}`;
  };

  const handleSaveRecord = async () => {
    if (!user || !activePatientId) return;
    if (!title.trim()) return Alert.alert(t.prompt, t.resultTitleRequiredMessage);

    setIsUploading(true);
    try {
      let uploadedUrl = null;
      if (mediaUri) uploadedUrl = await uploadMediaFile(mediaUri);

      const customDocId = getCustomDocId();
      const docRef = doc(db, 'abnormal_records', customDocId);

      const basePayload = {
        patientId: activePatientId,
        caregiverId: user.uid,
        createdAt: serverTimestamp(),
        titleOriginal: title,
        titleZh: '', 
        notesOriginal: notes,
        notesZh: '', 
      };

      if (createFormType === 'single') {
        await setDoc(docRef, { ...basePayload, type: 'single', hasMedia: !!uploadedUrl, mediaUrl: uploadedUrl, mediaType: mediaType || null });
      } else {
        await setDoc(docRef, { ...basePayload, type: 'folder', entries: [] });
      }

      Alert.alert(t.success, t.saveSuccessMessage);
      goToList();
    } catch {
      Alert.alert(t.resultErrorTitle, t.resultSaveFailedMessage);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveFolderEntry = async () => {
    if (!user || !activePatientId || !selectedRecord) return;
    
    setIsUploading(true);
    try {
      let uploadedUrl = null;
      if (mediaUri) uploadedUrl = await uploadMediaFile(mediaUri);

      const newEntry = {
        entryId: randomUUID(),
        notesOriginal: notes,
        notesZh: '', 
        mediaUrl: uploadedUrl,
        mediaType: mediaType || null,
        createdAt: new Date(), 
      };

      const docRef = doc(db, 'abnormal_records', selectedRecord.id);
      await updateDoc(docRef, { entries: arrayUnion(newEntry) });

      Alert.alert(t.success, t.saveSuccessMessage);
      goBackToFolder();
    } catch {
      Alert.alert(t.resultErrorTitle, t.resultSaveFailedMessage);
    } finally {
      setIsUploading(false);
    }
  };

  // ==========================================
  // 4. 編輯與刪除邏輯
  // ==========================================
  const handleDeleteRecord = () => {
    setDropdownOpen(false);
    Alert.alert(t.deleteConfirmTitle, selectedRecord.type === 'folder' ? mediaCopy.deleteFolder : mediaCopy.deleteRecord, [
      { text: t.cancel, style: 'cancel' },
      { text: t.delete, style: 'destructive', onPress: async () => {
          try {
            await deleteDoc(doc(db, 'abnormal_records', selectedRecord.id));
            Alert.alert(t.success, mediaCopy.deleted);
            goToList();
          } catch {
            Alert.alert(t.resultErrorTitle, t.deleteFailedShort);
          }
      }}
    ]);
  };

  const handleDeleteFolderEntry = () => {
    setDropdownOpen(false);
    Alert.alert(t.deleteConfirmTitle, mediaCopy.deleteEntry, [
      { text: t.cancel, style: 'cancel' },
      { text: t.delete, style: 'destructive', onPress: async () => {
          try {
            const docRef = doc(db, 'abnormal_records', selectedRecord.id);
            await updateDoc(docRef, { entries: arrayRemove(selectedFolderEntry) });
            Alert.alert(t.success, mediaCopy.deleted);
            goBackToFolder();
          } catch {
            Alert.alert(t.resultErrorTitle, t.deleteFailedShort);
          }
      }}
    ]);
  };

  const handleUpdateTextOnly = async () => {
    setIsUploading(true);
    try {
      const docRef = doc(db, 'abnormal_records', selectedRecord.id);
      if (currentView === 'edit') {
        await updateDoc(docRef, { titleOriginal: title, notesOriginal: notes });
        setCurrentView(selectedRecord.type === 'folder' ? 'folder' : 'detail');
      } else if (currentView === 'editFolderEntry') {
        const updatedEntries = selectedRecord.entries.map((e: any) => 
          e.entryId === selectedFolderEntry.entryId ? { ...e, notesOriginal: notes } : e
        );
        await updateDoc(docRef, { entries: updatedEntries });
        setSelectedFolderEntry({ ...selectedFolderEntry, notesOriginal: notes });
        setCurrentView('folderEntryDetail');
      }
      Alert.alert(t.success, t.saveSuccessMessage);
    } catch {
      Alert.alert(t.resultErrorTitle, t.resultSaveFailedMessage);
    } finally {
      setIsUploading(false);
    }
  };

  // --- 導覽功能 ---
  const resetForm = () => { setTitle(''); setNotes(''); setMediaUri(null); setMediaType(null); setDropdownOpen(false); };
  const goToList = () => { setCurrentView('list'); setSelectedRecord(null); setSelectedFolderEntry(null); setIsDoctorMode(false); resetForm(); };
  const goToDetail = (record: any) => { setSelectedRecord(record); setCurrentView(record.type === 'folder' ? 'folder' : 'detail'); setIsDoctorMode(false); resetForm(); };
  const goToCreate = () => { resetForm(); setCurrentView('create'); setCreateFormType('single'); };
  const goToFolderEntry = (entry: any) => { setSelectedFolderEntry(entry); setCurrentView('folderEntryDetail'); setIsDoctorMode(false); resetForm(); };
  const goBackToFolder = () => { setCurrentView('folder'); setSelectedFolderEntry(null); setIsDoctorMode(false); resetForm(); };
  const goToCreateFolderEntry = () => { resetForm(); setCurrentView('createFolderEntry'); setIsDoctorMode(false); };
  
  const goToEditRecord = () => {
    setDropdownOpen(false);
    setTitle(selectedRecord.titleOriginal);
    setNotes(selectedRecord.notesOriginal);
    setCurrentView('edit');
  };

  const goToEditFolderEntry = () => {
    setDropdownOpen(false);
    setNotes(selectedFolderEntry.notesOriginal);
    setCurrentView('editFolderEntry');
  };

  // --- 共用的媒體渲染元件 ---
  const renderMedia = (uri: string, type: 'image' | 'video' | null | undefined, isUploadBox: boolean = false) => {
    if (type === 'video') {
      return (
        <VideoPlayerView
          uri={uri}
          style={isUploadBox ? { width: '100%', height: '100%' } : styles.mediaImage}
        />
      );
    }
    return (
      <Image
        source={{ uri }}
        style={isUploadBox ? { width: '100%', height: '100%' } : styles.mediaImage}
        resizeMode="contain"
      />
    );
  };

  const recordDate = (value: any) => formatLongDate(value?.toDate ? value.toDate() : value ? new Date(value) : new Date(), language);

  const renderDoctorToggle = (onLabel: string, offLabel: string) => (
    <Pressable
      onPress={() => setIsDoctorMode(!isDoctorMode)}
      accessibilityRole="switch"
      accessibilityState={{ checked: isDoctorMode }}
      style={({ pressed }) => [
        styles.doctorModeBtn,
        isDoctorMode ? styles.doctorModeBtnActive : styles.doctorModeBtnIdle,
        pressed && !isDoctorMode && { backgroundColor: colors.surfaceSunken },
      ]}
    >
      <Ionicons name="language" size={20} color={isDoctorMode ? colors.onPrimary : colors.textSecondary} />
      <Text style={[styles.doctorModeText, isDoctorMode && { color: colors.onPrimary }]}>
        {isDoctorMode ? onLabel : offLabel}
      </Text>
    </Pressable>
  );

  const renderMediaPicker = () => (
    <View style={[styles.uploadBox, mediaUri ? styles.uploadBoxFilled : styles.uploadBoxEmpty]}>
      {mediaUri ? (
        <View style={{ width: '100%', height: '100%', position: 'relative' }}>
          {renderMedia(mediaUri, mediaType, true)}
          <Pressable
            onPress={handlePickMedia}
            accessibilityRole="button"
            style={({ pressed }) => [styles.reselectBtn, pressed && { opacity: 0.85 }]}
          >
            <Ionicons name="refresh" size={18} color={colors.onPrimary} />
            <Text style={styles.reselectBtnText}>{t.cameraPickImage}</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={handlePickMedia}
          accessibilityRole="button"
          accessibilityLabel={t.cameraPickImage}
          style={({ pressed }) => [styles.uploadPlaceholder, pressed && { backgroundColor: colors.border }]}
        >
          <View style={styles.uploadIcon}>
            <Ionicons name="camera-outline" size={32} color={colors.primary} />
          </View>
          <Text style={styles.uploadText}>{t.cameraPickImage}</Text>
        </Pressable>
      )}
    </View>
  );

  const renderFooter = (node: React.ReactNode) => (
    <View style={[styles.footer, { paddingBottom: spacing.md + bottomInset }]}>{node}</View>
  );

  // --- UI 渲染區塊 ---

  const renderList = () => (
    <View style={styles.viewContainer}>
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: spacing.xxl + bottomInset }]} showsVerticalScrollIndicator={false}>
        <Text style={styles.listHint}>{t.conditionHint}</Text>
        {records.length === 0 ? (
          <EmptyState icon="videocam-outline" title={c.recordEmpty} />
        ) : null}
        {records.map(record => (
          <Card
            key={record.id}
            onPress={() => goToDetail(record)}
            accessibilityLabel={record.titleOriginal || t.unnamedRecord}
            style={styles.listItem}
          >
            <View style={styles.listIconBox}>
              {record.type === 'folder' ? (
                <Ionicons name="folder-outline" size={24} color={colors.primary} />
              ) : (
                <Ionicons name={record.mediaType === 'video' ? 'videocam-outline' : 'image-outline'} size={24} color={colors.primary} />
              )}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <StatusBadge
                label={record.type === 'folder' ? t.trackingFolder : t.singleRecord}
                tone={record.type === 'folder' ? 'primary' : 'neutral'}
                style={styles.tag}
              />
              <Text style={styles.listTitle} numberOfLines={1}>{record.titleOriginal || t.unnamedRecord}</Text>
              <Text style={styles.listDate}>{recordDate(record.createdAt)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color={colors.textMuted} />
          </Card>
        ))}
      </ScrollView>
      {renderFooter(<Button label={c.recordAdd} icon="add" size="lg" fullWidth onPress={goToCreate} />)}
    </View>
  );

  const renderDetail = () => (
    <View style={styles.viewContainer}>
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: spacing.xxl + bottomInset }]} showsVerticalScrollIndicator={false}>
        <View style={styles.doctorModeRow}>{renderDoctorToggle(t.doctorModeOn, t.doctorModeSwitch)}</View>

        <View style={styles.mediaContainer}>
          {selectedRecord.hasMedia && selectedRecord.mediaUrl ? (
            renderMedia(selectedRecord.mediaUrl, selectedRecord.mediaType)
          ) : (<Text style={styles.mediaEmptyText}>{t.noMedia}</Text>)}
        </View>

        <Text style={styles.detailTitle}>{isDoctorMode ? (pickAbnormalTitle(selectedRecord, language) || t.aiTranslating) : selectedRecord.titleOriginal}</Text>
        <Text style={styles.detailDate}>{recordDate(selectedRecord.createdAt)}</Text>
        <Card tone="sunken">
          <Text style={styles.noteTitle}>{t.note}</Text>
          <Text style={[styles.noteText, isDoctorMode && { fontSize: 18, lineHeight: 28 }]}>
            {isDoctorMode ? (pickAbnormalNotes(selectedRecord, language) || t.aiTranslating) : selectedRecord.notesOriginal}
          </Text>
        </Card>
      </ScrollView>
    </View>
  );

  const renderFolder = () => (
    <View style={styles.viewContainer}>
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: spacing.xxl + bottomInset }]} showsVerticalScrollIndicator={false}>
        <View style={styles.doctorModeRow}>{renderDoctorToggle(t.chineseModeOn, t.switchChinese)}</View>

        <View style={styles.folderHeader}>
          <View style={styles.listIconBox}>
            <Ionicons name="folder-open-outline" size={26} color={colors.primary} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.detailTitle}>{isDoctorMode ? (pickAbnormalTitle(selectedRecord, language) || t.aiTranslating) : selectedRecord.titleOriginal}</Text>
            <Text style={styles.listDate}>{c.recordCreatedAt}{language === 'zh' ? '：' : ': '}{recordDate(selectedRecord.createdAt)}</Text>
          </View>
        </View>

        <Button label={t.todayRecords} icon="add" variant="secondary" size="lg" fullWidth onPress={goToCreateFolderEntry} style={styles.addEntryBtn} />

        <View style={styles.timelineContainer}>
          {selectedRecord.entries?.map((entry: any, index: number) => {
             const eDateObj = entry.createdAt?.toDate ? entry.createdAt.toDate() : new Date(entry.createdAt);
             const eDateStr = `${eDateObj.getMonth() + 1}/${eDateObj.getDate()} ${String(eDateObj.getHours()).padStart(2, '0')}:${String(eDateObj.getMinutes()).padStart(2, '0')}`;
             return (
              <View key={entry.entryId || index} style={styles.timelineItem}>
                <View style={styles.timelineDot} />
                <Text style={styles.timelineDate}>{eDateStr}</Text>
                <Card onPress={() => goToFolderEntry(entry)} padding={spacing.md} style={styles.timelineCard} accessibilityLabel={`${eDateStr} ${t.viewMore}`}>
                  <View style={styles.timelineThumbnail}>
                    {entry.mediaUrl ? (
                      entry.mediaType === 'video' ? (
                        <View style={styles.videoThumb}>
                          <Ionicons name="play" size={30} color={colors.onPrimary} />
                        </View>
                      ) : (
                        <Image source={{ uri: entry.mediaUrl }} style={styles.thumbImage} />
                      )
                    ) : <Ionicons name="document-text-outline" size={30} color={colors.textMuted} />}
                  </View>
                  <View style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}>
                    <Text style={styles.timelineNotes} numberOfLines={2}>{isDoctorMode ? (pickAbnormalEntryNotes(entry, language) || t.aiTranslatingShort) : entry.notesOriginal}</Text>
                    <View style={styles.timelineMoreRow}>
                      <Text style={styles.timelineMore}>{t.viewMore}</Text>
                      <Ionicons name="chevron-forward" size={14} color={colors.primary} />
                    </View>
                  </View>
                </Card>
              </View>
            )
          })}
        </View>
      </ScrollView>
    </View>
  );

  const renderFolderEntryDetail = () => {
    const eDateObj = selectedFolderEntry?.createdAt?.toDate ? selectedFolderEntry.createdAt.toDate() : new Date(selectedFolderEntry?.createdAt ?? NaN);
    const eDateStr = Number.isNaN(eDateObj.getTime()) ? '—' : formatLongDate(eDateObj, language);
    return (
      <View style={styles.viewContainer}>
        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: spacing.xxl + bottomInset }]} showsVerticalScrollIndicator={false}>
          <View style={styles.doctorModeRow}>{renderDoctorToggle(t.chineseModeOn, t.switchChinese)}</View>

          <View style={styles.folderBadge}>
            <Ionicons name="folder-outline" size={16} color={colors.primary} />
            <Text style={styles.folderBadgeText}>{t.fromFolder}: {isDoctorMode ? (pickAbnormalTitle(selectedRecord, language) || selectedRecord.titleOriginal) : selectedRecord.titleOriginal}</Text>
          </View>

          <View style={styles.mediaContainer}>
             {selectedFolderEntry.mediaUrl ? renderMedia(selectedFolderEntry.mediaUrl, selectedFolderEntry.mediaType) : <Text style={styles.mediaEmptyText}>{t.noPhoto}</Text>}
          </View>

          <Text style={styles.noteTitle}>{t.recordTime}</Text>
          <Text style={styles.detailDate}>{eDateStr}</Text>
          <Card tone="sunken">
            <Text style={styles.noteTitle}>{t.note}</Text>
            <Text style={[styles.noteText, isDoctorMode && { fontSize: 18, lineHeight: 28 }]}>{isDoctorMode ? (pickAbnormalEntryNotes(selectedFolderEntry, language) || t.aiTranslating) : selectedFolderEntry.notesOriginal}</Text>
          </Card>
        </ScrollView>
      </View>
    );
  };

  const renderEdit = () => (
    <View style={styles.viewContainer}>
      <KeyboardAwareScroll contentContainerStyle={styles.formContent} showsVerticalScrollIndicator={false} safeAreaBottom={false}>
        <View style={styles.introBox}>
          <Ionicons name="create-outline" size={22} color={colors.primary} />
          <Text style={styles.introText}>{mediaCopy.edit}</Text>
        </View>

        {currentView === 'edit' && (
          <TextField label={t.recordTitle} value={title} onChangeText={setTitle} />
        )}

        <TextField label={t.noteDescription} value={notes} onChangeText={setNotes} multiline inputStyle={styles.notesInput} />
      </KeyboardAwareScroll>

      {renderFooter(<Button label={t.save} icon="checkmark" size="lg" fullWidth onPress={handleUpdateTextOnly} loading={isUploading} />)}
    </View>
  );

  const renderCreate = () => (
    <View style={styles.viewContainer}>
      <KeyboardAwareScroll contentContainerStyle={styles.formContent} showsVerticalScrollIndicator={false} safeAreaBottom={false}>
        <SegmentedTabs
          options={[
            { key: 'single', label: t.singleRecord },
            { key: 'folder', label: t.trackingFolder },
          ]}
          value={createFormType}
          onChange={setCreateFormType}
        />

        {createFormType === 'single' ? (
          <>
            {renderMediaPicker()}
            <TextField label={t.recordTitle} value={title} onChangeText={setTitle} placeholder={t.recordTitlePlaceholder} />
            <TextField label={t.noteDescription} value={notes} onChangeText={setNotes} placeholder={t.notePlaceholder} multiline inputStyle={styles.notesInput} />
          </>
        ) : (
          <>
            <View style={styles.introBox}>
              <Ionicons name="folder-open-outline" size={22} color={colors.primary} />
              <Text style={styles.introText}>{t.conditionHint}</Text>
            </View>
            <TextField label={t.trackingFolder} value={title} onChangeText={setTitle} placeholder={t.recordTitlePlaceholder} />
            <TextField label={t.noteDescription} value={notes} onChangeText={setNotes} placeholder={t.notePlaceholder} multiline inputStyle={styles.notesInput} />
          </>
        )}
      </KeyboardAwareScroll>
      {renderFooter(<Button label={t.save} icon="checkmark" size="lg" fullWidth onPress={handleSaveRecord} loading={isUploading} />)}
    </View>
  );

  const renderCreateFolderEntry = () => (
    <View style={styles.viewContainer}>
      <KeyboardAwareScroll contentContainerStyle={styles.formContent} showsVerticalScrollIndicator={false} safeAreaBottom={false}>
        <View style={styles.folderBadge}>
          <Ionicons name="folder-outline" size={16} color={colors.primary} />
          <Text style={styles.folderBadgeText}>{mediaCopy.addEntry}: {selectedRecord.titleOriginal}</Text>
        </View>

        {renderMediaPicker()}

        <TextField label={t.noteDescription} value={notes} onChangeText={setNotes} placeholder={t.notePlaceholder} multiline inputStyle={styles.notesInput} />
      </KeyboardAwareScroll>
      {renderFooter(<Button label={t.save} icon="checkmark" size="lg" fullWidth onPress={() => void handleSaveFolderEntry()} loading={isUploading} />)}
    </View>
  );

  const showActions = currentView === 'detail' || currentView === 'folder' || currentView === 'folderEntryDetail';

  // --- 主結構回傳 ---
  return (
    <View style={styles.container}>
      <AppHeader
        title={t.conditionRecording}
        onBack={() => {
          if (currentView === 'folderEntryDetail' || currentView === 'editFolderEntry' || currentView === 'createFolderEntry') goBackToFolder();
          else if (currentView === 'edit') setCurrentView(selectedRecord.type === 'folder' ? 'folder' : 'detail');
          else if (currentView !== 'list') goToList();
          else if (router.canGoBack()) router.back();
          else router.replace('/caregiver' as Href);
        }}
        right={showActions ? (
          <IconButton icon="ellipsis-horizontal" accessibilityLabel={mediaCopy.actions} onPress={() => setDropdownOpen(true)} />
        ) : undefined}
      />

      <View style={{ flex: 1 }}>
        {currentView === 'list' && renderList()}
        {currentView === 'detail' && renderDetail()}
        {currentView === 'folder' && renderFolder()}
        {currentView === 'folderEntryDetail' && renderFolderEntryDetail()}
        {currentView === 'create' && renderCreate()}
        {currentView === 'createFolderEntry' && renderCreateFolderEntry()}
        {(currentView === 'edit' || currentView === 'editFolderEntry') && renderEdit()}
      </View>
      {/* A native/web modal keeps actions above ScrollView, media and note layers. */}
      <Modal visible={dropdownOpen} transparent animationType="fade" onRequestClose={() => setDropdownOpen(false)}>
        <View style={[styles.actionsOverlay, { paddingBottom: spacing.xl + insets.bottom }]}>
          <Pressable accessibilityRole="button" accessibilityLabel={mediaCopy.close} style={StyleSheet.absoluteFill} onPress={() => setDropdownOpen(false)} />
          <View style={styles.actionsSheet} accessibilityViewIsModal>
            <Text style={styles.actionsTitle}>{mediaCopy.actions}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={currentView === 'folderEntryDetail' ? goToEditFolderEntry : goToEditRecord}
              style={({ pressed }) => [styles.dropdownItem, pressed && { backgroundColor: colors.surfaceSunken }]}
            >
              <Ionicons name="create-outline" size={22} color={colors.primary} />
              <Text style={styles.dropdownText}>{t.edit}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={currentView === 'folderEntryDetail' ? handleDeleteFolderEntry : handleDeleteRecord}
              style={({ pressed }) => [styles.dropdownItem, pressed && { backgroundColor: colors.dangerSoft }]}
            >
              <Ionicons name="trash-outline" size={22} color={colors.danger} />
              <Text style={[styles.dropdownText, { color: colors.danger }]}>{t.delete}</Text>
            </Pressable>
            <Button label={t.cancel} variant="secondary" fullWidth onPress={() => setDropdownOpen(false)} style={styles.actionsCancel} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  viewContainer: { flex: 1 },
  scrollContent: {
    paddingHorizontal: layout.screenPaddingX,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
  },
  formContent: { width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center' },
  footer: {
    paddingHorizontal: layout.screenPaddingX,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },

  actionsOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl, backgroundColor: colors.overlay },
  actionsSheet: { width: '100%', maxWidth: 380, backgroundColor: colors.surface, borderRadius: radii.sheet, padding: spacing.md },
  actionsTitle: { ...typography.header, paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  dropdownItem: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.control,
  },
  dropdownText: { ...typography.bodyStrong },
  actionsCancel: { marginTop: spacing.sm },

  listHint: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg, marginHorizontal: spacing.xs },
  listItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  tag: { marginBottom: spacing.xs },
  listTitle: { ...typography.bodyStrong, fontSize: 18 },
  listDate: { ...typography.bodySmall, marginTop: 2 },
  listIconBox: { width: 48, height: 48, backgroundColor: colors.primarySoft, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },

  doctorModeRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: spacing.lg },
  doctorModeBtn: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: 24,
    borderWidth: 1,
    maxWidth: '100%',
  },
  doctorModeBtnIdle: { backgroundColor: colors.surface, borderColor: colors.border },
  doctorModeBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  doctorModeText: { ...typography.label, fontSize: 16, color: colors.textSecondary, flexShrink: 1, textAlign: 'center' },
  mediaContainer: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: colors.surfaceSunken,
    borderRadius: radii.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
    overflow: 'hidden',
  },
  mediaEmptyText: { ...typography.body, color: colors.textMuted },
  mediaImage: { width: '100%', height: '100%' },
  detailTitle: { ...typography.title, maxWidth: '100%' },
  detailDate: { ...typography.bodySmall, marginTop: spacing.xs, marginBottom: spacing.lg },
  noteTitle: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.xs },
  noteText: { ...typography.body },

  folderHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xl },
  addEntryBtn: { marginBottom: spacing.xl },
  timelineContainer: { paddingLeft: spacing.lg, borderLeftWidth: 2, borderLeftColor: colors.primaryBorder, marginLeft: spacing.sm },
  timelineItem: { marginBottom: spacing.xl, position: 'relative' },
  timelineDot: {
    position: 'absolute',
    left: -spacing.lg - 9,
    top: 3,
    width: 16,
    height: 16,
    backgroundColor: colors.primary,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: colors.canvas,
  },
  timelineDate: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.sm },
  timelineCard: { flexDirection: 'row', gap: spacing.md },
  timelineThumbnail: {
    width: 80,
    height: 80,
    backgroundColor: colors.surfaceSunken,
    borderRadius: radii.control,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  videoThumb: { width: '100%', height: '100%', backgroundColor: colors.text, justifyContent: 'center', alignItems: 'center' },
  thumbImage: { width: '100%', height: '100%' },
  timelineNotes: { ...typography.body, marginBottom: spacing.xs },
  timelineMore: { ...typography.label, color: colors.primary },
  timelineMoreRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  folderBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.pill,
    marginBottom: spacing.lg,
    maxWidth: '100%',
  },
  folderBadgeText: { ...typography.label, color: colors.primary, flexShrink: 1 },

  uploadBox: { width: '100%', aspectRatio: 4 / 3, borderRadius: radii.card, overflow: 'hidden' },
  uploadBoxEmpty: { backgroundColor: colors.surfaceSunken, borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed' },
  uploadBoxFilled: { backgroundColor: colors.text },
  uploadPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.sm },
  uploadIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  uploadText: { ...typography.bodyStrong, color: colors.primary },
  reselectBtn: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    minHeight: 44,
    backgroundColor: colors.overlay,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '90%',
  },
  reselectBtnText: { ...typography.label, color: colors.onPrimary, flexShrink: 1 },

  notesInput: { minHeight: 140 },
  introBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.primarySoft, padding: spacing.lg, borderRadius: radii.card },
  introText: { ...typography.body, color: colors.text, flex: 1 },
});
