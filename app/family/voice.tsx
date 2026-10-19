import { ScreenHeader } from "@/src/ui/ScreenLayout";
// app/family/voice.tsx
import { Feather, Ionicons } from '@expo/vector-icons'; // 💡 引入專業圖示庫
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
} from 'expo-audio';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

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

  return (
    <View style={styles.container}>
      {/* 💡 延伸的綠色 Header (拿掉電池 UI，加深 PaddingBottom) */}
      <ScreenHeader style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color="#111827" />
            <Text style={styles.backBtnText}>{t.back}</Text>
          </Pressable>
        </View>
      </ScreenHeader>

      {/* 列表區域 */}
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {tasks.map((task) => (
          <View key={task.id} style={styles.taskCard}>
            
            {/* 左側：圖片與標題 */}
            <View style={styles.taskLeft}>
              <View style={styles.imageBox}>
                <Image source={task.image} style={styles.taskImage} resizeMode="contain" />
              </View>
              
              <View style={styles.taskInfo}>
                <Text style={styles.taskTitle}>{taskTitles[task.id] ?? task.title}</Text>
                <View style={styles.statusArea}>
                  {task.hasRecording ? (
                    // 💡 有錄音時，顯示播放鍵與音波
                    <Pressable 
                      style={styles.playBadge}
                      onPress={() => playTaskAudio(task)}
                    >
                      <Ionicons name={playingTaskId === task.id ? "pause" : "play"} size={16} color="black" style={styles.playIcon} />
                      <View style={styles.waveContainer}>
                        {[...Array(7)].map((_, i) => (
                          <View 
                            key={i} 
                            style={[
                              styles.waveBar, 
                              { 
                                height: playingTaskId === task.id ? Math.random() * 12 + 4 : 6,
                                opacity: playingTaskId === task.id ? 0.8 : 0.4
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

            {/* 💡 右側：替換成原汁原味的 Feather Icons */}
            <View style={styles.taskRight}>
              <Pressable style={styles.iconBtn} onPress={() => handleOpenRecord(task)}>
                <Feather name="mic" size={26} color="black" />
              </Pressable>
              <Pressable 
                style={[styles.iconBtn, !task.hasRecording && { opacity: 0.3 }]} 
                onPress={() => handleDeleteRecord(task)}
                disabled={!task.hasRecording}
              >
                <Feather name="trash-2" size={26} color="black" />
              </Pressable>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* ================= 錄音彈出視窗 (Modal) ================= */}
      {recordingTask && (
        <View style={styles.modalOverlay}>
          <ScrollView style={{ maxHeight: "90%", width: "90%", flexGrow: 0, borderRadius: 32 }} contentContainerStyle={styles.modalContent}>
            <Pressable 
              style={styles.closeBtn} 
              onPress={() => {
                if (isRecording) stopRecording();
                setRecordingTask(null);
                setIsRecording(false);
                setIsPlayingModal(false);
              }}
            >
              <Ionicons name="close" size={28} color="#666" />
            </Pressable>

            <Text style={styles.modalTitle}>{t.recordVoiceFor}: {taskTitles[recordingTask.id] ?? recordingTask.title}</Text>
            <Text style={styles.modalSubtitle}>
              {isPlayingModal ? t.previewing : isRecording ? t.recordingHint : t.tapMicToRecord}
            </Text>

            <Pressable 
              style={[styles.micWrap, isPlayingModal && { opacity: 0.5 }]}
              onPress={toggleRecord}
              disabled={isPlayingModal}
            >
              {isRecording && <View style={styles.micPulse} />}
              <View style={[styles.micInner, isRecording ? { backgroundColor: '#ffcccc' } : { backgroundColor: '#D4D7DC' }]}>
                {/* 💡 Modal 內的麥克風也換成真正的 Icon */}
                <Ionicons name="mic" size={50} color={isRecording ? "#EF3E3E" : "#2C3E50"} />
              </View>
            </Pressable>

            <Text style={styles.timeText}>
              {isPlayingModal ? `${formatTime(previewTime)} / ${formatTime(recordTime)}` : `${formatTime(recordTime)} / 00:30`}
            </Text>

            <View style={styles.btnRow}>
              <Pressable 
                style={[styles.actionBtn, (recordTime === 0 || isRecording) ? styles.btnDisabled : styles.btnPreview]}
                onPress={togglePreview}
                disabled={recordTime === 0 || isRecording}
              >
                <Text style={styles.actionBtnText}>{isPlayingModal ? t.stopPreview : t.preview}</Text>
              </Pressable>

              <Pressable 
                style={[styles.actionBtn, styles.btnSave, isUploading && { opacity: 0.7 }]}
                onPress={handleSaveRecord}
                disabled={isUploading || isRecording || recordTime === 0}
              >
                {isUploading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.actionBtnText}>{t.save}</Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  // 💡 修改了 Header，增加了 paddingBottom 讓綠色延伸
  header: { backgroundColor: '#90E389', paddingTop: 12, paddingBottom: 16, elevation: 2, minHeight: 56 },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backBtnText: { fontSize: 17, fontWeight: '700', color: '#111827' },
  
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 },
  taskCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFF', paddingVertical: 14, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', flexWrap: "wrap", gap: 12 },
  taskLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  imageBox: { width: 90, height: 90, backgroundColor: '#F0F0F0', borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden' },
  taskImage: { width: 100, height: 100 },
  taskInfo: { justifyContent: 'center', flex: 1, minWidth: 0 },
  taskTitle: { fontSize: 20, fontWeight: 'bold', color: '#000', marginBottom: 6, letterSpacing: 1 },
  
  statusArea: { justifyContent: 'center', minHeight: 28 },
  statusEmpty: { fontSize: 16, color: '#9CA3AF', fontWeight: '600', letterSpacing: 1 },
  playBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  playIcon: { marginRight: 8 },
  waveContainer: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 16 },
  waveBar: { width: 3, backgroundColor: '#000', borderRadius: 2 },
  
  taskRight: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 0 },
  iconBtn: { padding: 10 },
  
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', zIndex: 50 },
  modalContent: { backgroundColor: '#E2E5EA', borderRadius: 32, padding: 24, alignItems: 'center', elevation: 10, paddingTop: 56 },
  closeBtn: { position: 'absolute', top: 16, right: 20, padding: 8 },
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: '#374151', marginBottom: 8, marginTop: 0, letterSpacing: 1, textAlign: "center", width: "100%", paddingHorizontal: 0 },
  modalSubtitle: { fontSize: 14, color: '#6B7280', fontWeight: '600', marginBottom: 24, textAlign: "center" },
  
  micWrap: { width: 120, height: 120, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  micPulse: { position: 'absolute', width: '100%', height: '100%', backgroundColor: '#EF3E3E', borderRadius: 60, opacity: 0.3 },
  micInner: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center' },
  
  timeText: { fontSize: 26, fontWeight: '600', letterSpacing: 2, marginBottom: 32, color: '#000' },
  
  btnRow: { flexDirection: 'row', width: '100%', gap: 16 },
  actionBtn: { flex: 1, paddingVertical: 14, borderRadius: 16, alignItems: 'center', paddingHorizontal: 8 },
  btnPreview: { backgroundColor: '#85C6F9' },
  btnSave: { backgroundColor: '#4651DB' },
  btnDisabled: { backgroundColor: '#D1D5DB' },
  actionBtnText: { color: '#FFF', fontSize: 20, fontWeight: 'bold', width: "100%", textAlign: "center" },
});
