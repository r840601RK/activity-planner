const API_URL = "https://script.google.com/macros/s/AKfycbwmm__A8DmQuL8DPsWBjZcc5S09syJNxrpsvTvoAx2oWdVmw4j5BMN8sbLMLdL_gihV/exec";
const DEFAULT_USER = "";
const IMPORTED_STORAGE_KEY = "activityPlanner.importedActivities";
const USER_STORAGE_KEY = "activityPlanner.user";

const PERIODS = {
  early: { label: "月初", sortDay: "05" },
  middle: { label: "月中", sortDay: "15" },
  late: { label: "月末", sortDay: "25" },
};

const state = {
  ownActivities: [],
  importedActivities: [],
};

const els = {
  form: document.querySelector("#activityForm"),
  userName: document.querySelector("#userName"),
  loadUserButton: document.querySelector("#loadUserButton"),
  title: document.querySelector("#title"),
  date: document.querySelector("#date"),
  startDate: document.querySelector("#startDate"),
  endDate: document.querySelector("#endDate"),
  month: document.querySelector("#month"),
  datePeriod: document.querySelector("#datePeriod"),
  note: document.querySelector("#note"),
  formStatus: document.querySelector("#formStatus"),
  shareStatus: document.querySelector("#shareStatus"),
  refreshButton: document.querySelector("#refreshButton"),
  makeShareCode: document.querySelector("#makeShareCode"),
  copyShareCode: document.querySelector("#copyShareCode"),
  importShareCode: document.querySelector("#importShareCode"),
  clearImported: document.querySelector("#clearImported"),
  shareCode: document.querySelector("#shareCode"),
  importCode: document.querySelector("#importCode"),
  activityList: document.querySelector("#activityList"),
  summaryText: document.querySelector("#summaryText"),
  exactDateField: document.querySelector("#exactDateField"),
  rangeDateField: document.querySelector("#rangeDateField"),
  fuzzyDateField: document.querySelector("#fuzzyDateField"),
  dateModeInputs: Array.from(document.querySelectorAll('input[name="dateMode"]')),
};

init();

function init() {
  els.userName.value = DEFAULT_USER;
  state.importedActivities = readImportedActivities();

  els.form.addEventListener("submit", handleAddActivity);
  els.loadUserButton.addEventListener("click", loadActivities);
  els.refreshButton.addEventListener("click", loadActivities);
  els.userName.addEventListener("keydown", handleUserNameKeydown);
  els.makeShareCode.addEventListener("click", makeShareCode);
  els.copyShareCode.addEventListener("click", copyShareCode);
  els.importShareCode.addEventListener("click", importShareCode);
  els.clearImported.addEventListener("click", clearImportedActivities);
  els.dateModeInputs.forEach((input) => input.addEventListener("change", updateDateMode));

  updateDateMode();
  renderActivities();
  setStatus(els.formStatus, "請先輸入使用者名稱，然後按讀取活動。");
}

async function handleAddActivity(event) {
  event.preventDefault();

  const user = getCurrentUser();
  const data = {
    user,
    title: els.title.value.trim(),
    date: getDateValue(),
    note: els.note.value.trim(),
  };

  if (!data.user || !data.title || !data.date) {
    setStatus(els.formStatus, "請填寫使用者、活動名稱和日期。", true);
    return;
  }

  try {
    data.date = validateDateValue(data.date);
  } catch (error) {
    setStatus(els.formStatus, error.message, true);
    return;
  }

  setStatus(els.formStatus, "新增中...");

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify(data),
    });

    const result = await readJsonResponse(response);
    if (!response.ok || !result.ok) {
      throw new Error(result.error || "Google Sheets 沒有回傳成功狀態");
    }

    els.form.reset();
    els.userName.value = user;
    updateDateMode();
    setStatus(els.formStatus, "已新增，活動列表已更新。");
    await loadActivities();
  } catch (error) {
    setStatus(els.formStatus, `新增失敗：${error.message}`, true);
  }
}

