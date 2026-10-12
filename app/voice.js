// "Hey Livo": versteht gesprochene oder getippte Sätze ohne KI. Pro Sprache ein
// Wörterbuch (LEX) mit Monaten, Wochentagen, Zahlwörtern, Uhrzeit-Mustern,
// Stichwörtern für die Vorlagen und Füllwörtern; die Regeln darunter gelten für alle.
// Erkennt die Art der Frist (Stichwörter -> Vorlage), das Datum (absolut, relativ,
// Wochentag, Monat) und eine Uhrzeit. Der Rest wird zum Titel.
// Datums-Helfer (today, addDays, …) stehen in app.js, LANG/LOCALE in i18n.js.

function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
// Längere Wörter zuerst, damit "januar" vor "jan…" und "übermorgen" vor "morgen" passt
function alt(words) { return words.slice().sort(function (a, b) { return b.length - a.length; }).map(escRe).join("|"); }
function altKeys(obj) { return alt(Object.keys(obj)); }
function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

// Zahlwörter "twenty-first", "twenty first" usw. für 21–31
function englishOrdinals() {
  var o = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
    eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14, fifteenth: 15, sixteenth: 16, seventeenth: 17,
    eighteenth: 18, nineteenth: 19, twentieth: 20, thirtieth: 30 };
  ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth"].forEach(function (w, i) {
    o["twenty-" + w] = o["twenty " + w] = 21 + i;
  });
  o["thirty-first"] = o["thirty first"] = 31;
  return o;
}

var LEX = {};

LEX.de = {
  months: {
    januar: 1, februar: 2, "märz": 3, maerz: 3, april: 4, mai: 5, juni: 6, juli: 7, august: 8,
    september: 9, oktober: 10, november: 11, dezember: 12,
    feb: 2, "mär": 3, apr: 4, jun: 6, jul: 7, aug: 8, sept: 9, sep: 9, okt: 10, nov: 11, dez: 12
  },
  weekdays: { sonntag: 0, montag: 1, dienstag: 2, mittwoch: 3, donnerstag: 4, freitag: 5, samstag: 6, sonnabend: 6 },
  nums: {
    ein: 1, eins: 1, eine: 1, einem: 1, einen: 1, einer: 1, zwei: 2, drei: 3, vier: 4, "fünf": 5,
    sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, "zwölf": 12
  },
  ordinals: {
    ersten: 1, zweiten: 2, dritten: 3, vierten: 4, "fünften": 5, sechsten: 6, siebten: 7, achten: 8,
    neunten: 9, zehnten: 10, elften: 11, "zwölften": 12, dreizehnten: 13, vierzehnten: 14,
    "fünfzehnten": 15, sechzehnten: 16, siebzehnten: 17, achtzehnten: 18, neunzehnten: 19,
    zwanzigsten: 20, einundzwanzigsten: 21, zweiundzwanzigsten: 22, dreiundzwanzigsten: 23,
    vierundzwanzigsten: 24, "fünfundzwanzigsten": 25, sechsundzwanzigsten: 26,
    siebenundzwanzigsten: 27, achtundzwanzigsten: 28, neunundzwanzigsten: 29,
    "dreißigsten": 30, "einunddreißigsten": 31
  },
  pre: "(?:am |bis |bis zum |zum |vom |ab |spätestens )?",
  parts: { ende: "end", anfang: "start", mitte: "mid" }, partPre: "(?:bis |zum )?",
  monthPre: "(?:im |bis |ab |zum |bis zum |bis ende |ende )?", numMonthPre: "(?:im |bis |ab )?",
  today: ["heute"], tomorrow: ["morgen"], dayAfter: ["übermorgen"],
  inWord: "in", units: { day: ["tagen", "tag"], week: ["wochen", "woche"], month: ["monaten", "monat"], year: ["jahren", "jahr"] },
  rel: [[["übernächste woche"], { days: 14 }], [["nächste woche", "kommende woche"], { days: 7 }],
    [["nächsten monat", "kommenden monat"], { months: 1 }], [["nächstes jahr", "kommendes jahr"], { months: 12 }]],
  wdPre: "(?:am |bis |ab |nächsten |kommenden |diesen )*", wdNext: /nächsten|kommenden/,
  // "halb 4" = 3:30, "viertel nach 3" = 3:15, "viertel vor 4" = 3:45, "um 15 Uhr", "um drei"
  times: function (H, hourOf) {
    var AT = " (?:um |ab |gegen )?";
    function exact(m) { return { h: +m[1], m: m[2] ? +m[2] : 0, padded: /^0\d/.test(m[1]) }; }
    return [
      [AT + "halb " + H + "(?: uhr)?", function (m) { return { h: hourOf(m[1]) - 1, m: 30 }; }],
      [AT + "viertel nach " + H + "(?: uhr)?", function (m) { return { h: hourOf(m[1]), m: 15 }; }],
      [AT + "viertel vor " + H + "(?: uhr)?", function (m) { return { h: hourOf(m[1]) - 1, m: 45 }; }],
      [" (?:um |ab |gegen )?(\\d{1,2})(?:[:.](\\d{2}))? ?uhr", exact],
      [" (?:um|ab|gegen) (\\d{1,2})[:.](\\d{2})", exact],
      [" (?:um|gegen) " + H + "(?: uhr)?", function (m) { return { h: hourOf(m[1]), m: 0, padded: /^0\d/.test(m[1]) }; }]
    ];
  },
  pm: / (nachmittags?|abends?|am nachmittag|am abend)(?= )/, am: / (morgens|früh|vormittags?|am vormittag|am morgen|nachts)(?= )/,
  dueWords: /auffrisch|fällig|nächste/,
  // Reihenfolge zählt: Spezielles vor Allgemeinem (Zahnarzt vor Arzt, Kfz-Versicherung vor Versicherung)
  keywords: [
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
  ],
  // Füllwörter, die nicht in den Titel gehören (mehrteilige zuerst)
  fillers: [
    "hey livo", "hallo livo", "livo", "erinnere mich bitte", "erinnere mich", "erinner mich",
    "am nachmittag", "am abend", "am vormittag", "am morgen",
    "daran dass", "an die", "an den", "an das", "bitte", "daran", "dass", "an", "mein", "meine",
    "meinen", "meinem", "meiner", "der", "die", "das", "den", "dem", "läuft ab", "läuft", "ab",
    "ist", "wird", "fällig", "gültig", "bis", "am", "im", "um", "zum", "spätestens", "noch", "und", "uhr",
    "nachmittags", "abends", "morgens", "vormittags"
  ],
  // "Hausratversicherung", "Fitnessstudio" usw. in den Titel übernehmen
  whatWord: { versicherung: /\S*versicherung\S*/i, abo: /\S*(?:fitness|studio|netflix|spotify|zeitung)\S*/i },
  whatSkip: ["versicherung"]
};

