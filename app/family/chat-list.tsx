import React, { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, Platform } from "react-native";
import { router } from "expo-router";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "@/firebase/firebaseConfig";
import { useActiveCareTarget } from "@/src/care-target/useActiveCareTarget";

export default function FamilyChatListScreen() {
  const { activePatientId, activePatient } = useActiveCareTarget(); //
  const [lastMessage, setLastMessage] = useState<any>(null);

  // 監聽最後一則訊息 (用於預覽)
  useEffect(() => {
    if (!activePatientId) return;

    const q = query(
      collection(db, "chats", activePatientId, "messages"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        setLastMessage(snap.docs[0].data());
      }
    });
    return () => unsubscribe();
  }, [activePatientId]);

  return (
    <View style={styles.container}>
      {/* 💡 修正 1: 表頭維持紫色區塊，但不放任何文字 */}
      <View style={styles.headerSpacer} />
      
      <ScrollView>
        <Pressable 
          onPress={() => router.push({
            pathname: "/family/chat-room",
            params: { patientId: activePatientId } 
          })}
          style={({ pressed }) => [styles.chatItem, pressed && { backgroundColor: '#F5F5F5' }]}
        >
          {/* 💡 修正 2：灰色圓圈頭像，顯示文字 */}
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {activePatient?.name ? activePatient.name.substring(0, 1) : ""}
            </Text>
          </View>

          <View style={styles.chatInfo}>
            <View style={styles.chatHeader}>
              <Text style={styles.caregiverName}>
                {activePatient?.name ? `${activePatient.name} 的看護` : "對話室"}
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
  
  // 💡 修正：加大的標頭樣式，標題居中
  headerSpacer: { 
    backgroundColor: "#9999E5", 
    paddingTop: Platform.OS === 'ios' ? 90 : 50,
    paddingBottom: 25, 
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)'
  },
  
  // 💡 標頭文字改為一般字體 (移除 fontWeight)
  headerTitle: { 
    fontSize: 22, 
    color: '#000' 
  },

  chatItem: { flexDirection: 'row', padding: 20, alignItems: 'center' },
  
  avatar: { 
    width: 60, 
    height: 60, 
    borderRadius: 30, 
    backgroundColor: '#E0E0E0', // 💡 灰色背景
    marginRight: 15,
    justifyContent: 'center', // 水平置中文字
    alignItems: 'center'     // 垂直置中文字
  },
  avatarText: {
    color: '#666', 
    fontSize: 24,
    fontWeight: 'bold'
  },

  chatInfo: { flex: 1, gap: 5 },
  chatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  
  caregiverName: { 
    fontSize: 20, 
    fontWeight: '900',
    color: '#000' 
  },

  timeText: { fontSize: 14, color: '#999' },
  lastMsgText: { fontSize: 16, color: '#666' },
  divider: { height: 1, backgroundColor: '#EEE', marginHorizontal: 20 },
});