async function loadActivities() {
  const user = getCurrentUser();
  if (!user) {
    state.ownActivities = [];
    renderActivities();
    setStatus(els.formStatus, "請先輸入使用者名稱。", true);
    return;
  }

  localStorage.setItem(USER_STORAGE_KEY, user);
  setStatus(els.formStatus, "讀取中...");

  try {
    const response = await fetch(`${API_URL}?user=${encodeURIComponent(user)}`);
    const activities = await readJsonResponse(response);

    if (!response.ok || !Array.isArray(activities)) {
      throw new Error("Google Sheets 回傳格式不正確");
    }

    state.ownActivities = activities.map(normalizeOwnActivity);
    renderActivities();
    setStatus(els.formStatus, `已載入 ${state.ownActivities.length} 筆我的活動。`);
  } catch (error) {
    setStatus(els.formStatus, `讀取失敗：${error.message}`, true);
    renderActivities();
  }
}

function handleUserChange() {
  localStorage.setItem(USER_STORAGE_KEY, getCurrentUser());
  state.ownActivities = [];
  loadActivities();
}

function handleUserNameKeydown(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    loadActivities();
  }
}

function updateDateMode() {
  const mode = getDateMode();
  setDateFieldVisible(els.exactDateField, mode === "exact");
  setDateFieldVisible(els.rangeDateField, mode === "range");
  setDateFieldVisible(els.fuzzyDateField, mode === "fuzzy");
}

function setDateFieldVisible(element, isVisible) {
  element.hidden = !isVisible;
  element.classList.toggle("is-hidden", !isVisible);
  element.style.display = isVisible ? "" : "none";
}

function getDateMode() {
  return els.dateModeInputs.find((input) => input.checked)?.value || "exact";
}

function getDateValue() {
  if (getDateMode() === "range") {
    if (!els.startDate.value || !els.endDate.value) return "";
    return `${els.startDate.value}..${els.endDate.value}`;
  }

  if (getDateMode() === "fuzzy") {
    return els.month.value ? `${els.month.value}|${els.datePeriod.value}` : "";
  }

  return els.date.value;
}

function renderActivities() {
  const activities = getSortedActivities();
  const conflictMap = findConflicts(activities);
  els.activityList.innerHTML = "";

  if (activities.length === 0) {
    els.activityList.innerHTML = '<div class="empty-state">目前沒有活動。新增活動或貼上分享碼後，這裡會依日期排序顯示。</div>';
    els.summaryText.textContent = "目前沒有活動。";
    return;
  }

  const conflictCount = Array.from(conflictMap.values()).filter(Boolean).length;
  els.summaryText.textContent = `共 ${activities.length} 筆活動，其中 ${conflictCount} 筆有同日、區間重疊或可能衝突。`;

  const fragment = document.createDocumentFragment();
  activities.forEach((activity) => {
    const conflictType = conflictMap.get(activity.id);
    const card = document.createElement("article");
    card.className = `activity-card ${activity.source} ${conflictType ? "conflict" : ""}`;
    card.dataset.id = activity.id;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "share-select";
    checkbox.value = activity.id;
    checkbox.checked = activity.selected || false;
    checkbox.addEventListener("change", () => {
      activity.selected = checkbox.checked;
    });

    card.append(
      checkbox,
      makeElement("div", "activity-date", formatActivityDate(activity.dateInfo)),
      makeActivityBody(activity),
      makeBadges(activity, conflictType)
    );

    fragment.append(card);
  });

  els.activityList.append(fragment);
}

function makeActivityBody(activity) {
  const body = document.createElement("div");
  body.className = "activity-body";
  body.append(makeElement("div", "activity-title", activity.title));

  if (activity.note) {
    body.append(makeElement("div", "activity-note", activity.note));
  }

  return body;
}

function makeBadges(activity, conflictType) {
  const badges = document.createElement("div");
  badges.className = "badges";
  badges.append(makeElement("span", "badge", activity.source === "own" ? "我的" : `匯入：${activity.user}`));

  if (activity.dateInfo.type === "fuzzy") {
    badges.append(makeElement("span", "badge", "日期未定"));
  }

  if (activity.dateInfo.type === "range") {
    badges.append(makeElement("span", "badge", "日期區間"));
  }

  if (conflictType) {
    badges.append(makeElement("span", "badge conflict", getConflictLabel(conflictType)));
  }

  return badges;
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  return element;
}

function makeShareCode() {
  const selectedIds = new Set(
    Array.from(document.querySelectorAll(".share-select:checked")).map((checkbox) => checkbox.value)
  );
  const selectedActivities = getSortedActivities()
    .filter((activity) => selectedIds.has(activity.id))
    .map(({ id, user, title, date, note }) => ({ id, user, title, date, note }));

  if (selectedActivities.length === 0) {
    setStatus(els.shareStatus, "請先勾選要分享的活動。", true);
    return;
  }

  els.shareCode.value = encodeShareCode(selectedActivities);
  setStatus(els.shareStatus, `已產生 ${selectedActivities.length} 筆活動的分享碼。`);
}