LEX.en = {
  months: {
    january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8,
    september: 9, october: 10, november: 11, december: 12,
    feb: 2, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12
  },
  weekdays: { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 },
  nums: { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 },
  counts: { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 },
  ordinals: englishOrdinals(),
  ordSuffix: true,              // "3rd" -> "3"
  pre: "(?:on |by |until |till |before |from |on the |by the |the )*",
  dmJoin: "(?:of )?",           // "3rd of March"
  monthDay: true,               // "March 3", "March 3rd"
  mdy: function () { return /^en-US/i.test(LOCALE); },  // 3/11 = 11 March, in den USA 3 November
  parts: {
    "end of": "end", "the end of": "end", "beginning of": "start", "the beginning of": "start",
    "start of": "start", "the start of": "start", early: "start", "middle of": "mid", "the middle of": "mid", mid: "mid"
  },
  partPre: "(?:by |at |in |until |before )?",
  monthPre: "(?:in |by |until |before |from |during )?", numMonthPre: "(?:in |by |until )?",
  today: ["today", "tonight"], tomorrow: ["tomorrow"], dayAfter: ["the day after tomorrow", "day after tomorrow"],
  inWord: "in", units: { day: ["days", "day"], week: ["weeks", "week"], month: ["months", "month"], year: ["years", "year"] },
  rel: [[["the week after next", "week after next"], { days: 14 }], [["next week"], { days: 7 }],
    [["next month"], { months: 1 }], [["next year"], { months: 12 }]],
  wdPre: "(?:on |by |until |next |this |coming |on the |the )*", wdNext: /next|coming/,
  // "half past 3", "quarter to 4", "at 3 pm", "3 o'clock", "at 10:30", "noon"
  times: function (H, hourOf) {
    var AT = " (?:at |from |around |by )?";
    return [
      [AT + "half past " + H, function (m) { return { h: hourOf(m[1]), m: 30 }; }],
      [AT + "(?:a )?quarter past " + H, function (m) { return { h: hourOf(m[1]), m: 15 }; }],
      [AT + "(?:a )?quarter to " + H, function (m) { return { h: hourOf(m[1]) - 1, m: 45 }; }],
      [" (?:at |from |around |by )?(\\d{1,2})(?:[:.](\\d{2}))? ?(am|pm)", function (m) { return { h: +m[1], m: m[2] ? +m[2] : 0, ampm: m[3] }; }],
      [AT + H + " o'?clock", function (m) { return { h: hourOf(m[1]), m: 0 }; }],
      [" (?:at|around|from|by) (\\d{1,2})[:.](\\d{2})", function (m) { return { h: +m[1], m: +m[2], padded: /^0\d/.test(m[1]) }; }],
      [" (?:at|around) " + H, function (m) { return { h: hourOf(m[1]), m: 0, padded: /^0\d/.test(m[1]) }; }],
      [" (?:at )?(?:noon|midday)", function () { return { h: 12, m: 0, fixed: true }; }],
      [" (?:at )?midnight", function () { return { h: 0, m: 0, fixed: true }; }]
    ];
  },
  pm: / (pm|in the afternoon|in the evening|tonight|this afternoon|this evening)(?= )/, am: / (am|in the morning|this morning)(?= )/,
  dueWords: /booster|due|next/,
  keywords: [
    ["reisepass", ["passport"]],
    ["fuehrerschein", ["driving licence", "driving license", "driver's license", "driver's licence", "drivers license", "driver license"]],
    ["aufenthaltstitel", ["residence permit", "work permit", " visa "]],
    ["personalausweis", ["id card", "identity card", " id "]],
    ["rechnung", ["bill", "invoice"]],
    ["tuev", [" mot ", "car inspection", "vehicle inspection", "roadworthiness"]],
    ["inspektion", ["car service", "oil change", "garage"]],
    ["handy", ["phone contract", "mobile contract", "phone plan", "mobile plan", "broadband", "internet contract"]],
    ["strom", ["electricity", "energy contract", "gas contract", "energy supplier"]],
    ["abo", ["gym", "subscription", "netflix", "spotify", "membership"]],
    ["versicherung", ["insurance"]],
    ["zahnarzt", ["dentist", "dental"]],
    ["checkup", ["check-up", "checkup", "check up", "screening", "health check"]],
    ["tetanus", ["tetanus", "vaccination", "vaccine", "booster", " jab "]],
    ["arzttermin", ["doctor", " dr ", " gp ", "physio", "clinic", "hospital"]],
    ["rechnung", [" pay ", " rent ", "transfer"]]
  ],
  fillers: [
    "hey livo", "hi livo", "ok livo", "livo", "remind me to", "remind me about", "remind me that", "remind me",
    "in the morning", "in the afternoon", "in the evening", "this morning", "this afternoon", "this evening",
    "runs out", "run out", "please", "that", "my", "the", "a", "an", "to", "on", "at", "by", "is", "are",
    "expires", "expire", "due", "until", "in", "and", "of", "o'clock", "pm", "am", "next", "this"
  ],
  whatWord: { versicherung: /\b([a-z]+ insurance)\b/i, abo: /\b(gym|netflix|spotify|[a-z]+ subscription|[a-z]+ membership)\b/i },
  whatSkip: []
};

