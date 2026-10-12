// Livo – Prototyp. Fristen werden nur in diesem Browser gespeichert
// (localStorage); Anmeldung, Supabase und Push-Erinnerungen kommen mit Version 1.
// URL-Parameter zum Testen: ?demo=1 lädt Beispiel-Fristen,
// &show=add | voice | form:<vorlage> | item öffnet direkt das passende Blatt,
// &say=<Satz> verarbeitet einen Satz so, als wäre er gesprochen worden.

var STORE_KEY = "livo.items.v1";
var items = load();

/* ---------- Speicher ---------- */
function load() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; } catch (e) { return []; }
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(items)); } catch (e) {}
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

/* ---------- Datum: immer lokale Mitternacht, gespeichert als JJJJ-MM-TT ---------- */
function pad(n) { return (n < 10 ? "0" : "") + n; }
function today() { var d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function toISO(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
function fromISO(s) { var p = String(s).split("-"); return new Date(+p[0], +p[1] - 1, +(p[2] || 1)); }
function fmt(d) { return pad(d.getDate()) + "." + pad(d.getMonth() + 1) + "." + d.getFullYear(); }
function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
function addMonths(d, n) {
  // 31.01. + 1 Monat = 28./29.02., nicht 03.03.
  var first = new Date(d.getFullYear(), d.getMonth() + n, 1);
  var last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return new Date(first.getFullYear(), first.getMonth(), Math.min(d.getDate(), last));
}
function endOfMonth(ym) { var p = String(ym).split("-"); return new Date(+p[0], +p[1], 0); }
function nextYearly(month, day) {
  var t = today(), d = new Date(t.getFullYear(), month - 1, day);
  return d < t ? new Date(t.getFullYear() + 1, month - 1, day) : d;
}
function diffDays(a, b) { return Math.round((b - a) / 86400000); }
function isDate(d) { return d instanceof Date && !isNaN(d.getTime()); }

/* ---------- Status und Texte ---------- */
function status(it) {
  var days = diffDays(today(), fromISO(it.due));
  if (days < 0) return { key: "late", days: days };
  if (days <= it.lead) return { key: "now", days: days };
  return { key: "later", days: days };
}
function whenText(days) {
  if (days === 0) return "heute fällig";
  if (days === 1) return "morgen fällig";
  if (days === -1) return "seit gestern fällig";
  if (days < 0) return "seit " + (-days) + " Tagen fällig";
  if (days <= 60) return "in " + days + " Tagen";
  var m = Math.round(days / 30.44);
  if (m < 24) return "in " + m + " Monaten";
  return "in " + Math.round(days / 365.25) + " Jahren";
}
function everyText(m) {
  if (!m) return "einmalig";
  if (m === 1) return "jeden Monat";
  if (m === 12) return "jedes Jahr";
  if (m % 12 === 0) return "alle " + (m / 12) + " Jahre";
  return "alle " + m + " Monate";
}
function dueText(it) { return fmt(fromISO(it.due)) + (it.time ? ", " + it.time + " Uhr" : ""); }
function remindText(it) {
  var r = addDays(fromISO(it.due), -it.lead);
  return r <= today() ? "sofort" : "ab " + fmt(r);
}
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c];
  });
}

/* ---------- Nachschlagen ---------- */
function find(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }
function iconOf(it) { var t = find(TEMPLATES, it.tpl); return find(CATEGORIES, t ? t.cat : "own").icon; }
function sortedItems() {
  return items.slice().sort(function (a, b) { return a.due < b.due ? -1 : a.due > b.due ? 1 : 0; });
}

/* ---------- Liste ---------- */
var VOICEBAR = '<button type="button" class="voicebar" data-act="voice"><span class="mic-ico">🎤</span>' +
  '<span><b>Hey Livo …</b><small>Frist einfach sagen, z. B. „Mein Ausweis läuft im März 2027 ab“</small></span></button>';

