import { AppHeader, Button, Card, Divider, IconButton } from "@/src/ui/components";
import { colors, layout, radii, shadows, spacing, typography } from "@/src/ui/theme";
import { ClientOnly } from "@/src/ui/ClientOnly";
import { AppAlert as Alert } from "@/src/ui/AppAlert";
// app/family/voice.tsx
import { Ionicons } from '@expo/vector-icons';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
} from 'expo-audio';

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

// Firebase 相關
import { db } from '@/firebase/firebaseConfig';
import { useAuth } from '@/src/auth/useAuth';
import { useActiveCareTarget } from '@/src/care-target/useActiveCareTarget';
import { translations } from '@/src/i18n/translations';
import { useLanguage } from '@/src/store/LanguageContext';
import { collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { deleteObject, getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import { createMediaUploadFilename } from '@/firebase/uploadFilename';
import { readLocalBlob } from "@/src/media/readLocalBlob";

// 初始任務模板 (純圖片，不帶任何錄音狀態)
const initialTasks = [
  { id: 1, title: '乖乖吃藥', image: require('@/assets/images/medication.png') },
  { id: 2, title: '吃飯時間', image: require('@/assets/images/eating.png') },
  { id: 3, title: '洗澡囉', image: require('@/assets/images/shower.png') },
  { id: 4, title: '多喝水喔', image: require('@/assets/images/drink_water.png') },
  { id: 5, title: '動動身體', image: require('@/assets/images/exercise.png') },
  { id: 6, title: '上廁所', image: require('@/assets/images/toilet.png') },
  { id: 7, title: '上床睡覺', image: require('@/assets/images/sleep.png') },
  { id: 8, title: '安撫情緒', image: require('@/assets/images/emotion.png') },
];

export default function FamilyVoiceScreen() {
  return <ClientOnly><FamilyVoiceContent /></ClientOnly>;
}

function FamilyVoiceContent() {
  const { user } = useAuth();
  const { activePatientId } = useActiveCareTarget();
  const { language } = useLanguage();
  const t = translations[language];
  const storage = getStorage();
  const taskTitles: Record<number, string> = {
    1: t.voiceTaskMedication,
    2: t.voiceTaskMeal,
    3: t.voiceTaskShower,
    4: t.voiceTaskDrinkWater,
    5: t.voiceTaskExercise,
    6: t.voiceTaskToilet,
    7: t.voiceTaskSleep,
    8: t.voiceTaskEmotion,
  };

  // 畫面上的任務列表，會與 Firebase 同步
  const [tasks, setTasks] = useState<any[]>(initialTasks.map(t => ({ ...t, hasRecording: false })));
  const [recordingTask, setRecordingTask] = useState<any>(null); 
  
  // 錄音與試聽狀態 (Modal 用)
  // expo-audio 的錄音器與播放器都由 hook 管理生命週期，元件卸載時自動釋放，
  // 不需要像舊版 expo-av 那樣自己 unloadAsync
  const recorder = useAudioRecorder(RecordingPresets.LOW_QUALITY);
  const modalPlayer = useAudioPlayer();
  const modalPlayerStatus = useAudioPlayerStatus(modalPlayer);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlayingModal, setIsPlayingModal] = useState(false); 
  const previewTime = isPlayingModal ? Math.floor(modalPlayerStatus.currentTime) : 0;

  // 列表播放狀態 (實體播放用)
  const listPlayer = useAudioPlayer();
  const [playingTaskId, setPlayingTaskId] = useState<number | null>(null);

  // 播放結束時清掉播放中狀態（取代舊版的 setOnPlaybackStatusUpdate）
  useEffect(() => {
    const subscription = modalPlayer.addListener('playbackStatusUpdate', status => {
      if (status.didJustFinish) setIsPlayingModal(false);
    });
    return () => subscription.remove();
  }, [modalPlayer]);

  useEffect(() => {
    const subscription = listPlayer.addListener('playbackStatusUpdate', status => {
      if (status.didJustFinish) setPlayingTaskId(null);
    });
    return () => subscription.remove();
  }, [listPlayer]);

  // ==========================================
  // 1. 抓取 Firebase 語音紀錄 (同步狀態)
  // ==========================================
  useEffect(() => {
    if (!activePatientId) return;

    // 查詢該長輩的所有語音紀錄
    const q = query(
      collection(db, 'voice_records'),
      where('patientId', '==', activePatientId)
    );

    const unsub = onSnapshot(q, (snap) => {
      const recordsMap: Record<string, any> = {};
      
      snap.docs.forEach(doc => {
        const data = doc.data();
        // 確保抓到最新的一筆 (以防同一種項目重複錄)
        if (!recordsMap[data.title] || data.createdAt > recordsMap[data.title].createdAt) {
          recordsMap[data.title] = { docId: doc.id, ...data };
        }
      });

      // 將 Firebase 資料與 UI 列表合併
      setTasks(initialTasks.map(task => {
        const record = recordsMap[task.title];
        if (record) {
          return { ...task, hasRecording: true, audioUrl: record.audioUrl, docId: record.docId };
        }
        return { ...task, hasRecording: false, audioUrl: null, docId: null };
      }));
    });

    return unsub;
  }, [activePatientId]);

  // ==========================================
  // 計時器邏輯
  // ==========================================
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (recordingTask !== null && isRecording) {
      interval = setInterval(() => {
        setRecordTime((prev) => (prev >= 30 ? 30 : prev + 1));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [recordingTask, isRecording]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  // ==========================================
  // 錄音與試聽控制 (Modal 內)
  // ==========================================
  const startRecording = async () => {
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(t.resultErrorTitle, t.micPermissionNeeded);
        return;
      }
      // 💡 錄音前：開啟錄音模式
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        shouldRouteThroughEarpiece: false, // 防止 Android 也從聽筒出聲
      });

      await recorder.prepareToRecordAsync();
      recorder.record();
      setIsRecording(true);
      setRecordTime(0);
      setAudioUri(null);
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };

  const stopRecording = async () => {
    if (!recorder.isRecording) return;
    setIsRecording(false);
    await recorder.stop();
    // expo-audio 的錄音檔路徑在 recorder.uri
    setAudioUri(recorder.uri);
  };

  const toggleRecord = () => {
    if (isPlayingModal) return; 
    if (isRecording) stopRecording();
    else startRecording();
  };

  const togglePreview = async () => {
    if (isPlayingModal) {
      modalPlayer.pause();
      setIsPlayingModal(false);
    } else {
      if (!audioUri) return;
      setIsPlayingModal(true);

      // 💡 播放前：關閉錄音模式，強制聲音從底部主喇叭放出！
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
        shouldRouteThroughEarpiece: false,
      });

      modalPlayer.replace({ uri: audioUri });
      modalPlayer.play();
    }
  };

  // ==========================================
  // 列表播放與刪除 (真實操作雲端)
  // ==========================================
  const playTaskAudio = async (task: any) => {
    if (!task.audioUrl) return;

    // 如果點擊的是正在播放的，就停止
    if (playingTaskId === task.id) {
      listPlayer.pause();
      setPlayingTaskId(null);
      return;
    }

    setPlayingTaskId(task.id);
    try {

      // 💡 播放前：關閉錄音模式，強制聲音從底部主喇叭放出！
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
        shouldRouteThroughEarpiece: false,
      });

      // 換音源後從頭播放（replace 會自動停掉前一首）
      listPlayer.replace({ uri: task.audioUrl });
      listPlayer.play();
    } catch {
      Alert.alert(t.resultErrorTitle, t.playVoiceFailed);
      setPlayingTaskId(null);
    }
  };

  const handleDeleteRecord = async (task: any) => {
    if (!task.docId) return;

    Alert.alert(t.deleteConfirmTitle, `${t.deleteVoiceMessage}\n${taskTitles[task.id] ?? task.title}`, [
      { text: t.cancel, style: 'cancel' },
      { 
        text: t.delete, 
        style: 'destructive', 
        onPress: async () => {
          try {
            // 1. 刪除 Firestore 文件
            await deleteDoc(doc(db, 'voice_records', task.docId));
            
            // 2. 刪除 Storage 實體音檔
            const storageRef = ref(storage, `voice_messages/${activePatientId}/${task.docId}.m4a`);
            await deleteObject(storageRef).catch(() => console.log("Storage file already missing"));
            
            // 如果正在播放則停止
            if (playingTaskId === task.id) {
              listPlayer.pause();
              setPlayingTaskId(null);
            }
          } catch {
            Alert.alert(t.resultErrorTitle, t.deleteFailedShort);
          }
        } 
      }
    ]);
  };

  // ==========================================
  // 儲存邏輯 (上傳)
  // ==========================================
  const handleSaveRecord = async () => {
    if (!audioUri || !user || !activePatientId || !recordingTask) {
      Alert.alert(t.prompt, t.recordBeforeSave);
      return;
    }

    setIsUploading(true);
    try {
      const fileName = createMediaUploadFilename('m4a');
      const customDocId = fileName.slice(0, -4);

      const blob = await readLocalBlob(audioUri);
      const storageRef = ref(storage, `voice_messages/${activePatientId}/${fileName}`);
      
      await uploadBytes(storageRef, blob, {
        contentType: blob.type || 'audio/mp4',
        customMetadata: {uploaderUid: user.uid, patientId: activePatientId},
      });
      const downloadUrl = await getDownloadURL(storageRef);

      const docRef = doc(db, 'voice_records', customDocId);
      await setDoc(docRef, {
        patientId: activePatientId,
        familyId: user.uid,
        title: recordingTask.title,
        audioUrl: downloadUrl,
        createdAt: serverTimestamp(),
      });

      Alert.alert(t.saveSuccessTitle, t.voiceUploaded);
      
      setRecordingTask(null);
      setIsRecording(false);
      setIsPlayingModal(false);
      setAudioUri(null);
    } catch (error) {
      console.error('Upload failed:', error);
      Alert.alert(t.uploadFailedTitle, t.uploadFailedMessage);
    } finally {
      setIsUploading(false);
    }
  };

  const handleOpenRecord = (task: any) => {
    setRecordingTask(task);
    setRecordTime(0);
    setIsRecording(false);
    setIsPlayingModal(false);
    setAudioUri(null);
  };

  const closeModal = () => {
    if (isRecording) stopRecording();
    setRecordingTask(null);
    setIsRecording(false);
    setIsPlayingModal(false);
  };

  return (
    <View style={styles.container}>
      <AppHeader title={t.recordVoice} fallbackHref="/family" />

      {/* 列表區域 */}
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Card padding={0}>
          {tasks.map((task, index) => {
            const title = taskTitles[task.id] ?? task.title;
            return (
              <View key={task.id}>
                {index > 0 ? <Divider /> : null}
                <View style={styles.taskCard}>
                  {/* 左側：圖片與標題 */}
                  <View style={styles.taskLeft}>
                    <View style={styles.imageBox}>
                      <Image source={task.image} style={styles.taskImage} resizeMode="contain" />
                    </View>

                    <View style={styles.taskInfo}>
                      <Text style={styles.taskTitle}>{title}</Text>
                      <View style={styles.statusArea}>
                        {task.hasRecording ? (
                          <Pressable
                            style={({ pressed }) => [styles.playBadge, pressed && { backgroundColor: colors.primaryBorder }]}
                            onPress={() => playTaskAudio(task)}
                            accessibilityRole="button"
                            accessibilityLabel={`${title}, ${playingTaskId === task.id ? t.stopPreview : t.preview}`}
                          >
                            <Ionicons name={playingTaskId === task.id ? "pause" : "play"} size={16} color={colors.primary} style={styles.playIcon} />
                            <View style={styles.waveContainer}>
                              {[...Array(7)].map((_, i) => (
                                <View
                                  key={i}
                                  style={[
                                    styles.waveBar,
                                    {
                                      height: playingTaskId === task.id ? Math.random() * 12 + 4 : 6,
                                      opacity: playingTaskId === task.id ? 0.9 : 0.45
                                    }
                                  ]}
                                />
                              ))}
                            </View>
                          </Pressable>
                        ) : (
                          <Text style={styles.statusEmpty}>{t.notRecorded}</Text>
                        )}
                      </View>
                    </View>
                  </View>

                  {/* 右側：錄音／刪除 */}
                  <View style={styles.taskRight}>
                    <IconButton
                      icon="mic-outline"
                      color={colors.primary}
                      accessibilityLabel={`${t.recordVoiceFor}: ${title}`}
                      onPress={() => handleOpenRecord(task)}
                      style={styles.iconBtn}
                    />
                    <IconButton
                      icon="trash-outline"
                      color={colors.danger}
                      accessibilityLabel={`${t.delete}: ${title}`}
                      onPress={() => handleDeleteRecord(task)}
                      disabled={!task.hasRecording}
                    />
                  </View>
                </View>
              </View>
            );
          })}
        </Card>
      </ScrollView>

      {/* ================= 錄音彈出視窗 (Modal) ================= */}
      {recordingTask && (
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
            <IconButton icon="close" color={colors.textSecondary} accessibilityLabel={t.cancel} onPress={closeModal} style={styles.closeBtn} />

            <Text style={styles.modalTitle}>{t.recordVoiceFor}: {taskTitles[recordingTask.id] ?? recordingTask.title}</Text>
            <Text style={styles.modalSubtitle}>
              {isPlayingModal ? t.previewing : isRecording ? t.recordingHint : t.tapMicToRecord}
            </Text>

            <Pressable
              style={[styles.micWrap, isPlayingModal && { opacity: 0.5 }]}
              onPress={toggleRecord}
              disabled={isPlayingModal}
              accessibilityRole="button"
              accessibilityLabel={isRecording ? t.recordingHint : t.tapMicToRecord}
            >
              {isRecording && <View style={styles.micPulse} />}
              <View style={[styles.micInner, isRecording ? styles.micInnerRecording : styles.micInnerIdle]}>
                <Ionicons name={isRecording ? "stop" : "mic"} size={46} color={isRecording ? colors.onPrimary : colors.primary} />
              </View>
            </Pressable>

            <Text style={styles.timeText}>
              {isPlayingModal ? `${formatTime(previewTime)} / ${formatTime(recordTime)}` : `${formatTime(recordTime)} / 00:30`}
            </Text>

            <View style={styles.btnRow}>
              <Button
                label={isPlayingModal ? t.stopPreview : t.preview}
                icon={isPlayingModal ? "stop-outline" : "play-outline"}
                variant="secondary"
                size="lg"
                onPress={togglePreview}
                disabled={recordTime === 0 || isRecording}
                style={styles.actionBtn}
              />
              <Button
                label={t.save}
                icon="cloud-upload-outline"
                size="lg"
                onPress={handleSaveRecord}
                loading={isUploading}
                disabled={isRecording || recordTime === 0}
                style={styles.actionBtn}
              />
            </View>
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },

  scrollContent: { padding: layout.screenPaddingX, paddingBottom: spacing.xxxl, width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center' },
  taskCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md, paddingHorizontal: spacing.md, flexWrap: 'wrap', gap: spacing.sm },
  taskLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1, minWidth: 200 },
  imageBox: { width: 80, height: 80, backgroundColor: colors.surfaceSunken, borderRadius: radii.card, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  taskImage: { width: 88, height: 88 },
  taskInfo: { justifyContent: 'center', flex: 1, minWidth: 0 },
  taskTitle: { ...typography.bodyStrong, fontSize: 18, marginBottom: spacing.xs },

  statusArea: { justifyContent: 'center', minHeight: 36 },
  statusEmpty: { ...typography.bodySmall, color: colors.textMuted },
  playBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: colors.primarySoft, paddingHorizontal: 14, minHeight: 40, borderRadius: radii.pill },
  playIcon: { marginRight: spacing.sm },
  waveContainer: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 16 },
  waveBar: { width: 3, backgroundColor: colors.primary, borderRadius: 2 },

  taskRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexShrink: 0, marginLeft: 'auto' },
  iconBtn: { backgroundColor: colors.primarySoft },

  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center', zIndex: 50 },
  modalScroll: { maxHeight: '90%', width: '90%', maxWidth: 480, flexGrow: 0, borderRadius: radii.sheet },
  modalContent: { backgroundColor: colors.surface, borderRadius: radii.sheet, padding: spacing.xl, paddingTop: 56, alignItems: 'center', ...shadows.sheet },
  closeBtn: { position: 'absolute', top: spacing.sm, right: spacing.sm },
  modalTitle: { ...typography.header, textAlign: 'center', width: '100%', marginBottom: spacing.sm },
  modalSubtitle: { ...typography.bodySmall, textAlign: 'center', marginBottom: spacing.xl },

  micWrap: { width: 120, height: 120, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.xl },
  micPulse: { position: 'absolute', width: '100%', height: '100%', backgroundColor: colors.danger, borderRadius: 60, opacity: 0.2 },
  micInner: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center' },
  micInnerIdle: { backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primaryBorder },
  micInnerRecording: { backgroundColor: colors.danger },

  timeText: { fontSize: 26, lineHeight: 34, fontWeight: '600', letterSpacing: 1, marginBottom: spacing.xl, color: colors.text },

  btnRow: { flexDirection: 'row', width: '100%', gap: spacing.md },
  actionBtn: { flex: 1 },
});
