import { Icon } from "./icons.js";

const h = React.createElement;
const { useEffect, useMemo, useState } = React;

const tabs = [
  { id: "today", label: "오늘", icon: "calendar" },
  { id: "checklist", label: "체크", icon: "checklist" },
  { id: "search", label: "검색", icon: "search" },
  { id: "news", label: "뉴스", icon: "book" },
  { id: "admin", label: "관리", icon: "settings" }
];

const routineCategories = [
  { id: "분유", icon: "formula", tone: "mint" },
  { id: "모유", icon: "feeding", tone: "mint" },
  { id: "수유", icon: "feeding", tone: "mint" },
  { id: "이유식", icon: "meal", tone: "coral" },
  { id: "낮잠", icon: "nap", tone: "blue" },
  { id: "밤잠", icon: "sleep", tone: "ink" },
  { id: "기저귀", icon: "baby", tone: "olive" },
  { id: "어린이집", icon: "daycare", tone: "gray" },
  { id: "목욕", icon: "bath", tone: "sky" },
  { id: "산책", icon: "walk", tone: "green" },
  { id: "약 복용", icon: "medicine", tone: "red" },
  { id: "메모", icon: "note", tone: "gray" }
];

const quickRoutinePresets = [
  { category: "분유", icon: "formula", amount: "기록", tone: "mint" },
  { category: "모유", icon: "feeding", amount: "기록", tone: "mint" },
  { category: "낮잠", icon: "nap", amount: "시작", tone: "blue" },
  { category: "기저귀", icon: "baby", amount: "교체", tone: "olive" },
  { category: "이유식", icon: "meal", amount: "기록", tone: "coral" },
  { category: "어린이집", icon: "daycare", amount: "등원", tone: "gray" },
  { category: "산책", icon: "walk", amount: "기록", tone: "green" },
  { category: "약 복용", icon: "medicine", amount: "기록", tone: "red" }
];

const defaultQuickSettings = {
  formulaA: 120,
  formulaB: 160,
  nursingMinutes: 10
};

const summaryGroups = [
  { label: "먹기", icon: "formula", categories: ["분유", "모유", "수유", "이유식"] },
  { label: "잠", icon: "sleep", categories: ["낮잠", "밤잠"] },
  { label: "기저귀", icon: "baby", categories: ["기저귀"] },
  { label: "외부", icon: "daycare", categories: ["어린이집", "산책"] }
];

const checklistCategories = ["예방접종", "영유아 건강검진", "수면", "수유/이유식", "발달", "안전"];

function todayString() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
}

function currentTimeString() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function loadQuickSettings() {
  try {
    return {
      ...defaultQuickSettings,
      ...JSON.parse(localStorage.getItem("quickRoutineSettings") || "{}")
    };
  } catch {
    return defaultQuickSettings;
  }
}

function quickShortcutsFromSettings(settings) {
  return [
    { label: `분유 ${settings.formulaA}`, category: "분유", amount: `${settings.formulaA}ml`, icon: "formula", tone: "mint" },
    { label: `분유 ${settings.formulaB}`, category: "분유", amount: `${settings.formulaB}ml`, icon: "formula", tone: "mint" },
    { label: `모유 ${settings.nursingMinutes}분`, category: "모유", amount: `${settings.nursingMinutes}분`, icon: "feeding", tone: "mint" },
    { label: "소변", category: "기저귀", amount: "소변", icon: "baby", tone: "olive" },
    { label: "대변", category: "기저귀", amount: "대변", icon: "baby", tone: "olive" },
    { label: "하원", category: "어린이집", amount: "하원", icon: "pickup", tone: "gray" }
  ];
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    credentials: "same-origin",
    headers: {
      "content-type": "application/json",
      ...(options.headers || {})
    }
  });
  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.error || "요청을 처리하지 못했습니다.");
    error.status = response.status;
    error.code = data.code;
    throw error;
  }

  return data;
}

function cx(...items) {
  return items.filter(Boolean).join(" ");
}

function categoryMeta(category) {
  return routineCategories.find((item) => item.id === category) || routineCategories.at(-1);
}

function visibleEntryTime(entry) {
  return String(entry.entryTime || "").slice(0, 5);
}

function findLastEntry(entries, categories) {
  return [...entries]
    .reverse()
    .find((entry) => categories.includes(entry.category));
}

function countEntries(entries, categories) {
  return entries.filter((entry) => categories.includes(entry.category)).length;
}

function ageTagRank(tag) {
  const monthMatch = tag.match(/^(\d+)~(\d+)개월$/);
  if (monthMatch) {
    return {
      isAge: true,
      start: Number(monthMatch[1]),
      end: Number(monthMatch[2]),
      label: tag
    };
  }

  const yearRangeMatch = tag.match(/^만\s*(\d+)~(\d+)세$/);
  if (yearRangeMatch) {
    return {
      isAge: true,
      start: Number(yearRangeMatch[1]) * 12,
      end: Number(yearRangeMatch[2]) * 12,
      label: tag
    };
  }

  const yearMatch = tag.match(/^만\s*(\d+)세$/);
  if (yearMatch) {
    const start = Number(yearMatch[1]) * 12;
    return { isAge: true, start, end: start + 11, label: tag };
  }

  return { isAge: false, start: 9999, end: 9999, label: tag };
}