function render() {
  var list = document.getElementById("list");
  if (!items.length) { list.innerHTML = emptyHTML(); return; }
  var all = sortedItems();
  var now = all.filter(function (it) { return status(it).key !== "later"; });
  var later = all.filter(function (it) { return status(it).key === "later"; });
  var html = VOICEBAR + (now.length
    ? '<h2 class="sec sec-now">Jetzt kümmern <span>' + now.length + '</span></h2>' + now.map(card).join("")
    : '<div class="allgood">✅ Alles im Griff – gerade ist nichts fällig.</div>');
  if (later.length) html += '<h2 class="sec">Alles im Blick</h2>' + later.map(card).join("");
  list.innerHTML = html;
}
function card(it) {
  var s = status(it);
  var sub = s.key === "later" ? "Erinnerung " + remindText(it) : "fällig am " + dueText(it);
  return '<button type="button" class="card st-' + s.key + '" data-open="' + it.id + '">' +
    '<span class="ico">' + iconOf(it) + '</span>' +
    '<span class="txt"><b>' + esc(it.title) + '</b><small>' + sub + '</small></span>' +
    '<span class="pill">' + whenText(s.days) + '</span></button>';
}
function emptyHTML() {
  var quick = ["personalausweis", "tuev", "kfzversicherung", "zahnarzt", "rechnung", "versicherung"];
  return '<div class="empty"><h1>Nie wieder eine Frist verpassen.</h1>' +
    '<p>Sag Livo einfach, woran du denken musst – oder wähle eine Vorlage.</p>' + VOICEBAR +
    '<div class="chips">' +
    quick.map(function (id) { return '<button type="button" class="chip" data-tpl="' + id + '">' + esc(find(TEMPLATES, id).title) + '</button>'; }).join("") +
    '</div><button type="button" class="btn light" data-act="add">Alle Vorlagen ansehen</button></div>';
}

/* ---------- Blatt von unten ---------- */
var sheet = document.getElementById("sheet");
var sheetBg = document.getElementById("sheetBg");
function openSheet(html) {
  stopListening();
  sheet.innerHTML = '<div class="grab"></div>' + html;
  sheet.hidden = false;
  sheetBg.hidden = false;
  document.body.classList.add("lock");
  sheet.scrollTop = 0;
}
function closeSheet() {
  stopListening();
  sheet.hidden = true;
  sheetBg.hidden = true;
  document.body.classList.remove("lock");
}

function showPicker() {
  var html = '<h3>Was möchtest du im Blick behalten?</h3>' +
    '<button type="button" class="btn light" data-act="voice">🎤 Lieber sagen statt tippen</button>';
  CATEGORIES.forEach(function (c) {
    var list = TEMPLATES.filter(function (t) { return t.cat === c.id; });
    html += '<div class="cat">' + c.icon + " " + esc(c.name) + '</div><div class="tpls">' +
      list.map(function (t) { return '<button type="button" class="tpl" data-tpl="' + t.id + '">' + esc(t.title) + '</button>'; }).join("") +
      '</div>';
  });
  openSheet(html + '<button type="button" class="btn light" data-act="close">Abbrechen</button>');
}

/* ---------- Spracheingabe: "Hey Livo" ---------- */
var Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
var rec = null;

function stopListening() {
  if (rec) { var r = rec; rec = null; try { r.abort(); } catch (e) {} }
}

function showVoice() {
  openSheet('<h3>🎤 Hey Livo</h3>' +
    '<p class="muted">Sag einfach, worum es geht und wann – z. B. „Mein Ausweis läuft im März 2027 ab“ oder „Zahnarzt am 3. November um 10 Uhr“.</p>' +
    (Recognition
      ? '<button type="button" class="mic" id="micBtn" aria-label="Sprechen">🎤</button>'
      : '<p class="hint">Spracheingabe geht in diesem Browser nicht – in Chrome auf Android und in Safari auf dem iPhone schon. Du kannst den Satz aber hier eintippen.</p>') +
    '<p class="heard" id="heard"></p>' +
    '<form class="sayform" id="sayForm"><input name="say" type="text" placeholder="… oder hier eintippen" autocomplete="off">' +
    '<button class="btn" type="submit">OK</button></form>' +
    '<button type="button" class="btn light" data-act="close">Abbrechen</button>');

  document.getElementById("sayForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var txt = e.target.elements.say.value.trim();
    if (txt) understand(txt);
  });
  var mic = document.getElementById("micBtn");
  if (mic) {
    mic.addEventListener("click", function () { if (rec) stopListening(); else listen(); });
    listen();
  }
}

