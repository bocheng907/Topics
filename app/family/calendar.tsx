import { Feather, Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { db } from "@/firebase/firebaseConfig";
import { useAuth } from "@/src/auth/useAuth";
import { useActiveCareTarget } from "@/src/care-target/useActiveCareTarget";

type CalendarEventRecord = {
  id: string;
  patientId?: string;
  createdBy?: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
  startAt?: Timestamp | null;
  eventDate?: string;
  hour?: string;
  minute?: string;
  period?: "am" | "pm";
  color?: string;
  personName?: string;
  name?: string;
  patientName?: string;
  title?: string;
  eventTitle?: string;
  event?: string;
  description?: string;
  location?: string;
  place?: string;
};

type FormState = {
  personName: string;
  title: string;
  location: string;
  color: string;
};

type TimePeriod = "am" | "pm";

type CalendarCell = {
  day: number;
  kind: "prev" | "current" | "next";
  date: Date;
};

type CalendarEventViewModel = CalendarEventRecord & {
  resolvedPersonName: string;
  resolvedTitle: string;
  resolvedLocation: string;
  resolvedColor: string;
  resolvedDate: Date;
};

const CALENDAR_EVENTS_COLLECTION = "calendar_events";
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
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
const PERIODS: TimePeriod[] = ["am", "pm"];

function pad2(value: number | string) {
  return String(value).padStart(2, "0");
}

function sameDate(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function to24Hour(hour12: number, period: TimePeriod) {
  if (period === "am") {
    return hour12 === 12 ? 0 : hour12;
  }

  return hour12 === 12 ? 12 : hour12 + 12;
}

function buildEventDate(selectedDate: Date, hour: number, minute: number, period: TimePeriod) {
  const next = new Date(selectedDate);
  next.setHours(to24Hour(hour, period), minute, 0, 0);
  return next;
}

function extractTimeParts(date: Date) {
  const rawMinute = Math.round(date.getMinutes() / 5) * 5;
  const minute = rawMinute >= 60 ? 55 : rawMinute;
  const hour24 = date.getHours();
  const period: TimePeriod = hour24 >= 12 ? "pm" : "am";
  const hour = hour24 % 12 === 0 ? 12 : hour24 % 12;

  return { hour, minute, period };
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getMonthMeta(currentMonth: Date) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = getDaysInMonth(year, month);
  const prevMonthDays = getDaysInMonth(year, month - 1);
  const cells: CalendarCell[] = [];

  for (let i = 0; i < firstWeekday; i += 1) {
    const day = prevMonthDays - firstWeekday + i + 1;
    cells.push({
      day,
      kind: "prev",
      date: new Date(year, month - 1, day),
    });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({
      day,
      kind: "current",
      date: new Date(year, month, day),
    });
  }

  while (cells.length < 35) {
    const day = cells.length - (firstWeekday + daysInMonth) + 1;
    cells.push({
      day,
      kind: "next",
      date: new Date(year, month + 1, day),
    });
  }

  while (cells.length % 7 !== 0) {
    const day = cells.length - (firstWeekday + daysInMonth) + 1;
    cells.push({
      day,
      kind: "next",
      date: new Date(year, month + 1, day),
    });
  }

  return cells;
}

function formatEventDateKey(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function resolveTitle(event: CalendarEventRecord) {
  return event.title || event.eventTitle || event.event || event.description || "";
}

function resolvePersonName(event: CalendarEventRecord) {
  return event.name || event.personName || event.patientName || "";
}

function resolveLocation(event: CalendarEventRecord) {
  return event.location || event.place || "";
}

function resolveColor(event: CalendarEventRecord) {
  return event.color || EVENT_COLORS[0];
}

function getEventDateObject(event: CalendarEventRecord) {
  if (event.startAt instanceof Timestamp) {
    return event.startAt.toDate();
  }

  if (event.eventDate) {
    const [year, month, day] = event.eventDate.split("-").map(Number);
    const hour = Number(event.hour) || 7;
    const minute = Number(event.minute) || 0;
    return buildEventDate(
      new Date(year, (month || 1) - 1, day || 1),
      hour,
      minute,
      event.period || "pm"
    );
  }

  return buildEventDate(new Date(), 7, 0, "pm");
}

function toCalendarEventViewModel(event: CalendarEventRecord): CalendarEventViewModel {
  return {
    ...event,
    resolvedPersonName: resolvePersonName(event),
    resolvedTitle: resolveTitle(event),
    resolvedLocation: resolveLocation(event),
    resolvedColor: resolveColor(event),
    resolvedDate: getEventDateObject(event),
  };
}

function formatEventTime(event: CalendarEventViewModel) {
  const { hour, minute, period } = extractTimeParts(event.resolvedDate);
  return `${hour}:${pad2(minute)} ${period}`;
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

export default function FamilyCalendarScreen() {
  const { user } = useAuth();
  const { activePatientId } = useActiveCareTarget();

  const [currentMonth, setCurrentMonth] = useState(() => new Date(2026, 8, 1));
  const [selectedDate, setSelectedDate] = useState(() => new Date(2026, 8, 18));
  const [monthMenuOpen, setMonthMenuOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [events, setEvents] = useState<CalendarEventRecord[]>([]);
  const [form, setForm] = useState<FormState>({
    personName: "",
    title: "",
    location: "",
    color: EVENT_COLORS[0],
  });
  const [formHour, setFormHour] = useState(7);
  const [formMinute, setFormMinute] = useState(0);
  const [formPeriod, setFormPeriod] = useState<TimePeriod>("pm");

  const calendarCells = useMemo(() => getMonthMeta(currentMonth), [currentMonth]);

  const monthEvents = useMemo(() => {
    return events
      .map(toCalendarEventViewModel)
      .filter(
        (event) =>
          event.resolvedDate.getFullYear() === currentMonth.getFullYear() &&
          event.resolvedDate.getMonth() === currentMonth.getMonth()
      )
      .sort((left, right) => left.resolvedDate.getTime() - right.resolvedDate.getTime());
  }, [events, currentMonth]);

  const selectedDayEvents = useMemo(
    () => monthEvents.filter((event) => sameDate(event.resolvedDate, selectedDate)),
    [monthEvents, selectedDate]
  );

  useEffect(() => {
    setMonthMenuOpen(false);
  }, [currentMonth]);

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
        console.log("family calendar snapshot failed:", error);
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
    setFormHour(7);
    setFormMinute(0);
    setFormPeriod("pm");
    setEditingEventId(null);
  };

  const openCreateForm = () => {
    resetForm();
    setFormOpen(true);
  };

  const openEditForm = (event: CalendarEventViewModel) => {
    const timeParts = extractTimeParts(event.resolvedDate);
    setSelectedDate(
      new Date(
        event.resolvedDate.getFullYear(),
        event.resolvedDate.getMonth(),
        event.resolvedDate.getDate()
      )
    );
    setCurrentMonth(new Date(event.resolvedDate.getFullYear(), event.resolvedDate.getMonth(), 1));
    setForm({
      personName: event.resolvedPersonName,
      title: event.resolvedTitle,
      location: event.resolvedLocation,
      color: event.resolvedColor,
    });
    setFormHour(timeParts.hour);
    setFormMinute(timeParts.minute);
    setFormPeriod(timeParts.period);
    setEditingEventId(event.id);
    setFormOpen(true);
  };

  const handleYearChange = (diff: number) => {
    const nextMonth = new Date(currentMonth.getFullYear() + diff, currentMonth.getMonth(), 1);
    const nextSelectedDate = new Date(
      nextMonth.getFullYear(),
      nextMonth.getMonth(),
      Math.min(selectedDate.getDate(), getDaysInMonth(nextMonth.getFullYear(), nextMonth.getMonth()))
    );
    setCurrentMonth(nextMonth);
    setSelectedDate(nextSelectedDate);
  };

  const handleMonthSelect = (nextMonthIndex: number) => {
    const nextMonth = new Date(currentMonth.getFullYear(), nextMonthIndex, 1);
    const nextSelectedDate = new Date(
      nextMonth.getFullYear(),
      nextMonth.getMonth(),
      Math.min(selectedDate.getDate(), getDaysInMonth(nextMonth.getFullYear(), nextMonth.getMonth()))
    );
    setCurrentMonth(nextMonth);
    setSelectedDate(nextSelectedDate);
  };

  const confirmEvent = async () => {
    if (!activePatientId || !user?.uid) return;

    const startDate = buildEventDate(selectedDate, formHour, formMinute, formPeriod);
    const eventDate = formatEventDateKey(startDate);
    const payload = {
      name: form.personName.trim(),
      personName: form.personName.trim(),
      title: form.title.trim(),
      eventTitle: form.title.trim(),
      location: form.location.trim(),
      color: form.color,
      startAt: Timestamp.fromDate(startDate),
      eventDate,
      hour: String(formHour),
      minute: pad2(formMinute),
      period: formPeriod,
      updatedAt: serverTimestamp(),
    };

    try {
      if (editingEventId) {
        await updateDoc(doc(db, CALENDAR_EVENTS_COLLECTION, editingEventId), payload);
      } else {
        await addDoc(collection(db, CALENDAR_EVENTS_COLLECTION), {
          patientId: activePatientId,
          createdBy: user.uid,
          createdAt: serverTimestamp(),
          ...payload,
        });
      }

      setFormOpen(false);
      resetForm();
    } catch (error) {
      console.log("save calendar event failed:", error);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    try {
      await deleteDoc(doc(db, CALENDAR_EVENTS_COLLECTION, eventId));
    } catch (error) {
      console.log("delete calendar event failed:", error);
    }
  };

  const renderDayCell = (cell: CalendarCell, index: number) => {
    const dayEvents = monthEvents.filter((event) => sameDate(event.resolvedDate, cell.date));
    const isSelected = sameDate(cell.date, selectedDate);

    return (
      <Pressable
        key={`${cell.kind}-${cell.day}-${index}`}
        onPress={() => {
          setSelectedDate(new Date(cell.date.getFullYear(), cell.date.getMonth(), cell.date.getDate()));
          setCurrentMonth(new Date(cell.date.getFullYear(), cell.date.getMonth(), 1));
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
            <View key={event.id} style={[styles.dayMarker, { backgroundColor: event.resolvedColor }]} />
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
              <Pressable onPress={() => handleYearChange(-1)} hitSlop={10} style={styles.yearArrowButton}>
                <Ionicons name="caret-back" size={16} color="#2B2B2B" />
              </Pressable>
              <Text style={styles.yearText}>{currentMonth.getFullYear()}</Text>
              <Pressable onPress={() => handleYearChange(1)} hitSlop={10} style={styles.yearArrowButton}>
                <Ionicons name="caret-forward" size={16} color="#2B2B2B" />
              </Pressable>
            </View>

            <View style={styles.monthWrap}>
              <Pressable onPress={() => setMonthMenuOpen((prev) => !prev)} style={styles.monthButton}>
                <Text style={styles.monthButtonText}>{MONTH_LABELS[currentMonth.getMonth()]}</Text>
                <Ionicons name="chevron-down" size={16} color="#4A4A4A" />
              </Pressable>

              {monthMenuOpen && (
                <View style={styles.monthMenu}>
                  {MONTH_LABELS.map((label, index) => (
                    <Pressable
                      key={label}
                      onPress={() => handleMonthSelect(index)}
                      style={[
                        styles.monthMenuItem,
                        index === currentMonth.getMonth() && styles.monthMenuItemActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.monthMenuText,
                          index === currentMonth.getMonth() && styles.monthMenuTextActive,
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
                      {event.resolvedPersonName}
                    </Text>
                    <Text style={styles.eventCardText} numberOfLines={1}>
                      {event.resolvedTitle}
                    </Text>
                    <Text style={styles.eventCardText} numberOfLines={1}>
                      {event.resolvedLocation}
                    </Text>
                  </View>

                  <View style={styles.eventActions}>
                    <Pressable hitSlop={8} style={styles.eventActionButton} onPress={() => openEditForm(event)}>
                      <Feather name="edit-2" size={22} color="#1F2430" />
                    </Pressable>
                    <Pressable
                      hitSlop={8}
                      style={styles.eventActionButton}
                      onPress={() => handleDeleteEvent(event.id)}
                    >
                      <Ionicons name="trash-outline" size={24} color="#1F2430" />
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </View>

      <Pressable style={styles.plusButton} onPress={openCreateForm}>
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
              <Pressable
                onPress={() => {
                  setFormOpen(false);
                  resetForm();
                }}
                hitSlop={12}
                style={styles.formIconButton}
              >
                <Text style={styles.formHeaderIcon}>X</Text>
              </Pressable>
              <Pressable onPress={confirmEvent} hitSlop={12} style={styles.formConfirmButton}>
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
                    value={formHour}
                    onChange={setFormHour}
                    renderValue={(hour) => String(hour)}
                  />
                  <WheelColumn
                    values={MINUTES}
                    value={formMinute}
                    onChange={setFormMinute}
                    renderValue={(minute) => pad2(minute)}
                  />
                  <WheelColumn
                    values={PERIODS}
                    value={formPeriod}
                    onChange={setFormPeriod}
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
