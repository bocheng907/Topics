import { AppAlert as Alert } from "@/src/ui/AppAlert";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { auth, db } from "@/firebase/firebaseConfig";
import { useAuth } from "@/src/auth/useAuth";
import {
  AgendaEventCard,
  DailyChecklistCard,
  DayAgenda,
  EventFormSheet,
  MonthCalendar,
} from "@/src/calendar/components";
import { useActiveCareTarget } from "@/src/care-target/useActiveCareTarget";
import { makeDailyChecklistDocumentId } from "@/src/data/firestoreDocumentIds";
import { calendarCopy } from "@/src/i18n/copy/calendarCopy";
import {
  ensureFirestoreTranslations,
  pickDynamicLocalizedString,
} from "@/src/i18n/dynamicTranslation";
import { translations, type Language } from "@/src/i18n/translations";
import { userErrorCopy } from "@/src/ui/userErrorMessages";
import { useLanguage } from "@/src/store/LanguageContext";
import { eventCopy } from "@/src/ui/calendarEventCopy";
import { AppHeader, KeyboardAwareScroll } from "@/src/ui/components";
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

type DailyChecklistItem = {
  id: string;
  title: string;
  title_en?: string;
  title_vi?: string;
  title_id?: string;
  completed: boolean;
  isCompleted?: boolean;
  isDefault: boolean;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
  completedAt?: Timestamp | null;
  createdBy: string;
  caregiverId: string;
  patientId: string;
  dateKey: string;
  dailyChecklistDocId?: string;
};

const CALENDAR_EVENTS_COLLECTION = "calendar_events";
const DEFAULT_DAILY_CHECKLIST_ITEMS = ["喝水1500cc", "運動30分鐘", "睡前關懷"];
const DEFAULT_DAILY_CHECKLIST_TRANSLATION_KEYS = [
  "dailyChecklistDefaultWater",
  "dailyChecklistDefaultExercise",
  "dailyChecklistDefaultCare",
] as const;
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

// Readable and unique per save: {eventDate}_{HH-mm-ss-SSS}_{patient suffix}.
// (A date-only ID made every new event on the same day overwrite the previous one.)
function makeCalendarEventDocId(eventDate: string, activePatientId?: string | null, now = new Date()) {
  const patientSuffix = activePatientId?.trim().slice(-4);
  if (!patientSuffix) return "";
  const timePart = `${pad2(now.getHours())}-${pad2(now.getMinutes())}-${pad2(now.getSeconds())}-${String(now.getMilliseconds()).padStart(3, "0")}`;
  return `${eventDate}_${timePart}_${patientSuffix}`;
}

function makeLegacyTopLevelDailyChecklistDocIds(
  dateKey: string,
  patientDocId?: string,
  patientsId?: string
) {
  const ids = new Set<string>();
  const docId = patientDocId?.trim() ?? "";
  const patientCode = docId.match(/(?:^|_)pat_([A-Za-z0-9]+)$/)?.[1];

  if (patientCode) ids.add(`${dateKey}_pat_${patientCode}`);
  if (patientsId?.trim()) ids.add(`${dateKey}_${patientsId.trim()}`);
  if (!patientCode && docId) ids.add(`${dateKey}_${docId}`);

  return [...ids];
}

function makeLegacyDailyChecklistDocId(dateKey: string, patientId?: string | null) {
  const patientSuffix = patientId?.trim().slice(-4);
  if (!patientSuffix) return "";
  return `${dateKey}_${patientSuffix}`;
}

