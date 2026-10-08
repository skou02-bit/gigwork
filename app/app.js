(function () {
  "use strict";

  /* ---------- 定数 ---------- */
  var WEEKDAYS = ["月", "火", "水", "木", "金", "土", "日"];
  var MONTHDAYS = ["1","2","3","4","5","6","7","8","9","10","11","12","13","14","15","16","17","18","19","20","21","22","23","24","25","26","27","28","29","30","31","月末"];
  var HOURS = Array.from({ length: 24 }, function (_, h) { return h + ":00"; });
  var PLATFORM_PALETTE = ["#E8A33D", "#4C8BF5", "#9B6BD9", "#E85D75", "#4A9D8F", "#7A9D54", "#C77DFF"];

  var SCREENSHOT_PROMPT = "このスクショから、稼働日・プラットフォーム名・金額を読み取ってください。出力は1行につき1件、次の形式だけで出力してください（説明文は不要です）。\n\n1日ごとの金額が分かる場合：\n日付(YYYY-MM-DD),プラットフォーム名,金額(数字のみ)\n\n週や期間の合計額しか分からない場合（内訳がないスクショ）：\n開始日(YYYY-MM-DD)~終了日(YYYY-MM-DD),プラットフォーム名,金額(数字のみ)\n\n例：\n2024-09-13,Wolt,8400\n2024-09-09~2024-09-15,Uber Eats,18013";

  /* ---------- ストレージ ---------- */
  var STORAGE_KEY = "gigwork.v1";

  function defaultState() {
    return {
      weekStart: "mon",
      platforms: [
        { id: "uber", name: "Uber Eats", color: "#E8A33D",
          payday: { type: "weekly", days: ["火"] },
          period: { type: "weekly", startWeekday: "月", startTime: "4:00", endWeekday: "日", endTime: "4:00" } },
        { id: "wolt", name: "Wolt", color: "#4C8BF5",
          payday: { type: "weekly", days: ["金"] },
          period: { type: "weekly", startWeekday: "月", startTime: "0:00", endWeekday: "日", endTime: "0:00" } },
        { id: "timee", name: "タイミー", color: "#4A9D8F",
          payday: { type: "daily", days: [] },
          period: { type: "daily", time: "5:00" } }
      ],
      entries: [],
      fixedCosts: [],
      variableCosts: []
    };
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      var parsed = JSON.parse(raw);
      return Object.assign(defaultState(), parsed);
    } catch (e) {
      return defaultState();
    }
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  var state = load();

  /* ---------- 日付ユーティリティ ---------- */
  function pad2(n) { return n < 10 ? "0" + n : "" + n; }
  function toDateStr(d) { return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
  function parseDateStr(s) { var p = s.split("-").map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  function todayStr() { return toDateStr(new Date()); }
  function addDays(d, n) { var r = new Date(d); r.setDate(r.getDate() + n); return r; }
  function weekdayIndexMon0(d) { return (d.getDay() + 6) % 7; } // 月=0 ... 日=6
  function weekdayLabel(d) { return WEEKDAYS[weekdayIndexMon0(d)]; }

  var viewYear = new Date().getFullYear();
  var viewMonth = new Date().getMonth(); // 0-11

  function buildMonthGrid(year, month) {
    var first = new Date(year, month, 1);
    var startOffset = weekdayIndexMon0(first);
    var gridStart = addDays(first, -startOffset);
    var cells = [];
    for (var i = 0; i < 42; i++) {
      var d = addDays(gridStart, i);
      cells.push({ date: d, dateStr: toDateStr(d), inMonth: d.getMonth() === month });
    }
    return cells;
  }

  /* ---------- プラットフォーム ---------- */
  function platformById(id) { return state.platforms.filter(function (p) { return p.id === id; })[0]; }

  function paydaySummary(payday) {
    if (payday.type === "daily") return "日払い";
    if (payday.type === "weekly") {
      var w = payday.days.slice().sort(function (a, b) { return WEEKDAYS.indexOf(a) - WEEKDAYS.indexOf(b); });
      return w.length ? "毎週" + w.join("・") + "曜払い" : "曜日未設定";
    }
    var m = payday.days.slice().sort(function (a, b) { return MONTHDAYS.indexOf(a) - MONTHDAYS.indexOf(b); });
    return m.length ? "毎月" + m.join("・") + "日払い" : "日付未設定";
  }

  /* 次に集計期間が締まる日時（ミリ秒）を返す。アラートの「今使える手札」判定に使う。 */
  function nextPeriodCloseMs(period, fromDate) {
    function atTime(date, timeStr) {
      var hh = parseInt(timeStr, 10);
      var r = new Date(date);
      r.setHours(hh, 0, 0, 0);
      return r;
    }
    if (period.type === "daily") {
      var t = atTime(fromDate, period.time);
      if (t.getTime() <= fromDate.getTime()) t = addDays(t, 1);
      return t.getTime();
    }
    if (period.type === "weekly") {
      var endIdx = WEEKDAYS.indexOf(period.endWeekday);
      var cur = new Date(fromDate);
      for (var i = 0; i < 8; i++) {
        if (weekdayIndexMon0(cur) === endIdx) {
          var close = atTime(cur, period.endTime);
          if (close.getTime() > fromDate.getTime()) return close.getTime();
        }
        cur = addDays(cur, 1);
      }
      return addDays(fromDate, 7).getTime();
    }
    if (period.type === "monthly") {
      var best = null;
      (period.ranges || []).forEach(function (r) {
        [0, 1, 2].forEach(function (monthOffset) {
          var base = new Date(fromDate.getFullYear(), fromDate.getMonth() + monthOffset, 1);
          var daysInM = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
          var dayNum = r.endDay === "月末" ? daysInM : Math.min(parseInt(r.endDay, 10), daysInM);
          var close = atTime(new Date(base.getFullYear(), base.getMonth(), dayNum), r.time);
          if (close.getTime() > fromDate.getTime() && (best === null || close.getTime() < best)) best = close.getTime();
        });
      });
      return best || addDays(fromDate, 30).getTime();
    }
    return addDays(fromDate, 7).getTime();
  }

  /* ---------- 固定費の次回引き落とし日 ---------- */
  function nextDueDate(fixedCost, fromDate) {
    for (var offset = 0; offset < 3; offset++) {
      var base = new Date(fromDate.getFullYear(), fromDate.getMonth() + offset, 1);
      var daysInM = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
      var dayNum = fixedCost.dueDay === "月末" ? daysInM : Math.min(parseInt(fixedCost.dueDay, 10) || 1, daysInM);
      var due = new Date(base.getFullYear(), base.getMonth(), dayNum);
      if (due.getTime() >= new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate()).getTime()) return due;
    }
    return addDays(fromDate, 30);
  }

  /* ---------- アラート（固定費逆算） ---------- */
  function computeAlert() {
    var unpaid = state.fixedCosts.filter(function (f) { return !f.paid; });
    if (!unpaid.length) return null;
    var now = new Date();
    var total = unpaid.reduce(function (s, f) { return s + (Number(f.amount) || 0); }, 0);
    var deadline = unpaid.reduce(function (min, f) {
      var d = nextDueDate(f, now);
      return min === null || d.getTime() < min.getTime() ? d : min;
    }, null);

    var deadlineMs = deadline.getTime();
    var available = state.platforms.filter(function (p) {
      return nextPeriodCloseMs(p.period, now) <= deadlineMs || p.payday.type === "daily" || p.period.type === "daily";
    });
    if (!available.length) available = state.platforms.slice();

    var confirmed = state.entries.filter(function (e) {
      var d = parseDateStr(e.date);
      return d.getTime() <= now.getTime() && available.some(function (p) { return p.id === e.platformId; });
    }).reduce(function (s, e) { return s + (Number(e.amount) || 0); }, 0);

    var remainingNeeded = Math.max(0, total - confirmed);
    var days = Math.max(1, Math.round((deadlineMs - now.getTime()) / 86400000));
    var perDay = Math.ceil(remainingNeeded / days);

    var dailyTotals = {};
    state.entries.forEach(function (e) {
      if (!available.some(function (p) { return p.id === e.platformId; })) return;
      dailyTotals[e.date] = (dailyTotals[e.date] || 0) + (Number(e.amount) || 0);
    });
    var vals = Object.keys(dailyTotals).map(function (k) { return dailyTotals[k]; });
    var avg = vals.length ? vals.reduce(function (a, b) { return a + b; }, 0) / vals.length : 0;
    var max = vals.length ? Math.max.apply(null, vals) : 0;

    var level = "none";
    if (vals.length) {
      if (perDay > max) level = "red";
      else if (perDay > avg) level = "yellow";
    }

    var names = available.map(function (p) { return p.name; }).join("、");
    return {
      text: names + "で1日¥" + perDay.toLocaleString() + "稼ぐ必要があります",
      level: level
    };
  }

  /* ---------- ルーター ---------- */
  function currentRoute() {
    var h = location.hash.replace("#", "") || "/calendar";
    return h;
  }

  window.addEventListener("hashchange", render);

  /* ---------- 共通UI ---------- */
  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      if (attrs[k] === null || attrs[k] === undefined) return;
      if (k === "class") e.className = attrs[k];
      else if (k.indexOf("on") === 0) e.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
      else if (k === "html") e.innerHTML = attrs[k];
      else if (k === "value") e.value = attrs[k];
      else e.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) {
      if (c === null || c === undefined) return;
      e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return e;
  }

  function renderNavbar(active) {
    var items = [
      { id: "calendar", label: "カレンダー", icon: "📅" },
      { id: "expense", label: "支出", icon: "🧾" },
      { id: "result", label: "リザルト", icon: "📊" },
      { id: "settings", label: "設定", icon: "⚙️" }
    ];
    return el("div", { class: "navbar" }, items.map(function (it) {
      return el("button", {
        class: "navbtn" + (active === it.id ? " active" : ""),
        onclick: function () { location.hash = "#/" + it.id; }
      }, [el("span", {}, [it.icon]), el("span", {}, [it.label])]);
    }));
  }

  function toast(msg) {
    var t = el("div", { class: "toast" }, [msg]);
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 1800);
  }

  /* ================= カレンダー画面 ================= */
  function renderCalendar(root) {
    var now = new Date();
    var monthEntries = state.entries.filter(function (e) {
      var d = parseDateStr(e.date);
      return d.getFullYear() === viewYear && d.getMonth() === viewMonth;
    });
    var totalIncome = monthEntries.reduce(function (s, e) { return s + (Number(e.amount) || 0); }, 0);
    var totalBudget = state.fixedCosts.reduce(function (s, f) { return s + (Number(f.amount) || 0); }, 0)
      + state.variableCosts.reduce(function (s, v) { return s + (Number(v.budget) || 0); }, 0);
    var surplus = totalIncome - totalBudget;

    var header = el("div", { class: "header" }, [
      el("div", { class: "header-title" }, ["gigwork"]),
      el("div", { class: "stat-grid" }, [
        statTile("今月の収入", "¥" + totalIncome.toLocaleString()),
        statTile("固定費+変動費", "¥" + totalBudget.toLocaleString()),
        statTile(surplus >= 0 ? "黒字" : "赤字", "¥" + Math.abs(surplus).toLocaleString(), surplus >= 0 ? "badge-surplus" : "badge-deficit")
      ])
    ]);

    var alert = computeAlert();
    if (alert) {
      header.appendChild(el("div", { class: "alert-box" + (alert.level === "red" ? " alert-red" : alert.level === "yellow" ? " alert-yellow" : "") }, [alert.text]));
    }

    var scroll = el("div", { class: "scroll" });

    var monthNav = el("div", { style: "display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;" }, [
      el("button", { class: "btn-ghost", style: "width:auto; padding:4px 10px;", onclick: function () { viewMonth--; if (viewMonth < 0) { viewMonth = 11; viewYear--; } render(); } }, ["‹"]),
      el("div", { style: "font-weight:800; font-size:15px;" }, [viewYear + "年" + (viewMonth + 1) + "月"]),
      el("button", { class: "btn-ghost", style: "width:auto; padding:4px 10px;", onclick: function () { viewMonth++; if (viewMonth > 11) { viewMonth = 0; viewYear++; } render(); } }, ["›"])
    ]);
    scroll.appendChild(monthNav);

    var weekdaysRow = el("div", { class: "calendar-weekdays" }, WEEKDAYS.map(function (w) { return el("div", {}, [w]); }));
    scroll.appendChild(weekdaysRow);

    var grid = el("div", { class: "calendar-grid" });
    buildMonthGrid(viewYear, viewMonth).forEach(function (cell) {
      var dayEntries = state.entries.filter(function (e) { return e.date === cell.dateStr; });
      var cls = "calendar-cell" + (cell.inMonth ? "" : " other-month") + (cell.dateStr === todayStr() ? " today" : "");
      var cellEl = el("button", { class: cls, onclick: function () { openDaySheet(cell.dateStr); } }, [
        el("div", { class: "calendar-daynum" }, [String(cell.date.getDate())])
      ]);
      dayEntries.slice(0, 3).forEach(function (en) {
        var p = platformById(en.platformId);
        cellEl.appendChild(el("div", { class: "calendar-entry" }, [
          el("span", { class: "calendar-dot", style: "background:" + (p ? p.color : "#999") }, []),
          el("span", {}, ["¥" + Number(en.amount).toLocaleString()])
        ]));
      });
      if (dayEntries.length > 3) cellEl.appendChild(el("div", { style: "font-size:9px; color:#8A8378;" }, ["+" + (dayEntries.length - 3)]));
      grid.appendChild(cellEl);
    });
    scroll.appendChild(grid);

    root.appendChild(header);
    root.appendChild(scroll);
    root.appendChild(renderNavbar("calendar"));
  }

  function statTile(label, value, cls) {
    return el("div", { class: "stat-tile" }, [
      el("div", { class: "stat-label" }, [label]),
      el("div", { class: "stat-value" + (cls ? " " + cls : "") }, [value])
    ]);
  }

  function openDaySheet(dateStr) {
    var backdrop = el("div", { class: "sheet-backdrop", onclick: closeSheet }, []);
    var dayEntries = state.entries.filter(function (e) { return e.date === dateStr; });

    var sheet = el("div", { class: "sheet", id: "day-sheet" }, [
      el("div", { class: "sheet-handle" }, []),
      el("div", { style: "font-size:15px; font-weight:800; margin-bottom:12px;" }, [dateStr])
    ]);

    dayEntries.forEach(function (en) {
      var p = platformById(en.platformId);
      sheet.appendChild(el("div", { class: "row", style: "padding:10px 0;" }, [
        el("span", { class: "row-dot", style: "background:" + (p ? p.color : "#999") }, []),
        el("div", { class: "row-title" }, [p ? p.name : "?"]),
        el("div", { class: "row-value" }, ["¥" + Number(en.amount).toLocaleString()]),
        el("button", { class: "btn-ghost", style: "width:auto; padding:4px 8px; color:#D14343;", onclick: function () {
          state.entries = state.entries.filter(function (x) { return x.id !== en.id; });
          save(); closeSheet(); openDaySheet(dateStr);
        } }, ["削除"])
      ]));
    });

    var platformSel = el("select", { class: "select-input" }, state.platforms.map(function (p) { return el("option", { value: p.id }, [p.name]); }));
    var amountInput = el("input", { class: "text-input", type: "number", inputmode: "numeric", placeholder: "¥0", style: "margin-top:8px;" }, []);

    sheet.appendChild(el("div", { style: "margin-top:12px;" }, [
      el("div", { class: "field-label" }, ["プラットフォーム"]),
      platformSel,
      amountInput,
      el("button", { class: "btn btn-primary", style: "margin-top:10px;", onclick: function () {
        var amount = parseInt(amountInput.value, 10);
        if (!amount) return;
        state.entries.push({ id: "e" + Date.now(), date: dateStr, platformId: platformSel.value, amount: amount });
        save(); closeSheet(); openDaySheet(dateStr);
      } }, ["追加"])
    ]));

    sheet.appendChild(el("button", { class: "btn btn-secondary", style: "margin-top:10px;", onclick: function () {
      closeSheet(); render();
    } }, ["閉じる"]));

    document.body.appendChild(backdrop);
    document.body.appendChild(sheet);
  }

  function closeSheet() {
    var old = document.getElementById("day-sheet");
    if (old) old.remove();
    document.querySelectorAll(".sheet-backdrop").forEach(function (b) { b.remove(); });
    render();
  }

  /* ================= 支出画面 ================= */
  function renderExpense(root) {
    var header = el("div", { class: "header" }, [el("div", { class: "header-title" }, ["支出"])]);
    var scroll = el("div", { class: "scroll" });

    var fixedTotal = state.fixedCosts.reduce(function (s, f) { return s + (Number(f.amount) || 0); }, 0);
    scroll.appendChild(el("div", { style: "display:flex; justify-content:space-between; margin-bottom:8px;" }, [
      el("div", { style: "font-size:13px; font-weight:700; color:#6B6560;" }, ["固定費"]),
      el("div", { style: "font-size:13px; font-weight:700;" }, ["¥" + fixedTotal.toLocaleString()])
    ]));
    var fixedCard = el("div", { class: "card flush" }, []);
    state.fixedCosts.forEach(function (f) {
      fixedCard.appendChild(el("div", { style: "padding:12px 14px; border-bottom:1px solid #F0EDE7; display:flex; align-items:center;" }, [
        el("label", { style: "display:flex; align-items:center; margin-right:10px;" }, [
          el("input", { type: "checkbox", checked: f.paid ? "checked" : null, onchange: function (e) { f.paid = e.target.checked; save(); render(); } }, [])
        ]),
        el("div", { style: "flex-grow:1;" }, [
          el("div", { style: "font-size:14px;" + (f.paid ? "text-decoration:line-through; color:#B3ACA0;" : "") }, [f.name]),
          el("div", { style: "font-size:11px; color:#8A8378;" }, ["毎月" + f.dueDay + "日 引き落とし"])
        ]),
        el("div", { style: "font-size:14px; font-weight:700;" }, ["¥" + Number(f.amount).toLocaleString()]),
        el("button", { class: "btn-ghost", style: "width:auto; padding:4px 8px; color:#D14343;", onclick: function () {
          state.fixedCosts = state.fixedCosts.filter(function (x) { return x.id !== f.id; }); save(); render();
        } }, ["×"])
      ]));
    });
    fixedCard.appendChild(addFixedCostForm());
    scroll.appendChild(fixedCard);

    var varBudget = state.variableCosts.reduce(function (s, v) { return s + (Number(v.budget) || 0); }, 0);
    scroll.appendChild(el("div", { style: "display:flex; justify-content:space-between; margin:20px 0 8px;" }, [
      el("div", { style: "font-size:13px; font-weight:700; color:#6B6560;" }, ["変動費"]),
      el("div", { style: "font-size:13px; font-weight:700;" }, ["予算¥" + varBudget.toLocaleString()])
    ]));
    var varCard = el("div", { class: "card flush" }, []);
    state.variableCosts.forEach(function (v) {
      var pct = v.budget > 0 ? Math.min(100, Math.round((Number(v.spent) || 0) / Number(v.budget) * 100)) : 0;
      varCard.appendChild(el("div", { style: "padding:12px 14px; border-bottom:1px solid #F0EDE7;" }, [
        el("div", { style: "display:flex; align-items:center; margin-bottom:6px;" }, [
          el("div", { style: "flex-grow:1; font-size:14px;" }, [v.name]),
          el("div", { style: "font-size:13px; font-weight:700;" }, ["予算¥" + Number(v.budget).toLocaleString()]),
          el("button", { class: "btn-ghost", style: "width:auto; padding:4px 8px; color:#D14343;", onclick: function () {
            state.variableCosts = state.variableCosts.filter(function (x) { return x.id !== v.id; }); save(); render();
          } }, ["×"])
        ]),
        el("div", { class: "mini-bar-track" }, [el("div", { class: "mini-bar-fill", style: "width:" + pct + "%;" }, [])]),
        el("div", { style: "text-align:right; font-size:11px; color:#6B6560;" }, ["使用済み ¥" + Number(v.spent || 0).toLocaleString()])
      ]));
    });
    varCard.appendChild(addVariableCostForm());
    scroll.appendChild(varCard);

    scroll.appendChild(el("div", { style: "background:#F7F5F1; border:1px dashed #C9C2B7; border-radius:14px; padding:16px;" }, [
      el("div", { style: "display:flex; justify-content:space-between;" }, [
        el("div", { style: "font-size:13px; font-weight:700; color:#8A8378;" }, ["固定費+変動費の予算 合計"]),
        el("div", { style: "font-size:18px; font-weight:800; color:#8A8378;" }, ["¥" + (fixedTotal + varBudget).toLocaleString()])
      ]),
      el("div", { style: "font-size:11px; color:#C9C2B7; margin-top:4px;" }, ["＝今月の目標の自動算出値（使用済み額は含まない）"])
    ]));

    root.appendChild(header);
    root.appendChild(scroll);
    root.appendChild(renderNavbar("expense"));
  }

  function addFixedCostForm() {
    var nameInput = el("input", { class: "inline-input", placeholder: "＋ 項目を追加（例：家賃）", style: "flex-grow:1;" }, []);
    var amountInput = el("input", { class: "inline-input", type: "number", placeholder: "¥0", style: "width:88px; text-align:right;" }, []);
    var dayInput = el("input", { class: "inline-input", type: "number", placeholder: "日", style: "width:40px; text-align:center;" }, []);
    function commit() {
      if (!nameInput.value || !amountInput.value) return;
      state.fixedCosts.push({ id: "f" + Date.now(), name: nameInput.value, amount: parseInt(amountInput.value, 10), dueDay: dayInput.value || "1", paid: false });
      save(); render();
    }
    return el("div", { style: "padding:12px 14px;" }, [
      el("div", { style: "display:flex; align-items:center; margin-bottom:4px;" }, [nameInput, amountInput]),
      el("div", { style: "display:flex; align-items:center; gap:6px;" }, [
        el("span", { style: "font-size:11px; color:#8A8378;" }, ["毎月"]), dayInput,
        el("span", { style: "font-size:11px; color:#8A8378;" }, ["日 引き落とし"]),
        el("button", { class: "btn-ghost", style: "width:auto; margin-left:auto;", onclick: commit }, ["追加"])
      ])
    ]);
  }

  function addVariableCostForm() {
    var nameInput = el("input", { class: "inline-input", placeholder: "＋ 項目を追加（例：ガソリン代）", style: "flex-grow:1;" }, []);
    var budgetInput = el("input", { class: "inline-input", type: "number", placeholder: "予算¥0", style: "width:80px; text-align:right;" }, []);
    function commit() {
      if (!nameInput.value || !budgetInput.value) return;
      state.variableCosts.push({ id: "v" + Date.now(), name: nameInput.value, budget: parseInt(budgetInput.value, 10), spent: 0 });
      save(); render();
    }
    return el("div", { style: "padding:12px 14px; display:flex; align-items:center;" }, [
      nameInput, budgetInput,
      el("button", { class: "btn-ghost", style: "width:auto; margin-left:6px;", onclick: commit }, ["追加"])
    ]);
  }

  /* ================= リザルト画面 ================= */
  function renderResult(root) {
    var header = el("div", { class: "header" }, [el("div", { class: "header-title" }, ["リザルト"])]);
    var scroll = el("div", { class: "scroll" });

    var byPlatform = {};
    state.entries.forEach(function (e) {
      byPlatform[e.platformId] = (byPlatform[e.platformId] || 0) + (Number(e.amount) || 0);
    });
    var totalAll = Object.keys(byPlatform).reduce(function (s, k) { return s + byPlatform[k]; }, 0);

    scroll.appendChild(el("div", { class: "section-label" }, ["プラットフォーム別（全期間）"]));
    var card = el("div", { class: "card flush" }, []);
    state.platforms.forEach(function (p) {
      var amt = byPlatform[p.id] || 0;
      var pct = totalAll > 0 ? Math.round(amt / totalAll * 100) : 0;
      card.appendChild(el("div", { style: "padding:12px 14px; border-bottom:1px solid #F0EDE7;" }, [
        el("div", { style: "display:flex; align-items:center; gap:8px; margin-bottom:6px;" }, [
          el("span", { class: "row-dot", style: "background:" + p.color }, []),
          el("div", { style: "flex-grow:1; font-size:14px;" }, [p.name]),
          el("div", { style: "font-size:14px; font-weight:700;" }, ["¥" + amt.toLocaleString()])
        ]),
        el("div", { class: "mini-bar-track" }, [el("div", { class: "mini-bar-fill", style: "width:" + pct + "%; background:" + p.color + ";" }, [])])
      ]));
    });
    scroll.appendChild(card);

    var workDays = {};
    state.entries.forEach(function (e) { workDays[e.date] = true; });
    var dayCount = Object.keys(workDays).length;
    var avgPerDay = dayCount ? Math.round(totalAll / dayCount) : 0;

    scroll.appendChild(el("div", { class: "stat-grid", style: "margin-top:16px;" }, [
      statTile("合計収入", "¥" + totalAll.toLocaleString()),
      statTile("稼働日数", dayCount + "日"),
      statTile("平均/日", "¥" + avgPerDay.toLocaleString())
    ]));

    root.appendChild(header);
    root.appendChild(scroll);
    root.appendChild(renderNavbar("result"));
  }

  /* ================= 設定画面 ================= */
  var expandedPlatformId = null;
  var screenshotPasteText = "";
  var screenshotParsed = [];

  function renderSettings(root) {
    var header = el("div", { class: "header" }, [el("div", { class: "header-title" }, ["設定"])]);
    var scroll = el("div", { class: "scroll" });

    scroll.appendChild(el("div", { class: "section-label" }, ["カレンダー"]));
    var weekStartCard = el("div", { class: "card" }, [
      el("div", { style: "font-size:14px; margin-bottom:10px;" }, ["週の起算日"]),
      el("div", { class: "segmented", style: "grid-template-columns:1fr 1fr;" }, [
        el("button", { class: state.weekStart === "mon" ? "active" : "", onclick: function () { state.weekStart = "mon"; save(); render(); } }, ["月曜始まり"]),
        el("button", { class: state.weekStart === "sun" ? "active" : "", onclick: function () { state.weekStart = "sun"; save(); render(); } }, ["日曜始まり"])
      ])
    ]);
    scroll.appendChild(weekStartCard);

    scroll.appendChild(el("div", { class: "section-label" }, ["プラットフォーム管理"]));
    var platCard = el("div", { class: "card flush" }, []);
    state.platforms.forEach(function (p) {
      var expanded = expandedPlatformId === p.id;
      var rowBtn = el("button", { class: "row", onclick: function () { expandedPlatformId = expanded ? null : p.id; render(); } }, [
        el("span", { class: "row-dot", style: "background:" + p.color }, []),
        el("div", { class: "row-title" }, [p.name]),
        el("div", { class: "row-sub" }, [paydaySummary(p.payday)]),
        el("span", { class: "row-chevron" }, [expanded ? "︿" : "﹀"])
      ]);
      var wrap = el("div", {}, [rowBtn]);
      if (expanded) wrap.appendChild(renderPlatformEditor(p));
      platCard.appendChild(wrap);
    });
    platCard.appendChild(el("button", { class: "row", style: "color:#2F6F5E; font-weight:700;", onclick: function () {
      var id = "p" + Date.now();
      state.platforms.push({ id: id, name: "新しいプラットフォーム", color: PLATFORM_PALETTE[state.platforms.length % PLATFORM_PALETTE.length],
        payday: { type: "monthly", days: [] }, period: { type: "monthly", ranges: [{ startDay: "1", endDay: "月末", time: "0:00" }] } });
      expandedPlatformId = id; save(); render();
    } }, ["+ プラットフォームを追加"]));
    scroll.appendChild(platCard);

    scroll.appendChild(renderScreenshotImport());

    root.appendChild(header);
    root.appendChild(scroll);
    root.appendChild(renderNavbar("settings"));
  }

  function renderPlatformEditor(p) {
    var wrap = el("div", { style: "padding:4px 14px 18px; display:flex; flex-direction:column; gap:16px;" }, []);

    var nameInput = el("input", { class: "text-input", value: p.name, oninput: function (e) { p.name = e.target.value; save(); } }, []);
    wrap.appendChild(el("div", {}, [el("div", { class: "field-label" }, ["名前"]), nameInput]));

    var paydaySection = el("div", {}, [el("div", { class: "field-label" }, ["支払い日"])]);
    paydaySection.appendChild(segmented(["monthly", "weekly", "daily"], { monthly: "毎月◯日", weekly: "毎週◯曜", daily: "日払い" }, p.payday.type, function (t) {
      p.payday = { type: t, days: [] };
      if (t === "daily") p.period = { type: "daily", time: "0:00" };
      else if (t === "weekly") p.period = { type: "weekly", startWeekday: "月", startTime: "0:00", endWeekday: "日", endTime: "0:00" };
      else p.period = { type: "monthly", ranges: [{ startDay: "1", endDay: "月末", time: "0:00" }] };
      save(); render();
    }));
    if (p.payday.type === "monthly") {
      paydaySection.appendChild(multiChipGrid(MONTHDAYS, p.payday.days, 8, function (d) { toggleArr(p.payday.days, d); save(); render(); }));
    } else if (p.payday.type === "weekly") {
      paydaySection.appendChild(multiChipGrid(WEEKDAYS, p.payday.days, 7, function (d) { toggleArr(p.payday.days, d); save(); render(); }));
    }
    wrap.appendChild(paydaySection);

    if (p.payday.type !== "daily") {
      var periodSection = el("div", {}, [el("div", { class: "field-label" }, ["集計期間"])]);
      periodSection.appendChild(segmented(["weekly", "monthly"], { weekly: "毎週", monthly: "毎月" }, p.period.type, function (t) {
        p.period = t === "weekly" ? { type: "weekly", startWeekday: "月", startTime: "0:00", endWeekday: "日", endTime: "0:00" } : { type: "monthly", ranges: [{ startDay: "1", endDay: "月末", time: "0:00" }] };
        save(); render();
      }));
      if (p.period.type === "weekly") {
        periodSection.appendChild(el("div", { style: "display:flex; align-items:center; gap:6px; margin-top:8px; flex-wrap:wrap;" }, [
          selectInput(WEEKDAYS, p.period.startWeekday, function (v) { p.period.startWeekday = v; save(); render(); }),
          selectInput(HOURS, p.period.startTime, function (v) { p.period.startTime = v; save(); render(); }),
          el("span", { style: "color:#C9C2B7;" }, ["〜"]),
          selectInput(WEEKDAYS, p.period.endWeekday, function (v) { p.period.endWeekday = v; save(); render(); }),
          selectInput(HOURS, p.period.endTime, function (v) { p.period.endTime = v; save(); render(); })
        ]));
      } else {
        p.period.ranges.forEach(function (r, idx) {
          periodSection.appendChild(el("div", { style: "display:flex; align-items:center; gap:6px; margin-top:8px; flex-wrap:wrap;" }, [
            selectInput(MONTHDAYS, r.startDay, function (v) { r.startDay = v; save(); render(); }),
            el("span", { style: "color:#C9C2B7;" }, ["〜"]),
            selectInput(MONTHDAYS, r.endDay, function (v) { r.endDay = v; save(); render(); }),
            selectInput(HOURS, r.time, function (v) { r.time = v; save(); render(); }),
            p.period.ranges.length > 1 ? el("button", { class: "btn-ghost", style: "width:auto; color:#D14343;", onclick: function () { p.period.ranges.splice(idx, 1); save(); render(); } }, ["×"]) : null
          ]));
        });
        periodSection.appendChild(el("button", { class: "btn-ghost", style: "width:auto; margin-top:6px;", onclick: function () {
          p.period.ranges.push({ startDay: "1", endDay: "月末", time: "0:00" }); save(); render();
        } }, ["+ 区切りを追加"]));
      }
      wrap.appendChild(periodSection);
    } else {
      wrap.appendChild(el("div", {}, [
        el("div", { class: "field-label" }, ["締め時刻"]),
        selectInput(HOURS, p.period.time, function (v) { p.period.time = v; save(); render(); })
      ]));
    }

    wrap.appendChild(el("button", { class: "btn-ghost", style: "color:#D14343;", onclick: function () {
      state.platforms = state.platforms.filter(function (x) { return x.id !== p.id; });
      expandedPlatformId = null; save(); render();
    } }, ["このプラットフォームを削除"]));

    return wrap;
  }

  function toggleArr(arr, v) {
    var idx = arr.indexOf(v);
    if (idx >= 0) arr.splice(idx, 1); else arr.push(v);
  }

  function segmented(values, labels, current, onPick) {
    return el("div", { class: "segmented", style: "grid-template-columns: repeat(" + values.length + ", 1fr); margin-bottom:8px;" },
      values.map(function (v) { return el("button", { class: current === v ? "active" : "", onclick: function () { onPick(v); } }, [labels[v]]); }));
  }

  function multiChipGrid(values, selected, cols, onPick) {
    return el("div", { class: "chip-grid", style: "grid-template-columns: repeat(" + cols + ", 1fr);" },
      values.map(function (v) { return el("button", { class: "chip" + (selected.indexOf(v) >= 0 ? " active" : ""), onclick: function () { onPick(v); } }, [v]); }));
  }

  function selectInput(options, current, onChange) {
    var s = el("select", { class: "select-input", style: "width:auto;", onchange: function (e) { onChange(e.target.value); } },
      options.map(function (o) { return el("option", { value: o, selected: o === current ? "selected" : null }, [o]); }));
    return s;
  }

  function renderScreenshotImport() {
    var section = el("div", {}, [el("div", { class: "section-label" }, ["スクショ自動入力"])]);
    var card = el("div", { class: "card" }, [
      el("div", { style: "font-size:13px; color:#6B6560; line-height:1.6; margin-bottom:12px;" }, [
        "収益画面のスクショを自分のAIに読み取らせて、出力をここに貼り付けると入力できます。週合計しか出せないアプリは期間合計として、スクショ自体が撮れないアプリは手入力で登録してください。"
      ]),
      el("button", { class: "btn btn-secondary", style: "margin-bottom:10px;", onclick: function () {
        try { navigator.clipboard.writeText(SCREENSHOT_PROMPT); } catch (e) {}
        toast("コピーしました");
      } }, ["読み取り用プロンプトをコピー"]),
      el("div", { class: "field-label" }, ["AIの出力を貼り付け"])
    ]);

    var textarea = el("textarea", { class: "text-input", style: "height:72px; resize:none; margin-bottom:8px;", placeholder: "2024-09-13,Uber Eats,12800",
      oninput: function (e) { screenshotPasteText = e.target.value; } }, [screenshotPasteText]);
    card.appendChild(textarea);

    card.appendChild(el("button", { class: "btn btn-primary", onclick: function () {
      screenshotParsed = parseScreenshotText(screenshotPasteText);
      render();
    } }, ["読み込む"]));

    if (screenshotParsed.length) {
      var list = el("div", { style: "margin-top:12px; border-top:1px solid #F0EDE7; padding-top:12px;" }, []);
      screenshotParsed.forEach(function (entry) {
        list.appendChild(el("div", { style: "display:flex; align-items:center; padding:8px 0; border-bottom:1px solid #F7F5F1;" }, [
          el("div", { style: "flex-grow:1; font-size:13px;" }, [entry.dateLabel + "　" + entry.platform]),
          el("div", { style: "font-size:13px; font-weight:700;" }, ["¥" + entry.amount.toLocaleString()])
        ]));
      });
      list.appendChild(el("button", { class: "btn btn-primary", style: "margin-top:10px;", onclick: function () {
        screenshotParsed.forEach(function (entry) {
          var platform = findOrCreatePlatform(entry.platform);
          if (entry.isRange) {
            state.entries.push({ id: "e" + Date.now() + Math.random(), date: entry.startDate, platformId: platform.id, amount: entry.amount, periodRange: [entry.startDate, entry.endDate] });
          } else {
            state.entries.push({ id: "e" + Date.now() + Math.random(), date: entry.startDate, platformId: platform.id, amount: entry.amount });
          }
        });
        screenshotParsed = []; screenshotPasteText = "";
        save(); toast("カレンダーに追加しました"); render();
      } }, ["カレンダーに追加（" + screenshotParsed.length + "件）"]));
      card.appendChild(list);
    }

    section.appendChild(card);
    return section;
  }

  function findOrCreatePlatform(name) {
    var existing = state.platforms.filter(function (p) { return p.name === name; })[0];
    if (existing) return existing;
    var p = { id: "p" + Date.now() + Math.random(), name: name, color: PLATFORM_PALETTE[state.platforms.length % PLATFORM_PALETTE.length],
      payday: { type: "monthly", days: [] }, period: { type: "monthly", ranges: [{ startDay: "1", endDay: "月末", time: "0:00" }] } };
    state.platforms.push(p);
    return p;
  }

  /* 「開始日~終了日」の範囲指定も受け付ける（日別の内訳が取れないプラットフォーム向け） */
  function parseScreenshotText(text) {
    var out = [];
    (text || "").split("\n").forEach(function (line) {
      var parts = line.split(",");
      if (parts.length !== 3) return;
      var dateField = parts[0].trim();
      var platform = parts[1].trim();
      var amountStr = parts[2].trim();
      if (!dateField || !platform || !/^\d+$/.test(amountStr)) return;
      var isRange = dateField.indexOf("~") >= 0;
      var startDate, endDate, dateLabel;
      if (isRange) {
        var bits = dateField.split("~").map(function (d) { return d.trim(); });
        startDate = bits[0]; endDate = bits[1];
        dateLabel = startDate + "〜" + endDate;
      } else {
        startDate = dateField; endDate = dateField; dateLabel = dateField;
      }
      out.push({ startDate: startDate, endDate: endDate, dateLabel: dateLabel, isRange: isRange, platform: platform, amount: Number(amountStr) });
    });
    return out;
  }

  /* ---------- 描画ディスパッチ ---------- */
  function render() {
    var root = document.getElementById("app");
    root.innerHTML = "";
    var route = currentRoute();
    if (route === "/expense") renderExpense(root);
    else if (route === "/result") renderResult(root);
    else if (route === "/settings") renderSettings(root);
    else renderCalendar(root);
  }

  render();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("./sw.js").catch(function () {});
    });
  }
})();
