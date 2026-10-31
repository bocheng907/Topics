// app/dev/ui-kit.tsx
// Dev-only design-system preview. Not reachable in production builds (__DEV__ guard
// here + the dev exception in app/_layout.tsx only applies when __DEV__ is true).
import {
  AppHeader,
  BottomNav,
  Button,
  Card,
  Chip,
  Divider,
  EmptyState,
  FormSheet,
  IconButton,
  ListRow,
  SectionHeader,
  SideDrawer,
  StatusBadge,
  TextField,
  type SideDrawerSection,
} from "@/src/ui/components";
import { colors, eventColors, radii, spacing, typography, type ColorToken, type TypographyToken } from "@/src/ui/theme";
import { Redirect } from "expo-router";
import React, { useState } from "react";
import { ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function UiKitScreen() {
  if (!__DEV__) return <Redirect href="/" />;
  return <UiKit />;
}

const colorGroups: { title: string; note: string; tokens: ColorToken[] }[] = [
  { title: "主色", note: "低彩度藍；白字於主色上對比 ≥ 4.5:1", tokens: ["primary", "primaryPressed", "primarySoft", "primaryBorder", "onPrimary"] },
  { title: "中性色", note: "文字、底色與分隔線", tokens: ["text", "textSecondary", "textMuted", "textDisabled", "border", "divider", "canvas", "surface", "surfaceSunken"] },
  { title: "強調色", note: "只用於緊急／關鍵操作（例如緊急撥號）", tokens: ["accent", "accentPressed", "accentSoft"] },
  { title: "狀態色", note: "只用於表達狀態，不作裝飾", tokens: ["danger", "dangerSoft", "warning", "warningSoft", "success", "successSoft"] },
];

const typeSamples: { token: TypographyToken; zh: string; en: string }[] = [
  { token: "display", zh: "早安，王奶奶", en: "Good morning" },
  { token: "title", zh: "今日照護摘要", en: "Today's care summary" },
  { token: "header", zh: "用藥提醒", en: "Medication reminders" },
  { token: "bodyStrong", zh: "下午 2:00 血壓藥", en: "2:00 PM blood pressure pill" },
  { token: "body", zh: "請在飯後半小時服用，並記錄血壓數值。", en: "Take 30 minutes after meals and log the reading." },
  { token: "bodySmall", zh: "由看護 Linh 於 10:24 更新", en: "Updated by caregiver Linh at 10:24" },
  { token: "label", zh: "欄位標籤", en: "Field label" },
  { token: "caption", zh: "最後同步 3 分鐘前", en: "Last synced 3 min ago" },
  { token: "overline", zh: "分組標題", en: "SECTION LABEL" },
];

function UiKit() {
  const insets = useSafeAreaInsets();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("home");
  const [chips, setChips] = useState<string[]>(["morning"]);
  const [notify, setNotify] = useState(true);
  const [title, setTitle] = useState("");
  const [loadingDemo, setLoadingDemo] = useState(false);

  const toggleChip = (key: string) =>
    setChips((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const closeDrawer = () => setDrawerOpen(false);
  const familySections: SideDrawerSection[] = [
    {
      items: [
        { key: "home", icon: "home-outline", label: "首頁", onPress: closeDrawer },
        { key: "calendar", icon: "calendar-outline", label: "照護行事曆", onPress: closeDrawer },
        { key: "medication", icon: "medkit-outline", label: "用藥管理", onPress: closeDrawer, badge: 2 },
        { key: "chat", icon: "chatbubbles-outline", label: "聊天", onPress: closeDrawer, badge: 5 },
      ],
    },
    {
      title: "長輩與家人",
      items: [
        { key: "care-target", icon: "people-outline", label: "照護對象", onPress: closeDrawer },
        { key: "invite", icon: "person-add-outline", label: "邀請家人", onPress: closeDrawer },
        { key: "emergency", icon: "call-outline", label: "緊急聯絡人", onPress: closeDrawer },
      ],
    },
    {
      title: "帳號",
      items: [
        { key: "profile", icon: "person-circle-outline", label: "個人資料", onPress: closeDrawer },
        { key: "my-data", icon: "document-text-outline", label: "我的資料與匯出", onPress: closeDrawer },
        { key: "audit", icon: "shield-checkmark-outline", label: "存取紀錄", onPress: closeDrawer },
        { key: "privacy", icon: "lock-closed-outline", label: "隱私權政策", onPress: closeDrawer },
        { key: "logout", icon: "log-out-outline", label: "登出", onPress: closeDrawer, tone: "danger" },
      ],
    },
  ];

  const fakeSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setSheetOpen(false);
    }, 900);
  };

  return (
    <View style={styles.root}>
      <AppHeader
        title="OmniCare 設計系統"
        subtitle="開發用預覽頁 · /dev/ui-kit"
        left="menu"
        onMenu={() => setDrawerOpen(true)}
        right={<IconButton icon="search-outline" accessibilityLabel="搜尋" onPress={() => {}} />}
      />

      <ScrollView style={styles.flex} contentContainerStyle={[styles.content, { paddingBottom: spacing.xxxl + insets.bottom }]}>
        <Text style={styles.pageTitle}>元件與設計規範</Text>
        <Text style={styles.pageLead}>
          此頁只在開發模式出現，用來檢查色彩、字級與共用元件。所有畫面改版都應從這裡的元件組合而成。
        </Text>

        {/* ---------------------------------------------------------- Colors */}
        <Block title="色彩">
          {colorGroups.map((group) => (
            <View key={group.title} style={styles.group}>
              <Text style={styles.groupTitle}>{group.title}</Text>
              <Text style={styles.groupNote}>{group.note}</Text>
              <View style={styles.swatchGrid}>
                {group.tokens.map((token) => (
                  <Swatch key={token} name={token} hex={colors[token]} />
                ))}
              </View>
            </View>
          ))}
          <View style={styles.group}>
            <Text style={styles.groupTitle}>行事曆事件色（使用者資料）</Text>
            <Text style={styles.groupNote}>色碼存於 Firestore 的 event.color，維持原值不調整</Text>
            <View style={styles.swatchGrid}>
              {eventColors.map((hex, i) => (
                <Swatch key={hex} name={`eventColors[${i}]`} hex={hex} />
              ))}
            </View>
          </View>
        </Block>

        {/* ------------------------------------------------------ Typography */}
        <Block title="字級">
          <Card padding={0}>
            {typeSamples.map((s, i) => (
              <View key={s.token}>
                {i > 0 ? <Divider inset={spacing.lg} /> : null}
                <View style={styles.typeRow}>
                  <Text style={styles.typeMeta}>
                    {s.token} · {typography[s.token].fontSize}/{typography[s.token].lineHeight} · {typography[s.token].fontWeight}
                  </Text>
                  <Text style={typography[s.token]}>{s.zh}</Text>
                  <Text style={typography[s.token]}>{s.en}</Text>
                </View>
              </View>
            ))}
          </Card>
        </Block>

        {/* -------------------------------------------------- Spacing & radii */}
        <Block title="間距與圓角">
          <Card>
            <Text style={styles.groupTitle}>間距（4 的倍數）</Text>
            <View style={styles.spacingList}>
              {(Object.entries(spacing) as [string, number][]).map(([name, value]) => (
                <View key={name} style={styles.spacingRow}>
                  <Text style={styles.spacingLabel}>
                    {name} · {value}
                  </Text>
                  <View style={[styles.spacingBar, { width: value * 3 }]} />
                </View>
              ))}
            </View>
          </Card>
          <View style={styles.radiusRow}>
            {(
              [
                ["control", "輸入框／按鈕", radii.control],
                ["card", "卡片", radii.card],
                ["sheet", "底部面板上緣", radii.sheet],
                ["pill", "標籤／膠囊", radii.pill],
              ] as const
            ).map(([name, desc, r]) => (
              <View key={name} style={styles.radiusItem}>
                <View style={[styles.radiusBox, { borderRadius: Math.min(r, 36) }]} />
                <Text style={styles.swatchName}>{name} · {r}</Text>
                <Text style={styles.swatchHex}>{desc}</Text>
              </View>
            ))}
          </View>
        </Block>

        {/* ---------------------------------------------------------- Header */}
        <Block title="頂部列 AppHeader">
          <View style={styles.headerDemo}>
            <AppHeader title="用藥紀錄" left="back" onBack={() => {}} safeAreaTop={false} />
          </View>
          <View style={styles.headerDemo}>
            <AppHeader
              title="王奶奶的照護行事曆，標題過長時會自動截斷"
              subtitle="家屬 · 3 位成員"
              left="menu"
              onMenu={() => setDrawerOpen(true)}
              safeAreaTop={false}
              right={
                <>
                  <IconButton icon="notifications-outline" accessibilityLabel="通知" onPress={() => {}} />
                  <IconButton icon="add" accessibilityLabel="新增" color={colors.primary} onPress={() => {}} />
                </>
              }
            />
          </View>
          <View style={styles.headerDemo}>
            <AppHeader title="機構總覽" variant="primary" left="back" onBack={() => {}} safeAreaTop={false} />
          </View>
          <View style={styles.headerDemo}>
            <AppHeader title="沒有左側按鈕" left="none" safeAreaTop={false} />
          </View>
        </Block>

        {/* --------------------------------------------------------- Buttons */}
        <Block title="按鈕 Button">
          <Card>
            <View style={styles.wrap}>
              <Button label="儲存" />
              <Button label="次要操作" variant="secondary" />
              <Button label="稍後再說" variant="ghost" />
              <Button label="刪除" variant="danger" icon="trash-outline" />
            </View>
            <View style={[styles.wrap, styles.mt]}>
              <Button
                label={loadingDemo ? "傳送中" : "點我看載入"}
                loading={loadingDemo}
                onPress={() => {
                  setLoadingDemo(true);
                  setTimeout(() => setLoadingDemo(false), 1200);
                }}
              />
              <Button label="停用" disabled />
              <Button label="新增事件" variant="secondary" icon="add" />
            </View>
            <Divider style={styles.mtLg} />
            <Text style={[styles.groupNote, styles.mt]}>大尺寸 lg（56）＋ 滿版，用於頁面主要操作</Text>
            <Button label="完成今日紀錄" size="lg" fullWidth icon="checkmark-circle-outline" style={styles.mt} />
            <Text style={[styles.groupNote, styles.mtLg]}>強調色只保留給緊急操作</Text>
            <Button label="緊急撥號" variant="accent" size="lg" fullWidth icon="call" style={styles.mt} />
          </Card>
        </Block>

        {/* ------------------------------------------------- Cards and lists */}
        <Block title="卡片與清單">
          <SectionHeader title="今日待辦" actionLabel="查看全部" onAction={() => {}} />
          <Card onPress={() => {}} accessibilityLabel="下午 2:00 血壓藥">
            <View style={styles.cardTop}>
              <Text style={typography.bodyStrong}>下午 2:00 · 血壓藥</Text>
              <StatusBadge label="待服用" tone="warning" />
            </View>
            <Text style={[typography.bodySmall, styles.mtXs]}>Amlodipine 5mg · 飯後半小時</Text>
          </Card>
          <View style={styles.cardPair}>
            <Card tone="selected" style={styles.flex}>
              <Text style={typography.caption}>今日血壓</Text>
              <Text style={[typography.title, styles.mtXs]}>128/82</Text>
            </Card>
            <Card tone="sunken" style={styles.flex}>
              <Text style={typography.caption}>上次量測</Text>
              <Text style={[typography.title, styles.mtXs]}>09:30</Text>
            </Card>
          </View>

          <SectionHeader title="設定" />
          <Card padding={0}>
            <ListRow icon="person-outline" title="個人資料" subtitle="姓名、電話與照片" onPress={() => {}} />
            <Divider inset />
            <ListRow icon="language-outline" title="語言" value="繁體中文" onPress={() => {}} />
            <Divider inset />
            <ListRow
              icon="notifications-outline"
              title="用藥提醒通知"
              right={<Switch value={notify} onValueChange={setNotify} trackColor={{ true: colors.primary, false: colors.border }} />}
            />
            <Divider inset />
            <ListRow icon="trash-outline" title="刪除帳號" tone="danger" onPress={() => {}} />
          </Card>
        </Block>

        {/* -------------------------------------------- Badges, chips, empty */}
        <Block title="狀態標籤與選項">
          <Card>
            <View style={styles.wrap}>
              <StatusBadge label="草稿" />
              <StatusBadge label="進行中" tone="primary" />
              <StatusBadge label="已完成" tone="success" icon="checkmark" />
              <StatusBadge label="待確認" tone="warning" />
              <StatusBadge label="已逾時" tone="danger" icon="alert-circle" />
            </View>
            <Divider style={styles.mtLg} />
            <Text style={[styles.groupNote, styles.mt]}>可複選的 Chip</Text>
            <View style={[styles.wrap, styles.mt]}>
              {[
                ["morning", "早上"],
                ["noon", "中午"],
                ["evening", "晚上"],
                ["bedtime", "睡前"],
              ].map(([key, label]) => (
                <Chip key={key} label={label} selected={chips.includes(key)} onPress={() => toggleChip(key)} />
              ))}
            </View>
          </Card>
          <Card style={styles.mt}>
            <EmptyState
              icon="calendar-outline"
              title="這天還沒有行程"
              body="新增回診、復健或探視時間，家人和看護都會收到提醒。"
              actionLabel="新增事件"
              onAction={() => setSheetOpen(true)}
            />
          </Card>
        </Block>

        {/* ---------------------------------------------------- Form sheet */}
        <Block title="表單 TextField 與 FormSheet">
          <Card>
            <TextField label="事件名稱" placeholder="例如：回診心臟科" required value={title} onChangeText={setTitle} />
            <TextField label="備註" placeholder="可留空" helper="家人與看護都看得到" multiline containerStyle={styles.mtLg} />
            <TextField label="聯絡電話" value="0912" error="電話號碼格式不正確" keyboardType="phone-pad" containerStyle={styles.mtLg} />
            <TextField label="已鎖定" value="由機構設定" editable={false} containerStyle={styles.mtLg} />
            <Button label="開啟表單面板" variant="secondary" icon="create-outline" fullWidth onPress={() => setSheetOpen(true)} style={styles.mtLg} />
          </Card>
        </Block>

        {/* ------------------------------------------------- Drawer & nav */}
        <Block title="側邊選單與底部導覽">
          <Card>
            <Text style={typography.body}>共用 SideDrawer：寬度 min(84%, 340)，Android 返回鍵與網頁 Esc 可關閉。</Text>
            <Button label="開啟側邊選單" icon="menu" onPress={() => setDrawerOpen(true)} style={styles.mt} />
          </Card>
          <View style={styles.navDemo}>
            <BottomNav
              safeAreaBottom={false}
              activeKey={activeTab}
              onSelect={setActiveTab}
              items={[
                { key: "home", icon: "home-outline", activeIcon: "home", label: "首頁" },
                { key: "calendar", icon: "calendar-outline", activeIcon: "calendar", label: "行事曆" },
                { key: "chat", icon: "chatbubbles-outline", activeIcon: "chatbubbles", label: "聊天", badge: 3 },
                { key: "me", icon: "person-outline", activeIcon: "person", label: "我的" },
              ]}
            />
          </View>
        </Block>
      </ScrollView>

      <FormSheet
        visible={sheetOpen}
        title="新增照護事件"
        onCancel={() => setSheetOpen(false)}
        onSave={fakeSave}
        saving={saving}
        saveDisabled={!title.trim()}
        footer={<Button label="刪除此事件" variant="ghost" icon="trash-outline" fullWidth onPress={() => setSheetOpen(false)} />}
      >
        <TextField label="事件名稱" placeholder="例如：回診心臟科" required value={title} onChangeText={setTitle} helper="輸入名稱後才能儲存" />
        <TextField label="地點" placeholder="醫院或地址" />
        <View>
          <Text style={styles.fieldLabel}>時段</Text>
          <View style={styles.wrap}>
            {[
              ["morning", "早上"],
              ["noon", "中午"],
              ["evening", "晚上"],
            ].map(([key, label]) => (
              <Chip key={key} label={label} selected={chips.includes(key)} onPress={() => toggleChip(key)} />
            ))}
          </View>
        </View>
        <View>
          <Text style={styles.fieldLabel}>顏色</Text>
          <View style={styles.wrap}>
            {eventColors.map((hex) => (
              <View key={hex} style={[styles.eventDot, { backgroundColor: hex }]} />
            ))}
          </View>
        </View>
        <TextField label="備註" placeholder="提醒看護需要準備的東西" multiline />
        <TextField label="聯絡人電話" placeholder="09xx-xxx-xxx" keyboardType="phone-pad" />
      </FormSheet>

      <SideDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        activeKey="calendar"
        sections={familySections}
        header={
          <View>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>林</Text>
            </View>
            <Text style={[typography.header, styles.mt]}>林小美</Text>
            <View style={[styles.wrap, styles.mtXs]}>
              <StatusBadge label="家屬" tone="primary" />
              <Text style={typography.bodySmall}>照護對象：王奶奶</Text>
            </View>
          </View>
        }
        footer={
          <View style={styles.wrap}>
            {["中文", "English", "Tiếng Việt", "Indonesia"].map((l, i) => (
              <Chip key={l} label={l} selected={i === 0} onPress={() => {}} />
            ))}
          </View>
        }
      />
    </View>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.block}>
      <Text style={styles.blockTitle} accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

function Swatch({ name, hex }: { name: string; hex: string }) {
  return (
    <View style={styles.swatch}>
      <View style={[styles.swatchChip, { backgroundColor: hex }]} />
      <Text style={styles.swatchName} numberOfLines={1}>
        {name}
      </Text>
      <Text style={styles.swatchHex}>{hex}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  content: { width: "100%", maxWidth: 760, alignSelf: "center", paddingHorizontal: spacing.lg, paddingTop: spacing.xl },
  pageTitle: { ...typography.display },
  pageLead: { ...typography.body, color: colors.textSecondary, marginTop: spacing.sm, maxWidth: 560 },

  block: { marginTop: spacing.xxxl },
  blockTitle: { ...typography.title, marginBottom: spacing.md },
  group: { marginBottom: spacing.xl },
  groupTitle: { ...typography.label },
  groupNote: { ...typography.caption, marginTop: 2 },

  swatchGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.md },
  swatch: { width: 104 },
  swatchChip: { height: 56, borderRadius: radii.control, borderWidth: 1, borderColor: colors.border },
  swatchName: { ...typography.caption, color: colors.text, fontWeight: "600", marginTop: 6 },
  swatchHex: { ...typography.caption },

  typeRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  typeMeta: { ...typography.caption, marginBottom: spacing.xs, fontVariant: ["tabular-nums"] },

  spacingList: { marginTop: spacing.md, gap: spacing.sm },
  spacingRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  spacingLabel: { ...typography.caption, width: 72 },
  spacingBar: { height: 12, borderRadius: 3, backgroundColor: colors.primaryBorder },
  radiusRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.lg, marginTop: spacing.lg },
  radiusItem: { width: 120 },
  radiusBox: { height: 72, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primaryBorder },

  headerDemo: {
    borderRadius: radii.card,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  navDemo: {
    marginTop: spacing.md,
    borderRadius: radii.card,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },

  wrap: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm },
  mtXs: { marginTop: spacing.xs },
  mt: { marginTop: spacing.md },
  mtLg: { marginTop: spacing.lg },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  cardPair: { flexDirection: "row", gap: spacing.md, marginTop: spacing.md },

  fieldLabel: { ...typography.label, marginBottom: spacing.sm },
  eventDot: { width: 36, height: 36, borderRadius: 18 },

  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { ...typography.title, color: colors.primary },
});
