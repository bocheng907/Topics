// src/i18n/copy/calendarCopy.ts
// UI copy for the family / caregiver calendar screens. Usage: calendarCopy[language].
import type { Language } from "@/src/i18n/translations";

export type CalendarCopy = {
  /** Month + year title for the month navigator, e.g. "2026年10月". */
  monthTitle: (year: number, monthIndex: number) => string;
  /** Short month names for the month picker (index 0 = January). */
  monthShort: readonly string[];
  /** Monday-first weekday labels for the month grid header. */
  weekdaysShort: readonly string[];
  /** Selected-day heading, e.g. "10月31日（週六）". */
  dayTitle: (date: Date) => string;
  /** Spoken label of a grid cell. */
  dayA11y: (date: Date, eventCount: number) => string;

  today: string;
  prevMonth: string;
  nextMonth: string;
  prevYear: string;
  nextYear: string;
  pickMonth: string;
  am: string;
  pm: string;

  // Agenda
  eventsCount: (count: number) => string;
  emptyTitle: string;
  emptyBody: string;
  addEvent: string;
  markDone: string;
  done: string;
  markUndoneA11y: (title: string) => string;
  markDoneA11y: (title: string) => string;
  editA11y: (title: string) => string;
  deleteA11y: (title: string) => string;

  // Event form
  formTitleNew: string;
  formTitleEdit: string;
  cancel: string;
  save: string;
  titleLabel: string;
  titlePlaceholder: string;
  dateLabel: string;
  prevDay: string;
  nextDay: string;
  timeLabel: string;
  hourLabel: string;
  minuteLabel: string;
  personLabel: string;
  personPlaceholder: string;
  personHelper: string;
  locationLabel: string;
  locationPlaceholder: string;
  colorLabel: string;
  colorHelper: string;
  colorNames: readonly string[];
  needCareTarget: string;
  needSignIn: string;
  saveFailedTitle: string;
  saveFailed: string;
  toggleFailedTitle: string;
  toggleFailed: string;

  // Caregiver daily checklist
  checklistTitle: string;
  checklistFor: (dayTitle: string) => string;
  checklistProgressA11y: (done: number, total: number) => string;
  checklistExpand: string;
  checklistCollapse: string;
  checklistPlaceholder: string;
  checklistInputLabel: string;
  checklistEditingLabel: string;
  checklistAdd: string;
  checklistSave: string;
  checklistCancelEdit: string;
  checklistEmpty: string;
  checklistEmptyInputTitle: string;
  checklistEmptyInputBody: string;
  checklistSaveFailedTitle: string;
  checklistSaveFailed: string;
  checklistDeleteTitle: string;
  checklistDeleteConfirm: string;
  checklistDelete: string;
  checklistDeleteFailedTitle: string;
  checklistDeleteFailed: string;
  checklistToggleFailedTitle: string;
  checklistToggleFailed: string;
};

