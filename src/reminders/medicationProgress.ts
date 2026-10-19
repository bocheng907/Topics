type Reminder = { id: string; enabled?: unknown; scheduleTime?: unknown };
type Log = { status?: unknown; dateKey?: unknown; scheduleTime?: unknown; reminderId?: unknown; reminderIds?: unknown };

export function taipeiDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

/** The caregiver confirms a whole scheduled time slot, not a pill count. */
export function medicationProgress(reminders: Reminder[], logs: Log[], dateKey: string) {
  const slots = new Map<string, string[]>();
  for (const reminder of reminders) {
    if (reminder.enabled !== true || typeof reminder.scheduleTime !== 'string' ||
      !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(reminder.scheduleTime)) continue;
    const ids = slots.get(reminder.scheduleTime) ?? [];
    ids.push(reminder.id);
    slots.set(reminder.scheduleTime, ids);
  }
  const todayLogs = logs.filter(log => log.dateKey === dateKey && log.status === 'taken');
  const completedIds = new Set(todayLogs.flatMap(log => [log.reminderId,
    ...(Array.isArray(log.reminderIds) ? log.reminderIds : [])]).filter((id): id is string => typeof id === 'string'));
  let completed = 0;
  for (const [time, ids] of slots) {
    if (todayLogs.some(log => log.scheduleTime === time) || ids.every(id => completedIds.has(id))) completed++;
  }
  return { total: slots.size, completed };
}

export const progressCopy = {
  zh: { unit: '個用藥時段', none: '已有藥單，目前未設定用藥時段。', error: '無法載入用藥進度，請稍後再試。' },
  en: { unit: 'medication time slots', none: 'Prescriptions are available, but no medication times are set.', error: 'Unable to load medication progress. Please try again later.' },
  vi: { unit: 'khung giờ uống thuốc', none: 'Đã có đơn thuốc nhưng chưa đặt giờ uống thuốc.', error: 'Không thể tải tiến độ uống thuốc. Vui lòng thử lại sau.' },
  id: { unit: 'jadwal minum obat', none: 'Resep tersedia, tetapi waktu minum obat belum diatur.', error: 'Tidak dapat memuat progres obat. Silakan coba lagi nanti.' },
};
