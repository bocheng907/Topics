import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { db } from "@/firebase/firebaseConfig";
import { useAuth } from "@/src/auth/useAuth";
import { AgendaEventCard, DayAgenda, EventFormSheet, MonthCalendar } from "@/src/calendar/components";
import { useActiveCareTarget } from "@/src/care-target/useActiveCareTarget";
import { calendarCopy } from "@/src/i18n/copy/calendarCopy";
import {
  ensureFirestoreTranslations,
  pickDynamicLocalizedString,
} from "@/src/i18n/dynamicTranslation";
import { translations } from "@/src/i18n/translations";
import { useLanguage } from "@/src/store/LanguageContext";
import { AppAlert as Alert } from "@/src/ui/AppAlert";
import { eventCopy } from "@/src/ui/calendarEventCopy";
import { AppHeader } from "@/src/ui/components";
import { colors, eventColors, layout, radii, shadows, spacing, typography } from "@/src/ui/theme";

type CalendarEventRecord = {
  id: string;
  [key: string]: any;
  patientId?: string;
  createdBy?: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
  completedAt?: Timestamp | null;
  completedBy?: string;
  startAt?: Timestamp | null;
  eventDate?: string;
  hour?: string;
  minute?: string;
  period?: "am" | "pm";
  color?: string;
  isCompleted?: boolean;
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
  resolvedDescription: string;
  resolvedColor: string;
  resolvedIsCompleted: boolean;
  resolvedDate: Date;
};

const CALENDAR_EVENTS_COLLECTION = "calendar_events";
// Persisted in Firestore as `event.color`; same hex values as theme.eventColors.
const EVENT_COLORS: string[] = [...eventColors];

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

function getTodayDate() {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate());
}

function getCurrentMonthStart() {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), 1);
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

function resolveDescription(event: CalendarEventRecord) {
  const titleSource = event.title || event.eventTitle || event.event || "";
  const description = event.description || "";
  return description && description !== titleSource ? description : "";
}

function resolveColor(event: CalendarEventRecord) {
  return event.color || EVENT_COLORS[0];
}

function resolveIsCompleted(event: CalendarEventRecord) {
  return event.isCompleted === true;
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
    resolvedDescription: resolveDescription(event),
    resolvedColor: resolveColor(event),
    resolvedIsCompleted: resolveIsCompleted(event),
    resolvedDate: getEventDateObject(event),
  };
}

function getEventTimeParts(event: CalendarEventViewModel) {
  const { hour, minute, period } = extractTimeParts(event.resolvedDate);
  return {
    time: `${hour}:${pad2(minute)}`,
    period,
  };
}

