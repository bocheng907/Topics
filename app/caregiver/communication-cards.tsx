import { AppHeader } from "@/src/ui/components";
import { colors, layout, radii, spacing, typography } from "@/src/ui/theme";
import { caregiverCopy } from "@/src/i18n/copy/caregiverCopy";
import { ClientOnly } from "@/src/ui/ClientOnly";
// app/caregiver/communication-cards.tsx
import { Ionicons } from '@expo/vector-icons';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import type { Href } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppAlert as Alert } from '@/src/ui/AppAlert';

// Firebase 相關
import { db } from '@/firebase/firebaseConfig';
import { useActiveCareTarget } from '@/src/care-target/useActiveCareTarget';
import { translations } from '@/src/i18n/translations';
import { useLanguage } from '@/src/store/LanguageContext';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useScreenBottomInset } from "@/src/ui/BottomInsetContext";

const initialTasks = [
  { id: 1, title: '乖乖吃藥', image: require('@/assets/images/medication.png') },
  { id: 2, title: '吃飯時間', image: require('@/assets/images/eating.png') },
  { id: 3, title: '洗澡囉', image: require('@/assets/images/shower.png') },
  { id: 4, title: '上廁所', image: require('@/assets/images/toilet.png') },
  { id: 5, title: '動動身體', image: require('@/assets/images/exercise.png') },
  { id: 6, title: '多喝水喔', image: require('@/assets/images/drink_water.png') },
  { id: 7, title: '睡覺時間', image: require('@/assets/images/sleep.png') },
  { id: 8, title: '安撫情緒', image: require('@/assets/images/emotion.png') },
];

export default function CaregiverVoiceScreen() {
  return <ClientOnly><CaregiverVoiceContent /></ClientOnly>;
}