function listen() {
  var mic = document.getElementById("micBtn"), heard = document.getElementById("heard");
  var said = "";
  var r = new Recognition();
  r.lang = "de-DE";
  r.interimResults = true;
  r.onresult = function (e) {
    said = Array.prototype.map.call(e.results, function (x) { return x[0].transcript; }).join(" ");
    heard.textContent = "„" + said + "“";
  };
  r.onerror = function (e) {
    heard.textContent = e.error === "not-allowed" || e.error === "service-not-allowed"
      ? "Das Mikrofon ist nicht erlaubt. Bitte im Browser erlauben – oder den Satz eintippen."
      : e.error === "no-speech" ? "Ich habe nichts gehört. Tipp nochmal aufs Mikrofon." : "Das hat nicht geklappt. Bitte nochmal versuchen oder eintippen.";
  };
  r.onend = function () {
    if (rec !== r) return;          // abgebrochen (Blatt geschlossen)
    rec = null;
    mic.classList.remove("on");
    if (said) understand(said);
  };
  rec = r;
  mic.classList.add("on");
  heard.textContent = "Ich höre zu …";
  try { r.start(); } catch (e) { rec = null; mic.classList.remove("on"); }
}

function understand(text) {
  showDraft(draftFrom(text), text);
}

/* ---------- Formular für eine Frist (Bestätigen, Bearbeiten, Erneuern) ---------- */
function leadHTML(val) {
  return '<label class="field"><span>Erinnern – wie viele Tage vorher?</span>' +
    '<input name="lead" type="number" min="0" max="365" inputmode="numeric" value="' + val + '"></label>';
}
function readLead(form, def) {
  var n = parseInt(form.elements.lead.value, 10);
  return isNaN(n) || n < 0 ? def : n;
}
function itemFormHTML(it, opts) {
  var list = EVERY_OPTIONS.slice();
  if (!list.some(function (o) { return o[0] === it.every; })) list.push([it.every, everyText(it.every)]);
  return '<form id="frm" novalidate>' + (opts.intro || "") +
    '<label class="field"><span>Was?</span><input name="title" type="text" value="' + esc(it.title) + '"></label>' +
    '<label class="field"><span>' + (opts.dateLabel || "Fällig am") + '</span><input name="due" type="date" value="' + esc(it.due) + '"></label>' +
    '<label class="field"><span>Uhrzeit <i>(optional)</i></span><input name="time" type="time" value="' + esc(it.time || "") + '"></label>' +
    '<label class="field"><span>Wiederholung</span><select name="every">' + list.map(function (o) {
      return '<option value="' + o[0] + '"' + (o[0] === it.every ? " selected" : "") + '>' + esc(o[1]) + '</option>';
    }).join("") + '</select></label>' +
    leadHTML(it.lead) +
    '<p class="err" id="err"></p><button class="btn" type="submit">Speichern</button>' + (opts.back || "") + '</form>';
}
// Liest das Formular in "it" ein; false, wenn Titel oder Datum fehlen
function readItemForm(form, it) {
  var title = form.elements.title.value.trim(), due = form.elements.due.value;
  if (!title || !due || !isDate(fromISO(due))) {
    document.getElementById("err").textContent = "Bitte trag ein, was es ist und ein gültiges Datum.";
    return false;
  }
  it.title = title;
  it.due = due;
  it.time = form.elements.time.value || "";
  it.every = parseInt(form.elements.every.value, 10) || 0;
  it.lead = readLead(form, it.lead);
  return true;
}

function showDraft(d, said) {
  var t = find(TEMPLATES, d.tpl);
  openSheet('<h3>' + find(CATEGORIES, t.cat).icon + ' Habe ich das richtig verstanden?</h3>' +
    '<p class="said">„' + esc(said) + '“</p>' +
    itemFormHTML(d, {
      intro: (d.due ? "" : '<p class="err">Das Datum habe ich nicht verstanden – bitte unten eintragen.</p>') +
        (t.hint ? '<p class="hint">' + esc(t.hint) + '</p>' : ""),
      back: '<button class="btn light" type="button" data-act="voice">Nochmal sagen</button>'
    }));
  var form = document.getElementById("frm");
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!readItemForm(form, d)) return;
    d.id = uid();
    items.push(d);
    save(); closeSheet(); render();
    toast("Gespeichert ✓ Erinnerung " + remindText(d));
  });
}

