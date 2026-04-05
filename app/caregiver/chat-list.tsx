// app/caregiver/chat-list.tsx
import React, { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, Platform } from "react-native";
import { router } from "expo-router";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "@/firebase/firebaseConfig";
import { useActiveCareTarget } from "@/src/care-target/useActiveCareTarget";
import { useAuth } from "@/src/auth/useAuth";

export default function CaregiverChatListScreen() {
  const { activePatientId, activePatient } = useActiveCareTarget();
  const { user } = useAuth();
  const [lastMessage, setLastMessage] = useState<any>(null);

  useEffect(() => {
    if (!activePatientId) return;
    const q = query(collection(db, "chats", activePatientId, "messages"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) setLastMessage(snap.docs[0].data());
    });
    return () => unsub();
  }, [activePatientId]);

  return (
    <View style={styles.container}>
      {/* 💡 統一標頭：加大紫色區塊，不放文字 */}
      <View style={styles.headerSpacer} />
      
      <ScrollView>
        <Pressable 
          onPress={() => router.push({
            pathname: "/caregiver/chat-room",
            params: { patientId: activePatientId } 
          })}
          style={({ pressed }) => [styles.chatItem, pressed && { backgroundColor: '#F5F5F5' }]}
        >
          {/* 💡 灰底黑字頭像 */}
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {activePatient?.name ? activePatient.name.substring(0, 1) : ""}
            </Text>
          </View>

          <View style={styles.chatInfo}>
            <View style={styles.chatHeader}>
              <Text style={styles.caregiverName}>
                {activePatient?.name ? `${activePatient.name} 的家屬` : "對話室"}
              </Text>
              <Text style={styles.timeText}>
                {lastMessage?.createdAt ? new Date(lastMessage.createdAt.toMillis()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "上午 8:00"}
              </Text>
            </View>
            <Text style={styles.lastMsgText} numberOfLines={1}>
              {lastMessage ? (
                  lastMessage.imageUrl ? "[照片]" : lastMessage.text
                ) : (
                  "尚未有對話紀錄"
                )}
            </Text>
          </View>
        </Pressable>
        <View style={styles.divider} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF" },
  headerSpacer: { 
    backgroundColor: "#9999E5", 
    paddingTop: Platform.OS === 'ios' ? 90 : 50, // 💡 修正：與 family 一致，避免被頂掉
    paddingBottom: 25, 
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)'
  },
  chatItem: { flexDirection: 'row', padding: 20, alignItems: 'center' },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#E0E0E0', marginRight: 15, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#000', fontSize: 24, fontWeight: 'bold' }, // 💡 黑字
  chatInfo: { flex: 1, gap: 5 },
  chatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  caregiverName: { fontSize: 20, fontWeight: '900', color: '#000' },
  timeText: { fontSize: 14, color: '#999' },
  lastMsgText: { fontSize: 16, color: '#666' },
  divider: { height: 1, backgroundColor: '#EEE', marginHorizontal: 20 },
  
  inputArea: { 
    flexDirection: 'row', 
    paddingHorizontal: 15, 
    paddingTop: 10,
    // 💡 關鍵修正：底部留白，防止被手機導覽條遮住
    paddingBottom: Platform.OS === 'ios' ? 30 : 20, 
    alignItems: 'center', 
    borderTopWidth: 1, 
    borderTopColor: '#EEE', 
    backgroundColor: '#FFF' 
  },

});