const zhWeekLong = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];
const enMonths = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const enWeekLong = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const viWeekLong = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
const idMonths = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const idWeekLong = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export const calendarCopy: Record<Language, CalendarCopy> = {
  zh: {
    monthTitle: (y, m) => `${y}年${m + 1}月`,
    monthShort: Array.from({ length: 12 }, (_, i) => `${i + 1}月`),
    weekdaysShort: ["一", "二", "三", "四", "五", "六", "日"],
    dayTitle: (d) => `${d.getMonth() + 1}月${d.getDate()}日（${zhWeekLong[d.getDay()]}）`,
    dayA11y: (d, n) => `${d.getMonth() + 1}月${d.getDate()}日${n > 0 ? `，${n} 個事件` : ""}`,
    today: "今天",
    prevMonth: "上個月",
    nextMonth: "下個月",
    prevYear: "前一年",
    nextYear: "下一年",
    pickMonth: "選擇年份與月份",
    am: "上午",
    pm: "下午",
    eventsCount: (n) => `${n} 個事件`,
    emptyTitle: "這天沒有事件",
    emptyBody: "回診、復健或其他安排，都可以記在這裡。",
    addEvent: "新增事件",
    markDone: "標記完成",
    done: "已完成",
    markUndoneA11y: (title) => `${title}，已完成，點一下改回未完成`,
    markDoneA11y: (title) => `將 ${title} 標記為完成`,
    editA11y: (title) => `編輯 ${title}`,
    deleteA11y: (title) => `刪除 ${title}`,
    formTitleNew: "新增事件",
    formTitleEdit: "編輯事件",
    cancel: "取消",
    save: "儲存",
    titleLabel: "事件名稱",
    titlePlaceholder: "例如：回診、復健、量血壓",
    dateLabel: "日期",
    prevDay: "前一天",
    nextDay: "後一天",
    timeLabel: "時間",
    hourLabel: "點",
    minuteLabel: "分",
    personLabel: "對象",
    personPlaceholder: "例如：王奶奶",
    personHelper: "這個事件和誰有關（選填）",
    locationLabel: "地點",
    locationPlaceholder: "例如：台大醫院 3 樓",
    colorLabel: "顏色",
    colorHelper: "用顏色區分事件類型，月曆上會顯示同色圓點。",
    colorNames: ["橘色", "紫色", "藍色", "粉紅色", "綠色"],
    needCareTarget: "尚未選擇照護對象，無法儲存。請先從選單選擇照護對象。",
    needSignIn: "登入狀態已失效，請重新登入後再試。",
    saveFailedTitle: "儲存失敗",
    saveFailed: "事件尚未儲存，請檢查網路後再試。",
    toggleFailedTitle: "操作失敗",
    toggleFailed: "無法更新事件狀態，請稍後再試。",
    checklistTitle: "每日清單",
    checklistFor: (day) => `${day}的事項`,
    checklistProgressA11y: (done, total) => `已完成 ${done} 項，共 ${total} 項`,
    checklistExpand: "展開每日清單",
    checklistCollapse: "收合每日清單",
    checklistPlaceholder: "例如：散步 10 分鐘",
    checklistInputLabel: "新增每日事項",
    checklistEditingLabel: "編輯每日事項",
    checklistAdd: "新增",
    checklistSave: "儲存",
    checklistCancelEdit: "取消編輯",
    checklistEmpty: "這天還沒有每日事項。",
    checklistEmptyInputTitle: "請輸入事項",
    checklistEmptyInputBody: "每日事項不能空白。",
    checklistSaveFailedTitle: "儲存失敗",
    checklistSaveFailed: "無法儲存每日事項，請稍後再試。",
    checklistDeleteTitle: "刪除事項",
    checklistDeleteConfirm: "確定要刪除這個每日事項嗎？",
    checklistDelete: "刪除",
    checklistDeleteFailedTitle: "刪除失敗",
    checklistDeleteFailed: "無法刪除每日事項，請稍後再試。",
    checklistToggleFailedTitle: "操作失敗",
    checklistToggleFailed: "無法更新每日事項狀態，請稍後再試。",
  },
  en: {
    monthTitle: (y, m) => `${enMonths[m]} ${y}`,
    monthShort: enMonths.map((m) => m.slice(0, 3)),
    weekdaysShort: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    dayTitle: (d) => `${enWeekLong[d.getDay()]}, ${enMonths[d.getMonth()]} ${d.getDate()}`,
    dayA11y: (d, n) => `${enMonths[d.getMonth()]} ${d.getDate()}${n > 0 ? `, ${n} ${n === 1 ? "event" : "events"}` : ""}`,
    today: "Today",
    prevMonth: "Previous month",
    nextMonth: "Next month",
    prevYear: "Previous year",
    nextYear: "Next year",
    pickMonth: "Choose year and month",
    am: "AM",
    pm: "PM",
    eventsCount: (n) => `${n} ${n === 1 ? "event" : "events"}`,
    emptyTitle: "No events on this day",
    emptyBody: "Keep track of check-ups, therapy sessions and other plans here.",
    addEvent: "Add event",
    markDone: "Mark done",
    done: "Done",
    markUndoneA11y: (title) => `${title}, done. Tap to mark as not done`,
    markDoneA11y: (title) => `Mark ${title} as done`,
    editA11y: (title) => `Edit ${title}`,
    deleteA11y: (title) => `Delete ${title}`,
    formTitleNew: "New event",
    formTitleEdit: "Edit event",
    cancel: "Cancel",
    save: "Save",
    titleLabel: "Event name",
    titlePlaceholder: "e.g. Doctor visit, therapy, blood pressure check",
    dateLabel: "Date",
    prevDay: "Previous day",
    nextDay: "Next day",
    timeLabel: "Time",
    hourLabel: "Hour",
    minuteLabel: "Minute",
    personLabel: "Person",
    personPlaceholder: "e.g. Grandma Wang",
    personHelper: "Who this event is for (optional)",
    locationLabel: "Location",
    locationPlaceholder: "e.g. City Hospital, 3rd floor",
    colorLabel: "Color",
    colorHelper: "Use colors to tell event types apart. The calendar shows a dot in the same color.",
    colorNames: ["Orange", "Purple", "Blue", "Pink", "Green"],
    needCareTarget: "No care recipient selected, so this can't be saved yet. Choose one from the menu first.",
    needSignIn: "Your session has expired. Please sign in again and retry.",
    saveFailedTitle: "Couldn't save",
    saveFailed: "The event wasn't saved. Check your connection and try again.",
    toggleFailedTitle: "Something went wrong",
    toggleFailed: "Couldn't update the event status. Please try again later.",
    checklistTitle: "Daily checklist",
    checklistFor: (day) => `Tasks for ${day}`,
    checklistProgressA11y: (done, total) => `${done} of ${total} done`,
    checklistExpand: "Expand daily checklist",
    checklistCollapse: "Collapse daily checklist",
    checklistPlaceholder: "e.g. Walk for 10 minutes",
    checklistInputLabel: "Add a daily task",
    checklistEditingLabel: "Edit daily task",
    checklistAdd: "Add",
    checklistSave: "Save",
    checklistCancelEdit: "Cancel editing",
    checklistEmpty: "No daily tasks for this day yet.",
    checklistEmptyInputTitle: "Enter a task",
    checklistEmptyInputBody: "A daily task can't be empty.",
    checklistSaveFailedTitle: "Couldn't save",
    checklistSaveFailed: "Couldn't save the daily task. Please try again later.",
    checklistDeleteTitle: "Delete task",
    checklistDeleteConfirm: "Delete this daily task?",
    checklistDelete: "Delete",
    checklistDeleteFailedTitle: "Couldn't delete",
    checklistDeleteFailed: "Couldn't delete the daily task. Please try again later.",
    checklistToggleFailedTitle: "Something went wrong",
    checklistToggleFailed: "Couldn't update the daily task. Please try again later.",
  },
  vi: {
    monthTitle: (y, m) => `Tháng ${m + 1}, ${y}`,
    monthShort: Array.from({ length: 12 }, (_, i) => `Th${i + 1}`),
    weekdaysShort: ["T2", "T3", "T4", "T5", "T6", "T7", "CN"],
    dayTitle: (d) => `${viWeekLong[d.getDay()]}, ${d.getDate()}/${d.getMonth() + 1}`,
    dayA11y: (d, n) => `Ngày ${d.getDate()} tháng ${d.getMonth() + 1}${n > 0 ? `, ${n} lịch hẹn` : ""}`,
    today: "Hôm nay",
    prevMonth: "Tháng trước",
    nextMonth: "Tháng sau",
    prevYear: "Năm trước",
    nextYear: "Năm sau",
    pickMonth: "Chọn năm và tháng",
    am: "SA",
    pm: "CH",
    eventsCount: (n) => `${n} lịch hẹn`,
    emptyTitle: "Ngày này chưa có lịch hẹn",
    emptyBody: "Ghi lại lịch tái khám, vật lý trị liệu và các việc khác tại đây.",
    addEvent: "Thêm lịch hẹn",
    markDone: "Đánh dấu xong",
    done: "Đã xong",
    markUndoneA11y: (title) => `${title}, đã xong. Chạm để chuyển về chưa xong`,
    markDoneA11y: (title) => `Đánh dấu ${title} là đã xong`,
    editA11y: (title) => `Sửa ${title}`,
    deleteA11y: (title) => `Xóa ${title}`,
    formTitleNew: "Thêm lịch hẹn",
    formTitleEdit: "Sửa lịch hẹn",
    cancel: "Hủy",
    save: "Lưu",
    titleLabel: "Tên lịch hẹn",
    titlePlaceholder: "Ví dụ: tái khám, vật lý trị liệu, đo huyết áp",
    dateLabel: "Ngày",
    prevDay: "Ngày trước",
    nextDay: "Ngày sau",
    timeLabel: "Giờ",
    hourLabel: "Giờ",
    minuteLabel: "Phút",
    personLabel: "Người liên quan",
    personPlaceholder: "Ví dụ: bà Vương",
    personHelper: "Lịch hẹn này dành cho ai (không bắt buộc)",
    locationLabel: "Địa điểm",
    locationPlaceholder: "Ví dụ: Bệnh viện Đài Đại, tầng 3",
    colorLabel: "Màu",
    colorHelper: "Dùng màu để phân biệt loại lịch hẹn. Lịch sẽ hiện chấm cùng màu.",
    colorNames: ["Cam", "Tím", "Xanh dương", "Hồng", "Xanh lá"],
    needCareTarget: "Chưa chọn người được chăm sóc nên chưa thể lưu. Hãy chọn trong menu trước.",
    needSignIn: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại rồi thử lại.",
    saveFailedTitle: "Không thể lưu",
    saveFailed: "Lịch hẹn chưa được lưu. Hãy kiểm tra kết nối mạng rồi thử lại.",
    toggleFailedTitle: "Có lỗi xảy ra",
    toggleFailed: "Không thể cập nhật trạng thái lịch hẹn. Vui lòng thử lại sau.",
    checklistTitle: "Việc hằng ngày",
    checklistFor: (day) => `Việc cần làm · ${day}`,
    checklistProgressA11y: (done, total) => `Đã xong ${done} trên ${total} việc`,
    checklistExpand: "Mở danh sách việc hằng ngày",
    checklistCollapse: "Thu gọn danh sách việc hằng ngày",
    checklistPlaceholder: "Ví dụ: đi bộ 10 phút",
    checklistInputLabel: "Thêm việc hằng ngày",
    checklistEditingLabel: "Sửa việc hằng ngày",
    checklistAdd: "Thêm",
    checklistSave: "Lưu",
    checklistCancelEdit: "Hủy sửa",
    checklistEmpty: "Ngày này chưa có việc nào.",
    checklistEmptyInputTitle: "Vui lòng nhập nội dung",
    checklistEmptyInputBody: "Việc hằng ngày không được để trống.",
    checklistSaveFailedTitle: "Không thể lưu",
    checklistSaveFailed: "Không lưu được việc hằng ngày. Vui lòng thử lại sau.",
    checklistDeleteTitle: "Xóa việc",
    checklistDeleteConfirm: "Bạn có chắc muốn xóa việc hằng ngày này?",
    checklistDelete: "Xóa",
    checklistDeleteFailedTitle: "Không thể xóa",
    checklistDeleteFailed: "Không xóa được việc hằng ngày. Vui lòng thử lại sau.",
    checklistToggleFailedTitle: "Có lỗi xảy ra",
    checklistToggleFailed: "Không cập nhật được trạng thái. Vui lòng thử lại sau.",
  },
  id: {
    monthTitle: (y, m) => `${idMonths[m]} ${y}`,
    monthShort: idMonths.map((m) => m.slice(0, 3)),
    weekdaysShort: ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"],
    dayTitle: (d) => `${idWeekLong[d.getDay()]}, ${d.getDate()} ${idMonths[d.getMonth()]}`,
    dayA11y: (d, n) => `${d.getDate()} ${idMonths[d.getMonth()]}${n > 0 ? `, ${n} jadwal` : ""}`,
    today: "Hari ini",
    prevMonth: "Bulan sebelumnya",
    nextMonth: "Bulan berikutnya",
    prevYear: "Tahun sebelumnya",
    nextYear: "Tahun berikutnya",
    pickMonth: "Pilih tahun dan bulan",
    am: "AM",
    pm: "PM",
    eventsCount: (n) => `${n} jadwal`,
    emptyTitle: "Tidak ada jadwal di hari ini",
    emptyBody: "Catat jadwal kontrol, terapi, dan rencana lainnya di sini.",
    addEvent: "Tambah jadwal",
    markDone: "Tandai selesai",
    done: "Selesai",
    markUndoneA11y: (title) => `${title}, sudah selesai. Ketuk untuk menandai belum selesai`,
    markDoneA11y: (title) => `Tandai ${title} sebagai selesai`,
    editA11y: (title) => `Ubah ${title}`,
    deleteA11y: (title) => `Hapus ${title}`,
    formTitleNew: "Tambah jadwal",
    formTitleEdit: "Ubah jadwal",
    cancel: "Batal",
    save: "Simpan",
    titleLabel: "Nama jadwal",
    titlePlaceholder: "Contoh: kontrol ke dokter, terapi, cek tekanan darah",
    dateLabel: "Tanggal",
    prevDay: "Hari sebelumnya",
    nextDay: "Hari berikutnya",
    timeLabel: "Jam",
    hourLabel: "Jam",
    minuteLabel: "Menit",
    personLabel: "Untuk siapa",
    personPlaceholder: "Contoh: Nenek Wang",
    personHelper: "Jadwal ini untuk siapa (opsional)",
    locationLabel: "Lokasi",
    locationPlaceholder: "Contoh: RS Pusat, lantai 3",
    colorLabel: "Warna",
    colorHelper: "Gunakan warna untuk membedakan jenis jadwal. Kalender akan menampilkan titik berwarna sama.",
    colorNames: ["Oranye", "Ungu", "Biru", "Merah muda", "Hijau"],
    needCareTarget: "Belum ada penerima perawatan yang dipilih, jadi belum bisa disimpan. Pilih dulu dari menu.",
    needSignIn: "Sesi login Anda telah berakhir. Silakan login lagi lalu coba kembali.",
    saveFailedTitle: "Gagal menyimpan",
    saveFailed: "Jadwal belum tersimpan. Periksa koneksi internet lalu coba lagi.",
    toggleFailedTitle: "Terjadi kesalahan",
    toggleFailed: "Status jadwal tidak dapat diperbarui. Coba lagi nanti.",
    checklistTitle: "Daftar harian",
    checklistFor: (day) => `Tugas untuk ${day}`,
    checklistProgressA11y: (done, total) => `${done} dari ${total} selesai`,
    checklistExpand: "Buka daftar harian",
    checklistCollapse: "Tutup daftar harian",
    checklistPlaceholder: "Contoh: jalan kaki 10 menit",
    checklistInputLabel: "Tambah tugas harian",
    checklistEditingLabel: "Ubah tugas harian",
    checklistAdd: "Tambah",
    checklistSave: "Simpan",
    checklistCancelEdit: "Batal mengubah",
    checklistEmpty: "Belum ada tugas harian untuk hari ini.",
    checklistEmptyInputTitle: "Isi tugasnya",
    checklistEmptyInputBody: "Tugas harian tidak boleh kosong.",
    checklistSaveFailedTitle: "Gagal menyimpan",
    checklistSaveFailed: "Tugas harian tidak dapat disimpan. Coba lagi nanti.",
    checklistDeleteTitle: "Hapus tugas",
    checklistDeleteConfirm: "Yakin ingin menghapus tugas harian ini?",
    checklistDelete: "Hapus",
    checklistDeleteFailedTitle: "Gagal menghapus",
    checklistDeleteFailed: "Tugas harian tidak dapat dihapus. Coba lagi nanti.",
    checklistToggleFailedTitle: "Terjadi kesalahan",
    checklistToggleFailed: "Status tugas harian tidak dapat diperbarui. Coba lagi nanti.",
  },
};
