import { AppHeader, EmptyState, StatusBadge } from "@/src/ui/components";
import { colors, layout, radii, spacing, typography } from "@/src/ui/theme";
import { Ionicons } from '@expo/vector-icons';
import VideoPlayerView from '@/src/media/VideoPlayerView';
import { router, useNavigation } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

// Firebase 相關
import { db } from '@/firebase/firebaseConfig';
import { useActiveCareTarget } from '@/src/care-target/useActiveCareTarget';
import { pickDynamicLocalizedString } from '@/src/i18n/dynamicTranslation';
import { translations, type Language } from '@/src/i18n/translations';
import { useLanguage } from '@/src/store/LanguageContext';
import { collection, onSnapshot, query, where } from 'firebase/firestore';

function pickAbnormalTitle(record: any, language: Language) {
  return pickDynamicLocalizedString(record, 'title', language, ['titleZh', 'titleOriginal'], record?.titleOriginal ?? '');
}

function pickAbnormalNotes(record: any, language: Language) {
  return pickDynamicLocalizedString(record, 'notes', language, ['notesZh', 'notesOriginal'], record?.notesOriginal ?? '');
}

function pickAbnormalEntryNotes(entry: any, language: Language) {
  return pickDynamicLocalizedString(entry, 'notes', language, ['notesZh', 'notesOriginal'], entry?.notesOriginal ?? '');
}