/* ---------- Neue Frist aus einer Vorlage ---------- */
function fieldHTML(f) {
  var v = f.value != null ? f.value : "";
  var input;
  if (f.type === "select") {
    input = '<select name="' + f.key + '">' + f.options.map(function (o) {
      return '<option value="' + o[0] + '"' + (String(o[0]) === String(v) ? " selected" : "") + '>' + esc(o[1]) + '</option>';
    }).join("") + '</select>';
  } else if (f.type === "months") {
    input = '<input name="' + f.key + '" type="number" min="1" max="120" inputmode="numeric" value="' + esc(v) + '">';
  } else {
    input = '<input name="' + f.key + '" type="' + f.type + '" value="' + esc(v) + '"' +
      (f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : "") + '>';
  }
  return '<label class="field"><span>' + esc(f.label) + (f.optional ? " <i>(optional)</i>" : "") + '</span>' + input + '</label>';
}
function readValues(form, t) {
  var v = {};
  t.fields.forEach(function (f) { v[f.key] = (form.elements[f.key].value || "").trim(); });
  return v;
}
// Liefert die fertige Frist oder null, wenn Pflichtfelder fehlen oder das Datum ungültig ist
function build(t, v, lead) {
  if (t.fields.some(function (f) { return !f.optional && !v[f.key]; })) return null;
  var r = t.compute(v);
  if (!isDate(r.due)) return null;
  return { tpl: t.id, title: t.name ? t.name(v) : t.title, due: toISO(r.due), time: "", every: r.every || 0, from: t.from || "due", lead: lead, renew: !!t.renew };
}

function showNew(tid) {
  var t = find(TEMPLATES, tid);
  if (!t) return;
  openSheet('<h3>' + find(CATEGORIES, t.cat).icon + " " + esc(t.title) + '</h3><form id="frm" novalidate>' +
    (t.hint ? '<p class="hint">' + esc(t.hint) + '</p>' : "") +
    t.fields.map(fieldHTML).join("") + leadHTML(t.lead) +
    '<div class="preview" id="pv"></div><p class="err" id="err"></p>' +
    '<button class="btn" type="submit">Speichern</button>' +
    '<button class="btn light" type="button" data-act="add">Zurück</button></form>');

  var form = document.getElementById("frm");
  function update() {
    var it = build(t, readValues(form, t), readLead(form, t.lead));
    document.getElementById("pv").innerHTML = it
      ? 'Fällig am <b>' + fmt(fromISO(it.due)) + '</b> · Erinnerung <b>' + remindText(it) + '</b> · ' + everyText(it.every)
      : "Fällig am … – bitte die Felder ausfüllen.";
  }
  form.addEventListener("input", update);
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var it = build(t, readValues(form, t), readLead(form, t.lead));
    if (!it) { document.getElementById("err").textContent = "Bitte fülle die Pflichtfelder mit einem gültigen Datum aus."; return; }
    it.id = uid();
    items.push(it);
    save(); closeSheet(); render();
    toast("Gespeichert ✓ Erinnerung " + remindText(it));
  });
  update();
}

/* ---------- Eine Frist ansehen, erledigen, bearbeiten ---------- */
function showItem(id) {
  var it = find(items, id);
  if (!it) return;
  var s = status(it), t = find(TEMPLATES, it.tpl);
  var main = it.every > 0 ? "Erledigt – nächster Termin" : it.renew ? "Erneuert – neues Datum eintragen" : "Erledigt";
  openSheet('<div class="st-' + s.key + '"><div class="d-head"><span class="ico">' + iconOf(it) + '</span><div><h3>' + esc(it.title) + '</h3>' +
    '<span class="pill">' + whenText(s.days) + '</span></div></div>' +
    '<dl><dt>Fällig am</dt><dd>' + dueText(it) + '</dd>' +
    '<dt>Erinnerung</dt><dd>' + it.lead + ' Tage vorher (' + remindText(it) + ')</dd>' +
    '<dt>Wiederholung</dt><dd>' + everyText(it.every) + '</dd></dl>' +
    (t && t.hint ? '<p class="hint">' + esc(t.hint) + '</p>' : "") +
    '<button type="button" class="btn" data-act="done" data-id="' + it.id + '">' + main + '</button>' +
    '<button type="button" class="btn light" data-act="edit" data-id="' + it.id + '">Bearbeiten</button>' +
    '<button type="button" class="btn danger" data-act="del" data-id="' + it.id + '">Löschen</button></div>');
}