const redundantAgeTags = new Map([
  ["4~12개월", ["4~6개월", "7~9개월", "10~12개월"]],
  ["만3~5세", ["만4~5세"]]
]);

function compareTextTags(a, b) {
  return a.localeCompare(b, "ko", { numeric: true, sensitivity: "base" });
}

function sortSearchTags(tags) {
  const uniqueTags = Array.from(new Set(tags));
  const hiddenAgeTags = new Set();
  const tagSet = new Set(uniqueTags);

  redundantAgeTags.forEach((coveredTags, broadTag) => {
    if (tagSet.has(broadTag)) {
      coveredTags.forEach((coveredTag) => hiddenAgeTags.add(coveredTag));
    }
  });

  const visibleTags = uniqueTags.filter((tag) => !hiddenAgeTags.has(tag));

  return visibleTags.sort((a, b) => {
    const ageA = ageTagRank(a);
    const ageB = ageTagRank(b);

    if (ageA.isAge && ageB.isAge) {
      if (ageA.start !== ageB.start) return ageA.start - ageB.start;
      if (ageA.end !== ageB.end) return ageB.end - ageA.end;
      return ageA.label.localeCompare(ageB.label, "ko");
    }

    if (ageA.isAge !== ageB.isAge) return ageA.isAge ? -1 : 1;
    return compareTextTags(a, b);
  });
}

function groupSearchTags(tags) {
  const sortedTags = sortSearchTags(tags);
  return {
    ageTags: sortedTags.filter((tag) => ageTagRank(tag).isAge),
    topicTags: sortedTags.filter((tag) => !ageTagRank(tag).isAge)
  };
}

function EmptyState({ icon = "alert", title, body }) {
  return h(
    "div",
    { className: "empty-state" },
    h("div", { className: "empty-icon" }, h(Icon, { name: icon, size: 24 })),
    h("strong", null, title),
    body ? h("p", null, body) : null
  );
}

function IconButton({ icon, label, onClick, variant = "ghost", type = "button", disabled = false }) {
  return h(
    "button",
    {
      className: cx("icon-button", variant),
      type,
      onClick,
      disabled,
      title: label,
      "aria-label": label
    },
    h(Icon, { name: icon, size: 18 })
  );
}

function ActionButton({ icon, children, onClick, variant = "primary", type = "button", disabled = false }) {
  return h(
    "button",
    { className: cx("action-button", variant), onClick, type, disabled },
    icon ? h(Icon, { name: icon, size: 18 }) : null,
    h("span", null, children)
  );
}

function Field({ label, children }) {
  return h("label", { className: "field" }, h("span", null, label), children);
}

