/** Full date for each reading, independent of sparse axis labels. */
export function formatChartDate(ts: number): string {
  const date = new Date(ts);
  const two = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}/${two(date.getMonth() + 1)}/${two(date.getDate())} ${two(date.getHours())}:${two(date.getMinutes())}`;
}

export function formatChartAxisLabel(ts: number, index: number, total: number): string {
  const date = new Date(ts);
  const label = `${date.getMonth() + 1}/${date.getDate()}`;
  if (total <= 7) return label;
  if (total <= 14) return index % 2 === 0 ? label : "";
  if (total <= 24) return index % 3 === 0 ? label : "";
  return index % 4 === 0 ? label : "";
}
