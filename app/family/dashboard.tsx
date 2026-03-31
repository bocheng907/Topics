// app/family/dashboard.tsx
import { db } from "@/firebase/firebaseConfig";
import { useActiveCareTarget } from "@/src/care-target/useActiveCareTarget";
import { router } from 'expo-router';
import { collection, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type VitalStatus = 'normal' | 'abnormal' | 'outdated' | 'nodata';

export default function FamilyDashboardScreen() {
  const { ready, activePatientId } = useActiveCareTarget();

  // 預設為 'history' (歷史趨勢)
  const [activeTab, setActiveTab] = useState<'history' | 'today'>('history'); 

  // -- 歷史趨勢頁面狀態 --
  const [chartDataType, setChartDataType] = useState('體溫');
  const [chartTimeRange, setChartTimeRange] = useState('1周');

  const dataTypes = ['體溫', '心跳', '血壓', '血糖'];
  const timeRanges = ['1周', '2周', '1個月', '全部'];

  // -- 本日紀錄狀態 (從 Firebase 抓取) --
  const [vitals, setVitals] = useState<any>({
    temp: null,
    hr: null,
    bp: null,
    sugarFasting: null, // 空腹
    sugarAfter: null,   // 飯後
    hasAnyData: false
  });

  // ==========================================
  // 邏輯：監聽健康紀錄，抓出最新數值
  // ==========================================
  useEffect(() => {
    if (!ready || !activePatientId) return;

    const q = query(
      collection(db, "health_records"),
      where("patientId", "==", activePatientId),
      orderBy("createdAt", "desc"),
      limit(20) // 多抓幾筆，確保能找到最新資料
    );

    const unsub = onSnapshot(q, (snap) => {
      let temp, hr, bp, sugarFasting, sugarAfter;
      let hasAnyData = false;
      let hasFoundLatestSugar = false; // 💡 新增：用來追蹤是否已經找到「最新一筆」血糖

      snap.docs.forEach(doc => {
        const d = doc.data();
        const ts = d.createdAt?.toMillis ? d.createdAt.toMillis() : Date.now();
        hasAnyData = true;

        if (!temp && d.temperature) temp = { val: d.temperature, ts };
        if (!hr && d.heartRate) hr = { val: d.heartRate, ts };
        if (!bp && d.bloodPressureSys && d.bloodPressureDia) bp = { sys: d.bloodPressureSys, dia: d.bloodPressureDia, ts };
        
        // 💡 血糖邏輯修改：只抓「絕對最新」的一筆，抓到就鎖定！
        if (!hasFoundLatestSugar && d.bloodSugar) {
          hasFoundLatestSugar = true; // 標記：已經找到最新的一筆了，後面更舊的血糖都不看了
          
          // 判斷這最新的一筆是空腹還是飯後，放入對應的變數中
          if (d.bloodSugarType === '空腹' || d.bloodSugarType === '飯前') {
            sugarFasting = { val: d.bloodSugar, ts };
          } else if (d.bloodSugarType === '飯後' || d.bloodSugarType === '餐後') {
            sugarAfter = { val: d.bloodSugar, ts };
          }
        }
      });

      setVitals({ temp, hr, bp, sugarFasting, sugarAfter, hasAnyData });
    });

    return unsub;
  }, [ready, activePatientId]);

  // ==========================================
  // UI 輔助函式：判斷醫學數值正常與否 & 時效
  // ==========================================
  const checkVitalStatus = (type: string, data: any, sugarData2?: any): VitalStatus => {
    if (!data && !sugarData2) return 'nodata';
    
    // 針對血糖雙欄位，找出最新的那筆時間來判斷是否過期
    let latestTs = data?.ts || 0;
    if (sugarData2?.ts && sugarData2.ts > latestTs) latestTs = sugarData2.ts;

    const isOutdated = (Date.now() - latestTs) > 24 * 60 * 60 * 1000;
    if (isOutdated && latestTs !== 0) return 'outdated';

    if (type === 'temp' && data) {
      if (data.val < 36.0 || data.val > 37.5) return 'abnormal';
    } else if (type === 'hr' && data) {
      if (data.val < 60 || data.val > 100) return 'abnormal';
    } else if (type === 'bp' && data) {
      if (data.sys < 90 || data.sys > 140 || data.dia < 60 || data.dia > 90) return 'abnormal';
    } else if (type === 'sugar') {
      let isAbnormal = false;
      if (data && (data.val < 70 || data.val > 130)) isAbnormal = true; // 空腹標準
      if (sugarData2 && (sugarData2.val < 70 || sugarData2.val > 180)) isAbnormal = true; // 飯後標準
      if (isAbnormal) return 'abnormal';
    }
    return 'normal';
  };

  // 根據狀態取得大卡片對應色號 (依照你 Canvas 的設計)
  const getCardColors = (status: VitalStatus) => {
    if (status === 'normal') return { top: '#76C25F', bottom: '#98F698' }; // 綠色
    if (status === 'abnormal') return { top: '#EE6A6E', bottom: '#F9A4A6' }; // 紅色
    return { top: '#A8A3A3', bottom: '#E6E6E6' }; // 灰色
  };

  // 格式化時間
  const formatTime = (ts: number | undefined) => {
    if (!ts) return '';
    const d = new Date(ts);
    const time = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let label = `${d.getMonth() + 1}月${d.getDate()}日`;
    if (d.toDateString() === today.toDateString()) label = '今日';
    else if (d.toDateString() === yesterday.toDateString()) label = '昨天';

    return `${label} ${time}`;
  };

  if (!ready) return <ActivityIndicator style={{ flex: 1, justifyContent: "center" }} />;

  return (
    <View style={styles.container}>
      {/* 頂部狀態列 & 標籤頁區域 */}
      <View style={styles.topContainer}>
        <View style={styles.headerRow}>
          {/* 加入返回鍵 */}
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← 返回主頁</Text>
          </Pressable>
        </View>

        {/* 雙分頁標籤 */}
        <View style={styles.tabRow}>
          <Pressable 
            style={[styles.tabButton, activeTab === 'history' && styles.tabButtonActive]}
            onPress={() => setActiveTab('history')}
          >
            <Text style={[styles.tabText, activeTab === 'history' ? styles.tabTextActive : styles.tabTextInactive]}>
              歷史趨勢
            </Text>
          </Pressable>
          <Pressable 
            style={[styles.tabButton, activeTab === 'today' && styles.tabButtonActive]}
            onPress={() => setActiveTab('today')}
          >
            <Text style={[styles.tabText, activeTab === 'today' ? styles.tabTextActive : styles.tabTextInactive]}>
              本日紀錄
            </Text>
          </Pressable>
        </View>
      </View>

      {/* 可滾動內容區域 */}
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {activeTab === 'history' ? (
          /* =================== 歷史趨勢頁面內容 =================== */
          <View style={styles.tabContent}>
            {/* 資料類型切換 */}
            <View style={styles.filterRow}>
              {dataTypes.map((type) => (
                <Pressable
                  key={type}
                  onPress={() => setChartDataType(type)}
                  style={[styles.filterBtn, chartDataType === type ? styles.filterBtnActive : styles.filterBtnInactive]}
                >
                  <Text style={[styles.filterBtnText, chartDataType === type ? styles.filterTextActive : styles.filterTextInactive]}>
                    {type}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* 時間範圍切換 */}
            <View style={styles.filterRow}>
              {timeRanges.map((range) => (
                <Pressable
                  key={range}
                  onPress={() => setChartTimeRange(range)}
                  style={[styles.filterBtn, chartTimeRange === range ? styles.filterBtnActive : styles.filterBtnInactive]}
                >
                  <Text style={[styles.filterBtnText, chartTimeRange === range ? styles.filterTextActive : styles.filterTextInactive]}>
                    {range}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* 圖表佔位呈現區 */}
            <View style={styles.chartPlaceholder}>
              <Text style={styles.chartPlaceholderText}>未來圖表呈現區</Text>
            </View>
          </View>
        ) : (
          /* =================== 本日紀錄資料卡片頁面 =================== */
          <View style={styles.tabContent}>
            
            {/* 體溫 & 心跳 (Grid 雙欄) */}
            <View style={styles.gridRow}>
              
              {/* 體溫卡片 */}
              <View style={styles.gridCard}>
                {(() => {
                  const status = checkVitalStatus('temp', vitals.temp);
                  const colors = getCardColors(status);
                  return (
                    <>
                      <View style={[styles.cardHeader, { backgroundColor: colors.top }]}>
                        <Text style={styles.cardTitle}>體溫</Text>
                      </View>
                      <View style={[styles.cardBody, { backgroundColor: colors.bottom }]}>
                        <View style={styles.valueRow}>
                          <Text style={styles.valueMain}>{vitals.temp?.val ?? '-'}</Text>
                          <Text style={styles.valueUnit}>°C</Text>
                        </View>
                        <View style={styles.timeBadge}>
                          <Text style={styles.timeBadgeText}>{vitals.temp ? formatTime(vitals.temp.ts) : '無紀錄'}</Text>
                        </View>
                      </View>
                    </>
                  );
                })()}
              </View>

              {/* 心跳卡片 */}
              <View style={styles.gridCard}>
                {(() => {
                  const status = checkVitalStatus('hr', vitals.hr);
                  const colors = getCardColors(status);
                  return (
                    <>
                      <View style={[styles.cardHeader, { backgroundColor: colors.top }]}>
                        <Text style={styles.cardTitle}>心跳</Text>
                      </View>
                      <View style={[styles.cardBody, { backgroundColor: colors.bottom }]}>
                        <View style={styles.valueRow}>
                          <Text style={styles.valueMain}>{vitals.hr?.val ?? '-'}</Text>
                          <Text style={styles.valueUnit}>bpm</Text>
                        </View>
                        <View style={styles.timeBadge}>
                          <Text style={styles.timeBadgeText}>{vitals.hr ? formatTime(vitals.hr.ts) : '無紀錄'}</Text>
                        </View>
                      </View>
                    </>
                  );
                })()}
              </View>
            </View>

            {/* 血壓卡片 (滿寬) */}
            <View style={styles.fullCard}>
              {(() => {
                const status = checkVitalStatus('bp', vitals.bp);
                const colors = getCardColors(status);
                return (
                  <>
                    <View style={[styles.fullCardHeader, { backgroundColor: colors.top }]}>
                      <Text style={styles.cardTitle}>血壓</Text>
                      <View style={styles.headerSubRow}>
                        <Text style={styles.headerSubText}>收縮壓</Text>
                        <Text style={styles.headerSubText}>舒張壓</Text>
                      </View>
                    </View>
                    <View style={[styles.fullCardBody, { backgroundColor: colors.bottom }]}>
                      <View style={styles.fullCardValueRow}>
                        <View style={styles.valueCol}>
                          <Text style={styles.valueMain}>{vitals.bp?.sys ?? '-'}</Text>
                          <Text style={styles.valueUnitLarge}>mmhg</Text>
                        </View>
                        <View style={styles.valueCol}>
                          <Text style={styles.valueMain}>{vitals.bp?.dia ?? '-'}</Text>
                          <Text style={styles.valueUnitLarge}>mmhg</Text>
                        </View>
                      </View>
                      <View style={[styles.timeBadge, { paddingHorizontal: 32 }]}>
                        <Text style={styles.timeBadgeText}>{vitals.bp ? formatTime(vitals.bp.ts) : '無紀錄'}</Text>
                      </View>
                    </View>
                  </>
                );
              })()}
            </View>

            {/* 血糖卡片 (滿寬) */}
            <View style={styles.fullCard}>
              {(() => {
                const status = checkVitalStatus('sugar', vitals.sugarFasting, vitals.sugarAfter);
                const colors = getCardColors(status);
                // 找出最新的時間顯示
                let latestTs = vitals.sugarFasting?.ts || 0;
                if (vitals.sugarAfter?.ts && vitals.sugarAfter.ts > latestTs) latestTs = vitals.sugarAfter.ts;

                return (
                  <>
                    <View style={[styles.fullCardHeader, { backgroundColor: colors.top }]}>
                      <Text style={styles.cardTitle}>血糖</Text>
                      <View style={styles.headerSubRow}>
                        {/* 💡 照要求替換為 空腹 */}
                        <Text style={styles.headerSubText}>空腹</Text>
                        <Text style={styles.headerSubText}>飯後</Text>
                      </View>
                    </View>
                    <View style={[styles.fullCardBody, { backgroundColor: colors.bottom }]}>
                      <View style={styles.fullCardValueRow}>
                        <View style={styles.valueCol}>
                          <Text style={styles.valueMain}>{vitals.sugarFasting?.val ?? '-'}</Text>
                          <Text style={styles.valueUnitLarge}>mg/dl</Text>
                        </View>
                        <View style={styles.valueCol}>
                          <Text style={styles.valueMain}>{vitals.sugarAfter?.val ?? '-'}</Text>
                          <Text style={styles.valueUnitLarge}>mg/dl</Text>
                        </View>
                      </View>
                      <View style={[styles.timeBadge, { paddingHorizontal: 32 }]}>
                        <Text style={styles.timeBadgeText}>{latestTs > 0 ? formatTime(latestTs) : '無紀錄'}</Text>
                      </View>
                    </View>
                  </>
                );
              })()}
            </View>

          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  topContainer: { backgroundColor: '#F3CDAD', paddingTop: 50, zIndex: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 10 },
  backButton: { paddingVertical: 8 },
  backButtonText: { fontSize: 18, fontWeight: '800', color: '#000' },
  tabRow: { flexDirection: 'row', width: '100%' },
  tabButton: { flex: 1, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  tabButtonActive: { backgroundColor: '#E69A57' },
  tabText: { fontSize: 24, fontWeight: 'bold', letterSpacing: 2 },
  tabTextActive: { color: '#000' },
  tabTextInactive: { color: 'rgba(0,0,0,0.6)' },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 140 }, // 避開導覽列
  tabContent: { flex: 1 },
  
  // 歷史趨勢
  filterRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, gap: 8 },
  filterBtn: { flex: 1, paddingVertical: 8, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  filterBtnActive: { backgroundColor: '#EAA161', borderColor: 'transparent' },
  filterBtnInactive: { backgroundColor: '#FFF', borderColor: '#000' },
  filterBtnText: { fontSize: 18, fontWeight: 'bold' },
  filterTextActive: { color: '#000' },
  filterTextInactive: { color: '#000' },
  chartPlaceholder: { height: 350, borderWidth: 2, borderStyle: 'dashed', borderColor: '#B5B5B5', borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  chartPlaceholderText: { fontSize: 22, fontWeight: '600', color: '#999', letterSpacing: 2 },

  // 本日紀錄大卡片
  gridRow: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  gridCard: { flex: 1, borderRadius: 16, overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8 },
  cardHeader: { paddingVertical: 8, alignItems: 'center' },
  cardTitle: { fontSize: 22, fontWeight: 'bold', letterSpacing: 2, color: '#000' },
  cardBody: { flex: 1, paddingVertical: 16, alignItems: 'center', justifyContent: 'space-between' },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginBottom: 12 },
  valueMain: { fontSize: 36, fontWeight: '500', color: '#000' },
  valueUnit: { fontSize: 24, fontWeight: '500', color: '#000' },
  timeBadge: { backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 4 },
  timeBadgeText: { color: '#FFF', fontSize: 14, fontWeight: 'bold', letterSpacing: 1 },

  // 滿寬卡片 (血壓、血糖)
  fullCard: { borderRadius: 16, overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, marginBottom: 16 },
  fullCardHeader: { paddingTop: 8, paddingBottom: 4, alignItems: 'center' },
  headerSubRow: { flexDirection: 'row', widdth: '100%', marginTop: 4, width: '100%' },
  headerSubText: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: 'bold', color: 'rgba(0,0,0,0.7)' },
  fullCardBody: { paddingVertical: 16, alignItems: 'center' },
  fullCardValueRow: { flexDirection: 'row', width: '100%', marginBottom: 12 },
  valueCol: { flex: 1, alignItems: 'center' },
  valueUnitLarge: { fontSize: 22, fontWeight: '500', color: '#000' }
});