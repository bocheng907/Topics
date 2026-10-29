// Media-specific wording must not reuse prescription or voice deletion prompts.
export const recordCopy = {
  zh: {
    actions: "紀錄操作", close: "關閉操作選單", edit: "編輯紀錄資訊",
    deleteRecord: "確定要刪除這筆狀況紀錄嗎？",
    deleteFolder: "確定要刪除此追蹤資料夾及其中的所有紀錄嗎？",
    deleteEntry: "確定要刪除此資料夾中的這筆紀錄嗎？其他紀錄將保留。",
    deleted: "紀錄已刪除。", addEntry: "新增紀錄",
  },
  en: {
    actions: "Record actions", close: "Close actions menu", edit: "Edit record details",
    deleteRecord: "Delete this condition record?",
    deleteFolder: "Delete this tracking folder and all its entries?",
    deleteEntry: "Delete this entry from the folder? Other entries will be kept.",
    deleted: "Record deleted.", addEntry: "Add entry",
  },
  vi: {
    actions: "Thao tác bản ghi", close: "Đóng menu thao tác", edit: "Sửa thông tin bản ghi",
    deleteRecord: "Xóa bản ghi tình trạng này?",
    deleteFolder: "Xóa thư mục theo dõi này và tất cả bản ghi bên trong?",
    deleteEntry: "Xóa bản ghi này khỏi thư mục? Các bản ghi khác sẽ được giữ lại.",
    deleted: "Đã xóa bản ghi.", addEntry: "Thêm bản ghi",
  },
  id: {
    actions: "Tindakan catatan", close: "Tutup menu tindakan", edit: "Edit detail catatan",
    deleteRecord: "Hapus catatan kondisi ini?",
    deleteFolder: "Hapus folder pemantauan ini beserta semua catatan di dalamnya?",
    deleteEntry: "Hapus catatan ini dari folder? Catatan lainnya akan tetap disimpan.",
    deleted: "Catatan dihapus.", addEntry: "Tambah catatan",
  },
} as const;