async function copyShareCode() {
  if (!els.shareCode.value) {
    setStatus(els.shareStatus, "目前沒有可複製的分享碼。", true);
    return;
  }

  try {
    await navigator.clipboard.writeText(els.shareCode.value);
    setStatus(els.shareStatus, "分享碼已複製。");
  } catch {
    els.shareCode.select();
    document.execCommand("copy");
    setStatus(els.shareStatus, "分享碼已複製。");
  }
}

function importShareCode() {
  const code = els.importCode.value.trim();
  if (!code) {
    setStatus(els.shareStatus, "請先貼上分享碼。", true);
    return;
  }

  try {
    const imported = decodeShareCode(code).map(normalizeImportedActivity);
    const knownIds = new Set(state.importedActivities.map((activity) => activity.id));
    const newItems = imported.filter((activity) => !knownIds.has(activity.id));

    state.importedActivities = [...state.importedActivities, ...newItems];
    localStorage.setItem(IMPORTED_STORAGE_KEY, JSON.stringify(state.importedActivities));
    els.importCode.value = "";
    renderActivities();
    setStatus(els.shareStatus, `已整合 ${newItems.length} 筆新活動到你的畫面，不會寫入 Google Sheets。`);
  } catch (error) {
    setStatus(els.shareStatus, `分享碼無法解析：${error.message}`, true);
  }
}

function clearImportedActivities() {
  state.importedActivities = [];
  localStorage.removeItem(IMPORTED_STORAGE_KEY);
  renderActivities();
  setStatus(els.shareStatus, "已清除匯入活動。");
}

function getSortedActivities() {
  return [...state.ownActivities, ...state.importedActivities].sort((a, b) => {
    const dateCompare = a.dateInfo.sortKey.localeCompare(b.dateInfo.sortKey);
    if (dateCompare !== 0) return dateCompare;
    return a.title.localeCompare(b.title, "zh-Hant");
  });
}

function findConflicts(activities) {
  const result = new Map();

  for (let i = 0; i < activities.length; i += 1) {
    for (let j = i + 1; j < activities.length; j += 1) {
      const a = activities[i];
      const b = activities[j];
      const conflictType = getConflictType(a.dateInfo, b.dateInfo);

      if (conflictType) {
        markConflict(result, a.id, conflictType);
        markConflict(result, b.id, conflictType);
      }
    }
  }

  return result;
}

function markConflict(result, id, type) {
  if (result.get(id) === "exact") return;
  result.set(id, type);
}

function getConflictType(a, b) {
  if (!a.raw || !b.raw) return "";

  if (a.type === "exact" && b.type === "exact") {
    return a.raw === b.raw ? "exact" : "";
  }

  if (dateRangesOverlap(a, b)) {
    if (a.type === "fuzzy" || b.type === "fuzzy") return "possible";
    return "overlap";
  }

  return "";
}

function getConflictLabel(type) {
  if (type === "exact") return "同日衝突";
  if (type === "overlap") return "區間重疊";
  return "可能衝突";
}

function dateRangesOverlap(a, b) {
  if (!a.startDate || !a.endDate || !b.startDate || !b.endDate) {
    return false;
  }

  return a.startDate <= b.endDate && b.startDate <= a.endDate;
}

function validateDateValue(dateValue) {
  const info = parseDateInfo(dateValue);

  if (info.type === "range" && info.startDate > info.endDate) {
    throw new Error("結束日期不能早於開始日期");
  }

  return dateValue;
}

function normalizeOwnActivity(activity) {
  const date = normalizeDateValue(activity.date);
  return {
    id: String(activity.id || crypto.randomUUID()),
    user: String(activity.user || getCurrentUser()),
    title: String(activity.title || ""),
    date,
    dateInfo: parseDateInfo(date),
    note: String(activity.note || ""),
    created_at: activity.created_at || "",
    source: "own",
  };
}

