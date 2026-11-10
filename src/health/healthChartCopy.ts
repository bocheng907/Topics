import type { Language } from "@/src/i18n/translations";

export const healthChartCopy: Record<Language, {
  temperature: string; heartRate: string; bloodPressure: string; bloodSugar: string;
  perGrid: (value: string) => string;
  loading: string; emptyTitle: string; emptyBody: string;
  showDetails: string; hideDetails: string; unknownDate: string;
  systolic: string; diastolic: string; scrollLabel: string; chartLabel: string; chartDescription: string;
}> = {
  zh: {
    temperature: "體溫趨勢", heartRate: "心跳趨勢", bloodPressure: "血壓趨勢", bloodSugar: "血糖趨勢",
    perGrid: value => "每格 " + value,
    loading: "圖表資料載入中…", emptyTitle: "目前沒有可顯示的資料", emptyBody: "先新增幾筆紀錄，這裡就會顯示趨勢圖",
    showDetails: "查看各筆紀錄", hideDetails: "收合各筆紀錄", unknownDate: "日期不明",
    systolic: "收縮壓", diastolic: "舒張壓", scrollLabel: "健康趨勢圖，可橫向捲動",
    chartLabel: "健康紀錄趨勢", chartDescription: "健康紀錄趨勢；資料點顯示數值",
  },
  en: {
    temperature: "Temperature trend", heartRate: "Heart rate trend", bloodPressure: "Blood pressure trend", bloodSugar: "Blood glucose trend",
    perGrid: value => value + " per grid line",
    loading: "Loading chart…", emptyTitle: "No data to display", emptyBody: "Add records to see the trend here.",
    showDetails: "View readings", hideDetails: "Hide readings", unknownDate: "Unknown date",
    systolic: "Systolic", diastolic: "Diastolic", scrollLabel: "Health trend chart, scroll horizontally",
    chartLabel: "Health record trends", chartDescription: "Health record trends; data points show values",
  },
  vi: {
    temperature: "Xu hướng nhiệt độ", heartRate: "Xu hướng nhịp tim", bloodPressure: "Xu hướng huyết áp", bloodSugar: "Xu hướng đường huyết",
    perGrid: value => "Mỗi ô: " + value,
    loading: "Đang tải biểu đồ…", emptyTitle: "Chưa có dữ liệu để hiển thị", emptyBody: "Thêm bản ghi để xem biểu đồ xu hướng.",
    showDetails: "Xem từng chỉ số", hideDetails: "Ẩn các chỉ số", unknownDate: "Không rõ ngày",
    systolic: "Tâm thu", diastolic: "Tâm trương", scrollLabel: "Biểu đồ sức khỏe, có thể cuộn ngang",
    chartLabel: "Xu hướng sức khỏe", chartDescription: "Xu hướng sức khỏe; các điểm hiển thị giá trị",
  },
  id: {
    temperature: "Tren suhu tubuh", heartRate: "Tren denyut jantung", bloodPressure: "Tren tekanan darah", bloodSugar: "Tren gula darah",
    perGrid: value => value + " per garis",
    loading: "Memuat grafik…", emptyTitle: "Tidak ada data untuk ditampilkan", emptyBody: "Tambahkan catatan untuk melihat grafik tren.",
    showDetails: "Lihat setiap catatan", hideDetails: "Sembunyikan catatan", unknownDate: "Tanggal tidak diketahui",
    systolic: "Sistolik", diastolic: "Diastolik", scrollLabel: "Grafik kesehatan, dapat digeser mendatar",
    chartLabel: "Tren catatan kesehatan", chartDescription: "Tren kesehatan; titik data menampilkan nilai",
  },
};
