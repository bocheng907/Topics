// app/caregiver/health-report.tsx
import { db } from '@/firebase/firebaseConfig';
import { router } from 'expo-router';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Pressable, ScrollView,
    StyleSheet,
    Text, TextInput,
    View
} from 'react-native';

import { useAuth } from '@/src/auth/useAuth';
import { useActiveCareTarget } from '@/src/care-target/useActiveCareTarget';

export default function HealthReportScreen() {
  const { user } = useAuth();
  const { activePatientId } = useActiveCareTarget();

  // 標籤頁切換狀態 ('today' | 'history') - 預設本日紀錄
  const [activeTab, setActiveTab] = useState<'today' | 'history'>('today'); 
  
  // -- 本日紀錄頁面狀態 --
  const [mealTime, setMealTime] = useState<'before' | 'after'>('before');
  const [formData, setFormData] = useState({
    temperature: '',
    heartRate: '',
    systolic: '',
    diastolic: '',
    bloodSugar: ''
  });
  const [isSaving, setIsSaving] = useState(false);

  // -- 歷史趨勢頁面狀態 --
  const [chartDataType, setChartDataType] = useState('體溫');
  const [chartTimeRange, setChartTimeRange] = useState('1周');
  
  const dataTypes = ['體溫', '心跳', '血壓', '血糖'];
  const timeRanges = ['1周', '2周', '1個月', '全部'];

  // 處理輸入變更
  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // ==========================================
  // 核心邏輯：寫入 Firebase 資料庫
  // ==========================================
  const handleSave = async () => {
    if (!user || !activePatientId) {
      Alert.alert('錯誤', '無法取得目前照顧的長輩資料，請重新選擇。');
      return;
    }

    // 檢查是否完全沒填
    const hasData = Object.values(formData).some(val => val.trim() !== '');
    if (!hasData) {
      Alert.alert('提示', '請至少輸入一項生理數據後再儲存！');
      return;
    }

    setIsSaving(true);

    try {
      // 1. 產生自訂 Document ID: YYYYMMDD_HHmmss_rec_[末4碼]
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const hh = String(now.getHours()).padStart(2, '0');
      const min = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');
      
      const timeString = `${yyyy}-${mm}-${dd}_${hh}-${min}-${ss}`;
      const shortId = activePatientId.slice(-4); // 取長輩ID最後4碼防撞
      const customDocId = `${timeString}_rec_${shortId}`;

      // 2. 組裝要存入的資料 (有填寫的才轉成數字存入)
      const payload: any = {
        patientId: activePatientId,
        caregiverId: user.uid,
        createdAt: serverTimestamp(),
      };

      if (formData.temperature) payload.temperature = Number(formData.temperature);
      if (formData.heartRate) payload.heartRate = Number(formData.heartRate);
      if (formData.systolic) payload.bloodPressureSys = Number(formData.systolic);
      if (formData.diastolic) payload.bloodPressureDia = Number(formData.diastolic);
      if (formData.bloodSugar) {
        payload.bloodSugar = Number(formData.bloodSugar);
        payload.bloodSugarType = mealTime === 'before' ? '空腹' : '餐後';
      }

      // 3. 呼叫 setDoc 寫入 health_records 集合
      const docRef = doc(db, 'health_records', customDocId);
      await setDoc(docRef, payload);

      // 4. 成功後的處理
      Alert.alert('儲存成功', '健康紀錄已順利上傳！');
      
      // 清空表單
      setFormData({
        temperature: '',
        heartRate: '',
        systolic: '',
        diastolic: '',
        bloodSugar: ''
      });
      // 幫使用者自動切換到歷史趨勢頁面，讓他們看成果 (也可選不切換)
      setActiveTab('history'); 

    } catch (error) {
      console.log('Save health record error:', error);
      Alert.alert('儲存失敗', '請檢查網路連線後再試一次。');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* ==========================================
          頂部狀態列 & 標籤頁區域
          ========================================== */}
      <View style={styles.topContainer}>
        {/* 返回按鈕列 */}
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← 返回</Text>
          </Pressable>
        </View>

        {/* 雙分頁標籤 (Tabs) */}
        <View style={styles.tabRow}>
          <Pressable 
            style={[styles.tabButton, activeTab === 'today' && styles.tabButtonActive]}
            onPress={() => setActiveTab('today')}
          >
            <Text style={[styles.tabText, activeTab === 'today' ? styles.tabTextActive : styles.tabTextInactive]}>
              本日紀錄
            </Text>
          </Pressable>
          <Pressable 
            style={[styles.tabButton, activeTab === 'history' && styles.tabButtonActive]}
            onPress={() => setActiveTab('history')}
          >
            <Text style={[styles.tabText, activeTab === 'history' ? styles.tabTextActive : styles.tabTextInactive]}>
              歷史趨勢
            </Text>
          </Pressable>
        </View>
      </View>

      {/* ==========================================
          可滾動內容區域
          ========================================== */}
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'today' ? (
          /* =================== 本日紀錄頁面內容 =================== */
          <View style={styles.formContainer}>
            
            {/* 體溫 */}
            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>體溫:</Text>
              <TextInput 
                style={styles.inputField}
                keyboardType="numeric"
                value={formData.temperature}
                onChangeText={(val) => handleInputChange('temperature', val)}
                placeholder="36.5"
                placeholderTextColor="#CCC"
              />
              <Text style={styles.unitText}>°C</Text>
            </View>

            {/* 心跳 */}
            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>心跳:</Text>
              <TextInput 
                style={styles.inputField}
                keyboardType="numeric"
                value={formData.heartRate}
                onChangeText={(val) => handleInputChange('heartRate', val)}
                placeholder="80"
                placeholderTextColor="#CCC"
              />
              <Text style={styles.unitText}>bpm</Text>
            </View>

            {/* 血壓 (兩欄) */}
            <View style={styles.inputRowMulti}>
              <Text style={[styles.inputLabel, { marginTop: 10 }]}>血壓:</Text>
              <View style={styles.multiInputCol}>
                <View style={styles.subInputRow}>
                  <TextInput 
                    style={[styles.inputField, { fontSize: 20 }]}
                    keyboardType="numeric"
                    placeholder="收縮壓"
                    placeholderTextColor="#999"
                    value={formData.systolic}
                    onChangeText={(val) => handleInputChange('systolic', val)}
                  />
                  <Text style={styles.unitText}>mmhg</Text>
                </View>
                <View style={styles.subInputRow}>
                  <TextInput 
                    style={[styles.inputField, { fontSize: 20 }]}
                    keyboardType="numeric"
                    placeholder="舒張壓"
                    placeholderTextColor="#999"
                    value={formData.diastolic}
                    onChangeText={(val) => handleInputChange('diastolic', val)}
                  />
                  <Text style={styles.unitText}>mmhg</Text>
                </View>
              </View>
            </View>

            {/* 血糖 */}
            <View style={styles.inputRowMulti}>
              <Text style={[styles.inputLabel, { marginTop: 10 }]}>血糖:</Text>
              <View style={styles.multiInputCol}>
                <View style={styles.mealTimeRow}>
                  <Pressable 
                    onPress={() => setMealTime('before')}
                    style={[styles.mealBtn, mealTime === 'before' ? styles.mealBtnActive : styles.mealBtnInactive]}
                  >
                    <Text style={[styles.mealBtnText, mealTime === 'before' ? styles.mealBtnTextActive : styles.mealBtnTextInactive]}>空腹</Text>
                  </Pressable>
                  <Pressable 
                    onPress={() => setMealTime('after')}
                    style={[styles.mealBtn, mealTime === 'after' ? styles.mealBtnActive : styles.mealBtnInactive]}
                  >
                    <Text style={[styles.mealBtnText, mealTime === 'after' ? styles.mealBtnTextActive : styles.mealBtnTextInactive]}>飯後</Text>
                  </Pressable>
                </View>

                <View style={styles.subInputRow}>
                  <TextInput 
                    style={styles.inputField}
                    keyboardType="numeric"
                    value={formData.bloodSugar}
                    onChangeText={(val) => handleInputChange('bloodSugar', val)}
                    placeholder="90"
                    placeholderTextColor="#CCC"
                  />
                  <Text style={styles.unitText}>mg/dL</Text>
                </View>
              </View>
            </View>

            {/* 儲存按鈕 */}
            <Pressable 
              onPress={handleSave} 
              disabled={isSaving}
              style={({ pressed }) => [
                styles.saveButton,
                pressed && { opacity: 0.8 },
                isSaving && { backgroundColor: '#A0A5E8' }
              ]}
            >
              {isSaving ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.saveButtonText}>儲存</Text>
              )}
            </Pressable>

          </View>

        ) : (

          /* =================== 歷史趨勢頁面內容 =================== */
          <View style={styles.historyContainer}>
            
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

            {/* 圖表佔位區 */}
            <View style={styles.chartPlaceholder}>
              <Text style={styles.chartPlaceholderText}>未來圖表呈現區</Text>
              <Text style={{ marginTop: 8, color: '#999' }}>顯示：{chartDataType} ({chartTimeRange})</Text>
            </View>

          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ==========================================
// 樣式表 (Tailwind to RN StyleSheet)
// ==========================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  // --- Top Bar & Tabs ---
  topContainer: {
    backgroundColor: '#F3CDAD',
    paddingTop: 50, // 避開狀態列
    zIndex: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  backButton: {
    paddingVertical: 8,
    paddingRight: 16,
  },
  backButtonText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#000',
  },
  tabRow: {
    flexDirection: 'row',
    width: '100%',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#E59752',
  },
  tabText: {
    fontSize: 22,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  tabTextActive: {
    color: '#000',
  },
  tabTextInactive: {
    color: 'rgba(0,0,0,0.6)',
  },
  // --- Scroll Area ---
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 140, // 💡 避開外部 _layout.tsx 的紅色電話與導覽列
  },
  // --- Form (Today) ---
  formContainer: {
    gap: 24,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  inputRowMulti: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  inputLabel: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    minWidth: 70,
    letterSpacing: 2,
  },
  inputField: {
    flex: 1,
    maxWidth: 140,
    height: 55,
    backgroundColor: '#EAEAEA',
    borderRadius: 16,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '600',
    color: '#000',
  },
  unitText: {
    fontSize: 22,
    fontWeight: '600',
    color: '#000',
  },
  multiInputCol: {
    flex: 1,
    gap: 16,
  },
  subInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mealTimeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  mealBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 2,
  },
  mealBtnActive: {
    backgroundColor: '#F2A25B',
    borderColor: '#F2A25B',
  },
  mealBtnInactive: {
    backgroundColor: 'transparent',
    borderColor: '#9CA3AF',
  },
  mealBtnText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  mealBtnTextActive: {
    color: '#000',
  },
  mealBtnTextInactive: {
    color: '#4B5563',
  },
  saveButton: {
    backgroundColor: '#4F59D5',
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#4F59D5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  saveButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
    letterSpacing: 8,
    marginLeft: 8, // 平衡 letterSpacing 造成的視覺偏移
  },
  // --- History Trends ---
  historyContainer: {
    flex: 1,
    gap: 20,
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  filterBtn: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  filterBtnActive: {
    backgroundColor: '#EAA161',
    borderColor: '#EAA161',
  },
  filterBtnInactive: {
    backgroundColor: '#FFF',
    borderColor: '#000',
  },
  filterBtnText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  filterTextActive: {
    color: '#000',
  },
  filterTextInactive: {
    color: '#000',
  },
  chartPlaceholder: {
    height: 300,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#CCC',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    marginTop: 10,
  },
  chartPlaceholderText: {
    fontSize: 22,
    fontWeight: '600',
    color: '#999',
    letterSpacing: 2,
  }
});