export const STORAGE_KEY = "shizhua-cleaning-v1";
export const repeatNames = { once: "仅本次", daily: "每天", weekly: "每周" };
export const blankState = () => ({ version: 1, tasks: [], history: [] });
export function dateKey(value = new Date()) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}
export function validDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(new Date(value + "T12:00:00").getTime()) && dateKey(new Date(value + "T12:00:00")) === value;
}
export function shiftDate(value, days) {
  if (!validDate(value)) throw new Error("请填写有效的计划日期");
  const result = new Date(value + "T12:00:00");
  result.setDate(result.getDate() + days);
  return dateKey(result);
}
export function normalizeState(raw) {
  if (!raw || raw.version !== 1 || !Array.isArray(raw.tasks) || !Array.isArray(raw.history)) throw new Error("无法识别已保存的计划格式");
  const validTask = t => t && typeof t.id === "string" && t.id.length <= 100 && typeof t.title === "string"
    && t.title.trim().length > 0 && t.title.length <= 100 && typeof t.zone === "string" && t.zone.length <= 30
    && typeof t.note === "string" && t.note.length <= 1500 && Object.hasOwn(repeatNames, t.repeat)
    && ["open", "completed"].includes(t.state) && validDate(t.due);
  if (raw.tasks.length > 200 || raw.tasks.some(t => !validTask(t)) || new Set(raw.tasks.map(t => t.id)).size !== raw.tasks.length) throw new Error("已保存的任务不完整，未覆盖原记录");
  const history = raw.history.slice(-1000);
  if (history.some(h => !h || typeof h.title !== "string" || h.title.length > 100 || typeof h.zone !== "string"
    || h.zone.length > 30 || typeof h.completedAt !== "string" || !Number.isFinite(Date.parse(h.completedAt)))) throw new Error("已保存的完成记录无法读取");
  return { version: 1, tasks: raw.tasks.map(t => ({ ...t })), history: history.map(h => ({ ...h })) };
}
export function completeTask(state, id, stamp = new Date()) {
  const next = structuredClone(state);
  const task = next.tasks.find(t => t.id === id);
  if (!task || task.state !== "open") return next;
  next.history.push({ taskId: task.id, title: task.title, zone: task.zone, completedAt: stamp.toISOString() });
  next.history = next.history.slice(-1000);
  if (task.repeat === "once") task.state = "completed";
  else task.due = shiftDate(dateKey(stamp), task.repeat === "daily" ? 1 : 7);
  return next;
}
export function csvCell(value) {
  let text = String(value ?? "");
  if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export function exportCSV(state) {
  const rows = [["记录类型", "任务名称", "区域", "计划日期", "重复安排", "状态", "完成时间", "备注"],
    ...state.tasks.map(t => ["当前任务", t.title, t.zone, t.due, repeatNames[t.repeat], t.state === "completed" ? "已完成" : "待完成", "", t.note]),
    ...state.history.map(h => ["完成记录", h.title, h.zone, "", "", "已完成", h.completedAt, ""])];
  return "\uFEFF" + rows.map(row => row.map(csvCell).join(",")).join("\r\n");
}