export default function FamilyCalendarScreen() {
  const { user } = useAuth();
  const { activePatientId } = useActiveCareTarget();
  const { language } = useLanguage();
  const t = translations[language];
  const copy = calendarCopy[language];

  const [currentMonth, setCurrentMonth] = useState(getCurrentMonthStart);
  const [selectedDate, setSelectedDate] = useState(getTodayDate);
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
  const [savingEvent, setSavingEvent] = useState(false);
  const [formError, setFormError] = useState("");

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

  const [previousMonth, setPreviousMonth] = useState(currentMonth);
  if (previousMonth !== currentMonth) {
    setPreviousMonth(currentMonth);
    setMonthMenuOpen(false);
  }
  const [previousPatientId, setPreviousPatientId] = useState(activePatientId);
  if (previousPatientId !== activePatientId) {
    setPreviousPatientId(activePatientId);
    setEvents([]);
  }

  useEffect(() => {
    if (!activePatientId) return;

    const q = query(
      collection(db, CALENDAR_EVENTS_COLLECTION),
      where("patientId", "==", activePatientId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setEvents(
          [...snap.docs]
            .sort((a, b) => (b.data().createdAt?.toMillis?.() ?? 0) - (a.data().createdAt?.toMillis?.() ?? 0))
            .map((docSnap) => ({
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

  useEffect(() => {
    if (language === "zh") return;

    events.forEach((event) => {
      void ensureFirestoreTranslations(
        doc(db, CALENDAR_EVENTS_COLLECTION, event.id),
        event,
        language,
        [
          { baseName: "name", sourceKeys: ["name", "personName", "patientName"] },
          { baseName: "title", sourceKeys: ["title", "eventTitle", "event", "description"] },
          { baseName: "location", sourceKeys: ["location", "place"] },
          { baseName: "description", sourceKeys: ["description"] },
        ]
      );
    });
  }, [events, language]);

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
    setFormError("");
    // UI default only: next full hour when adding for today, otherwise 9:00 AM.
    const now = new Date();
    if (sameDate(selectedDate, now)) {
      const nextHour = new Date(now);
      nextHour.setHours(now.getHours() + 1, 0, 0, 0);
      if (sameDate(nextHour, now)) {
        const parts = extractTimeParts(nextHour);
        setFormHour(parts.hour);
        setFormMinute(parts.minute);
        setFormPeriod(parts.period);
      }
    } else {
      setFormHour(9);
      setFormMinute(0);
      setFormPeriod("am");
    }
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
    setFormError("");
    setFormOpen(true);
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
      name_zh: form.personName.trim(),
      title: form.title.trim(),
      eventTitle: form.title.trim(),
      title_zh: form.title.trim(),
      location: form.location.trim(),
      location_zh: form.location.trim(),
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
          isCompleted: false,
          ...payload,
        });
      }

      setFormOpen(false);
      resetForm();
    } catch (error) {
      console.log("save calendar event failed:", error);
      setFormError(copy.saveFailed);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    try {
      await deleteDoc(doc(db, CALENDAR_EVENTS_COLLECTION, eventId));
    } catch (error) {
      console.log("delete calendar event failed:", error);
    }
  };

  const confirmDeleteEvent = (eventId: string) => {
    const deleteCopy = eventCopy[language];
    Alert.alert(deleteCopy.title, deleteCopy.confirm, [
      { text: deleteCopy.cancel, style: "cancel" },
      { text: deleteCopy.remove, style: "destructive", onPress: () => void handleDeleteEvent(eventId) },
    ]);
  };

  const handleToggleEventCompleted = async (event: CalendarEventViewModel) => {
    if (!user?.uid) return;

    const nextIsCompleted = !event.resolvedIsCompleted;

    setEvents((prevEvents) =>
      prevEvents.map((item) => (item.id === event.id ? { ...item, isCompleted: nextIsCompleted } : item))
    );

    try {
      const completionPayload = nextIsCompleted
        ? {
            completedAt: serverTimestamp(),
            completedBy: user.uid,
          }
        : {
            completedAt: null,
            completedBy: "",
          };

      await updateDoc(doc(db, CALENDAR_EVENTS_COLLECTION, event.id), {
        isCompleted: nextIsCompleted,
        ...completionPayload,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.log("toggle calendar event completed failed:", error);
      setEvents((prevEvents) =>
        prevEvents.map((item) => (item.id === event.id ? { ...item, isCompleted: event.resolvedIsCompleted } : item))
      );
    }
  };

  /* ---------------------------------------------------- UI-only helpers */

  const markersByDay = useMemo(() => {
    const map = new Map<string, string[]>();
    monthEvents.forEach((event) => {
      const key = formatEventDateKey(event.resolvedDate);
      const list = map.get(key);
      if (list) list.push(event.resolvedColor);
      else map.set(key, [event.resolvedColor]);
    });
    return map;
  }, [monthEvents]);

  const markersFor = (date: Date) => markersByDay.get(formatEventDateKey(date)) ?? [];

  const selectDay = (date: Date) => {
    setSelectedDate(new Date(date.getFullYear(), date.getMonth(), date.getDate()));
    setCurrentMonth(new Date(date.getFullYear(), date.getMonth(), 1));
  };

  const shiftMonth = (diff: number) => handleMonthSelect(currentMonth.getMonth() + diff);

  const pickMonth = (year: number, monthIndex: number) =>
    handleMonthSelect((year - currentMonth.getFullYear()) * 12 + monthIndex);

  const shiftFormDate = (diffDays: number) =>
    selectDay(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() + diffDays));

  const closeForm = () => {
    setFormOpen(false);
    resetForm();
    setFormError("");
  };

  const handleSaveEvent = async () => {
    if (savingEvent) return;
    // Same preconditions confirmEvent() checks; surfaced inline instead of failing silently.
    if (!user?.uid) {
      setFormError(copy.needSignIn);
      return;
    }
    if (!activePatientId) {
      setFormError(copy.needCareTarget);
      return;
    }
    setFormError("");
    setSavingEvent(true);
    try {
      await confirmEvent();
    } finally {
      setSavingEvent(false);
    }
  };

  return (
    <View style={styles.screen}>
      <AppHeader title={t.navCalendar} left="menu" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.column}>
          <MonthCalendar
            month={currentMonth}
            selectedDate={selectedDate}
            cells={calendarCells}
            markersFor={markersFor}
            pickerOpen={monthMenuOpen}
            onTogglePicker={() => setMonthMenuOpen((prev) => !prev)}
            onSelectDate={selectDay}
            onShiftMonth={shiftMonth}
            onPickMonth={pickMonth}
            onToday={() => selectDay(getTodayDate())}
          />

          <DayAgenda date={selectedDate} count={selectedDayEvents.length} onAdd={openCreateForm}>
            {selectedDayEvents.map((event) => {
              const eventTime = getEventTimeParts(event);
              const eventPersonName = pickDynamicLocalizedString(
                event,
                "name",
                language,
                ["name", "personName", "patientName"],
                event.resolvedPersonName
              );
              const eventTitle = pickDynamicLocalizedString(
                event,
                "title",
                language,
                ["title", "eventTitle", "event", "description"],
                event.resolvedTitle
              );
              const eventLocation = pickDynamicLocalizedString(
                event,
                "location",
                language,
                ["location", "place"],
                event.resolvedLocation
              );
              const eventDescription = pickDynamicLocalizedString(
                event,
                "description",
                language,
                ["description"],
                event.resolvedDescription
              );

              return (
                <AgendaEventCard
                  key={event.id}
                  time={eventTime.time}
                  period={eventTime.period === "am" ? copy.am : copy.pm}
                  color={event.resolvedColor}
                  title={eventTitle || eventPersonName || t.unnamedRecord}
                  person={eventTitle && eventPersonName !== eventTitle ? eventPersonName : ""}
                  location={eventLocation}
                  description={eventDescription}
                  completed={event.resolvedIsCompleted}
                  onToggleComplete={() => handleToggleEventCompleted(event)}
                  onEdit={() => openEditForm(event)}
                  onDelete={() => confirmDeleteEvent(event.id)}
                />
              );
            })}
          </DayAgenda>
        </View>
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copy.addEvent}
        onPress={openCreateForm}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
      >
        <Ionicons name="add" size={26} color={colors.onPrimary} />
        <Text style={styles.fabText}>{copy.addEvent}</Text>
      </Pressable>

      <EventFormSheet
        visible={formOpen}
        editing={editingEventId !== null}
        values={form}
        onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
        date={selectedDate}
        onShiftDate={shiftFormDate}
        hour={formHour}
        minute={formMinute}
        period={formPeriod}
        onChangeHour={setFormHour}
        onChangeMinute={setFormMinute}
        onChangePeriod={setFormPeriod}
        error={formError}
        saving={savingEvent}
        onCancel={closeForm}
        onSave={() => void handleSaveEvent()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  content: {
    paddingHorizontal: layout.screenPaddingX,
    paddingTop: spacing.lg,
    paddingBottom: 112,
  },
  column: {
    width: "100%",
    maxWidth: layout.maxContentWidth,
    alignSelf: "center",
    gap: spacing.xl,
  },
  fab: {
    position: "absolute",
    right: spacing.lg,
    bottom: spacing.lg,
    minHeight: 56,
    paddingLeft: spacing.lg,
    paddingRight: spacing.xl,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    ...shadows.fab,
  },
  fabPressed: { backgroundColor: colors.primaryPressed },
  fabText: { ...typography.bodyStrong, color: colors.onPrimary },
});
