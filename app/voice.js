// "Hey Livo": versteht einen gesprochenen oder getippten deutschen Satz ohne KI.
// Erkennt die Art der Frist (Stichwörter -> Vorlage), das Datum (absolut,
// relativ, Wochentag, Monat) und eine Uhrzeit. Der Rest wird zum Titel.
// Die Datums-Helfer (today, addDays, addMonths, …) stehen in app.js.

var MONTHS = {
  januar: 1, februar: 2, "märz": 3, maerz: 3, april: 4, mai: 5, juni: 6, juli: 7, august: 8,
  september: 9, oktober: 10, november: 11, dezember: 12,
  feb: 2, "mär": 3, apr: 4, jun: 6, jul: 7, aug: 8, sept: 9, sep: 9, okt: 10, nov: 11, dez: 12
};
var NUMS = {
  ein: 1, eins: 1, eine: 1, einem: 1, einen: 1, einer: 1, zwei: 2, drei: 3, vier: 4, "fünf": 5,
  sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, "zwölf": 12
};
var ORDINALS = {
  ersten: 1, zweiten: 2, dritten: 3, vierten: 4, "fünften": 5, sechsten: 6, siebten: 7, achten: 8,
  neunten: 9, zehnten: 10, elften: 11, "zwölften": 12, dreizehnten: 13, vierzehnten: 14,
  "fünfzehnten": 15, sechzehnten: 16, siebzehnten: 17, achtzehnten: 18, neunzehnten: 19,
  zwanzigsten: 20, einundzwanzigsten: 21, zweiundzwanzigsten: 22, dreiundzwanzigsten: 23,
  vierundzwanzigsten: 24, "fünfundzwanzigsten": 25, sechsundzwanzigsten: 26,
  siebenundzwanzigsten: 27, achtundzwanzigsten: 28, neunundzwanzigsten: 29,
  "dreißigsten": 30, "einunddreißigsten": 31
};
var WEEKDAYS = { sonntag: 0, montag: 1, dienstag: 2, mittwoch: 3, donnerstag: 4, freitag: 5, samstag: 6, sonnabend: 6 };

// Längere Wörter zuerst, damit "januar" vor "jan…" und "dreißigsten" vor "dreißig…" passt
function alt(obj) { return Object.keys(obj).sort(function (a, b) { return b.length - a.length; }).join("|"); }
var MONTH_RE = alt(MONTHS), NUM_RE = alt(NUMS), ORD_RE = alt(ORDINALS), WD_RE = alt(WEEKDAYS);
var PRE = "(?:am |bis |bis zum |zum |vom |ab |spätestens )?";

// Reihenfolge zählt: Spezielles vor Allgemeinem (Zahnarzt vor Arzt, Kfz-Versicherung vor Versicherung)
var KEYWORDS = [
  ["reisepass", ["reisepass", " pass "]],
  ["fuehrerschein", ["führerschein", "fuehrerschein"]],
  ["aufenthaltstitel", ["aufenthalt"]],
  ["personalausweis", ["personalausweis", "ausweis", " perso "]],
  ["steuer", ["steuererklärung", "steuererklaerung", "steuer erklärung", " steuern "]],
  ["rechnung", ["rechnung"]],
  ["kfzversicherung", ["kfz-versicherung", "kfz versicherung", "kfzversicherung", "autoversicherung", "auto versicherung"]],
  ["tuev", ["tüv", "tuev", "hauptuntersuchung", " hu "]],
  ["reifen", ["reifen"]],
  ["inspektion", ["inspektion", "ölwechsel", "werkstatt", "autoservice", "auto service"]],
  ["handy", ["handy", "mobilfunk", "internetvertrag", " dsl ", "telekom", "vodafone", " o2 "]],
  ["strom", ["strom", " gas ", "gasvertrag", "energie"]],
  ["abo", ["fitness", "studio", " abo ", "abonnement", "netflix", "spotify", "zeitung", "mitgliedschaft"]],
  ["versicherung", ["versicherung"]],
  ["zahnarzt", ["zahnarzt", "zahnärzt", "zahnreinigung", "prophylaxe"]],
  ["checkup", ["check-up", "checkup", "check up", "vorsorge"]],
  ["tetanus", ["tetanus", "impfung", "auffrisch"]],
  ["arzttermin", ["arzt", "ärztin", "doktor", " dr ", "praxis", "physio"]],
  ["rechnung", ["bezahlen", "überweisen", "überweisung", " zahlen "]]
];
// Füllwörter, die nicht in den Titel gehören (mehrteilige zuerst)
var FILLERS = [
  "hey livo", "hallo livo", "livo", "erinnere mich bitte", "erinnere mich", "erinner mich",
  "daran dass", "an die", "an den", "an das", "bitte", "daran", "dass", "an", "mein", "meine",
  "meinen", "meinem", "meiner", "der", "die", "das", "den", "dem", "läuft ab", "läuft", "ab",
  "ist", "wird", "fällig", "gültig", "bis", "am", "im", "um", "zum", "spätestens", "noch", "und", "uhr"
];