function getDailyChecklistItemTitle(
  item: DailyChecklistItem,
  t: (typeof translations)[keyof typeof translations],
  language: Language
) {
  const defaultIndex = DEFAULT_DAILY_CHECKLIST_ITEMS.indexOf(item.title);
  if (item.isDefault && defaultIndex >= 0) {
    return t[DEFAULT_DAILY_CHECKLIST_TRANSLATION_KEYS[defaultIndex]] || item.title;
  }

  return pickDynamicLocalizedString(item, "title", language, ["title"], item.title);
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

export default function CaregiverCalendarScreen() {
  const { user } = useAuth();
  const { activePatientId, activePatient } = useActiveCareTarget();
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
  const [dailyChecklistItems, setDailyChecklistItems] = useState<DailyChecklistItem[]>([]);
  const [dailyChecklistExpanded, setDailyChecklistExpanded] = useState(true);
  const [dailyChecklistInput, setDailyChecklistInput] = useState("");
  const [editingChecklistItemId, setEditingChecklistItemId] = useState<string | null>(null);
  const [dailyChecklistError, setDailyChecklistError] = useState("");
  const dailyChecklistInitializationRef = useRef<string | null>(null);

  const calendarCells = useMemo(() => getMonthMeta(currentMonth), [currentMonth]);
  const selectedDateKey = useMemo(() => formatEventDateKey(selectedDate), [selectedDate]);
  const activePatientsId = activePatient?.patientsId ?? "";
  const dailyChecklistDocId = useMemo(
    () => {
      if (!activePatientId && !activePatientsId) return "";
      return makeDailyChecklistDocumentId(selectedDateKey, {
        patientDocId: activePatientId,
        patientsId: activePatientsId,
      });
    },
    [activePatientId, activePatientsId, selectedDateKey]
  );
  const legacyTopLevelChecklistDocIds = useMemo(
    () =>
      makeLegacyTopLevelDailyChecklistDocIds(
        selectedDateKey,
        activePatientId ?? "",
        activePatientsId
      ).filter((id) => id !== dailyChecklistDocId),
    [activePatientId, activePatientsId, dailyChecklistDocId, selectedDateKey]
  );
  const legacyPatientDocChecklistDocId = useMemo(
    () => makeLegacyDailyChecklistDocId(selectedDateKey, activePatientId),
    [activePatientId, selectedDateKey]
  );
  const legacyPatientsIdChecklistDocId = useMemo(
    () => makeLegacyDailyChecklistDocId(selectedDateKey, activePatientsId),
    [activePatientsId, selectedDateKey]
  );

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

  const sortedDailyChecklistItems = useMemo(() => {
    return [...dailyChecklistItems].sort((left, right) => {
      const leftDefaultIndex = DEFAULT_DAILY_CHECKLIST_ITEMS.indexOf(left.title);
      const rightDefaultIndex = DEFAULT_DAILY_CHECKLIST_ITEMS.indexOf(right.title);

      if (left.isDefault && right.isDefault && leftDefaultIndex !== rightDefaultIndex) {
        return leftDefaultIndex - rightDefaultIndex;
      }

      if (left.isDefault !== right.isDefault) return left.isDefault ? -1 : 1;

      const leftTime = left.createdAt?.toMillis?.() ?? 0;
      const rightTime = right.createdAt?.toMillis?.() ?? 0;
      return leftTime - rightTime;
    });
  }, [dailyChecklistItems]);

  const completedChecklistCount = useMemo(
    () => dailyChecklistItems.filter((item) => item.completed).length,
    [dailyChecklistItems]
  );

  const [previousMonth, setPreviousMonth] = useState(currentMonth);
  if (previousMonth !== currentMonth) {
    setPreviousMonth(currentMonth);
    setMonthMenuOpen(false);
  }
  const checklistScope = `${user?.uid}:${activePatientId}:${selectedDateKey}`;
  const [previousChecklistScope, setPreviousChecklistScope] = useState(checklistScope);
  if (previousChecklistScope !== checklistScope) {
    setPreviousChecklistScope(checklistScope);
    setDailyChecklistInput("");
    setEditingChecklistItemId(null);
    setDailyChecklistExpanded(true);
    setDailyChecklistItems([]);
    setDailyChecklistError("");
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
        console.log("caregiver calendar snapshot failed:", error);
        setEvents([]);
      }
    );

    return () => unsubscribe();
  }, [activePatientId]);

  useEffect(() => {
    if (!activePatientId || !user?.uid) return;

    const checklistRef = doc(db, "daily_checklist_items", dailyChecklistDocId);
    const itemsRef = collection(db, "daily_checklist_items", dailyChecklistDocId, "items");
    const legacyItemRefs = [
      ...legacyTopLevelChecklistDocIds.map((legacyDocId) =>
        collection(db, "daily_checklist_items", legacyDocId, "items")
      ),
      ...(legacyPatientDocChecklistDocId
        ? [
            collection(
              db,
              "patients",
              activePatientId,
              "daily_checklists",
              legacyPatientDocChecklistDocId,
              "items"
            ),
          ]
        : []),
      ...(legacyPatientsIdChecklistDocId &&
      legacyPatientsIdChecklistDocId !== legacyPatientDocChecklistDocId
        ? [
            collection(
              db,
              "patients",
              activePatientId,
              "daily_checklists",
              legacyPatientsIdChecklistDocId,
              "items"
            ),
          ]
        : []),
      collection(
        db,
        "patients",
        activePatientId,
        "daily_checklists",
        selectedDateKey,
        "items"
      ),
    ];

    const ensureDailyChecklistParent = async () => {
      console.log("daily checklist parent write:", {
        activePatientId,
        uid: user.uid,
        dailyChecklistDocId,
        parentPath: checklistRef.path,
        itemsPath: itemsRef.path,
      });
      await setDoc(
        checklistRef,
        {
          patientId: activePatientId,
          patientsId: activePatientsId,
          dateKey: selectedDateKey,
          dailyChecklistDocId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: user.uid,
        },
        { merge: true }
      );
    };

    const migrateLegacyItems = async () => {
      try {
        const flatLegacySnap = await getDocs(
          query(
            collection(db, "daily_checklist_items"),
            where("patientId", "==", activePatientId),
            where("dateKey", "==", selectedDateKey)
          )
        );
        let oldDocs = flatLegacySnap.docs.filter((legacyDoc) => {
          const legacyData = legacyDoc.data() as Partial<DailyChecklistItem>;
          return typeof legacyData.title === "string";
        });

        if (oldDocs.length === 0) {
          for (const legacyItemsRef of legacyItemRefs) {
            const candidateSnap = await getDocs(
              query(legacyItemsRef, where("patientId", "==", activePatientId))
            );
            if (!candidateSnap.empty) {
              oldDocs = candidateSnap.docs;
              break;
            }
          }
        }
        if (oldDocs.length === 0) return false;

        await ensureDailyChecklistParent();

        const batch = writeBatch(db);
        oldDocs.forEach((oldDoc) => {
          const oldData = oldDoc.data() as Partial<DailyChecklistItem>;
          const legacyDefaultMatch = oldDoc.id.match(/_default_(\d+)$/);
          const migratedItemId = legacyDefaultMatch
            ? `default-${Number(legacyDefaultMatch[1]) + 1}`
            : oldDoc.id;
          const completed =
            oldData.completed === true || oldData.isCompleted === true;
          const isDefault =
            oldData.isDefault === true ||
            legacyDefaultMatch !== null ||
            /^default-\d+$/.test(oldDoc.id);

          batch.set(doc(itemsRef, migratedItemId), {
            title: oldData.title ?? "",
            completed,
            isDefault,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            completedAt: completed ? serverTimestamp() : null,
            createdBy: user.uid,
            caregiverId: user.uid,
            patientId: activePatientId,
            patientsId: activePatientsId,
            dateKey: selectedDateKey,
            dailyChecklistDocId,
          });
        });
        await batch.commit();
        return true;
      } catch (error) {
        const firestoreError = error as { code?: string; message?: string };
        console.error("migrate legacy daily checklist failed; continuing with defaults:", {
          code: firestoreError.code,
          message: firestoreError.message,
          error,
        });
        return false;
      }
    };

    const createDefaultItems = async () => {
      console.log("daily checklist default creation started:", {
        activePatientId,
        uid: user.uid,
        dailyChecklistDocId,
        parentPath: checklistRef.path,
        itemsPath: itemsRef.path,
      });

      await ensureDailyChecklistParent();

      const batch = writeBatch(db);
      DEFAULT_DAILY_CHECKLIST_ITEMS.forEach((title, index) => {
        batch.set(doc(itemsRef, `default-${index + 1}`), {
          title,
          completed: false,
          isDefault: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          completedAt: null,
          createdBy: user.uid,
          caregiverId: user.uid,
          patientId: activePatientId,
          patientsId: activePatientsId,
          dateKey: selectedDateKey,
          dailyChecklistDocId,
        });
      });
      await batch.commit();
      console.log("daily checklist default writeBatch commit succeeded:", {
        dailyChecklistDocId,
        itemsPath: itemsRef.path,
      });
    };

    const itemsQuery = query(itemsRef, where("patientId", "==", activePatientId));
    const unsubscribe = onSnapshot(
      itemsQuery,
      (snap) => {
        if (snap.empty) {
          setDailyChecklistItems([]);
          if (dailyChecklistInitializationRef.current === dailyChecklistDocId) return;

          dailyChecklistInitializationRef.current = dailyChecklistDocId;
          setDailyChecklistError("");
          void (async () => {
            try {
              const migrated = await migrateLegacyItems();
              if (!migrated) {
                await createDefaultItems();
              }
            } catch (error) {
              const firestoreError = error as { code?: string; message?: string };
              console.error("seed daily checklist failed:", {
                activePatientId,
                uid: user.uid,
                dailyChecklistDocId,
                parentPath: checklistRef.path,
                itemsPath: itemsRef.path,
                code: firestoreError.code,
                message: firestoreError.message,
                error,
              });
              setDailyChecklistError(
                userErrorCopy[language].taskCreate
              );
            } finally {
              if (dailyChecklistInitializationRef.current === dailyChecklistDocId) {
                dailyChecklistInitializationRef.current = null;
              }
            }
          })();
          return;
        }

        dailyChecklistInitializationRef.current = null;
        setDailyChecklistError("");
        setDailyChecklistItems(
          snap.docs.map((docSnap) => {
            const data = docSnap.data() as Partial<DailyChecklistItem>;
            return {
              id: docSnap.id,
              title: data.title ?? "",
              title_en: data.title_en ?? "",
              title_vi: data.title_vi ?? "",
              title_id: data.title_id ?? "",
              completed: data.completed === true,
              isDefault: data.isDefault === true,
              createdAt: data.createdAt ?? null,
              updatedAt: data.updatedAt ?? null,
              completedAt: data.completedAt ?? null,
              createdBy: data.createdBy ?? "",
              caregiverId: data.caregiverId ?? "",
              patientId: data.patientId ?? activePatientId,
              dateKey: data.dateKey ?? selectedDateKey,
              dailyChecklistDocId: data.dailyChecklistDocId ?? dailyChecklistDocId,
            };
          })
        );
      },
      (error) => {
        console.error("daily checklist snapshot failed:", {
          code: error.code,
          message: error.message,
          error,
        });
        setDailyChecklistError(
          userErrorCopy[language].taskLoad
        );
        setDailyChecklistItems([]);
      }
    );

    return () => unsubscribe();
  }, [
    activePatientId,
    activePatientsId,
    dailyChecklistDocId,
    legacyPatientDocChecklistDocId,
    legacyPatientsIdChecklistDocId,
    legacyTopLevelChecklistDocIds,
    language,
    selectedDateKey,
    user?.uid,
  ]);

  useEffect(() => {
    if (!activePatientId || !dailyChecklistDocId || language === "zh") return;

    dailyChecklistItems.forEach((item) => {
      if (item.isDefault) return;

      void ensureFirestoreTranslations(
        doc(db, "daily_checklist_items", dailyChecklistDocId, "items", item.id),
        item,
        language,
        [{ baseName: "title", sourceKeys: ["title"] }]
      );
    });
  }, [activePatientId, dailyChecklistDocId, dailyChecklistItems, language]);

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
    const calendarEventDocId = editingEventId || makeCalendarEventDocId(eventDate, activePatientId);
    if (!calendarEventDocId) return;

    const eventRef = doc(db, CALENDAR_EVENTS_COLLECTION, calendarEventDocId);
    const getErrorCode = (error: unknown) =>
      typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
    const mutablePayload = {
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
    const createPayload = {
      patientId: activePatientId,
      patientsId: activePatientsId,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      isCompleted: false,
      ...mutablePayload,
    };

    try {
      if (editingEventId) {
        await updateDoc(eventRef, mutablePayload);
      } else {
        await setDoc(eventRef, createPayload);
      }
    } catch (saveError) {
      console.log("save calendar event failed:", {
        calendarEventDocId,
        eventRefPath: eventRef.path,
        editing: Boolean(editingEventId),
        errorCode: getErrorCode(saveError),
        payloadKeys: Object.keys(editingEventId ? mutablePayload : createPayload),
        authCurrentUserUid: auth.currentUser?.uid,
        saveError,
      });
      Alert.alert(copy.saveFailedTitle, copy.saveFailed);
      return;
    }

    setFormOpen(false);
    resetForm();
  };

  const handleDeleteEvent = (eventId: string) => {
    const copy = eventCopy[language];
    let submitted = false;
    Alert.alert(copy.title, copy.confirm, [
      { text: copy.cancel, style: "cancel" },
      { text: copy.remove, style: "destructive", onPress: async () => {
        if (submitted) return;
        submitted = true;
        try {
          await deleteDoc(doc(db, CALENDAR_EVENTS_COLLECTION, eventId));
        } catch (error) {
          console.log("delete calendar event failed:", error);
          Alert.alert(copy.failed, copy.retry);
        }
      } },
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
      Alert.alert(copy.toggleFailedTitle, copy.toggleFailed);
      setEvents((prevEvents) =>
        prevEvents.map((item) => (item.id === event.id ? { ...item, isCompleted: event.resolvedIsCompleted } : item))
      );
    }
  };

  const getDailyChecklistItemRef = (itemId: string) => {
    if (!activePatientId || !dailyChecklistDocId) return null;

    return doc(db, "daily_checklist_items", dailyChecklistDocId, "items", itemId);
  };

  const saveDailyChecklistInput = async () => {
    if (!activePatientId || !dailyChecklistDocId || !user?.uid) return;

    const title = dailyChecklistInput.trim();
    if (!title) {
      Alert.alert(copy.checklistEmptyInputTitle, copy.checklistEmptyInputBody);
      return;
    }

    try {
      if (editingChecklistItemId) {
        const itemRef = getDailyChecklistItemRef(editingChecklistItemId);
        if (!itemRef) return;

        await updateDoc(itemRef, {
          title,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(
        doc(db, "daily_checklist_items", dailyChecklistDocId),
          {
            patientId: activePatientId,
            patientsId: activePatientsId,
            dateKey: selectedDateKey,
            dailyChecklistDocId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdBy: user.uid,
          },
          { merge: true }
        );

        await addDoc(
          collection(db, "daily_checklist_items", dailyChecklistDocId, "items"),
          {
            title,
            completed: false,
            isDefault: false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            completedAt: null,
            createdBy: user.uid,
            caregiverId: user.uid,
            patientId: activePatientId,
            patientsId: activePatientsId,
            dateKey: selectedDateKey,
            dailyChecklistDocId,
          }
        );
      }

      setDailyChecklistInput("");
      setEditingChecklistItemId(null);
      setDailyChecklistExpanded(true);
    } catch (error) {
      console.log("save daily checklist item failed:", error);
      Alert.alert(copy.checklistSaveFailedTitle, copy.checklistSaveFailed);
    }
  };

  const startEditDailyChecklistItem = (item: DailyChecklistItem) => {
    setDailyChecklistInput(item.title);
    setEditingChecklistItemId(item.id);
    setDailyChecklistExpanded(true);
  };

  const cancelEditDailyChecklistItem = () => {
    setDailyChecklistInput("");
    setEditingChecklistItemId(null);
  };

  const confirmDeleteDailyChecklistItem = (item: DailyChecklistItem) => {
    Alert.alert(copy.checklistDeleteTitle, copy.checklistDeleteConfirm, [
      { text: copy.cancel, style: "cancel" },
      {
        text: copy.checklistDelete,
        style: "destructive",
        onPress: async () => {
          const itemRef = getDailyChecklistItemRef(item.id);
          if (!itemRef) return;

          try {
            await deleteDoc(itemRef);
          } catch (error) {
            console.log("delete daily checklist item failed:", error);
            Alert.alert(copy.checklistDeleteFailedTitle, copy.checklistDeleteFailed);
          }
        },
      },
    ]);
  };

  const toggleDailyChecklistItemCompleted = async (item: DailyChecklistItem) => {
    if (!user?.uid) return;

    const itemRef = getDailyChecklistItemRef(item.id);
    if (!itemRef) return;

    const nextCompleted = !item.completed;

    setDailyChecklistItems((prevItems) =>
      prevItems.map((prevItem) =>
        prevItem.id === item.id ? { ...prevItem, completed: nextCompleted } : prevItem
      )
    );

    try {
      await updateDoc(itemRef, {
        completed: nextCompleted,
        completedAt: nextCompleted ? serverTimestamp() : null,
        caregiverId: user.uid,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.log("toggle daily checklist item failed:", error);
      setDailyChecklistItems((prevItems) =>
        prevItems.map((prevItem) =>
          prevItem.id === item.id ? { ...prevItem, completed: item.completed } : prevItem
        )
      );
      Alert.alert(copy.checklistToggleFailedTitle, copy.checklistToggleFailed);
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

      <KeyboardAwareScroll
        safeAreaBottom={false}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
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
                  onDelete={() => handleDeleteEvent(event.id)}
                />
              );
            })}
          </DayAgenda>

          <DailyChecklistCard
            date={selectedDate}
            items={sortedDailyChecklistItems.map((item) => ({
              id: item.id,
              title: getDailyChecklistItemTitle(item, t, language),
              completed: item.completed,
            }))}
            doneCount={completedChecklistCount}
            expanded={dailyChecklistExpanded}
            onToggleExpanded={() => setDailyChecklistExpanded((prev) => !prev)}
            error={dailyChecklistError}
            input={dailyChecklistInput}
            onChangeInput={setDailyChecklistInput}
            editing={editingChecklistItemId !== null}
            onSubmit={() => void saveDailyChecklistInput()}
            onCancelEdit={cancelEditDailyChecklistItem}
            onToggleItem={(id) => {
              const item = dailyChecklistItems.find((entry) => entry.id === id);
              if (item) void toggleDailyChecklistItemCompleted(item);
            }}
            onEditItem={(id) => {
              const item = dailyChecklistItems.find((entry) => entry.id === id);
              if (item) startEditDailyChecklistItem(item);
            }}
            onDeleteItem={(id) => {
              const item = dailyChecklistItems.find((entry) => entry.id === id);
              if (item) confirmDeleteDailyChecklistItem(item);
            }}
          />
        </View>
      </KeyboardAwareScroll>

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
    gap: 0,
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