function normalizeImportedActivity(activity) {
  const date = normalizeDateValue(activity.date);
  return {
    id: `shared-${activity.id || crypto.randomUUID()}`,
    user: String(activity.user || "Unknown"),
    title: String(activity.title || ""),
    date,
    dateInfo: parseDateInfo(date),
    note: String(activity.note || ""),
    source: "imported",
  };
}

function readImportedActivities() {
  try {
    return JSON.parse(localStorage.getItem(IMPORTED_STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function getCurrentUser() {
  return els.userName.value.trim();
}

function normalizeDateValue(value) {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}\|(early|middle|late)$/.test(value)) return value;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}\.\.\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString().slice(0, 10);
}

function parseDateInfo(value) {
  const raw = normalizeDateValue(value);
  const fuzzyMatch = raw.match(/^(\d{4}-\d{2})\|(early|middle|late)$/);

  if (fuzzyMatch) {
    const [, month, period] = fuzzyMatch;
    const bounds = getPeriodBounds(month, period);
    return {
      raw,
      type: "fuzzy",
      month,
      period,
      startDate: bounds.startDate,
      endDate: bounds.endDate,
      sortKey: `${month}-${PERIODS[period].sortDay}`,
    };
  }

  const rangeMatch = raw.match(/^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/);
  if (rangeMatch) {
    const [, startDate, endDate] = rangeMatch;
    return {
      raw,
      type: "range",
      month: startDate.slice(0, 7),
      period: "",
      startDate,
      endDate,
      sortKey: startDate,
    };
  }

  const exactMatch = raw.match(/^(\d{4}-\d{2})-(\d{2})$/);
  if (exactMatch) {
    const [, month, dayText] = exactMatch;
    return {
      raw,
      type: "exact",
      month,
      period: getPeriodForDay(Number(dayText)),
      startDate: raw,
      endDate: raw,
      sortKey: raw,
    };
  }

  return {
    raw,
    type: "unknown",
    month: "",
    period: "",
    startDate: "",
    endDate: "",
    sortKey: raw || "9999-99-99",
  };
}

function getPeriodBounds(month, period) {
  if (period === "early") {
    return { startDate: `${month}-01`, endDate: `${month}-10` };
  }

  if (period === "middle") {
    return { startDate: `${month}-11`, endDate: `${month}-20` };
  }

  const lastDay = new Date(`${month}-01T00:00:00`);
  lastDay.setMonth(lastDay.getMonth() + 1);
  lastDay.setDate(0);

  return {
    startDate: `${month}-21`,
    endDate: `${month}-${String(lastDay.getDate()).padStart(2, "0")}`,
  };
}

function getPeriodForDay(day) {
  if (day <= 10) return "early";
  if (day <= 20) return "middle";
  return "late";
}

function formatActivityDate(info) {
  if (!info.raw) return "未設定";

  if (info.type === "fuzzy") {
    const [year, month] = info.month.split("-");
    return `${year}/${month} ${PERIODS[info.period].label}`;
  }

  if (info.type === "range") {
    return `${formatShortDate(info.startDate)} - ${formatShortDate(info.endDate)}`;
  }

  if (info.type !== "exact") return info.raw;

  const date = new Date(`${info.raw}T00:00:00`);
  if (Number.isNaN(date.getTime())) return info.raw;
  return new Intl.DateTimeFormat("zh-Hant", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).format(date);
}

function formatShortDate(value) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-Hant", {
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).format(date);
}

function encodeShareCode(activities) {
  const json = JSON.stringify({
    version: 1,
    activities,
  });
  return btoa(unescape(encodeURIComponent(json)));
}

function decodeShareCode(code) {
  const json = decodeURIComponent(escape(atob(code)));
  const payload = JSON.parse(json);
  if (!payload || !Array.isArray(payload.activities)) {
    throw new Error("內容不是活動分享碼");
  }
  return payload.activities;
}

function setStatus(element, message, isError = false) {
  element.textContent = message;
  element.style.color = isError ? "var(--warn)" : "var(--muted)";
}

async function readJsonResponse(response) {
  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch {
    if (text.includes("找不到以下指令碼函式：doGet")) {
      throw new Error("Apps Script 部署版本找不到 doGet，請重新部署網頁應用程式");
    }

    if (text.includes("找不到以下指令碼函式：doPost")) {
      throw new Error("Apps Script 部署版本找不到 doPost，請重新部署網頁應用程式");
    }

    throw new Error("API 沒有回傳 JSON，請檢查 Apps Script 部署與權限設定");
  }
}