export default function FamilyConditionScreen() {
  const { activePatientId } = useActiveCareTarget();
  const { language } = useLanguage();
  const t = translations[language];
  
  // 動態隱藏/顯示底部 Tab Bar
  const navigation = useNavigation();
  useEffect(() => {
    navigation.getParent()?.setOptions({ tabBarStyle: { display: 'none' } });
    return () => {
      navigation.getParent()?.setOptions({ tabBarStyle: { display: 'flex' } });
    };
  }, [navigation]);

  // --- 畫面與資料狀態 ---
  const [currentView, setCurrentView] = useState<'list' | 'detail' | 'folder' | 'folderEntryDetail'>('list');
  const [records, setRecords] = useState<any[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [selectedFolderEntry, setSelectedFolderEntry] = useState<any>(null);
  const [isDoctorMode, setIsDoctorMode] = useState(false);

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

  // --- 導覽功能 ---
  const goToList = () => { 
    setCurrentView('list'); 
    setSelectedRecord(null); 
    setSelectedFolderEntry(null); 
    setIsDoctorMode(false); 
  };
  
  const goToDetail = (record: any) => { 
    setSelectedRecord(record); 
    setCurrentView(record.type === 'folder' ? 'folder' : 'detail'); 
    setIsDoctorMode(false); 
  };
  
  const goToFolderEntry = (entry: any) => { 
    setSelectedFolderEntry(entry); 
    setCurrentView('folderEntryDetail'); 
    setIsDoctorMode(false); 
  };
  
  const goBackToFolder = () => { 
    setCurrentView('folder'); 
    setSelectedFolderEntry(null); 
    setIsDoctorMode(false); 
  };

  // --- 🌟 強化版：多重防呆的媒體渲染元件 ---
  const renderMedia = (uri: string, type: 'image' | 'video' | null | undefined) => {
    // 智慧偵測：如果資料庫有標記 video，或者網址內包含影片副檔名，就強制當成影片處理！
    const isVideo = type === 'video' || (uri && (uri.includes('.mp4') || uri.includes('.mov')));

    if (isVideo) {
      return (
        <VideoPlayerView uri={uri} style={styles.mediaImage} />
      );
    }
    return (
      <Image 
        source={{ uri }} 
        style={styles.mediaImage} 
        resizeMode="contain" 
      />
    );
  };

  // 判斷是否為影片的共用小函式 (用在列表與縮圖)
  const isVideoMedia = (type: any, uri: any) => {
    return type === 'video' || (uri && (uri.includes('.mp4') || uri.includes('.mov')));
  };

  // --- UI 渲染區塊 ---

  const renderDoctorToggle = (onLabel: string, offLabel: string) => (
    <View style={styles.doctorModeRow}>
      <Pressable
        onPress={() => setIsDoctorMode(!isDoctorMode)}
        accessibilityRole="switch"
        accessibilityState={{ checked: isDoctorMode }}
        style={({ pressed }) => [
          styles.doctorModeBtn,
          isDoctorMode ? styles.doctorModeBtnActive : styles.doctorModeBtnIdle,
          pressed && !isDoctorMode && { backgroundColor: colors.primarySoft },
        ]}
      >
        <Ionicons name="language" size={18} color={isDoctorMode ? colors.onPrimary : colors.primary} />
        <Text style={[styles.doctorModeText, isDoctorMode && { color: colors.onPrimary }]}>
          {isDoctorMode ? onLabel : offLabel}
        </Text>
      </Pressable>
    </View>
  );

  const renderList = () => (
    <View style={styles.viewContainer}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.listHint}>{t.conditionHint}</Text>

        {records.length === 0 ? (
          <EmptyState icon="clipboard-outline" title={t.noConditionRecords} />
        ) : (
          records.map(record => (
            <Pressable
              key={record.id}
              onPress={() => goToDetail(record)}
              accessibilityRole="button"
              accessibilityLabel={record.titleOriginal || t.unnamedRecord}
              style={({ pressed }) => [styles.listItem, pressed && styles.pressed]}
            >
              <View style={styles.listIconBox}>
                {record.type === 'folder' ? (
                  <Ionicons name="folder-outline" size={24} color={colors.primary} />
                ) : (
                  <Ionicons name={isVideoMedia(record.mediaType, record.mediaUrl) ? "videocam-outline" : "image-outline"} size={24} color={colors.primary} />
                )}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <StatusBadge
                  label={record.type === 'folder' ? t.trackingFolder : t.singleRecord}
                  tone={record.type === 'folder' ? 'primary' : 'neutral'}
                  style={styles.tag}
                />
                <Text style={styles.listTitle} numberOfLines={1}>{record.titleOriginal || t.unnamedRecord}</Text>
                <Text style={styles.listDate}>{record.displayDate}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );

  const renderDetail = () => (
    <View style={styles.viewContainer}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {renderDoctorToggle(t.doctorModeOn, t.doctorModeSwitch)}

        <View style={styles.mediaContainer}>
          {selectedRecord?.hasMedia && selectedRecord?.mediaUrl ? (
            renderMedia(selectedRecord.mediaUrl, selectedRecord.mediaType)
          ) : (<Text style={styles.mediaEmptyText}>{t.noMedia}</Text>)}
        </View>

        <View style={styles.detailHeaderRow}>
          <Text style={styles.detailTitle}>{isDoctorMode ? (pickAbnormalTitle(selectedRecord, language) || t.aiTranslating) : selectedRecord?.titleOriginal}</Text>
        </View>

        <Text style={styles.detailDate}>{selectedRecord?.displayDate}</Text>

        <View style={styles.noteBox}>
          <Text style={styles.noteTitle}>{t.note}</Text>
          <Text style={[styles.noteText, isDoctorMode && { fontSize: 18, lineHeight: 28 }]}>
            {isDoctorMode ? (pickAbnormalNotes(selectedRecord, language) || t.aiTranslating) : selectedRecord?.notesOriginal}
          </Text>
        </View>
      </ScrollView>
    </View>
  );

  const renderFolder = () => (
    <View style={styles.viewContainer}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {renderDoctorToggle(t.chineseModeOn, t.switchChinese)}

        <View style={styles.folderHeader}>
          <View style={[styles.listIconBox, { marginRight: spacing.md }]}>
            <Ionicons name="folder-open-outline" size={24} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.detailTitle}>{isDoctorMode ? (pickAbnormalTitle(selectedRecord, language) || t.aiTranslating) : selectedRecord?.titleOriginal}</Text>
            <Text style={[styles.detailDate, { marginBottom: 0 }]}>{t.createdAt}: {selectedRecord?.displayDate}</Text>
          </View>
        </View>

        {(!selectedRecord?.entries || selectedRecord?.entries.length === 0) && (
          <EmptyState icon="folder-open-outline" title={t.emptyFolder} />
        )}

        <View style={styles.timelineContainer}>
          {selectedRecord?.entries?.map((entry: any, index: number) => {
             const eDateObj = entry.createdAt?.toDate ? entry.createdAt.toDate() : new Date(entry.createdAt);
             const eDateStr = `${eDateObj.getMonth() + 1}/${eDateObj.getDate()} ${String(eDateObj.getHours()).padStart(2, '0')}:${String(eDateObj.getMinutes()).padStart(2, '0')}`;
             return (
              <Pressable
                key={entry.entryId || index}
                style={styles.timelineItem}
                onPress={() => goToFolderEntry(entry)}
                accessibilityRole="button"
                accessibilityLabel={`${eDateStr}, ${t.viewMore}`}
              >
                <View style={styles.timelineDot} />
                <Text style={styles.timelineDate}>{eDateStr}</Text>
                <View style={styles.timelineCard}>
                  <View style={styles.timelineThumbnail}>
                    {entry.mediaUrl ? (
                      isVideoMedia(entry.mediaType, entry.mediaUrl) ? (
                        <View style={styles.videoThumb}>
                          <Ionicons name="play" size={32} color={colors.onPrimary} />
                        </View>
                      ) : (
                        <Image source={{ uri: entry.mediaUrl }} style={styles.thumbImage} />
                      )
                    ) : <Ionicons name="document-text-outline" size={32} color={colors.textDisabled} />}
                  </View>
                  <View style={{ flex: 1, justifyContent: 'center' }}>
                    <Text style={styles.timelineNotes} numberOfLines={2}>{isDoctorMode ? (pickAbnormalEntryNotes(entry, language) || t.aiTranslatingShort) : entry.notesOriginal}</Text>
                    <View style={styles.timelineMoreRow}>
                      <Text style={styles.timelineMore}>{t.viewMore}</Text>
                      <Ionicons name="chevron-forward" size={14} color={colors.primary} />
                    </View>
                  </View>
                </View>
              </Pressable>
            )
          })}
        </View>
      </ScrollView>
    </View>
  );

  const renderFolderEntryDetail = () => {
    const eDateObj = selectedFolderEntry?.createdAt?.toDate ? selectedFolderEntry.createdAt.toDate() : new Date(selectedFolderEntry?.createdAt ?? NaN);
    const eDateStr = Number.isNaN(eDateObj.getTime()) ? '—' : `${eDateObj.getFullYear()}年 ${eDateObj.getMonth() + 1}月 ${eDateObj.getDate()}日`;

    return (
      <View style={styles.viewContainer}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {renderDoctorToggle(t.chineseModeOn, t.switchChinese)}

          <View style={styles.folderBadge}>
            <Ionicons name="folder-outline" size={16} color={colors.primary} style={{ marginRight: 6 }} />
            <Text style={styles.folderBadgeText}>{t.fromFolder}{language === 'zh' ? '：' : ': '}{isDoctorMode ? (pickAbnormalTitle(selectedRecord, language) || selectedRecord?.titleOriginal) : selectedRecord?.titleOriginal}</Text>
          </View>

          <View style={styles.mediaContainer}>
             {selectedFolderEntry?.mediaUrl ? renderMedia(selectedFolderEntry.mediaUrl, selectedFolderEntry.mediaType) : <Text style={styles.mediaEmptyText}>{t.noPhoto}</Text>}
          </View>

          <View style={styles.detailHeaderRow}>
            <Text style={styles.detailTitle}>{t.recordTime}</Text>
          </View>

          <Text style={styles.detailDate}>{eDateStr}</Text>

          <View style={styles.noteBox}>
            <Text style={styles.noteTitle}>{t.note}</Text>
            <Text style={[styles.noteText, isDoctorMode && { fontSize: 18, lineHeight: 28 }]}>
              {isDoctorMode ? (pickAbnormalEntryNotes(selectedFolderEntry, language) || t.aiTranslating) : selectedFolderEntry?.notesOriginal}
            </Text>
          </View>
        </ScrollView>
      </View>
    );
  };

  // --- 主結構回傳 ---
  return (
    <View style={styles.container}>
      <AppHeader
        title={t.conditionView}
        onBack={() => {
          if (currentView === 'folderEntryDetail') goBackToFolder();
          else if (currentView !== 'list') goToList();
          else if (router.canGoBack()) router.back();
          else router.replace('/family');
        }}
      />

      <View style={{ flex: 1 }}>
        {currentView === 'list' && renderList()}
        {currentView === 'detail' && renderDetail()}
        {currentView === 'folder' && renderFolder()}
        {currentView === 'folderEntryDetail' && renderFolderEntryDetail()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  viewContainer: { flex: 1, position: 'relative' },
  scrollContent: { paddingHorizontal: layout.screenPaddingX, paddingTop: spacing.lg, paddingBottom: spacing.xxxl, width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center' },

  listHint: { ...typography.bodySmall, marginBottom: spacing.lg, marginLeft: spacing.xs },
  listItem: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  pressed: { backgroundColor: colors.surfaceSunken },
  tag: { marginBottom: spacing.xs },
  listTitle: { ...typography.bodyStrong, fontSize: 18 },
  listDate: { ...typography.bodySmall, color: colors.textMuted, marginTop: 2 },
  listIconBox: { width: 48, height: 48, backgroundColor: colors.primarySoft, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },

  doctorModeRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: spacing.lg },
  doctorModeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.lg, minHeight: layout.minTouchTarget, borderRadius: radii.pill, borderWidth: 1, maxWidth: '100%' },
  doctorModeBtnIdle: { backgroundColor: colors.surface, borderColor: colors.primaryBorder },
  doctorModeBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  doctorModeText: { ...typography.label, color: colors.primary, flexShrink: 1, textAlign: 'center' },
  mediaContainer: { width: '100%', aspectRatio: 4 / 3, backgroundColor: colors.surfaceSunken, borderRadius: radii.card, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.xl, overflow: 'hidden' },
  mediaImage: { width: '100%', height: '100%' },
  mediaEmptyText: { ...typography.bodySmall, color: colors.textMuted },
  detailHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.xs, flexWrap: 'wrap', gap: spacing.sm },
  detailTitle: { ...typography.title, maxWidth: '100%' },
  detailDate: { ...typography.bodySmall, color: colors.textMuted, marginBottom: spacing.xl },
  noteBox: { backgroundColor: colors.surface, padding: spacing.lg, borderRadius: radii.card, borderWidth: 1, borderColor: colors.border },
  noteTitle: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.sm },
  noteText: { ...typography.body },

  folderHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xl },
  timelineContainer: { paddingLeft: spacing.lg, borderLeftWidth: 2, borderLeftColor: colors.primaryBorder, marginLeft: spacing.lg, marginTop: spacing.lg },
  timelineItem: { marginBottom: spacing.xl, position: 'relative' },
  timelineDot: { position: 'absolute', left: -25, top: 2, width: 16, height: 16, backgroundColor: colors.primary, borderRadius: 8, borderWidth: 3, borderColor: colors.canvas },
  timelineDate: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.sm },
  timelineCard: { backgroundColor: colors.surface, borderRadius: radii.card, borderWidth: 1, borderColor: colors.border, padding: spacing.md, flexDirection: 'row', gap: spacing.md },
  timelineThumbnail: { width: 80, height: 80, backgroundColor: colors.surfaceSunken, borderRadius: radii.control, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  videoThumb: { width: '100%', height: '100%', borderRadius: radii.control, backgroundColor: colors.text, justifyContent: 'center', alignItems: 'center' },
  thumbImage: { width: '100%', height: '100%', borderRadius: radii.control },
  timelineNotes: { ...typography.bodySmall, color: colors.text, marginBottom: spacing.sm },
  timelineMore: { ...typography.label, color: colors.primary },
  timelineMoreRow: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 24 },
  folderBadge: { alignSelf: 'flex-start', backgroundColor: colors.primarySoft, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radii.control, marginBottom: spacing.lg, flexDirection: 'row', alignItems: 'center', maxWidth: '100%' },
  folderBadgeText: { ...typography.label, color: colors.primary, flexShrink: 1 },
});