function CaregiverVoiceContent() {
  const bottomInset = useScreenBottomInset();
  const { activePatientId } = useActiveCareTarget();
  const { language } = useLanguage();
  const t = translations[language];
  const c = caregiverCopy[language];
  const taskTitles: Record<number, string> = {
    1: t.voiceTaskMedication,
    2: t.voiceTaskMeal,
    3: t.voiceTaskShower,
    4: t.voiceTaskToilet,
    5: t.voiceTaskExercise,
    6: t.voiceTaskDrinkWater,
    7: t.voiceTaskSleep,
    8: t.voiceTaskEmotion,
  };
  
  const [tasks, setTasks] = useState<any[]>(initialTasks.map(t => ({ ...t, hasRecording: false })));
  const [playingTaskId, setPlayingTaskId] = useState<number | null>(null);
  // expo-audio 的播放器由 hook 管理生命週期（元件卸載時自動釋放），
  // 不需要像舊版 expo-av 那樣自己 unloadAsync
  const player = useAudioPlayer();

  const [waveHeights, setWaveHeights] = useState([6, 6, 6, 6]);

  // 播放結束時清掉「播放中」狀態（取代舊版的 setOnPlaybackStatusUpdate）
  useEffect(() => {
    const subscription = player.addListener('playbackStatusUpdate', status => {
      if (status.didJustFinish) setPlayingTaskId(null);
    });
    return () => subscription.remove();
  }, [player]);

  // ==========================================
  // 1. 抓取 Firebase 語音紀錄
  // ==========================================
  useEffect(() => {
    if (!activePatientId) return;

    const q = query(
      collection(db, 'voice_records'),
      where('patientId', '==', activePatientId)
    );

    const unsub = onSnapshot(q, (snap) => {
      const recordsMap: Record<string, any> = {};
      
      snap.docs.forEach(doc => {
        const data = doc.data();
        if (!recordsMap[data.title] || data.createdAt > recordsMap[data.title].createdAt) {
          recordsMap[data.title] = { docId: doc.id, ...data };
        }
      });

      setTasks(initialTasks.map(task => {
        const record = recordsMap[task.title];
        if (record) {
          return { ...task, hasRecording: true, audioUrl: record.audioUrl };
        }
        return { ...task, hasRecording: false, audioUrl: null };
      }));
    });

    return unsub;
  }, [activePatientId]);

  // ==========================================
  // 2. 音波動畫控制
  // ==========================================
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (playingTaskId !== null) {
      interval = setInterval(() => {
        setWaveHeights([
          Math.random() * 10 + 4,
          Math.random() * 12 + 6,
          Math.random() * 10 + 4,
          Math.random() * 8 + 4,
        ]);
      }, 150);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [playingTaskId]);

  // ==========================================
  // 3. 播放邏輯
  // ==========================================
  const handleCardClick = async (task: any) => {
    if (!task.hasRecording || typeof task.audioUrl !== 'string' || !task.audioUrl.trim()) {
      Alert.alert(t.prompt, t.notRecorded);
      return;
    }

    // 點同一張卡片 → 停止播放
    if (playingTaskId === task.id) {
      player.pause();
      setPlayingTaskId(null);
      return;
    }

    setPlayingTaskId(task.id);
    try {
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
        shouldRouteThroughEarpiece: false,
      });

      // 換音源後從頭播放（replace 會自動停掉前一個音源）
      player.replace({ uri: task.audioUrl });
      player.play();
    } catch {
      Alert.alert(t.resultErrorTitle, t.playVoiceFailed);
      setPlayingTaskId(null);
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader title={t.communicationCards} fallbackHref={"/caregiver" as Href} />

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: spacing.xxl + bottomInset }]} showsVerticalScrollIndicator={false}>
        <View style={styles.hintRow}>
          <Ionicons name="volume-medium-outline" size={22} color={colors.textSecondary} />
          <Text style={styles.hintText}>{c.cardsHint}</Text>
        </View>

        <View style={styles.gridContainer}>
          {tasks.map((task) => {
            const isPlaying = playingTaskId === task.id;
            const title = taskTitles[task.id] ?? task.title;

            return (
              <Pressable
                key={task.id}
                onPress={() => handleCardClick(task)}
                accessibilityRole="button"
                accessibilityLabel={task.hasRecording ? title : `${title} (${t.notRecorded})`}
                accessibilityState={{ selected: isPlaying }}
                style={({ pressed }) => [
                  styles.card,
                  isPlaying && styles.cardPlaying,
                  pressed && !isPlaying && styles.cardPressed,
                ]}
              >
                <View style={[styles.imageBox, !task.hasRecording && styles.imageBoxDisabled]}>
                  <Image source={task.image} style={styles.taskImage} resizeMode="contain" />

                  {isPlaying && (
                    <View style={styles.playingOverlay}>
                      <Text style={styles.playingText}>{t.previewing}</Text>
                    </View>
                  )}

                  {task.hasRecording ? (
                    <View style={[styles.iconBadge, isPlaying ? styles.iconBadgePlaying : styles.iconBadgeIdle]}>
                      {isPlaying ? (
                        <View style={styles.waveContainer}>
                          <View style={[styles.waveBar, { height: waveHeights[0] }]} />
                          <View style={[styles.waveBar, { height: waveHeights[1] }]} />
                          <View style={[styles.waveBar, { height: waveHeights[2] }]} />
                          <View style={[styles.waveBar, { height: waveHeights[3] }]} />
                        </View>
                      ) : (
                        <Ionicons name="play" size={18} color={colors.primary} style={{ marginLeft: 2 }} />
                      )}
                    </View>
                  ) : null}
                </View>

                <View style={styles.titleContainer}>
                  <Text
                    style={[styles.cardTitle, isPlaying && styles.cardTitlePlaying]}
                    numberOfLines={2}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {title}
                  </Text>
                  {!task.hasRecording ? <Text style={styles.cardMeta}>{t.notRecorded}</Text> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },

  scrollContent: {
    paddingHorizontal: layout.screenPaddingX,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
  },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg, paddingHorizontal: spacing.xs },
  hintText: { ...typography.body, color: colors.textSecondary, flexShrink: 1 },

  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.md },

  card: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    alignItems: 'center',
  },
  cardPressed: { backgroundColor: colors.surfaceSunken },
  cardPlaying: { backgroundColor: colors.primarySoft, borderColor: colors.primary, borderWidth: 2, padding: spacing.md - 1 },

  imageBox: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: colors.surfaceSunken,
    borderRadius: radii.control,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  imageBoxDisabled: { opacity: 0.55 },
  taskImage: { width: '100%', height: '100%' },

  playingOverlay: { ...StyleSheet.absoluteFill, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center' },
  playingText: { ...typography.bodyStrong, color: colors.onPrimary, fontSize: 18 },

  iconBadge: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBadgeIdle: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primaryBorder },
  iconBadgePlaying: { backgroundColor: colors.primary },

  waveContainer: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 3, height: 16 },
  waveBar: { width: 3, backgroundColor: colors.onPrimary, borderRadius: 2 },

  titleContainer: { marginTop: spacing.md, marginBottom: spacing.xs, width: '100%', minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { ...typography.title, fontSize: 21, lineHeight: 26, width: '100%', textAlign: 'center' },
  cardTitlePlaying: { color: colors.primary },
  cardMeta: { ...typography.caption, textAlign: 'center', marginTop: 2 },
});