function norm(s) { return String(s).replace(/[,;!?„“"()]/g, " ").replace(/\s+/g, " ").trim(); }

function validDay(y, m, d) {
  var dt = new Date(y, m - 1, d);
  return dt.getMonth() === m - 1 ? dt : null;
}
// Ohne Jahreszahl gilt immer das laufende Jahr ("03.10" = 03.10. dieses Jahres,
// auch wenn der Tag vorbei ist); nur mit Jahr ("03.10.2027") ein anderes.
function yearOf(y) { return y ? (+y < 100 ? 2000 + +y : +y) : today().getFullYear(); }
// Tag + Monat
function dayMonth(d, m, y) {
  if (!d || !m || m > 12) return null;
  return validDay(yearOf(y), m, d);
}
// "Ende März" = letzter Tag, "Anfang" = 1., "Mitte" = 15.
function monthPart(m, y, part) {
  if (!m || m > 12) return null;
  var year = yearOf(y);
  return part === "anfang" ? new Date(year, m - 1, 1) : part === "mitte" ? new Date(year, m - 1, 15) : new Date(year, m, 0);
}

function extract(text) {
  var low = " " + norm(text).toLowerCase() + " ";
  var orig = " " + norm(text) + " ";
  var t0 = today(), date = null, time = null, m;

  // Treffer aus beiden Fassungen herausschneiden (beide haben dieselbe Länge)
  function cut(match) {
    var i = low.indexOf(match);
    if (i < 0) return;
    low = low.slice(0, i) + " " + low.slice(i + match.length);
    orig = orig.slice(0, i) + " " + orig.slice(i + match.length);
  }

  // Uhrzeit zuerst, damit "um 10 Uhr" nicht als Datum gelesen wird
  m = low.match(/ (?:um |ab |gegen )?(\d{1,2})(?:[:.](\d{2}))? ?uhr(?= )/) || low.match(/ um (\d{1,2})[:.](\d{2})(?= )/) || low.match(/ um (\d{1,2})(?= )/);
  if (m && +m[1] < 24) { time = pad(+m[1]) + ":" + (m[2] || "00"); cut(m[0]); }

  function first(re, fn) {
    if (date) return;
    var mm = low.match(re);
    if (!mm) return;
    var d = fn(mm);
    if (d && isDate(d)) { date = d; cut(mm[0]); }
  }
  // 15.03.2027 · 15.3.27 · 15.3. · 15.3 · 15. 3. (Chrome schreibt gesprochene Daten unterschiedlich)
  first(new RegExp(" " + PRE + "(\\d{1,2})\\. ?(\\d{1,2})(?:\\.(\\d{2,4})?)?(?= )"), function (x) { return dayMonth(+x[1], +x[2], x[3]); });
  // 15. März 2027 · 15 März
  first(new RegExp(" " + PRE + "(\\d{1,2})\\.? (" + MONTH_RE + ")\\.?(?: (\\d{4}))?(?= )"), function (x) { return dayMonth(+x[1], MONTHS[x[2]], x[3]); });
  // ersten April
  first(new RegExp(" " + PRE + "(" + ORD_RE + ") (" + MONTH_RE + ")\\.?(?: (\\d{4}))?(?= )"), function (x) { return dayMonth(ORDINALS[x[1]], MONTHS[x[2]], x[3]); });
  // Ende / Anfang / Mitte März 2027
  first(new RegExp(" (?:bis |zum )?(ende|anfang|mitte) (" + MONTH_RE + ")\\.?(?: (\\d{4}))?(?= )"), function (x) { return monthPart(MONTHS[x[2]], x[3], x[1]); });
  // im März 2027 · März → letzter Tag des Monats
  first(new RegExp(" (?:im |bis |ab |zum |bis zum |bis ende |ende )?(" + MONTH_RE + ")\\.?(?: (\\d{4}))?(?= )"), function (x) { return monthPart(MONTHS[x[1]], x[2], "ende"); });
  // 04/2027 · 4.2027 → letzter Tag des Monats
  first(/ (?:im |bis |ab )?(\d{1,2})[\/.](\d{4})(?= )/, function (x) { return monthPart(+x[1], x[2], "ende"); });
  // heute · morgen · übermorgen
  first(/ übermorgen(?= )/, function () { return addDays(t0, 2); });
  first(/ morgen(?= )/, function () { return addDays(t0, 1); });
  first(/ heute(?= )/, function () { return t0; });
  // in 2 Wochen · in drei Monaten
  first(new RegExp(" in (\\d{1,3}|" + NUM_RE + ") (tagen|tag|wochen|woche|monaten|monat|jahren|jahr)(?= )"), function (x) {
    var n = /\d/.test(x[1]) ? +x[1] : NUMS[x[1]], u = x[2];
    if (u.indexOf("tag") === 0) return addDays(t0, n);
    if (u.indexOf("woche") === 0) return addDays(t0, 7 * n);
    if (u.indexOf("monat") === 0) return addMonths(t0, n);
    return addMonths(t0, 12 * n);
  });
  // nächste Woche · nächsten Monat · nächstes Jahr
  first(/ (übernächste|nächste|kommende) woche(?= )/, function (x) { return addDays(t0, x[1] === "übernächste" ? 14 : 7); });
  first(/ (?:nächsten|kommenden) monat(?= )/, function () { return addMonths(t0, 1); });
  first(/ (?:nächstes|kommendes) jahr(?= )/, function () { return addMonths(t0, 12); });
  // (am / bis / nächsten) Dienstag
  first(new RegExp(" ((?:am |bis |ab |nächsten |kommenden |diesen )*)(" + WD_RE + ")(?= )"), function (x) {
    var wd = WEEKDAYS[x[2]], diff = (wd - t0.getDay() + 7) % 7 || 7;
    var iso = function (d) { return d === 0 ? 7 : d; };
    // "nächsten Dienstag" am Montag = Dienstag der nächsten Woche
    if (/nächsten|kommenden/.test(x[1]) && iso(wd) > iso(t0.getDay())) diff += 7;
    return addDays(t0, diff);
  });

  return { date: date, time: time, rest: cleanTitle(orig) };
}

function cleanTitle(s) {
  s = " " + s + " ";
  FILLERS.forEach(function (f) {
    s = s.replace(new RegExp(" " + f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?= )", "gi"), " ");
  });
  s = s.replace(/\s+/g, " ").replace(/^[\s.:-]+|[\s.:-]+$/g, "");
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}

function detectTemplate(text) {
  var low = " " + norm(text).toLowerCase() + " ";
  for (var i = 0; i < KEYWORDS.length; i++) {
    for (var j = 0; j < KEYWORDS[i][1].length; j++) {
      if (low.indexOf(KEYWORDS[i][1][j]) >= 0) return KEYWORDS[i][0];
    }
  }
  return "eigene";
}

// Aus einem Satz wird ein Entwurf, den der Nutzer vor dem Speichern bestätigt
function draftFrom(text) {
  var tid = detectTemplate(text), t = find(TEMPLATES, tid), x = extract(text);
  var free = tid === "rechnung" || tid === "arzttermin" || tid === "eigene";
  var title = free && x.rest.length >= 3 ? x.rest.slice(0, 60) : (t.name ? t.name({}) : t.title);
  // "Hausratversicherung", "Fitnessstudio" usw. in den Titel übernehmen
  var whatWord = { versicherung: /\S*versicherung\S*/i, abo: /\S*(fitness|studio|netflix|spotify|zeitung)\S*/i }[tid];
  if (whatWord) {
    var w = (x.rest.match(whatWord) || [])[0];
    title = t.name({ what: w && w.toLowerCase() !== "versicherung" ? w : "" });
  }
  var d = { tpl: tid, title: title, due: "", time: x.time || "", every: 0, from: t.from || "due", lead: t.lead, renew: !!t.renew };

  // Werte für die Vorlage: das gesprochene Datum (oder heute) in jedes Datumsfeld
  var iso = toISO(x.date || today()), v = {};
  t.fields.forEach(function (f) {
    v[f.key] = f.type === "date" ? iso : f.type === "month" ? iso.slice(0, 7) : f.value != null ? String(f.value) : "";
  });
  var r = t.compute(v);
  d.every = r.every || 0;
  var needsDate = t.fields.some(function (f) { return f.type === "date" || f.type === "month"; });
  if (!needsDate) d.due = toISO(x.date || r.due);              // Kfz, Reifen, Steuer: Datum optional
  else if (!x.date) d.due = "";                                  // Datum fehlt → Nutzer trägt es ein
  // Zukunft oder "auffrischen / fällig / nächste" = der Termin selbst, sonst "letztes Mal" bzw. Vertragsbeginn
  else if (t.dateMeans && (x.date >= today() || /auffrisch|fällig|nächste/i.test(text))) d.due = toISO(x.date);
  else d.due = toISO(r.due);
  return d;
}
