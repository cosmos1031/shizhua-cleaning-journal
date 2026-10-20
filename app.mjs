import { STORAGE_KEY, blankState, dateKey, repeatNames, normalizeState, completeTask, exportCSV } from "./core.mjs";

const byId = id => document.getElementById(id);
let state = blankState(), deleted = null, readableStorage = true;
const announce = message => { byId("status").textContent = message; };
const storageWarning = message => { byId("storage-warning").hidden = false; byId("storage-warning").textContent = message; };
try {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) state = normalizeState(JSON.parse(saved));
} catch {
  readableStorage = false;
  storageWarning("当前浏览器的原记录无法读取。未覆盖已保存数据；如有重要记录，请先保留原浏览器数据。");
}
function save() {
  let persisted = false;
  if (readableStorage) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); persisted = true; }
    catch { storageWarning("当前浏览器未能保存本次更改。页面关闭前请导出 CSV，避免丢失当前记录。"); }
  }
  render();
  return persisted;
}
function render() {
  const today = dateKey();
  const open = state.tasks.filter(t => t.state === "open");
  byId("open-count").textContent = open.length;
  byId("due-count").textContent = open.filter(t => t.due <= today).length;
  byId("done-count").textContent = state.history.filter(h => dateKey(new Date(h.completedAt)) === today).length;
  const scope = byId("filter").value;
  const visible = state.tasks.filter(t => scope === "all" || (scope === "completed" ? t.state === "completed"
    : t.state === "open" && (scope === "open" || (scope === "due" ? t.due <= today : t.due > today))))
    .sort((a, b) => a.due.localeCompare(b.due));
  byId("tasks").replaceChildren();
  byId("empty").hidden = visible.length > 0;
  if (!visible.length) {
    byId("empty").querySelector("h3").textContent = state.tasks.length ? "这个范围内还没有任务" : "给家留一份小清单";
    byId("empty").querySelector("p").textContent = state.tasks.length ? "可以切换查看范围，或再添加一项安排。" : "从表单添加第一件事，或先试用示例任务。";
  }
  for (const task of visible) {
    const card = byId("task-template").content.firstElementChild.cloneNode(true);
    card.classList.toggle("completed", task.state === "completed");
    card.querySelector("h4").textContent = task.title;
    card.querySelector(".zone").textContent = task.zone;
    const date = card.querySelector(".date");
    date.textContent = task.due === today ? "今天" : task.due;
    date.classList.toggle("overdue", task.due < today && task.state === "open");
    card.querySelector(".repeat").textContent = repeatNames[task.repeat];
    card.querySelector(".task-note").textContent = task.note;
    card.querySelector(".task-note").hidden = !task.note;
    card.querySelector(".task-state").textContent = task.state === "completed" ? "单次任务已完成" : task.due < today ? "已过计划日期" : "等待完成";
    const complete = card.querySelector(".complete");
    complete.disabled = task.state === "completed";
    complete.textContent = task.state === "completed" ? "已完成" : "标记完成";
    complete.setAttribute("aria-label", "完成：" + task.title);
    complete.addEventListener("click", () => {
      state = completeTask(state, task.id);
      save();
      announce(task.repeat === "once" ? "已记录本次完成。可在全部任务和完成记录中查看。" : "已记录完成，下一次日期按完成当天顺延" + (task.repeat === "daily" ? "一天。" : "七天。"));
    });
    const remove = card.querySelector(".delete");
    remove.setAttribute("aria-label", "删除：" + task.title);
    remove.addEventListener("click", () => {
      deleted = { ...task };
      state.tasks = state.tasks.filter(t => t.id !== task.id);
      byId("undo-area").hidden = false;
      save();
      announce("任务已删除，可以撤销；已有完成记录保留。");
    });
    byId("tasks").append(card);
  }
  byId("history-count").textContent = state.history.length;
  byId("history-list").replaceChildren();
  for (const record of state.history.slice(-10).reverse()) {
    const item = document.createElement("li");
    item.textContent = `${record.title} · ${record.zone} · ${new Date(record.completedAt).toLocaleString("zh-CN")}`;
    byId("history-list").append(item);
  }
}
byId("due").value = dateKey();
byId("task-form").addEventListener("submit", event => {
  event.preventDefault();
  if (state.tasks.length >= 200) return announce("当前最多保存 200 项任务，请先导出并整理已有任务。");
  const title = byId("title").value.trim();
  if (!title) return announce("请填写任务名称。");
  const task = { id: crypto.randomUUID(), title, zone: byId("zone").value, repeat: byId("repeat").value,
    due: byId("due").value, note: byId("note").value.trim(), state: "open" };
  try { normalizeState({ ...state, tasks: [...state.tasks, task] }); }
  catch (error) { return announce(error.message); }
  state.tasks.push(task);
  const persisted = save();
  byId("title").value = "";
  byId("note").value = "";
  announce(persisted ? "任务已添加，记录保存在当前浏览器。" : "任务已添加到当前页面，但未能保存；关闭前请导出 CSV。");
});
byId("filter").addEventListener("change", render);
byId("undo").addEventListener("click", () => {
  if (!deleted) return;
  if (state.tasks.length >= 200) return announce("任务已满，请整理后再撤销。");
  state.tasks.push(deleted);
  deleted = null;
  byId("undo-area").hidden = true;
  save();
  announce("已恢复刚才删除的任务。");
});
byId("sample").addEventListener("click", () => {
  if (state.tasks.length > 197) return announce("示例需要三个空位，请先整理已有任务。");
  const samples = [{ title: "示例：吸除客厅地面浮毛", zone: "客厅" }, { title: "示例：清理沙发表面浮毛", zone: "客厅" }, { title: "示例：整理猫砂周边", zone: "宠物活动区" }];
  for (const sample of samples) {
    if (!state.tasks.some(t => t.title === sample.title)) state.tasks.push({ ...sample, id: crypto.randomUUID(), due: dateKey(), repeat: "once", note: "示例任务，日期和安排可按自己的需要决定。", state: "open" });
  }
  save();
  announce("示例任务已加入，均未完成；这些是演示资料。");
});
byId("export").addEventListener("click", () => {
  const url = URL.createObjectURL(new Blob([exportCSV(state)], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `拾爪清洁簿-${dateKey()}.csv`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  announce("已生成 CSV，包含当前任务和已保存的完成记录。");
});
byId("print").addEventListener("click", () => { byId("filter").value = "all"; render(); window.print(); });
render();