function lexFor() { return LEX[LANG] || LEX.en; }

function norm(s) { return String(s).replace(/[,;!?„“”"«»()]/g, " ").replace(/\s+/g, " ").trim(); }
// Schreibweisen vereinheitlichen, bevor gesucht wird (Länge darf sich hier ändern)
function prepare(text, L) {
  var s = norm(text);
  if (L.ordSuffix) s = s.replace(/(\d+)(st|nd|rd|th)\b/gi, "$1");
  return s.replace(/\b([ap])\.m\.?/gi, "$1m").replace(/\bmid-/gi, "mid ");
}

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
// "end" = letzter Tag, "start" = 1., "mid" = 15.
function monthPart(m, y, part) {
  if (!m || m > 12) return null;
  var year = yearOf(y);
  return part === "start" ? new Date(year, m - 1, 1) : part === "mid" ? new Date(year, m - 1, 15) : new Date(year, m, 0);
}

function extract(text, L) {
  L = L || lexFor();
  var orig = " " + prepare(text, L) + " ";
  var low = orig.toLowerCase();
  var t0 = today(), date = null, time = null, m;

  // Treffer aus beiden Fassungen herausschneiden (beide haben dieselbe Länge)
  function cut(match) {
    var i = low.indexOf(match);
    if (i < 0) return;
    low = low.slice(0, i) + " " + low.slice(i + match.length);
    orig = orig.slice(0, i) + " " + orig.slice(i + match.length);
  }

  // Uhrzeit zuerst, damit "um 10 Uhr" nicht als Datum gelesen wird
  var H = "(\\d{1,2}|" + altKeys(L.nums) + ")";
  function hourOf(s) { return /\d/.test(s) ? +s : L.nums[s]; }
  var patterns = L.times(H, hourOf), tm = null;
  for (var i = 0; i < patterns.length && !tm; i++) {
    m = low.match(new RegExp(patterns[i][0] + "(?= )"));
    if (!m) continue;
    var r = patterns[i][1](m);
    if (r && r.h >= 0 && r.h < 24 && r.m < 60) { tm = r; cut(m[0]); }
  }
  if (tm) {
    var hour = tm.h;
    if (tm.ampm === "pm" && hour < 12) hour += 12;
    else if (tm.ampm === "am" && hour === 12) hour = 0;
    else if (!tm.ampm && !tm.fixed) {
      // Wie man spricht: "um 3" ist nachmittags, "um 9" vormittags - außer man sagt es dazu
      if (hour < 12 && L.pm.test(low)) hour += 12;
      else if (hour >= 1 && hour <= 6 && !tm.padded && !L.am.test(low)) hour += 12;
    }
    time = pad(hour) + ":" + pad(tm.m);
  }

  function first(re, fn) {
    if (date) return;
    var mm = low.match(re);
    if (!mm) return;
    var d = fn(mm);
    if (d && isDate(d)) { date = d; cut(mm[0]); }
  }
  var MONTH = altKeys(L.months), ORD = L.ordinals ? altKeys(L.ordinals) : "", WD = altKeys(L.weekdays);
  var PRE = L.pre, JOIN = L.dmJoin || "", Y = "(?: (\\d{4}))?(?= )";

  // 15.03.2027 · 15.3. · 15/3 (in den USA Monat/Tag)
  first(new RegExp(" " + PRE + "(\\d{1,2})(\\. ?|/)(\\d{1,2})(?:[./](\\d{2,4})?)?(?= )"), function (x) {
    var dm = dayMonth(+x[1], +x[3], x[4]), md = dayMonth(+x[3], +x[1], x[4]), slash = x[2] === "/";
    // Nur bei "/" kann die Reihenfolge je nach Land wechseln (15/08 auch auf einem US-Handy);
    // "10.30" mit Punkt ist dagegen eher eine Uhrzeit als ein Datum.
    if (slash && L.mdy && L.mdy()) return md || dm;
    return dm || (slash ? md : null);
  });
  // 15. März 2027 · 15 March · 15 of March
  first(new RegExp(" " + PRE + "(\\d{1,2})\\.? " + JOIN + "(" + MONTH + ")\\.?" + Y), function (x) { return dayMonth(+x[1], L.months[x[2]], x[3]); });
  // ersten April · third of March
  if (ORD) first(new RegExp(" " + PRE + "(" + ORD + ") " + JOIN + "(" + MONTH + ")\\.?" + Y), function (x) { return dayMonth(L.ordinals[x[1]], L.months[x[2]], x[3]); });
  // March 15 · March fifteenth
  if (L.monthDay) {
    first(new RegExp(" " + PRE + "(" + MONTH + ") (\\d{1,2})" + Y), function (x) { return dayMonth(+x[2], L.months[x[1]], x[3]); });
    if (ORD) first(new RegExp(" " + PRE + "(" + MONTH + ") (?:the )?(" + ORD + ")" + Y), function (x) { return dayMonth(L.ordinals[x[2]], L.months[x[1]], x[3]); });
  }
  // Ende März · end of March
  first(new RegExp(" " + L.partPre + "(" + altKeys(L.parts) + ") (" + MONTH + ")\\.?" + Y), function (x) { return monthPart(L.months[x[2]], x[3], L.parts[x[1]]); });
  // im März 2027 · in March → letzter Tag des Monats
  first(new RegExp(" " + L.monthPre + "(" + MONTH + ")\\.?" + Y), function (x) { return monthPart(L.months[x[1]], x[2], "end"); });
  // 04/2027 · 4.2027 → letzter Tag des Monats
  first(new RegExp(" " + L.numMonthPre + "(\\d{1,2})[\\/.](\\d{4})(?= )"), function (x) { return monthPart(+x[1], x[2], "end"); });
  // übermorgen · morgen · heute
  [[L.dayAfter, 2], [L.tomorrow, 1], [L.today, 0]].forEach(function (w) {
    first(new RegExp(" (?:" + alt(w[0]) + ")(?= )"), function () { return addDays(t0, w[1]); });
  });
  // in 2 Wochen · in drei Monaten · in a week
  var counts = L.counts || L.nums, U = L.units;
  first(new RegExp(" " + L.inWord + " (\\d{1,3}|" + altKeys(counts) + ") (" + alt([].concat(U.day, U.week, U.month, U.year)) + ")(?= )"), function (x) {
    var n = /\d/.test(x[1]) ? +x[1] : counts[x[1]], u = x[2];
    if (U.day.indexOf(u) >= 0) return addDays(t0, n);
    if (U.week.indexOf(u) >= 0) return addDays(t0, 7 * n);
    if (U.month.indexOf(u) >= 0) return addMonths(t0, n);
    return addMonths(t0, 12 * n);
  });
  // nächste Woche · nächsten Monat · next year
  L.rel.forEach(function (rel) {
    first(new RegExp(" (?:" + alt(rel[0]) + ")(?= )"), function () { return rel[1].days ? addDays(t0, rel[1].days) : addMonths(t0, rel[1].months); });
  });
  // (am / bis / nächsten) Dienstag
  first(new RegExp(" (" + L.wdPre + ")(" + WD + ")(?= )"), function (x) {
    var wd = L.weekdays[x[2]], diff = (wd - t0.getDay() + 7) % 7 || 7;
    var iso = function (d) { return d === 0 ? 7 : d; };
    // "nächsten Dienstag" am Montag = Dienstag der nächsten Woche
    if (L.wdNext.test(x[1]) && iso(wd) > iso(t0.getDay())) diff += 7;
    return addDays(t0, diff);
  });

  return { date: date, time: time, rest: cleanTitle(orig, L) };
}

function cleanTitle(s, L) {
  // Lücken vom herausgeschnittenen Datum schließen, damit "remind me … about" wieder zusammenpasst
  s = " " + s.replace(/\s+/g, " ").trim() + " ";
  L.fillers.forEach(function (f) {
    s = s.replace(new RegExp(" " + escRe(f) + "(?= )", "gi"), " ");
  });
  s = s.replace(/\s+/g, " ").replace(/^[\s.:-]+|[\s.:-]+$/g, "");
  return capitalize(s);
}

function detectTemplate(text, L) {
  L = L || lexFor();
  var low = " " + prepare(text, L).toLowerCase() + " ";
  for (var i = 0; i < L.keywords.length; i++) {
    for (var j = 0; j < L.keywords[i][1].length; j++) {
      if (low.indexOf(L.keywords[i][1][j]) >= 0) return L.keywords[i][0];
    }
  }
  return "eigene";
}

// Aus einem Satz wird ein Entwurf, den der Nutzer vor dem Speichern bestätigt
function draftFrom(text) {
  var L = lexFor(), tid = detectTemplate(text, L), tp = find(TEMPLATES, tid), x = extract(text, L);
  var free = tid === "rechnung" || tid === "arzttermin" || tid === "eigene";
  var title = free && x.rest.length >= 3 ? x.rest.slice(0, 60) : tplName(tp, {});
  var whatWord = L.whatWord && L.whatWord[tid];
  if (whatWord) {
    var mw = x.rest.match(whatWord), w = mw ? (mw[1] || mw[0]) : "";
    title = tplName(tp, { what: w && L.whatSkip.indexOf(w.toLowerCase()) < 0 ? capitalize(w) : "" });
  }
  var d = { tpl: tid, title: title, due: "", time: x.time || "", every: 0, from: tp.from || "due", lead: tp.lead, renew: !!tp.renew };

  // Werte für die Vorlage: das gesprochene Datum (oder heute) in jedes Datumsfeld
  var iso = toISO(x.date || today()), v = {};
  tp.fields.forEach(function (f) {
    v[f.key] = f.type === "date" ? iso : f.type === "month" ? iso.slice(0, 7) : f.value != null ? String(f.value) : "";
  });
  var r = tp.compute(v);
  d.every = r.every || 0;
  var needsDate = tp.fields.some(function (f) { return f.type === "date" || f.type === "month"; });
  if (!needsDate) d.due = toISO(x.date || r.due);              // Kfz, Reifen, Steuer: Datum optional
  else if (!x.date) d.due = "";                                  // Datum fehlt → Nutzer trägt es ein
  // Zukunft oder "auffrischen / fällig / nächste" = der Termin selbst, sonst "letztes Mal" bzw. Vertragsbeginn
  else if (tp.dateMeans && (x.date >= today() || L.dueWords.test(text.toLowerCase()))) d.due = toISO(x.date);
  else d.due = toISO(r.due);
  return d;
}
