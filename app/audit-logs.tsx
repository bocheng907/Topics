import { auth, db } from "@/firebase/firebaseConfig";
import { useAuditAccess } from "@/src/auth/useAuditAccess";
import { auditLogCopy } from "@/src/i18n/copy/accountCopy";
import { useLanguage } from "@/src/store/LanguageContext";
import { AppHeader, Button, Card, Divider, EmptyState, StatusBadge, TextField } from "@/src/ui/components";
import { colors, layout, radii, spacing, typography } from "@/src/ui/theme";
import { Ionicons } from "@expo/vector-icons";
import { Stack, type Href } from "expo-router";
import { collection, getDocsFromServer, limit, orderBy, query, startAfter,
  type DocumentData, type QueryDocumentSnapshot } from "firebase/firestore";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Entry = { id: string; data: DocumentData };
type LoadError = "" | "denied" | "network";

function time(value: unknown, fallback: string) {
  const date = (value as { toDate?: () => Date })?.toDate?.();
  return date && Number.isFinite(date.getTime()) ? date.toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false }) : fallback;
}

export default function AuditLogs() {
  const access = useAuditAccess();
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();
  const c = auditLogCopy[language];
  const labels = c.operations;
  const [rows, setRows] = useState<Entry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<LoadError>("");
  const [more, setMore] = useState(false);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const cursor = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const generation = useRef(0);
  const loading = useRef(false);

  const load = useCallback(async (reset: boolean) => {
    if (!access.allowed || loading.current) return;
    loading.current = true;
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
      // Store the error kind (not the text) so a language switch re-renders it without reloading.
      setError(denied ? "denied" : "network");
    } finally {
      if (current === generation.current) { loading.current = false; setBusy(false); }
    }
  }, [access.allowed, access.uid]);

  const accessScope = `${access.ready}:${access.allowed}:${access.uid}`;
  const [previousAccessScope, setPreviousAccessScope] = useState<string | null>(null);
  if (previousAccessScope !== accessScope) {
    setPreviousAccessScope(accessScope);
    setRows([]); setMore(false); setError("");
    setBusy(access.ready && access.allowed); setExpanded(null);
  }
  const requestLoad = (reset: boolean) => {
    if (!access.allowed || loading.current) return;
    setBusy(true); setError("");
    void load(reset);
  };
  useEffect(() => {
    generation.current++; loading.current = false; cursor.current = null;
    if (access.ready && access.allowed) void load(true);
    const activeGeneration = generation;
    return () => { activeGeneration.current++; };
  }, [access.ready, access.allowed, access.uid, load]);

  const needle = search.trim().toLowerCase();
  const visible = rows.filter(({ data }) => [labels[data.operation], data.operation,
    data.actorId, data.patientId, data.resourcePath].some(value => String(value ?? "").toLowerCase().includes(needle)));
  const errorText = error === "denied" ? c.errorDenied : error === "network" ? c.errorNetwork : "";

  const header = (
    <AppHeader
      title={c.title}
      left="back"
      fallbackHref={"/" as Href}
      right={<StatusBadge label={c.adminBadge} tone="neutral" icon="shield-checkmark-outline" style={styles.adminBadge} />}
    />
  );

  return <View style={styles.page}>
    <Stack.Screen options={{ headerShown: false }} />
    {header}
    {!access.ready ? (
      <ActivityIndicator style={styles.centerLoader} color={colors.primary} accessibilityLabel={c.checkingAccess} />
    ) : !access.allowed ? (
      <View style={styles.restricted}>
        <EmptyState
          icon="lock-closed-outline"
          title={c.restrictedTitle}
          body={c.restrictedBody}
          actionLabel={c.refreshAccess}
          onAction={() => void access.refresh()}
        />
      </View>
    ) : <>
      <View style={styles.toolbar}>
        <Text style={styles.hint}>{c.toolbarHint}</Text>
        <TextField
          accessibilityLabel={c.searchLabel}
          placeholder={c.searchPlaceholder}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <View style={styles.toolbarRow}>
          <Text style={styles.hint}>{c.loadedCount(rows.length, visible.length)}</Text>
          <Button label={c.refresh} icon="refresh" variant="ghost" disabled={busy} onPress={() => requestLoad(true)} />
        </View>
        {errorText ? (
          <View accessibilityRole="alert" style={styles.error}>
            <Ionicons name="alert-circle" size={20} color={colors.danger} />
            <Text style={styles.errorText}>{errorText}</Text>
          </View>
        ) : null}
      </View>
      <FlatList
        data={visible}
        keyExtractor={item => item.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={[styles.list, { paddingBottom: spacing.xl + insets.bottom }]}
        ListEmptyComponent={!busy ? (
          <EmptyState
            icon="document-text-outline"
            title={error ? c.emptyRetry : rows.length ? c.emptyNoMatch : c.emptyNone}
          />
        ) : undefined}
        renderItem={({ item }) => {
          const open = expanded === item.id;
          const fromClient = item.data.source === "authenticated_client_signal";
          return (
            <Card padding={0}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
                accessibilityHint={open ? c.hideDetails : c.showDetails}
                onPress={() => setExpanded(open ? null : item.id)}
                style={({ pressed }) => [styles.entry, pressed && styles.entryPressed]}
              >
                <View style={styles.entryTop}>
                  <Text style={styles.entryTitle}>{labels[item.data.operation] ?? item.data.operation ?? c.unknownOperation}</Text>
                  <Ionicons name={open ? "chevron-up" : "chevron-down"} size={20} color={colors.textMuted} />
                </View>
                <Text style={styles.hint}>{time(item.data.occurredAt ?? item.data.createdAt, c.notProvided)}</Text>
                <StatusBadge label={fromClient ? c.sourceClient : c.sourceBackend} tone="neutral"
                  icon={fromClient ? "phone-portrait-outline" : "server-outline"} />
              </Pressable>
              {open ? (
                <>
                  <Divider />
                  <View style={styles.detail}>
                    <Detail label={c.actor} value={item.data.actorId ?? c.actorMissing} selectable />
                    <Detail label={c.resource} value={item.data.resourcePath ?? c.resourceSession} selectable />
                    <Detail label={c.patientId} value={item.data.patientId ?? c.notProvided} selectable />
                    <Detail label={c.actorType} value={item.data.actorType ?? c.unknown} />
                    <Detail
                      label={c.changedFields}
                      value={`${Array.isArray(item.data.changedFields) ? item.data.changedFields.join(c.fieldSeparator) || c.none : c.notApplicable}${item.data.fieldsTruncated ? c.truncated : ""}`}
                    />
                    <Detail label={c.recordedAt} value={time(item.data.createdAt, c.notProvided)} />
                    <Detail label={c.recordId} value={item.id} selectable />
                    {fromClient ? <Text style={styles.hint}>{c.clientNote}</Text> : null}
                  </View>
                </>
              ) : null}
            </Card>
          );
        }}
        ListFooterComponent={<View style={styles.footer}>
          {busy ? <ActivityIndicator color={colors.primary} accessibilityLabel={c.loadingRecords} />
            : more ? <Button label={c.loadMore} variant="secondary" onPress={() => requestLoad(false)} />
            : rows.length > 0 ? <Text style={styles.hint}>{c.allLoaded}</Text> : null}
        </View>}
      />
    </>}
  </View>;
}

