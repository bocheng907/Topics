import { auth, db } from "@/firebase/firebaseConfig";
import { useAuditAccess } from "@/src/auth/useAuditAccess";
import { Stack, router } from "expo-router";
import { collection, getDocsFromServer, limit, orderBy, query, startAfter,
  type DocumentData, type QueryDocumentSnapshot } from "firebase/firestore";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Entry = { id: string; data: DocumentData };
const labels: Record<string, string> = {
  login: "登入回報", logout_requested: "登出請求",
  prescription_create: "新增藥單", prescription_update: "修改藥單", prescription_delete: "刪除藥單",
  prescription_item_create: "新增藥品", prescription_item_update: "修改藥品", prescription_item_delete: "刪除藥品",
  members_create: "建立照護成員", members_update: "變更照護成員", members_delete: "移除照護成員",
  threshold_create: "新增健康閾值", threshold_update: "修改健康閾值", threshold_delete: "刪除健康閾值",
};
function time(value: unknown) {
  const date = (value as { toDate?: () => Date })?.toDate?.();
  return date && Number.isFinite(date.getTime()) ? date.toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false }) : "未提供";
}

export default function AuditLogs() {
  const access = useAuditAccess();
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<Entry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [more, setMore] = useState(false);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const cursor = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const generation = useRef(0);
  const loading = useRef(false);

  const load = useCallback(async (reset: boolean) => {
    if (!access.allowed || loading.current) return;
    loading.current = true; setBusy(true); setError("");
    const current = generation.current;
    try {
      const base = [orderBy("createdAt", "desc"), limit(50)];
      const snap = await getDocsFromServer(query(collection(db, "audit_logs"),
        ...base, ...(!reset && cursor.current ? [startAfter(cursor.current)] : [])));
      if (current !== generation.current || auth.currentUser?.uid !== access.uid) return;
      const next = snap.docs.map(doc => ({ id: doc.id, data: doc.data() }));
      setRows(old => reset ? next : [...new Map([...old, ...next].map(row => [row.id, row])).values()]);
      cursor.current = snap.docs.at(-1) ?? null;
      setMore(snap.size === 50);
    } catch (e) {
      if (current !== generation.current) return;
      const denied = (e as { code?: string }).code === "permission-denied";
      if (denied) { setRows([]); setMore(false); cursor.current = null; }
      setError(denied ? "沒有查閱權限，請重新確認管理員身分。" : "暫時無法取得紀錄，請檢查網路後重試。");
    } finally {
      if (current === generation.current) { loading.current = false; setBusy(false); }
    }
  }, [access.allowed, access.uid]);

  useEffect(() => {
    generation.current++; loading.current = false; cursor.current = null;
    setRows([]); setMore(false); setError(""); setBusy(false); setExpanded(null);
    if (access.ready && access.allowed) void load(true);
    const activeGeneration = generation;
    return () => { activeGeneration.current++; };
  }, [access.ready, access.allowed, access.uid, load]);

  const needle = search.trim().toLowerCase();
  const visible = rows.filter(({ data }) => [labels[data.operation], data.operation,
    data.actorId, data.patientId, data.resourcePath].some(value => String(value ?? "").toLowerCase().includes(needle)));
  return <View style={[styles.page, { paddingTop: insets.top + 12, paddingBottom: insets.bottom }]}>
    <Stack.Screen options={{ headerShown: false }} />
    <View style={styles.header}>
      <Pressable accessibilityRole="button" onPress={() => router.canGoBack() ? router.back() : router.replace("/")} style={styles.button}><Text style={styles.link}>返回</Text></Pressable>
      <Text style={styles.title}>操作紀錄</Text>
      <Text style={styles.badge}>管理員</Text>
    </View>
    {!access.ready ? <ActivityIndicator accessibilityLabel="確認權限中" /> : !access.allowed ?
      <View style={styles.notice}><Text style={styles.heading}>僅限授權管理員查閱</Text><Text style={styles.muted}>此頁面包含系統操作紀錄。若剛取得授權，請更新權限後再試。</Text>
        <Pressable accessibilityRole="button" style={styles.button} onPress={() => void access.refresh()}><Text style={styles.link}>更新權限</Text></Pressable></View> : <>
      <View style={styles.toolbar}><Text style={styles.muted}>最新紀錄優先 · 台灣時間 · 每次載入 50 筆</Text>
        <TextInput accessibilityLabel="搜尋已載入的操作紀錄" placeholder="搜尋已載入紀錄：操作、身分或資源" value={search} onChangeText={setSearch} style={styles.search} />
        <View style={styles.row}><Text style={styles.muted}>已載入 {rows.length} 筆 · 顯示 {visible.length} 筆</Text>
          <Pressable accessibilityRole="button" disabled={busy} style={styles.button} onPress={() => void load(true)}><Text style={styles.link}>重新整理</Text></Pressable></View>
        {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      </View>
      <FlatList data={visible} keyExtractor={item => item.id} contentContainerStyle={styles.list}
        ListEmptyComponent={!busy ? <Text style={styles.muted}>{error ? "請重試載入。" : rows.length ? "已載入的紀錄中沒有符合項目。" : "目前尚無操作紀錄。"}</Text> : null}
        renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityState={{ expanded: expanded === item.id }} onPress={() => setExpanded(expanded === item.id ? null : item.id)} style={styles.card}>
          <Text style={styles.heading}>{labels[item.data.operation] ?? item.data.operation ?? "未知操作"}</Text>
          <Text style={styles.muted}>{time(item.data.occurredAt ?? item.data.createdAt)}</Text>
          <Text selectable style={styles.body}>操作者：{item.data.actorId ?? "來源未提供身分"}</Text>
          <Text style={styles.source}>{item.data.source === "authenticated_client_signal" ? "App 回報事件" : "後端資料變更事件"}</Text>
          {expanded === item.id && <View style={styles.detail}>
            <Text selectable style={styles.body}>資源：{item.data.resourcePath ?? "登入工作階段"}</Text>
            <Text selectable style={styles.body}>照護對象 ID：{item.data.patientId ?? "未提供"}</Text>
            <Text style={styles.body}>身分類型：{item.data.actorType ?? "未知"}</Text>
            <Text style={styles.body}>變更欄位：{Array.isArray(item.data.changedFields) ? item.data.changedFields.join("、") || "無" : "不適用"}{item.data.fieldsTruncated ? "（僅顯示前 100 欄）" : ""}</Text>
            <Text style={styles.muted}>記錄時間：{time(item.data.createdAt)}</Text>
            <Text selectable style={styles.muted}>紀錄 ID：{item.id}</Text>
            {item.data.source === "authenticated_client_signal" && <Text style={styles.muted}>此為 App 回報；登出請求不代表已完成登出。</Text>}
          </View>}
        </Pressable>}
        ListFooterComponent={<View style={styles.footer}>{busy ? <ActivityIndicator accessibilityLabel="載入紀錄中" /> : more ? <Pressable accessibilityRole="button" style={styles.button} onPress={() => void load(false)}><Text style={styles.link}>載入更多</Text></Pressable> : rows.length > 0 ? <Text style={styles.muted}>已載入全部可查閱紀錄</Text> : null}</View>} />
    </>}
  </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F4F7FA" }, header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, gap: 12, paddingBottom: 12 },
  title: { flex: 1, fontSize: 24, fontWeight: "800", color: "#173447" }, badge: { color: "#37677B", fontSize: 13 },
  toolbar: { paddingHorizontal: 20, gap: 8 }, search: { backgroundColor: "white", borderColor: "#CBD5DF", borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 16 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }, list: { padding: 20, gap: 12 },
  card: { padding: 18, borderRadius: 16, backgroundColor: "white", borderWidth: 1, borderColor: "#DFE7EC", gap: 8 }, heading: { fontSize: 18, fontWeight: "700", color: "#173447" },
  body: { fontSize: 14, color: "#2D4858", lineHeight: 22 }, muted: { fontSize: 13, color: "#526776", lineHeight: 21 }, source: { fontSize: 12, color: "#27677C" },
  detail: { borderTopWidth: 1, borderTopColor: "#E5ECF0", paddingTop: 12, gap: 8 }, button: { minHeight: 44, padding: 10, justifyContent: "center" }, link: { color: "#12617D", fontSize: 16, fontWeight: "700" },
  notice: { padding: 24, gap: 16 }, error: { color: "#A22C33", lineHeight: 22 }, footer: { padding: 20, alignItems: "center" },
});