function ProfilePanel({ babies, selectedBabyId, setSelectedBabyId, onChanged }) {
  const selectedBaby = babies.find((baby) => String(baby.id) === String(selectedBabyId));
  const [editing, setEditing] = useState(!selectedBaby);
  const [form, setForm] = useState({
    name: selectedBaby?.name || "",
    birthDate: selectedBaby?.birthDate || "",
    sex: selectedBaby?.sex || "unspecified"
  });
  const [error, setError] = useState("");

  useEffect(() => {
    setForm({
      name: selectedBaby?.name || "",
      birthDate: selectedBaby?.birthDate || "",
      sex: selectedBaby?.sex || "unspecified"
    });
    setEditing(!selectedBaby);
  }, [selectedBabyId, babies.length]);

  async function submit(event) {
    event.preventDefault();
    setError("");

    try {
      const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
      const result = selectedBaby
        ? await api(`/api/babies/${selectedBaby.id}`, { method: "PUT", body: JSON.stringify(payload) })
        : await api("/api/babies", { method: "POST", body: JSON.stringify(payload) });

      localStorage.setItem("selectedBabyId", result.baby.id);
      setSelectedBabyId(result.baby.id);
      setEditing(false);
      await onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  return h(
    "section",
    { className: "profile-panel" },
    h(
      "div",
      { className: "panel-title-row" },
      h("div", { className: "title-with-icon" }, h(Icon, { name: "baby" }), h("h2", null, "아기 프로필")),
      selectedBaby ? h(IconButton, { icon: editing ? "close" : "edit", label: editing ? "닫기" : "수정", onClick: () => setEditing(!editing) }) : null
    ),
    selectedBaby && !editing
      ? h(
          "div",
          { className: "baby-summary" },
          h(
            "div",
            null,
            h("strong", null, selectedBaby.name),
            h("span", null, selectedBaby.sex === "female" ? "여아" : selectedBaby.sex === "male" ? "남아" : "성별 미지정")
          ),
          h(
            "div",
            { className: "age-pill" },
            h("span", null, `생후 ${selectedBaby.ageMonths}개월`),
            h("small", null, `${selectedBaby.ageDays}일`)
          )
        )
      : h(
          "form",
          { className: "profile-form", onSubmit: submit },
          h(
            "div",
            { className: "form-grid" },
            h(
              Field,
              { label: "이름" },
              h("input", {
                name: "name",
                value: form.name,
                onChange: (event) => setForm({ ...form, name: event.target.value }),
                placeholder: "아기 이름"
              })
            ),
            h(
              Field,
              { label: "생년월일" },
              h("input", {
                name: "birthDate",
                type: "date",
                value: form.birthDate,
                onChange: (event) => setForm({ ...form, birthDate: event.target.value })
              })
            ),
            h(
              Field,
              { label: "성별" },
              h(
                "select",
                { name: "sex", value: form.sex, onChange: (event) => setForm({ ...form, sex: event.target.value }) },
                h("option", { value: "unspecified" }, "미지정"),
                h("option", { value: "female" }, "여아"),
                h("option", { value: "male" }, "남아")
              )
            )
          ),
          error ? h("p", { className: "form-error" }, error) : null,
          h(ActionButton, { type: "submit", icon: "save" }, selectedBaby ? "저장" : "등록")
        ),
    babies.length > 1
      ? h(
          Field,
          { label: "프로필 선택" },
          h(
            "select",
            {
              value: selectedBabyId || "",
              onChange: (event) => {
                localStorage.setItem("selectedBabyId", event.target.value);
                setSelectedBabyId(event.target.value);
              }
            },
            babies.map((baby) => h("option", { key: baby.id, value: baby.id }, baby.name))
          )
        )
      : null
  );
}

function RoutineForm({ babyId, date, editingEntry, onSaved, onCancel }) {
  const [form, setForm] = useState({
    babyId,
    entryDate: date,
    entryTime: currentTimeString(),
    category: "분유",
    amount: "",
    note: ""
  });
  const [error, setError] = useState("");

  useEffect(() => {
    setForm(
      editingEntry
        ? {
            babyId,
            entryDate: date,
            entryTime: editingEntry.entryTime.slice(0, 5),
            category: editingEntry.category,
            amount: editingEntry.amount || "",
            note: editingEntry.note || ""
          }
        : {
            babyId,
            entryDate: date,
            entryTime: currentTimeString(),
            category: "분유",
            amount: "",
            note: ""
          }
    );
  }, [babyId, date, editingEntry?.id]);

  async function submit(event) {
    event.preventDefault();
    setError("");

    try {
      const payload = {
        ...form,
        ...Object.fromEntries(new FormData(event.currentTarget).entries()),
        babyId,
        entryDate: date
      };
      if (editingEntry) {
        await api(`/api/routines/${editingEntry.id}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await api("/api/routines", { method: "POST", body: JSON.stringify(payload) });
      }
      await onSaved();
      if (!editingEntry) {
        setForm({ ...form, entryTime: currentTimeString(), amount: "", note: "" });
      }
    } catch (err) {
      setError(err.message);
    }
  }

  return h(
    "form",
    { className: "routine-form detail-routine-form", onSubmit: submit },
    h(
      "div",
      { className: "compact-form-head" },
      h("strong", null, editingEntry ? "기록 수정" : "상세 입력"),
      h("span", null, date)
    ),
    h(
      "div",
      { className: "form-grid routine-grid" },
      h(
        Field,
        { label: "시간" },
        h("input", {
          name: "entryTime",
          type: "time",
          value: form.entryTime,
          onChange: (event) => setForm({ ...form, entryTime: event.target.value })
        })
      ),
      h(
        Field,
        { label: "항목" },
        h(
          "select",
          { name: "category", value: form.category, onChange: (event) => setForm({ ...form, category: event.target.value }) },
          routineCategories.map((category) => h("option", { key: category.id, value: category.id }, category.id))
        )
      ),
      h(
        Field,
        { label: "양/상태" },
        h("input", {
          name: "amount",
          value: form.amount,
          onChange: (event) => setForm({ ...form, amount: event.target.value }),
          placeholder: "120ml, 30분, 보통"
        })
      ),
      h(
        Field,
        { label: "메모" },
        h("input", {
          name: "note",
          value: form.note,
          onChange: (event) => setForm({ ...form, note: event.target.value }),
          placeholder: "특이사항"
        })
      )
    ),
    error ? h("p", { className: "form-error" }, error) : null,
    h(
      "div",
      { className: "form-actions" },
      h(ActionButton, { type: "submit", icon: editingEntry ? "save" : "plus" }, editingEntry ? "수정" : "추가"),
      editingEntry ? h(ActionButton, { variant: "secondary", icon: "close", onClick: onCancel }, "취소") : null
    )
  );
}

function TodaySummary({ entries }) {
  return h(
    "div",
    { className: "today-summary", role: "list" },
    summaryGroups.map((group) => {
      const last = findLastEntry(entries, group.categories);
      const count = countEntries(entries, group.categories);
      return h(
        "article",
        { className: "summary-tile", key: group.label, role: "listitem" },
        h("span", { className: "summary-icon" }, h(Icon, { name: group.icon, size: 17 })),
        h("div", null, h("strong", null, group.label), h("span", null, last ? `${visibleEntryTime(last)} · ${last.amount || last.category}` : "없음")),
        h("b", null, count)
      );
    })
  );
}

function RoutineQuickPanel({ babyId, date, onSaved }) {
  const [busyKey, setBusyKey] = useState("");
  const [error, setError] = useState("");
  const [editingSettings, setEditingSettings] = useState(false);
  const [quickSettings, setQuickSettings] = useState(loadQuickSettings());

  function updateQuickSetting(key, value) {
    const nextValue = Math.max(1, Number(value) || defaultQuickSettings[key]);
    const next = { ...quickSettings, [key]: nextValue };
    setQuickSettings(next);
    localStorage.setItem("quickRoutineSettings", JSON.stringify(next));
  }

  async function quickSave(preset) {
    const key = `${preset.category}-${preset.amount}`;
    setBusyKey(key);
    setError("");

    try {
      await api("/api/routines", {
        method: "POST",
        body: JSON.stringify({
          babyId,
          entryDate: date,
          entryTime: currentTimeString(),
          category: preset.category,
          amount: preset.amount || "",
          note: ""
        })
      });
      await onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyKey("");
    }
  }

  return h(
    "section",
    { className: "quick-panel" },
    h(
      "div",
      { className: "quick-head" },
      h("div", null, h("h3", null, "빠른 기록"), h("span", null, currentTimeString())),
      h(IconButton, {
        icon: "settings",
        label: editingSettings ? "퀵메뉴 닫기" : "퀵메뉴 조정",
        onClick: () => setEditingSettings(!editingSettings)
      })
    ),
    h(
      "div",
      { className: "quick-grid" },
      quickRoutinePresets.map((preset) =>
        h(
          "button",
          {
            className: cx("quick-action", preset.tone),
            key: `${preset.category}-${preset.amount}`,
            type: "button",
            onClick: () => quickSave(preset),
            disabled: Boolean(busyKey)
          },
          h("span", { className: "quick-icon" }, h(Icon, { name: preset.icon, size: 21 })),
          h("strong", null, preset.category),
          h("small", null, busyKey === `${preset.category}-${preset.amount}` ? "저장중" : preset.amount)
        )
      )
    ),
    h(
      "div",
      { className: "shortcut-row" },
      quickShortcutsFromSettings(quickSettings).map((shortcut) =>
        h(
          "button",
          {
            className: "shortcut-chip",
            key: shortcut.label,
            type: "button",
            onClick: () => quickSave(shortcut),
            disabled: Boolean(busyKey)
          },
          h(Icon, { name: shortcut.icon, size: 15 }),
          h("span", null, shortcut.label)
        )
      )
    ),
    editingSettings
      ? h(
          "div",
          { className: "quick-settings" },
          h(
            Field,
            { label: "분유 A ml" },
            h("input", {
              type: "number",
              min: 1,
              step: 10,
              value: quickSettings.formulaA,
              onChange: (event) => updateQuickSetting("formulaA", event.target.value)
            })
          ),
          h(
            Field,
            { label: "분유 B ml" },
            h("input", {
              type: "number",
              min: 1,
              step: 10,
              value: quickSettings.formulaB,
              onChange: (event) => updateQuickSetting("formulaB", event.target.value)
            })
          ),
          h(
            Field,
            { label: "모유 분" },
            h("input", {
              type: "number",
              min: 1,
              step: 1,
              value: quickSettings.nursingMinutes,
              onChange: (event) => updateQuickSetting("nursingMinutes", event.target.value)
            })
          )
        )
      : null,
    error ? h("p", { className: "form-error" }, error) : null
  );
}

function TodayView({ baby }) {
  const [date, setDate] = useState(todayString());
  const [entries, setEntries] = useState([]);
  const [editingEntry, setEditingEntry] = useState(null);
  const [showDetailForm, setShowDetailForm] = useState(false);
  const [error, setError] = useState("");

  async function loadEntries() {
    if (!baby) return;
    try {
      setError("");
      const result = await api(`/api/routines?babyId=${encodeURIComponent(baby.id)}&date=${date}`);
      setEntries(result.entries);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadEntries();
  }, [baby?.id, date]);

  async function removeEntry(entry) {
    await api(`/api/routines/${entry.id}`, { method: "DELETE" });
    await loadEntries();
  }

  if (!baby) {
    return h(EmptyState, { icon: "profile", title: "등록된 아기 프로필이 없습니다.", body: "프로필을 먼저 등록해 주세요." });
  }

  return h(
    "section",
    { className: "view-stack" },
    h(
      "div",
      { className: "section-header" },
      h("div", null, h("h2", null, "하루 일과표"), h("p", null, `${baby.name} · 생후 ${baby.ageMonths}개월`)),
      h(
        "label",
        { className: "date-picker" },
        h(Icon, { name: "calendar", size: 18 }),
        h("input", { type: "date", value: date, onChange: (event) => setDate(event.target.value) })
      )
    ),
    h(TodaySummary, { entries }),
    h(RoutineQuickPanel, { babyId: baby.id, date, onSaved: loadEntries }),
    editingEntry || showDetailForm
      ? h(RoutineForm, {
          babyId: baby.id,
          date,
          editingEntry,
          onSaved: async () => {
            setEditingEntry(null);
            setShowDetailForm(false);
            await loadEntries();
          },
          onCancel: () => {
            setEditingEntry(null);
            setShowDetailForm(false);
          }
        })
      : h(
          "div",
          { className: "detail-toggle-row" },
          h(ActionButton, { variant: "secondary", icon: "plus", onClick: () => setShowDetailForm(true) }, "상세 입력")
        ),
    error ? h("p", { className: "form-error" }, error) : null,
    entries.length === 0
      ? h(EmptyState, { icon: "clock", title: "오늘 기록이 없습니다." })
      : h(
          "div",
          { className: "timeline" },
          entries.map((entry) => {
            const meta = categoryMeta(entry.category);
            return h(
              "article",
              { className: "timeline-item", key: entry.id },
              h("time", null, visibleEntryTime(entry)),
              h(
                "div",
                { className: "timeline-body" },
                h(
                  "div",
                  { className: "timeline-main" },
                  h("span", { className: cx("category-dot", meta.tone) }, h(Icon, { name: meta.icon, size: 16 })),
                  h("strong", null, entry.category),
                  entry.amount ? h("span", { className: "entry-amount" }, entry.amount) : null
                ),
                entry.note ? h("p", null, entry.note) : null
              ),
              h(
                "div",
                { className: "row-actions" },
                h(IconButton, { icon: "edit", label: "수정", onClick: () => setEditingEntry(entry) }),
                h(IconButton, { icon: "trash", label: "삭제", variant: "danger", onClick: () => removeEntry(entry) })
              )
            );
          })
        )
  );
}

function ChecklistView({ baby }) {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("전체");
  const [error, setError] = useState("");

  async function loadChecklist() {
    if (!baby) return;
    try {
      setError("");
      const result = await api(`/api/checklist?babyId=${encodeURIComponent(baby.id)}`);
      setItems(result.items);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadChecklist();
  }, [baby?.id, baby?.ageMonths]);

  async function toggle(item) {
    await api(`/api/checklist/${encodeURIComponent(item.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ babyId: baby.id, completed: !item.completed })
    });
    await loadChecklist();
  }

  if (!baby) {
    return h(EmptyState, { icon: "profile", title: "등록된 아기 프로필이 없습니다.", body: "프로필을 먼저 등록해 주세요." });
  }

  const filteredItems = filter === "전체" ? items : items.filter((item) => item.category === filter);
  const completedCount = items.filter((item) => item.completed).length;

  return h(
    "section",
    { className: "view-stack" },
    h(
      "div",
      { className: "section-header" },
      h("div", null, h("h2", null, "월령별 체크리스트"), h("p", null, `${baby.ageMonths}개월 · ${completedCount}/${items.length}`))
    ),
    h(
      "div",
      { className: "chip-row" },
      ["전체", ...checklistCategories].map((category) =>
        h(
          "button",
          {
            key: category,
            className: cx("chip", filter === category && "active"),
            onClick: () => setFilter(category),
            type: "button"
          },
          category
        )
      )
    ),
    error ? h("p", { className: "form-error" }, error) : null,
    filteredItems.length === 0
      ? h(EmptyState, { icon: "checklist", title: "현재 월령에 표시할 항목이 없습니다." })
      : h(
          "div",
          { className: "checklist" },
          filteredItems.map((item) =>
            h(
              "article",
              { className: cx("check-item", item.completed && "done"), key: item.id },
              h(
                "button",
                {
                  className: "check-toggle",
                  type: "button",
                  onClick: () => toggle(item),
                  "aria-label": item.completed ? "완료 해제" : "완료"
                },
                item.completed ? h(Icon, { name: "check", size: 18 }) : null
              ),
              h(
                "div",
                null,
                h("span", { className: "item-category" }, item.category),
                h("h3", null, item.title),
                h("p", null, item.detail),
                h(
                  "a",
                  { href: item.sourceUrl, target: "_blank", rel: "noreferrer", className: "source-link" },
                  "출처",
                  h(Icon, { name: "external", size: 14 })
                )
              )
            )
          )
        )
  );
}

function InfoCard({ document }) {
  return h(
    "article",
    { className: "info-card" },
    h(
      "div",
      { className: "info-card-head" },
      h("span", { className: cx("grade", document.trustGrade === "A+" && "top") }, document.trustGrade),
      h("span", { className: "source-org" }, document.sourceInstitution)
    ),
    h("h3", null, document.title),
    h("p", null, document.summary),
    h(
      "div",
      { className: "tag-list" },
      (document.tags || []).map((tag) => h("span", { key: tag }, tag))
    ),
    h(
      "div",
      { className: "info-foot" },
      h("span", null, `최종 확인일 ${document.lastVerifiedAt}`),
      h(
        "a",
        { href: document.sourceUrl, target: "_blank", rel: "noreferrer" },
        "원문",
        h(Icon, { name: "external", size: 14 })
      )
    )
  );
}

function SourceRegistry({ sources }) {
  if (!sources.length) return null;

  return h(
    "details",
    { className: "source-registry" },
    h("summary", null, h(Icon, { name: "database", size: 17 }), h("span", null, "공식 출처 저장소")),
    h(
      "div",
      { className: "source-list" },
      sources.map((source) =>
        h(
          "a",
          {
            key: source.sourceUrl,
            href: source.sourceUrl,
            target: "_blank",
            rel: "noreferrer"
          },
          h("strong", null, source.sourceInstitution),
          h("span", null, source.useFor || "공식 자료"),
          h("small", null, source.sourceUrl)
        )
      )
    )
  );
}

function NewsCard({ item }) {
  return h(
    "article",
    { className: "news-card" },
    h(
      "div",
      { className: "news-meta" },
      h("span", null, item.sourceInstitution),
      item.publishedAt ? h("time", null, item.publishedAt) : null
    ),
    h("h3", null, item.title),
    item.summary ? h("p", null, item.summary) : null,
    h(
      "a",
      { href: item.sourceUrl, target: "_blank", rel: "noreferrer" },
      "원문 보기",
      h(Icon, { name: "external", size: 14 })
    )
  );
}

function NewsView() {
  const [items, setItems] = useState([]);
  const [sources, setSources] = useState([]);
  const [error, setError] = useState("");

  async function loadNews() {
    try {
      setError("");
      const result = await api("/api/news");
      setItems(result.items);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadNews();
    api("/api/sources")
      .then((result) => setSources(result.sources))
      .catch(() => setSources([]));
  }, []);

  return h(
    "section",
    { className: "view-stack" },
    h(
      "div",
      { className: "section-header" },
      h("div", null, h("h2", null, "육아 뉴스"), h("p", null, "정부·공공기관 RSS에서 육아 관련 소식만 모아봅니다.")),
      h(IconButton, { icon: "search", label: "새로고침", onClick: loadNews })
    ),
    h(SourceRegistry, { sources: sources.filter((source) => /RSS|뉴스|정책|보도|정부/.test(`${source.useFor} ${source.sourceInstitution}`)) }),
    error ? h("p", { className: "form-error" }, error) : null,
    items.length === 0
      ? h(EmptyState, { icon: "book", title: "표시할 육아 뉴스가 없습니다.", body: "공식 RSS가 응답하지 않았거나 최근 항목에 육아 키워드가 없을 수 있습니다." })
      : h("div", { className: "news-grid" }, items.map((item) => h(NewsCard, { key: `${item.sourceUrl}-${item.title}`, item })))
  );
}

function SearchView() {
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("");
  const [documents, setDocuments] = useState([]);
  const [sources, setSources] = useState([]);
  const [error, setError] = useState("");

  async function search(nextQuery = query, nextTag = tag) {
    try {
      setError("");
      const params = new URLSearchParams({ q: nextQuery, tag: nextTag });
      const result = await api(`/api/search?${params.toString()}`);
      setDocuments(result.documents);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    search("", "");
    api("/api/sources")
      .then((result) => setSources(result.sources))
      .catch(() => setSources([]));
  }, []);

  const tagGroups = useMemo(() => {
    const tagSet = new Set();
    documents.forEach((document) => (document.tags || []).forEach((item) => tagSet.add(item)));
    return groupSearchTags(Array.from(tagSet));
  }, [documents]);

  function submit(event) {
    event.preventDefault();
    search();
  }

  return h(
    "section",
    { className: "view-stack" },
    h(
      "div",
      { className: "section-header" },
      h("div", null, h("h2", null, "신뢰 정보 검색"), h("p", null, "공공기관·전문기관 출처만 저장합니다."))
    ),
    h(SourceRegistry, { sources }),
    h(
      "form",
      { className: "search-box", onSubmit: submit },
      h(Icon, { name: "search", size: 18 }),
      h("input", {
        value: query,
        onChange: (event) => setQuery(event.target.value),
        placeholder: "수유, 예방접종, 이유식"
      }),
      h(IconButton, { icon: "search", label: "검색", type: "submit", variant: "solid" })
    ),
    tagGroups.ageTags.length || tagGroups.topicTags.length
      ? h(
          "div",
          { className: "tag-panel" },
          h(
            "div",
            { className: "chip-row age-chip-row" },
            h(
              "button",
              {
                type: "button",
                className: cx("chip", "age-chip", tag === "" && "active"),
                onClick: () => {
                  setTag("");
                  search(query, "");
                }
              },
              "전체"
            ),
            tagGroups.ageTags.map((item) =>
              h(
                "button",
                {
                  type: "button",
                  className: cx("chip", "age-chip", tag === item && "active"),
                  key: item,
                  onClick: () => {
                    setTag(item);
                    search(query, item);
                  }
                },
                item
              )
            )
          ),
          tagGroups.topicTags.length
            ? h(
                "div",
                { className: "chip-row topic-chip-row" },
                tagGroups.topicTags.map((item) =>
                  h(
                    "button",
                    {
                      type: "button",
                      className: cx("chip", "topic-chip", tag === item && "active"),
                      key: item,
                      onClick: () => {
                        setTag(item);
                        search(query, item);
                      }
                    },
                    item
                  )
                )
              )
            : null
        )
      : null,
    error ? h("p", { className: "form-error" }, error) : null,
    documents.length === 0
      ? h(EmptyState, { icon: "search", title: "검색 결과가 없습니다." })
      : h("div", { className: "info-grid" }, documents.map((document) => h(InfoCard, { key: document.id, document })))
  );
}

function AdminView() {
  const blank = {
    title: "",
    summary: "",
    sourceInstitution: "",
    sourceUrl: "",
    lastVerifiedAt: todayString(),
    trustGrade: "A",
    tags: ""
  };
  const [documents, setDocuments] = useState([]);
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");

  async function loadDocuments() {
    const result = await api("/api/documents");
    setDocuments(result.documents);
  }

  useEffect(() => {
    loadDocuments();
  }, []);

  async function submit(event) {
    event.preventDefault();
    setError("");

    try {
      const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
      if (editingId) {
        await api(`/api/documents/${editingId}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await api("/api/documents", { method: "POST", body: JSON.stringify(payload) });
      }
      setForm(blank);
      setEditingId(null);
      await loadDocuments();
    } catch (err) {
      setError(err.message);
    }
  }

  function editDocument(document) {
    setEditingId(document.id);
    setForm({
      title: document.title,
      summary: document.summary,
      sourceInstitution: document.sourceInstitution,
      sourceUrl: document.sourceUrl,
      lastVerifiedAt: document.lastVerifiedAt,
      trustGrade: document.trustGrade,
      tags: (document.tags || []).join(", ")
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteDocument(document) {
    await api(`/api/documents/${document.id}`, { method: "DELETE" });
    await loadDocuments();
  }

  return h(
    "section",
    { className: "view-stack admin-view" },
    h(
      "div",
      { className: "section-header" },
      h("div", null, h("h2", null, "관리자 페이지"), h("p", null, "육아 정보 문서"))
    ),
    h(
      "form",
      { className: "admin-form", onSubmit: submit },
      h(
        "div",
        { className: "form-grid admin-grid" },
        h(
          Field,
          { label: "제목" },
          h("input", { name: "title", value: form.title, onChange: (event) => setForm({ ...form, title: event.target.value }) })
        ),
        h(
          Field,
          { label: "출처 기관" },
          h("input", {
            name: "sourceInstitution",
            value: form.sourceInstitution,
            onChange: (event) => setForm({ ...form, sourceInstitution: event.target.value })
          })
        ),
        h(
          Field,
          { label: "출처 URL" },
          h("input", {
            name: "sourceUrl",
            value: form.sourceUrl,
            onChange: (event) => setForm({ ...form, sourceUrl: event.target.value }),
            placeholder: "https://"
          })
        ),
        h(
          Field,
          { label: "최종 확인일" },
          h("input", {
            name: "lastVerifiedAt",
            type: "date",
            value: form.lastVerifiedAt,
            onChange: (event) => setForm({ ...form, lastVerifiedAt: event.target.value })
          })
        ),
        h(
          Field,
          { label: "신뢰 등급" },
          h(
            "select",
            { name: "trustGrade", value: form.trustGrade, onChange: (event) => setForm({ ...form, trustGrade: event.target.value }) },
            h("option", { value: "A+" }, "A+"),
            h("option", { value: "A" }, "A"),
            h("option", { value: "B" }, "B")
          )
        ),
        h(
          Field,
          { label: "태그" },
          h("input", {
            name: "tags",
            value: form.tags,
            onChange: (event) => setForm({ ...form, tags: event.target.value }),
            placeholder: "수유, 수면"
          })
        ),
        h(
          Field,
          { label: "요약" },
          h("textarea", {
            name: "summary",
            value: form.summary,
            onChange: (event) => setForm({ ...form, summary: event.target.value }),
            rows: 4
          })
        )
      ),
      error ? h("p", { className: "form-error" }, error) : null,
      h(
        "div",
        { className: "form-actions" },
        h(ActionButton, { type: "submit", icon: "save" }, editingId ? "수정 저장" : "문서 추가"),
        editingId
          ? h(ActionButton, { variant: "secondary", icon: "close", onClick: () => { setEditingId(null); setForm(blank); } }, "취소")
          : null
      )
    ),
    h(
      "div",
      { className: "admin-list" },
      documents.map((document) =>
        h(
          "article",
          { className: "admin-row", key: document.id },
          h(
            "div",
            null,
            h("strong", null, document.title),
            h("span", null, document.sourceInstitution),
            h("small", null, `${document.trustGrade} · ${document.lastVerifiedAt}`)
          ),
          h(
            "div",
            { className: "row-actions" },
            h(IconButton, { icon: "edit", label: "수정", onClick: () => editDocument(document) }),
            h(IconButton, { icon: "trash", label: "삭제", variant: "danger", onClick: () => deleteDocument(document) })
          )
        )
      )
    )
  );
}

function LockScreen({ onUnlocked }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ pin })
      });
      await onUnlocked();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return h(
    "div",
    { className: "lock-screen" },
    h(
      "section",
      { className: "lock-panel" },
      h("div", { className: "brand-mark" }, h(Icon, { name: "shield", size: 24 })),
      h("h1", null, "케어베이시스"),
      h("p", null, "가족 PIN으로 육아 기록을 보호합니다."),
      h(
        "form",
        { onSubmit: submit },
        h(
          Field,
          { label: "가족 PIN" },
          h("input", {
            type: "password",
            inputMode: "numeric",
            autoComplete: "current-password",
            value: pin,
            onChange: (event) => setPin(event.target.value),
            placeholder: "배포 시 설정한 PIN"
          })
        ),
        error ? h("p", { className: "form-error" }, error) : null,
        h(ActionButton, { type: "submit", icon: "check", disabled: submitting }, submitting ? "확인 중" : "열기")
      )
    )
  );
}

function App() {
  const [activeTab, setActiveTab] = useState("today");
  const [babies, setBabies] = useState([]);
  const [selectedBabyId, setSelectedBabyId] = useState(localStorage.getItem("selectedBabyId") || "");
  const [bootError, setBootError] = useState("");
  const [auth, setAuth] = useState({ checked: false, enabled: false, authenticated: false });

  async function checkAuth() {
    try {
      const result = await api("/api/auth/status");
      setAuth({ checked: true, enabled: result.enabled, authenticated: result.authenticated });
      if (result.authenticated) {
        await loadBabies();
      }
    } catch (err) {
      setBootError(err.message);
      setAuth({ checked: true, enabled: false, authenticated: false });
    }
  }

  async function signOut() {
    await api("/api/auth/logout", { method: "POST", body: JSON.stringify({}) });
    setAuth({ checked: true, enabled: true, authenticated: false });
    setBabies([]);
    setSelectedBabyId("");
  }

  async function loadBabies() {
    try {
      const result = await api("/api/babies");
      setBabies(result.babies);

      const storedId = localStorage.getItem("selectedBabyId");
      const nextSelected = result.babies.find((baby) => String(baby.id) === String(storedId))?.id || result.babies[0]?.id || "";
      if (nextSelected) {
        localStorage.setItem("selectedBabyId", nextSelected);
      }
      setSelectedBabyId(nextSelected);
    } catch (err) {
      if (err.status === 401) {
        setAuth((current) => ({ ...current, checked: true, authenticated: false, enabled: true }));
        return;
      }
      setBootError(err.message);
    }
  }

  useEffect(() => {
    checkAuth();
  }, []);

  const selectedBaby = babies.find((baby) => String(baby.id) === String(selectedBabyId));

  if (!auth.checked) {
    return h(
      "div",
      { className: "lock-screen" },
      h("section", { className: "lock-panel" }, h("div", { className: "brand-mark" }, h(Icon, { name: "shield", size: 24 })), h("p", null, "앱을 준비하고 있습니다."))
    );
  }

  if (auth.enabled && !auth.authenticated) {
    return h(LockScreen, { onUnlocked: checkAuth });
  }

  return h(
    "div",
    { className: "app-shell" },
    h(
      "header",
      { className: "app-header" },
      h(
        "div",
        { className: "brand" },
        h("div", { className: "brand-mark" }, h(Icon, { name: "shield", size: 22 })),
        h("div", null, h("h1", null, "케어베이시스"), h("span", null, "육아 루틴과 신뢰 정보"))
      ),
      auth.enabled ? h(IconButton, { icon: "close", label: "로그아웃", onClick: signOut }) : null
    ),
    bootError ? h("p", { className: "form-error page-error" }, bootError) : null,
    h(
      "main",
      { className: "main-layout" },
      h(
        "aside",
        { className: "side-column" },
        h(ProfilePanel, {
          babies,
          selectedBabyId,
          setSelectedBabyId,
          onChanged: loadBabies
        }),
        h(
          "nav",
          { className: "desktop-nav", "aria-label": "주요 메뉴" },
          tabs.map((tab) =>
            h(
              "button",
              {
                key: tab.id,
                className: cx(activeTab === tab.id && "active"),
                onClick: () => setActiveTab(tab.id),
                type: "button"
              },
              h(Icon, { name: tab.icon, size: 18 }),
              h("span", null, tab.label)
            )
          )
        )
      ),
      h(
        "div",
        { className: "content-column" },
        activeTab === "today" ? h(TodayView, { baby: selectedBaby }) : null,
        activeTab === "checklist" ? h(ChecklistView, { baby: selectedBaby }) : null,
        activeTab === "search" ? h(SearchView) : null,
        activeTab === "news" ? h(NewsView) : null,
        activeTab === "admin" ? h(AdminView) : null
      )
    ),
    h(
      "nav",
      { className: "mobile-tabs", "aria-label": "주요 메뉴" },
      tabs.map((tab) =>
        h(
          "button",
          {
            key: tab.id,
            className: cx(activeTab === tab.id && "active"),
            onClick: () => setActiveTab(tab.id),
            type: "button"
          },
          h(Icon, { name: tab.icon, size: 20 }),
          h("span", null, tab.label)
        )
      )
    )
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(h(App));