function Detail({ label, value, selectable }: { label: string; value: string; selectable?: boolean }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text selectable={selectable} style={styles.body}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.canvas },
  centerLoader: { flex: 1 },
  adminBadge: { alignSelf: "center", marginRight: spacing.sm },
  restricted: { flex: 1, justifyContent: "center", paddingHorizontal: layout.screenPaddingX },
  toolbar: {
    paddingHorizontal: layout.screenPaddingX,
    paddingTop: spacing.lg,
    gap: spacing.sm,
    width: "100%",
    maxWidth: layout.maxContentWidth,
    alignSelf: "center",
  },
  toolbarRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: spacing.sm },
  hint: { ...typography.bodySmall, color: colors.textMuted },
  error: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.control,
    backgroundColor: colors.dangerSoft,
  },
  errorText: { ...typography.body, color: colors.danger, flex: 1 },
  list: {
    paddingHorizontal: layout.screenPaddingX,
    paddingTop: spacing.sm,
    gap: spacing.md,
    width: "100%",
    maxWidth: layout.maxContentWidth,
    alignSelf: "center",
  },
  entry: { padding: spacing.lg, gap: spacing.xs },
  entryPressed: { backgroundColor: colors.surfaceSunken },
  entryTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.md },
  entryTitle: { ...typography.bodyStrong, flex: 1 },
  body: { ...typography.body },
  detail: { padding: spacing.lg, gap: spacing.md },
  detailRow: { gap: 2 },
  detailLabel: { ...typography.caption },
  footer: { padding: spacing.xl, alignItems: "center" },
});
