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

const CALENDAR_EVENTS_COLLECTION = "calendar_events";
const YEAR = 2026;
const MONTH_LABELS = Array.from({ length: 12 }, (_, index) => `${index + 1}`);
const WEEK_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const EVENT_COLORS = ["#F4A261", "#6C63FF", "#2F80ED", "#E56BDF", "#2EC4B6"];
const HOURS = Array.from({ length: 12 }, (_, index) => index + 1);
const MINUTES = Array.from({ length: 60 }, (_, index) => index);
const PERIODS: Array<TimeState["period"]> = ["am", "pm"];

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

function WheelColumn<T extends string | number>({
  title,
  values,
  value,
  onChange,
  renderValue,
}: {
  title: string;
  values: T[];
  value: T;
  onChange: (value: T) => void;
  renderValue: (value: T) => string;
}) {
  const selectedIndex = values.findIndex((item) => item === value);
  const visibleIndices = Array.from({ length: 5 }, (_, index) => selectedIndex - 2 + index);

  return (
    <View style={styles.wheelColumn}>
      <Text style={styles.wheelTitle}>{title}</Text>
      <View style={styles.wheelFrame}>
        {visibleIndices.map((index, rowIndex) => {
          const item = values[index];
          const isSelected = rowIndex === 2;

          if (item === undefined) {
            return (
              <View
                key={`${title}-empty-${rowIndex}`}
                style={[styles.wheelRow, styles.wheelRowGhost]}
              />
            );
          }

          return (
            <Pressable
              key={`${title}-${renderValue(item)}`}
              onPress={() => onChange(item)}
              style={[styles.wheelRow, isSelected && styles.wheelRowSelected]}
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

  const [month, setMonth] = useState(3);
  const [selectedDay, setSelectedDay] = useState(8);
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
  const calendarCells = useMemo(() => buildCalendarCells(YEAR, month), [month]);
  const monthKey = useMemo(() => `${YEAR}-${pad2(month + 1)}`, [month]);

  const monthEvents = useMemo(
    () => events.filter((event) => toMonthKey(event.eventDate) === monthKey),
    [events, monthKey]
  );
  const selectedDayEvents = monthEvents.filter(
    (event) => Number(toDayKey(event.eventDate)) === selectedDay
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

  const renderDayCell = (day: number | null, index: number) => {
    if (!day) {
      return <View key={`empty-${index}`} style={styles.dayCell} />;
    }

    const dayEvents = monthEvents
      .filter((event) => Number(toDayKey(event.eventDate)) === day)
      .slice(0, 2);
    const isSelected = day === selectedDay;

    return (
      <Pressable
        key={`day-${day}`}
        onPress={() => setSelectedDay(day)}
        style={[styles.dayCell, isSelected && styles.dayCellSelected]}
      >
        <Text style={[styles.dayNumber, isSelected && styles.dayNumberSelected]}>{day}</Text>

        <View style={styles.eventStack}>
          {dayEvents.map((event) => (
            <View key={event.id} style={[styles.eventChip, { backgroundColor: event.color }]}>
              <Text style={styles.eventChipText} numberOfLines={1}>
                {event.title}
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
                <Text style={styles.monthChevron}>v</Text>
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
            {WEEK_LABELS.map((day) => (
              <Text key={day} style={styles.weekText}>
                {day}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>
            {calendarCells.map((cell, index) => renderDayCell(cell, index))}
          </View>

          <View style={styles.selectedSummary}>
            <Text style={styles.selectedSummaryTitle}>{selectedDay} Events</Text>
            {selectedDayEvents.length === 0 ? (
              <Text style={styles.emptySummaryText}>No events today</Text>
            ) : (
              selectedDayEvents.map((event) => (
                <View key={event.id} style={styles.summaryCard}>
                  <View style={[styles.summaryDot, { backgroundColor: event.color }]} />
                  <View style={styles.summaryBody}>
                    <Text style={styles.summaryTitle}>
                      {event.hour}:{event.minute} {event.period} {event.title}
                    </Text>
                    <Text style={styles.summaryMeta}>
                      {event.personName} - {event.location}
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
                <Text style={styles.formHeaderIcon}>X</Text>
              </Pressable>
              <Pressable onPress={confirmNewEvent} hitSlop={12}>
                <Text style={styles.formHeaderIcon}>{"\u2713"}</Text>
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.formContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Color</Text>
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

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Name</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={form.personName}
                  onChangeText={(text) => setForm((prev) => ({ ...prev, personName: text }))}
                  placeholder="Enter name"
                  placeholderTextColor="#B7B7B7"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Time</Text>
                <View style={styles.timePicker}>
                  <WheelColumn
                    title="Hour"
                    values={HOURS}
                    value={time.hour}
                    onChange={(hour) => setTime((prev) => ({ ...prev, hour }))}
                    renderValue={(hour) => String(hour)}
                  />
                  <WheelColumn
                    title="Min"
                    values={MINUTES}
                    value={time.minute}
                    onChange={(minute) => setTime((prev) => ({ ...prev, minute }))}
                    renderValue={(minute) => pad2(minute)}
                  />
                  <WheelColumn
                    title="AM / PM"
                    values={PERIODS}
                    value={time.period}
                    onChange={(period) => setTime((prev) => ({ ...prev, period }))}
                    renderValue={(period) => period}
                  />
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Event</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={form.title}
                  onChangeText={(text) => setForm((prev) => ({ ...prev, title: text }))}
                  placeholder="Enter event"
                  placeholderTextColor="#B7B7B7"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Location</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={form.location}
                  onChangeText={(text) => setForm((prev) => ({ ...prev, location: text }))}
                  placeholder="Enter location"
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
    paddingBottom: 220,
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
    bottom: 26,
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
  timePicker: {
    flexDirection: "row",
    gap: 10,
  },
  wheelColumn: {
    flex: 1,
  },
  wheelTitle: {
    fontSize: 12,
    color: "#8B8B8B",
    fontWeight: "700",
    marginBottom: 6,
    textAlign: "center",
  },
  wheelFrame: {
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#F7F7F8",
    borderWidth: 1,
    borderColor: "#E7E7E7",
  },
  wheelRow: {
    height: 42,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  wheelRowGhost: {
    opacity: 0,
  },
  wheelRowSelected: {
    backgroundColor: "#EDEFF2",
  },
  wheelRowText: {
    fontSize: 16,
    color: "#666",
    fontWeight: "700",
  },
  wheelRowTextSelected: {
    color: "#111",
    fontSize: 18,
  },
});