function markDone(id) {
  var it = find(items, id);
  if (!it) return;
  if (it.every > 0) {
    var next = addMonths(it.from === "done" ? today() : fromISO(it.due), it.every);
    while (next <= today()) next = addMonths(next, it.every);
    it.due = toISO(next);
    save(); closeSheet(); render();
    toast("Erledigt ✓ Nächster Termin: " + fmt(next));
  } else if (it.renew) {
    showEdit(id, true);
  } else {
    items = items.filter(function (x) { return x.id !== id; });
    save(); closeSheet(); render();
    toast("Erledigt ✓");
  }
}

function showEdit(id, renewing) {
  var it = find(items, id);
  if (!it) return;
  var view = renewing ? Object.assign({}, it, { due: "" }) : it;
  openSheet('<h3>' + (renewing ? "Neues Datum eintragen" : "Bearbeiten") + '</h3>' +
    itemFormHTML(view, {
      intro: renewing ? '<p class="hint">Trag das neue „Gültig bis“-Datum ein – dann erinnert Livo dich beim nächsten Mal wieder rechtzeitig.</p>' : "",
      dateLabel: renewing ? "Neu gültig bis" : "Fällig am",
      back: '<button class="btn light" type="button" data-open="' + it.id + '">Zurück</button>'
    }));
  var form = document.getElementById("frm");
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!readItemForm(form, it)) return;
    save(); closeSheet(); render();
    toast("Gespeichert ✓");
  });
}

function removeItem(id) {
  var it = find(items, id);
  if (!it || !confirm("„" + it.title + "“ wirklich löschen?")) return;
  items = items.filter(function (x) { return x.id !== id; });
  save(); closeSheet(); render();
}

/* ---------- Kurze Meldung ---------- */
var toastTimer;
function toast(msg) {
  var el = document.getElementById("toast");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { el.hidden = true; }, 2800);
}

/* ---------- Klicks ---------- */
document.addEventListener("click", function (e) {
  var el = e.target.closest("[data-act],[data-open],[data-tpl]");
  if (!el) return;
  if (el.hasAttribute("data-tpl")) return showNew(el.getAttribute("data-tpl"));
  if (el.hasAttribute("data-open")) return showItem(el.getAttribute("data-open"));
  var act = el.getAttribute("data-act"), id = el.getAttribute("data-id");
  if (act === "add") showPicker();
  else if (act === "voice") showVoice();
  else if (act === "close") closeSheet();
  else if (act === "done") markDone(id);
  else if (act === "edit") showEdit(id, false);
  else if (act === "del") removeItem(id);
});
sheetBg.addEventListener("click", closeSheet);
document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeSheet(); });

/* ---------- Beispiel-Fristen zum Ausprobieren ---------- */
function seedDemo() {
  var t = today();
  function add(tid, v) {
    var tp = find(TEMPLATES, tid), it = build(tp, v, tp.lead);
    it.id = uid();
    items.push(it);
  }
  items = [];
  add("rechnung", { what: "Stadtwerke", date: toISO(addDays(t, 2)) });
  add("personalausweis", { date: toISO(addDays(t, 58)) });
  add("inspektion", { date: toISO(addDays(t, -4)) });
  add("handy", { what: "Telekom", start: toISO(addMonths(t, -23)), term: "24" });
  add("kfzversicherung", {});
  add("zahnarzt", { date: toISO(addMonths(t, -5)) });
  add("tuev", { month: toISO(addMonths(t, 7)).slice(0, 7) });
  add("steuer", {});
  add("reisepass", { date: toISO(addMonths(t, 26)) });
  save();
}

var params = new URLSearchParams(location.search);
if (params.get("demo") === "1") seedDemo();
render();
var show = params.get("show") || "";
if (params.get("say")) understand(params.get("say"));
else if (show === "add") showPicker();
else if (show === "voice") showVoice();
else if (show.indexOf("form:") === 0) showNew(show.slice(5));
else if (show === "item" && items.length) showItem(sortedItems()[0].id);
