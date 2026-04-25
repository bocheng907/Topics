import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type CalendarEvent = {
  id: string;
  year: number;
  month: number;
  day: number;
  name: string;
  time: string;
  event: string;
  location: string;
  color: string;
};

type FormState = {
  name: string;
  time: string;
  event: string;
  location: string;
  color: string;
};

const YEAR = 2026;
const MONTH_LABELS = Array.from({ length: 12 }, (_, index) => `${index + 1}月`);
const EVENT_COLORS = ["#F25F5C", "#F4A261", "#2EC4B6", "#6C63FF", "#E56BDF"];

const INITIAL_EVENTS: CalendarEvent[] = [
  {
    id: "evt-1",
    year: 2026,
    month: 3,
    day: 3,
    name: "王小明",
    time: "10:00",
    event: "眼科回診",
    location: "台北醫院",
    color: "#F25F5C",
  },
  {
    id: "evt-2",
    year: 2026,
    month: 3,
    day: 8,
    name: "王小明",
    time: "06:00",
    event: "吃藥",
    location: "家中",
    color: "#F4A261",
  },
  {
    id: "evt-3",
    year: 2026,
    month: 3,
    day: 15,
    name: "王小明",
    time: "14:30",
    event: "復健",
    location: "復健中心",
    color: "#2EC4B6",
  },
  {
    id: "evt-4",
    year: 2026,
    month: 3,
    day: 21,
    name: "王小明",
    time: "09:00",
    event: "量血壓",
    location: "家中",
    color: "#6C63FF",
  },
];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function buildCalendarCells(year: number, month: number) {
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = getDaysInMonth(year, month);
  const cells: Array<number | null> = [];

  for (let i = 0; i < firstWeekday; i += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(day);
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

export default function FamilyCalendarScreen() {
  const [month, setMonth] = useState(3);
  const [selectedDay, setSelectedDay] = useState(8);
  const [monthMenuOpen, setMonthMenuOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>(INITIAL_EVENTS);
  const [form, setForm] = useState<FormState>({
    name: "",
    time: "",
    event: "",
    location: "",
    color: EVENT_COLORS[0],
  });

  const daysInMonth = useMemo(() => getDaysInMonth(YEAR, month), [month]);
  const calendarCells = useMemo(() => buildCalendarCells(YEAR, month), [month]);
  const monthEvents = useMemo(
    () => events.filter((event) => event.year === YEAR && event.month === month),
    [events, month]
  );
  const selectedDayEvents = monthEvents.filter((event) => event.day === selectedDay);

  useEffect(() => {
    if (selectedDay > daysInMonth) {
      setSelectedDay(daysInMonth);
    }
  }, [daysInMonth, selectedDay]);

  useEffect(() => {
    setMonthMenuOpen(false);
  }, [month]);

  const confirmNewEvent = () => {
    const nextEvent: CalendarEvent = {
      id: `evt-${Date.now()}`,
      year: YEAR,
      month,
      day: selectedDay,
      name: form.name.trim() || "未填寫姓名",
      time: form.time.trim() || "未填寫時間",
      event: form.event.trim() || "未命名事件",
      location: form.location.trim() || "未填寫地點",
      color: form.color,
    };

    setEvents((prev) => [nextEvent, ...prev]);
    setFormOpen(false);
    setForm({
      name: "",
      time: "",
      event: "",
      location: "",
      color: EVENT_COLORS[0],
    });
  };

  const renderDayCell = (day: number | null, index: number) => {
    if (!day) {
      return <View key={`empty-${index}`} style={styles.dayCell} />;
    }

    const dayEvents = monthEvents.filter((event) => event.day === day).slice(0, 2);
    const isSelected = day === selectedDay;

    return (
      <Pressable
        key={`day-${day}`}
        onPress={() => setSelectedDay(day)}
        style={[styles.dayCell, isSelected && styles.dayCellSelected]}
      >
        <Text style={[styles.dayNumber, isSelected && styles.dayNumberSelected]}>
          {day}
        </Text>

        <View style={styles.eventStack}>
          {dayEvents.map((event) => (
            <View
              key={event.id}
              style={[styles.eventChip, { backgroundColor: event.color }]}
            >
              <Text style={styles.eventChipText} numberOfLines={1}>
                {event.event}
              </Text>
            </View>
          ))}
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.yearText}>{YEAR}</Text>
            <View style={styles.monthWrap}>
              <Pressable
                onPress={() => setMonthMenuOpen((prev) => !prev)}
                style={styles.monthButton}
              >
                <Text style={styles.monthButtonText}>{MONTH_LABELS[month]}</Text>
                <Text style={styles.monthChevron}>▾</Text>
              </Pressable>

              {monthMenuOpen && (
                <View style={styles.monthMenu}>
                  {MONTH_LABELS.map((label, index) => (
                    <Pressable
                      key={label}
                      onPress={() => setMonth(index)}
                      style={[
                        styles.monthMenuItem,
                        index === month && styles.monthMenuItemActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.monthMenuText,
                          index === month && styles.monthMenuTextActive,
                        ]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          </View>

          <Pressable hitSlop={12} style={styles.menuButton} onPress={() => {}}>
            <View style={styles.menuLine} />
            <View style={styles.menuLine} />
            <View style={styles.menuLine} />
          </Pressable>
        </View>
      </View>

      <View style={styles.contentCard}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.weekRow}>
            {["日", "一", "二", "三", "四", "五", "六"].map((day) => (
              <Text key={day} style={styles.weekText}>
                {day}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>{calendarCells.map((cell, index) => renderDayCell(cell, index))}</View>

          <View style={styles.selectedSummary}>
            <Text style={styles.selectedSummaryTitle}>{selectedDay} 日行程</Text>
            {selectedDayEvents.length === 0 ? (
              <Text style={styles.emptySummaryText}>目前沒有事件</Text>
            ) : (
              selectedDayEvents.map((event) => (
                <View key={event.id} style={styles.summaryCard}>
                  <View style={[styles.summaryDot, { backgroundColor: event.color }]} />
                  <View style={styles.summaryBody}>
                    <Text style={styles.summaryTitle}>
                      {event.time} {event.event}
                    </Text>
                    <Text style={styles.summaryMeta}>
                      {event.name} · {event.location}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </View>

      <Pressable style={styles.plusButton} onPress={() => setFormOpen(true)}>
        <Text style={styles.plusText}>+</Text>
      </Pressable>

      {formOpen && (
        <View style={styles.formOverlay}>
          <View style={styles.formCard}>
            <View style={styles.formHeader}>
              <Pressable onPress={() => setFormOpen(false)} hitSlop={12}>
                <Text style={styles.formHeaderIcon}>✕</Text>
              </Pressable>
              <Pressable onPress={confirmNewEvent} hitSlop={12}>
                <Text style={styles.formHeaderIcon}>✓</Text>
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.formContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>姓名</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={form.name}
                  onChangeText={(text) => setForm((prev) => ({ ...prev, name: text }))}
                  placeholder="請輸入姓名"
                  placeholderTextColor="#B7B7B7"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>時間</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={form.time}
                  onChangeText={(text) => setForm((prev) => ({ ...prev, time: text }))}
                  placeholder="08:00"
                  placeholderTextColor="#B7B7B7"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>事件</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={form.event}
                  onChangeText={(text) => setForm((prev) => ({ ...prev, event: text }))}
                  placeholder="請輸入事件"
                  placeholderTextColor="#B7B7B7"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>地點</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={form.location}
                  onChangeText={(text) => setForm((prev) => ({ ...prev, location: text }))}
                  placeholder="請輸入地點"
                  placeholderTextColor="#B7B7B7"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>色彩選擇</Text>
                <View style={styles.colorRow}>
                  {EVENT_COLORS.map((color) => {
                    const selected = form.color === color;
                    return (
                      <Pressable
                        key={color}
                        onPress={() => setForm((prev) => ({ ...prev, color }))}
                        style={[
                          styles.colorSwatch,
                          { backgroundColor: color },
                          selected && styles.colorSwatchSelected,
                        ]}
                      />
                    );
                  })}
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F6F2F0",
  },
  header: {
    backgroundColor: "#F26C61",
    paddingTop: 58,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  yearText: {
    fontSize: 34,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 1,
  },
  monthWrap: {
    marginTop: 10,
    position: "relative",
    alignSelf: "flex-start",
  },
  monthButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.24)",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  monthButtonText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFF",
  },
  monthChevron: {
    fontSize: 14,
    color: "#FFF",
    marginTop: 2,
  },
  monthMenu: {
    position: "absolute",
    top: 48,
    left: 0,
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 8,
    width: 140,
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 6,
    zIndex: 50,
  },
  monthMenuItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  monthMenuItemActive: {
    backgroundColor: "#FCE8E6",
  },
  monthMenuText: {
    fontSize: 16,
    color: "#374151",
    fontWeight: "600",
  },
  monthMenuTextActive: {
    color: "#F26C61",
  },
  menuButton: {
    width: 34,
    height: 34,
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  menuLine: {
    width: 18,
    height: 2,
    borderRadius: 999,
    backgroundColor: "#FFF",
  },
  contentCard: {
    flex: 1,
    marginTop: -14,
    backgroundColor: "#FFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 170,
  },
  weekRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  weekText: {
    width: `${100 / 7}%`,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "700",
    color: "#8A8A8A",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    width: `${100 / 7}%`,
    minHeight: 90,
    borderWidth: 0.5,
    borderColor: "#F1F1F1",
    padding: 6,
  },
  dayCellSelected: {
    backgroundColor: "#FFF2EF",
    borderColor: "#F26C61",
  },
  dayNumber: {
    alignSelf: "flex-end",
    fontSize: 15,
    fontWeight: "700",
    color: "#333",
  },
  dayNumberSelected: {
    color: "#F26C61",
  },
  eventStack: {
    marginTop: 6,
    gap: 4,
  },
  eventChip: {
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  eventChipText: {
    color: "#FFF",
    fontSize: 11,
    fontWeight: "700",
  },
  selectedSummary: {
    marginTop: 20,
    gap: 12,
  },
  selectedSummaryTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#222",
  },
  emptySummaryText: {
    fontSize: 14,
    color: "#999",
  },
  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    backgroundColor: "#F8F8F8",
    borderRadius: 18,
    gap: 12,
  },
  summaryDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  summaryBody: {
    flex: 1,
    gap: 4,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#222",
  },
  summaryMeta: {
    fontSize: 13,
    color: "#666",
  },
  plusButton: {
    position: "absolute",
    right: 20,
    bottom: 122,
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#F6A6C0",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#F6A6C0",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  plusText: {
    fontSize: 36,
    fontWeight: "300",
    color: "#FFF",
    marginTop: -2,
  },
  formOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 18,
  },
  formCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#FFF",
    borderRadius: 28,
    padding: 18,
    maxHeight: "84%",
  },
  formHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  formHeaderIcon: {
    fontSize: 24,
    fontWeight: "700",
    color: "#333",
  },
  formContent: {
    gap: 14,
    paddingBottom: 6,
  },
  field: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: "800",
    color: "#333",
  },
  fieldInput: {
    backgroundColor: "#F4F5F7",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    color: "#111",
  },
  colorRow: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  },
  colorSwatch: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: "transparent",
  },
  colorSwatchSelected: {
    borderColor: "#111",
  },
});
