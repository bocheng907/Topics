import { Feather, Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
} from "firebase/firestore";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { db } from "@/firebase/firebaseConfig";
import { useAuth } from "@/src/auth/useAuth";
import { useActiveCareTarget } from "@/src/care-target/useActiveCareTarget";

type CalendarEventRecord = {
  id: string;
  patientId: string;
  title: string;
  personName: string;
  location: string;
  eventDate: string;
  hour: string;
  minute: string;
  period: "am" | "pm";
  color: string;
  createdBy: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
};

type FormState = {
  personName: string;
  title: string;
  location: string;
  color: string;
};

type TimeState = {
  hour: number;
  minute: number;
  period: "am" | "pm";
};

type CalendarCell = {
  day: number;
  kind: "prev" | "current" | "next";
  monthOffset: -1 | 0 | 1;
};

const CALENDAR_EVENTS_COLLECTION = "calendar_events";
const YEAR = 2026;
const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const WEEK_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const EVENT_COLORS = ["#F4A261", "#B9A0F3", "#73B8F2", "#F6BDC2", "#7EDB68"];
const HOURS = Array.from({ length: 12 }, (_, index) => index + 1);
const MINUTES = Array.from({ length: 60 }, (_, index) => index);
const PERIODS: TimeState["period"][] = ["am", "pm"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getMonthMeta(year: number, month: number) {
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = getDaysInMonth(year, month);
  const prevMonthDays = getDaysInMonth(year, month - 1);
  const cells: CalendarCell[] = [];

  for (let i = 0; i < firstWeekday; i += 1) {
    cells.push({
      day: prevMonthDays - firstWeekday + i + 1,
      kind: "prev",
      monthOffset: -1,
    });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ day, kind: "current", monthOffset: 0 });
  }

  while (cells.length < 35) {
    cells.push({
      day: cells.length - (firstWeekday + daysInMonth) + 1,
      kind: "next",
      monthOffset: 1,
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push({
      day: cells.length - (firstWeekday + daysInMonth) + 1,
      kind: "next",
      monthOffset: 1,
    });
  }

  return cells;
}

function pad2(value: number | string) {
  return String(value).padStart(2, "0");
}

function getEventDate(year: number, month: number, day: number) {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

function toMonthKey(eventDate: string) {
  return eventDate.slice(0, 7);
}

function toDayKey(eventDate: string) {
  return eventDate.slice(8, 10);
}

function formatEventTime(event: Pick<CalendarEventRecord, "hour" | "minute" | "period">) {
  return `${event.hour}:${event.minute} ${event.period}`;
}

function WheelColumn<T extends string | number>({
  values,
  value,
  onChange,
  renderValue,
}: {
  values: T[];
  value: T;
  onChange: (value: T) => void;
  renderValue: (value: T) => string;
}) {
  const selectedIndex = values.findIndex((item) => item === value);
  const visibleIndices = Array.from({ length: 7 }, (_, index) => selectedIndex - 3 + index);

  return (
    <View style={styles.wheelColumn}>
      <View style={styles.wheelFrame}>
        <View style={styles.wheelSelectedBand} />
        {visibleIndices.map((index, rowIndex) => {
          const item = values[index];
          const isSelected = rowIndex === 3;

          if (item === undefined) {
            return <View key={`empty-${rowIndex}`} style={[styles.wheelRow, styles.wheelRowGhost]} />;
          }

          return (
            <Pressable
              key={`${renderValue(item)}-${rowIndex}`}
              onPress={() => onChange(item)}
              style={styles.wheelRow}
            >
              <Text style={[styles.wheelRowText, isSelected && styles.wheelRowTextSelected]}>
                {renderValue(item)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function CaregiverCalendarScreen() {
  const { user } = useAuth();
  const { activePatientId } = useActiveCareTarget();

  const [month, setMonth] = useState(8);
  const [selectedDay, setSelectedDay] = useState(18);
  const [monthMenuOpen, setMonthMenuOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [events, setEvents] = useState<CalendarEventRecord[]>([]);
  const [form, setForm] = useState<FormState>({
    personName: "",
    title: "",
    location: "",
    color: EVENT_COLORS[0],
  });
  const [time, setTime] = useState<TimeState>({
    hour: 7,
    minute: 0,
    period: "pm",
  });

  const daysInMonth = useMemo(() => getDaysInMonth(YEAR, month), [month]);
  const calendarCells = useMemo(() => getMonthMeta(YEAR, month), [month]);
  const monthKey = useMemo(() => `${YEAR}-${pad2(month + 1)}`, [month]);

  const monthEvents = useMemo(
    () => events.filter((event) => toMonthKey(event.eventDate) === monthKey),
    [events, monthKey]
  );
  const selectedDayEvents = useMemo(
    () => monthEvents.filter((event) => Number(toDayKey(event.eventDate)) === selectedDay),
    [monthEvents, selectedDay]
  );

  useEffect(() => {
    if (selectedDay > daysInMonth) {
      setSelectedDay(daysInMonth);
    }
  }, [daysInMonth, selectedDay]);

  useEffect(() => {
    setMonthMenuOpen(false);
  }, [month]);

  useEffect(() => {
    if (!activePatientId) {
      setEvents([]);
      return;
    }

    const q = query(
      collection(db, CALENDAR_EVENTS_COLLECTION),
      where("patientId", "==", activePatientId),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setEvents(
          snap.docs.map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as Omit<CalendarEventRecord, "id">),
          }))
        );
      },
      (error) => {
        console.log("caregiver calendar snapshot failed:", error);
        setEvents([]);
      }
    );

    return () => unsubscribe();
  }, [activePatientId]);

  const resetForm = () => {
    setForm({
      personName: "",
      title: "",
      location: "",
      color: EVENT_COLORS[0],
    });
    setTime({
      hour: 7,
      minute: 0,
      period: "pm",
    });
  };

  const confirmNewEvent = async () => {
    if (!activePatientId || !user?.uid) return;

    const eventDate = getEventDate(YEAR, month, selectedDay);

    try {
      await addDoc(collection(db, CALENDAR_EVENTS_COLLECTION), {
        patientId: activePatientId,
        title: form.title.trim() || "Untitled event",
        personName: form.personName.trim() || "Unnamed",
        location: form.location.trim() || "Unknown location",
        eventDate,
        hour: String(time.hour),
        minute: pad2(time.minute),
        period: time.period,
        color: form.color,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      });

      setFormOpen(false);
      resetForm();
    } catch (error) {
      console.log("create calendar event failed:", error);
    }
  };

  const renderDayCell = (cell: CalendarCell, index: number) => {
    const isCurrentMonth = cell.kind === "current";
    const dayEvents = isCurrentMonth
      ? monthEvents.filter((event) => Number(toDayKey(event.eventDate)) === cell.day)
      : [];
    const isSelected = isCurrentMonth && cell.day === selectedDay;

    return (
      <Pressable
        key={`${cell.kind}-${cell.day}-${index}`}
        onPress={() => {
          if (isCurrentMonth) setSelectedDay(cell.day);
        }}
        style={[
          styles.dayCell,
          cell.kind !== "current" && styles.dayCellMuted,
          isSelected && styles.dayCellSelected,
        ]}
      >
        <Text
          style={[
            styles.dayNumber,
            cell.kind !== "current" && styles.dayNumberMuted,
            isSelected && styles.dayNumberSelected,
          ]}
        >
          {cell.day}
        </Text>

        <View style={styles.dayMarkers}>
          {dayEvents.slice(0, 2).map((event) => (
            <View key={event.id} style={[styles.dayMarker, { backgroundColor: event.color }]} />
          ))}
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.topBar}>
          <View style={styles.topBarSpacer} />
          <Pressable hitSlop={12} style={styles.menuButton} onPress={() => {}}>
            <Feather name="menu" size={34} color="#111" />
          </Pressable>
        </View>
      </View>

      <View style={styles.contentCard}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.controlsCard}>
            <View style={styles.yearRow}>
              <Pressable onPress={() => {}} hitSlop={10} style={styles.yearArrowButton}>
                <Ionicons name="caret-back" size={16} color="#2B2B2B" />
              </Pressable>
              <Text style={styles.yearText}>{YEAR}</Text>
              <Pressable onPress={() => {}} hitSlop={10} style={styles.yearArrowButton}>
                <Ionicons name="caret-forward" size={16} color="#2B2B2B" />
              </Pressable>
            </View>

            <View style={styles.monthWrap}>
              <Pressable onPress={() => setMonthMenuOpen((prev) => !prev)} style={styles.monthButton}>
                <Text style={styles.monthButtonText}>{MONTH_LABELS[month]}</Text>
                <Ionicons name="chevron-down" size={16} color="#4A4A4A" />
              </Pressable>

              {monthMenuOpen && (
                <View style={styles.monthMenu}>
                  {MONTH_LABELS.map((label, index) => (
                    <Pressable
                      key={label}
                      onPress={() => setMonth(index)}
                      style={[styles.monthMenuItem, index === month && styles.monthMenuItemActive]}
                    >
                      <Text
                        style={[styles.monthMenuText, index === month && styles.monthMenuTextActive]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          </View>

          <View style={styles.weekRow}>
            {WEEK_LABELS.map((day) => (
              <Text key={day} style={styles.weekText}>
                {day}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>{calendarCells.map((cell, index) => renderDayCell(cell, index))}</View>

          {selectedDayEvents.length > 0 && (
            <View style={styles.eventList}>
              {selectedDayEvents.map((event) => (
                <View key={event.id} style={styles.eventCard}>
                  <View style={styles.eventCardTop}>
                    <Text style={styles.eventCardTime}>{formatEventTime(event)}</Text>
                    <Text style={styles.eventCardText} numberOfLines={1}>
                      {event.personName}
                    </Text>
                    <Text style={styles.eventCardText} numberOfLines={1}>
                      {event.title}
                    </Text>
                    <Text style={styles.eventCardText} numberOfLines={1}>
                      {event.location}
                    </Text>
                  </View>

                  <View style={styles.eventActions}>
                    <Pressable hitSlop={8} style={styles.eventActionButton} onPress={() => {}}>
                      <Feather name="edit-2" size={22} color="#1F2430" />
                    </Pressable>
                    <Pressable hitSlop={8} style={styles.eventActionButton} onPress={() => {}}>
                      <Ionicons name="trash-outline" size={24} color="#1F2430" />
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </View>

      <Pressable style={styles.phoneButton} onPress={() => {}}>
        <Ionicons name="call" size={26} color="#FFF" />
      </Pressable>

      <Pressable style={styles.plusButton} onPress={() => setFormOpen(true)}>
        <Ionicons name="add" size={38} color="#FFF" />
      </Pressable>

      {formOpen && (
        <View style={styles.formOverlay}>
          <View style={styles.formPeekCalendar}>
            <View style={styles.formPeekGridRow}>
              <View style={[styles.formPeekCell, styles.formPeekCellMuted]} />
              <View style={styles.formPeekCell} />
              <View style={styles.formPeekCell} />
              <View style={styles.formPeekCell} />
              <View style={[styles.formPeekCell, styles.formPeekCellSelected]} />
              <View style={styles.formPeekCell} />
            </View>
          </View>

          <View style={styles.formSheet}>
            <View style={styles.formHeader}>
              <Pressable onPress={() => setFormOpen(false)} hitSlop={12} style={styles.formIconButton}>
                <Text style={styles.formHeaderIcon}>X</Text>
              </Pressable>
              <Pressable onPress={confirmNewEvent} hitSlop={12} style={styles.formConfirmButton}>
                <Ionicons name="checkmark" size={34} color="#111" />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.formContent} showsVerticalScrollIndicator={false}>
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

              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>姓名:</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={form.personName}
                  onChangeText={(text) => setForm((prev) => ({ ...prev, personName: text }))}
                  placeholder=""
                  placeholderTextColor="#B7B7B7"
                />
              </View>

              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>時間:</Text>
                <View style={styles.timeField}>
                  <WheelColumn
                    values={HOURS}
                    value={time.hour}
                    onChange={(hour) => setTime((prev) => ({ ...prev, hour }))}
                    renderValue={(hour) => String(hour)}
                  />
                  <WheelColumn
                    values={MINUTES}
                    value={time.minute}
                    onChange={(minute) => setTime((prev) => ({ ...prev, minute }))}
                    renderValue={(minute) => pad2(minute)}
                  />
                  <WheelColumn
                    values={PERIODS}
                    value={time.period}
                    onChange={(period) => setTime((prev) => ({ ...prev, period }))}
                    renderValue={(period) => period}
                  />
                </View>
              </View>

              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>事件:</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={form.title}
                  onChangeText={(text) => setForm((prev) => ({ ...prev, title: text }))}
                  placeholder=""
                  placeholderTextColor="#B7B7B7"
                />
              </View>

              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>地點:</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={form.location}
                  onChangeText={(text) => setForm((prev) => ({ ...prev, location: text }))}
                  placeholder=""
                  placeholderTextColor="#B7B7B7"
                />
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
    backgroundColor: "#F4F2F0",
  },
  header: {
    backgroundColor: "#F67578",
    paddingTop: 58,
    paddingHorizontal: 22,
    paddingBottom: 22,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  topBarSpacer: {
    width: 34,
    height: 34,
  },
  menuButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  contentCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  content: {
    paddingBottom: 168,
  },
  controlsCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderColor: "#D8D8D8",
    backgroundColor: "#FFF",
  },
  yearRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  yearArrowButton: {
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  yearText: {
    fontSize: 19,
    lineHeight: 24,
    fontWeight: "500",
    color: "#111",
  },
  monthWrap: {
    position: "relative",
  },
  monthButton: {
    minWidth: 180,
    height: 28,
    borderWidth: 0.8,
    borderColor: "#D4D4D4",
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FAFAFA",
  },
  monthButtonText: {
    fontSize: 12,
    color: "#4A4A4A",
  },
  monthMenu: {
    position: "absolute",
    top: 34,
    right: 0,
    width: 180,
    backgroundColor: "#FFF",
    borderRadius: 10,
    borderWidth: 0.8,
    borderColor: "#E4E4E4",
    zIndex: 20,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 5,
  },
  monthMenuItem: {
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  monthMenuItemActive: {
    backgroundColor: "#FFF0F0",
  },
  monthMenuText: {
    fontSize: 13,
    color: "#444",
  },
  monthMenuTextActive: {
    color: "#F67578",
    fontWeight: "700",
  },
  weekRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderColor: "#E5E5E5",
    backgroundColor: "#FFF",
  },
  weekText: {
    width: `${100 / 7}%`,
    paddingVertical: 3,
    textAlign: "left",
    paddingLeft: 4,
    fontSize: 6,
    color: "#8E95A3",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderLeftWidth: 0.5,
    borderTopWidth: 0.5,
    borderColor: "#E5E5E5",
    backgroundColor: "#FFF",
  },
  dayCell: {
    width: `${100 / 7}%`,
    height: 88,
    borderRightWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: "#E5E5E5",
    paddingTop: 4,
    paddingHorizontal: 4,
    backgroundColor: "#FFF",
  },
  dayCellMuted: {
    backgroundColor: "#E7E7E7",
  },
  dayCellSelected: {
    backgroundColor: "#F7C7CB",
  },
  dayNumber: {
    fontSize: 10,
    color: "#202020",
  },
  dayNumberMuted: {
    color: "#A8A8A8",
  },
  dayNumberSelected: {
    color: "#111",
  },
  dayMarkers: {
    marginTop: 34,
    gap: 2,
  },
  dayMarker: {
    height: 8,
    borderRadius: 2,
    width: "86%",
  },
  eventList: {
    paddingHorizontal: 26,
    paddingTop: 32,
    gap: 14,
  },
  eventCard: {
    backgroundColor: "#FFAA59",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 8,
  },
  eventCardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingRight: 56,
  },
  eventCardTime: {
    width: 50,
    fontSize: 15,
    lineHeight: 16,
    color: "#111",
    fontWeight: "500",
  },
  eventCardText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    color: "#111",
    fontWeight: "600",
  },
  eventActions: {
    marginTop: 6,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 2,
  },
  eventActionButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  plusButton: {
    position: "absolute",
    right: 26,
    bottom: 98,
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#F8C5C7",
    alignItems: "center",
    justifyContent: "center",
  },
  phoneButton: {
    position: "absolute",
    left: "50%",
    marginLeft: -28,
    bottom: 102,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#EB5558",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#EB5558",
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  formOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.08)",
    justifyContent: "flex-start",
  },
  formPeekCalendar: {
    marginTop: 112,
    height: 84,
    backgroundColor: "#FFF",
  },
  formPeekGridRow: {
    flexDirection: "row",
    height: "100%",
  },
  formPeekCell: {
    flex: 1,
    borderRightWidth: 0.5,
    borderTopWidth: 0.5,
    borderColor: "#E5E5E5",
    backgroundColor: "#FFF",
  },
  formPeekCellMuted: {
    backgroundColor: "#E7E7E7",
  },
  formPeekCellSelected: {
    backgroundColor: "#F7C7CB",
  },
  formSheet: {
    flex: 1,
    backgroundColor: "#FFF",
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    paddingTop: 8,
    paddingHorizontal: 20,
  },
  formHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  formIconButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
  },
  formConfirmButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  formHeaderIcon: {
    fontSize: 28,
    color: "#111",
    fontWeight: "400",
  },
  formContent: {
    paddingBottom: 40,
    gap: 16,
  },
  colorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    marginBottom: 4,
    paddingLeft: 2,
  },
  colorSwatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2.5,
    borderColor: "transparent",
  },
  colorSwatchSelected: {
    borderColor: "#7A7A7A",
  },
  fieldRow: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 22,
    color: "#111",
    fontWeight: "700",
  },
  fieldInput: {
    height: 34,
    borderRadius: 12,
    backgroundColor: "#DCDDDF",
    paddingHorizontal: 14,
    fontSize: 18,
    color: "#111",
    marginLeft: 74,
    marginTop: -34,
  },
  timeField: {
    minHeight: 170,
    borderRadius: 12,
    backgroundColor: "#FFF",
    marginLeft: 74,
    marginTop: -34,
    flexDirection: "row",
    paddingHorizontal: 6,
  },
  wheelColumn: {
    flex: 1,
    alignItems: "center",
  },
  wheelFrame: {
    width: "100%",
    height: 170,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  wheelSelectedBand: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 68,
    height: 30,
    borderRadius: 8,
    backgroundColor: "#F2F2F2",
  },
  wheelRow: {
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  wheelRowGhost: {
    opacity: 0,
  },
  wheelRowText: {
    fontSize: 13,
    color: "#B9B9B9",
  },
  wheelRowTextSelected: {
    fontSize: 17,
    color: "#111",
    fontWeight: "500",
  },
});
