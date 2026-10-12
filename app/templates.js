// Vorlagen. Jede Vorlage fragt so wenig wie möglich ab und rechnet daraus aus:
// due = Fälligkeit, every = Wiederholung in Monaten (0 = einmalig), lead = wie
// viele Tage vorher erinnert wird.
// from: "done" = nächster Termin zählt ab dem Tag, an dem man "Erledigt" tippt
// (z. B. Zahnarzt), sonst ab der alten Fälligkeit (z. B. TÜV).
// renew: Dokumente bekommen beim Erneuern ein neues "Gültig bis"-Datum.
// dateMeans: was ein gesprochenes Datum in der Vergangenheit bedeutet ("last" = letztes Mal,
// "start" = Vertragsbeginn). Ein Datum in der Zukunft ist dann direkt der Termin.
// only: Vorlage nur in dieser Sprache (deutsche Regeln wie Kfz-Versicherung bis 30.11.).
// Die Texte stehen unten in TPL_TEXT, je Sprache.

var CATEGORIES = [
  { id: "doc", icon: "🪪" },
  { id: "car", icon: "🚗" },
  { id: "contract", icon: "📄" },
  { id: "health", icon: "🩺" },
  { id: "money", icon: "💶" },
  { id: "own", icon: "⭐" }
];

var EVERY_OPTIONS = [0, 1, 3, 6, 12, 24, 36, 120].map(function (n) { return [n, t("everyopt." + n)]; });

function months(v, def) { var n = parseInt(v, 10); return n > 0 ? n : def; }
function dated(v) { return { due: fromISO(v.date), every: 0 }; }

var TEMPLATES = [
  // Ausweise & Dokumente
  { id: "personalausweis", cat: "doc", lead: 90, renew: true, fields: [{ key: "date", type: "date" }], compute: dated },
  { id: "reisepass", cat: "doc", lead: 180, renew: true, fields: [{ key: "date", type: "date" }], compute: dated },
  { id: "fuehrerschein", cat: "doc", lead: 90, renew: true, fields: [{ key: "date", type: "date" }], compute: dated },
  { id: "aufenthaltstitel", cat: "doc", lead: 90, renew: true, fields: [{ key: "date", type: "date" }], compute: dated },

  // Auto
  {
    id: "tuev", cat: "car", lead: 30, fields: [{ key: "month", type: "month" }],
    compute: function (v) { return { due: endOfMonth(v.month), every: 24 }; }
  },
  {
    id: "kfzversicherung", cat: "car", lead: 30, only: "de", fields: [],
    compute: function () { return { due: nextYearly(11, 30), every: 12 }; }
  },
  {
    id: "inspektion", cat: "car", lead: 14, from: "done", fields: [{ key: "date", type: "date" }],
    compute: function (v) { return { due: fromISO(v.date), every: 12 }; }
  },
  {
    id: "reifen", cat: "car", lead: 14, only: "de", fields: [],
    compute: function () {
      var a = nextYearly(10, 1), b = nextYearly(4, 1);
      return { due: a < b ? a : b, every: 6 };
    }
  },

  // Verträge & Versicherungen
  {
    id: "handy", cat: "contract", lead: 45, dateMeans: "start",
    fields: [{ key: "what", type: "text", optional: true }, { key: "start", type: "date" }, { key: "term", type: "months", value: 24 }],
    compute: function (v) { return { due: addMonths(fromISO(v.start), months(v.term, 24)), every: 0 }; }
  },
  {
    id: "versicherung", cat: "contract", lead: 30,
    fields: [{ key: "what", type: "text", optional: true }, { key: "end", type: "date" }, { key: "notice", type: "months", value: 3 }],
    compute: function (v) { return { due: addMonths(fromISO(v.end), -months(v.notice, 3)), every: 12 }; }
  },
  {
    id: "strom", cat: "contract", lead: 30, dateMeans: "start",
    fields: [{ key: "what", type: "text", optional: true }, { key: "start", type: "date" }, { key: "term", type: "months", value: 12 }],
    compute: function (v) { return { due: addMonths(fromISO(v.start), months(v.term, 12)), every: 12 }; }
  },
  {
    id: "abo", cat: "contract", lead: 30, dateMeans: "start",
    fields: [{ key: "what", type: "text", optional: true }, { key: "start", type: "date" }, { key: "term", type: "months", value: 12 }],
    compute: function (v) { return { due: addMonths(fromISO(v.start), months(v.term, 12)), every: 0 }; }
  },

  // Gesundheit
  {
    id: "zahnarzt", cat: "health", lead: 14, from: "done", dateMeans: "last", fields: [{ key: "date", type: "date" }],
    compute: function (v) { return { due: addMonths(fromISO(v.date), 6), every: 6 }; }
  },
  {
    id: "checkup", cat: "health", lead: 30, from: "done", dateMeans: "last", fields: [{ key: "date", type: "date" }],
    compute: function (v) { return { due: addMonths(fromISO(v.date), 36), every: 36 }; }
  },
  {
    id: "tetanus", cat: "health", lead: 60, from: "done", dateMeans: "last", fields: [{ key: "date", type: "date" }],
    compute: function (v) { return { due: addMonths(fromISO(v.date), 120), every: 120 }; }
  },
  {
    id: "arzttermin", cat: "health", lead: 1,
    fields: [{ key: "who", type: "text", optional: true }, { key: "date", type: "date" }], compute: dated
  },

  // Geld & Steuern
  {
    id: "rechnung", cat: "money", lead: 3,
    fields: [{ key: "what", type: "text", optional: true }, { key: "date", type: "date" }], compute: dated
  },
  {
    id: "steuer", cat: "money", lead: 45, only: "de", fields: [],
    compute: function () { return { due: nextYearly(7, 31), every: 12 }; }
  },

  // Eigene
  {
    id: "eigene", cat: "own", lead: 14,
    fields: [{ key: "title", type: "text" }, { key: "date", type: "date" }, { key: "every", type: "select", options: EVERY_OPTIONS, value: 0 }],
    compute: function (v) { return { due: fromISO(v.date), every: parseInt(v.every, 10) || 0 }; }
  }
];

// Texte je Sprache: title, hint, labels/ph (Feldbeschriftung/Beispiel je Feld),
// name = Titel mit {what} (Anbieter, Arzt, …), name0 = Titel ohne
var TPL_TEXT = {
  de: {
    cat: { doc: "Ausweise & Dokumente", car: "Auto", contract: "Verträge & Versicherungen", health: "Gesundheit", money: "Geld & Steuern", own: "Eigene" },
    personalausweis: { title: "Personalausweis", hint: "Neuen Ausweis rechtzeitig beim Bürgeramt beantragen – die Herstellung dauert einige Wochen.", labels: { date: "Gültig bis" } },
    reisepass: { title: "Reisepass", hint: "Viele Länder verlangen bei der Einreise noch mindestens 6 Monate Gültigkeit.", labels: { date: "Gültig bis" } },
    fuehrerschein: { title: "Führerschein", hint: "Der EU-Kartenführerschein muss alle 15 Jahre erneuert werden.", labels: { date: "Gültig bis (Feld 4b auf der Karte)" } },
    aufenthaltstitel: { title: "Aufenthaltstitel", hint: "Die Verlängerung früh bei der Ausländerbehörde beantragen – Termine sind oft knapp.", labels: { date: "Gültig bis" } },
    tuev: { title: "TÜV / Hauptuntersuchung", hint: "Steht auf der Plakette am hinteren Kennzeichen. Danach meist alle 2 Jahre.", labels: { month: "Nächste HU laut Plakette (Monat und Jahr)" }, ph: { month: "z. B. 2027-04" } },
    kfzversicherung: { title: "Kfz-Versicherung wechseln", hint: "Die meisten Kfz-Versicherungen laufen bis 31.12. – kündigen oder wechseln geht bis 30.11." },
    inspektion: { title: "Inspektion / Auto-Service", hint: "Steht im Serviceheft oder wird im Auto-Display angezeigt.", labels: { date: "Nächste Inspektion fällig am" } },
    reifen: { title: "Reifenwechsel", hint: "Faustregel „von O bis O“: Winterreifen von Oktober bis Ostern." },
    handy: {
      title: "Handy- / Internetvertrag", hint: "Nach der Mindestlaufzeit kannst du meist jederzeit mit 1 Monat Frist kündigen – ein guter Zeitpunkt, Preise zu vergleichen.",
      labels: { what: "Anbieter", start: "Vertragsbeginn", term: "Mindestlaufzeit (Monate)" }, ph: { what: "z. B. Telekom" },
      name: "Handyvertrag {what} – Laufzeit endet", name0: "Handy- / Internetvertrag – Laufzeit endet"
    },
    versicherung: {
      title: "Versicherung (Hausrat, Haftpflicht …)", hint: "Bis zu diesem Tag muss deine Kündigung beim Versicherer angekommen sein. Sonst verlängert sich der Vertrag meist um ein Jahr.",
      labels: { what: "Welche Versicherung?", end: "Vertrag läuft ab am", notice: "Kündigungsfrist (Monate)" }, ph: { what: "z. B. Hausrat" },
      name: "{what} – letzter Kündigungstag", name0: "Versicherung – letzter Kündigungstag"
    },
    strom: {
      title: "Strom- / Gasvertrag", hint: "Nach der Erstlaufzeit kannst du meist mit 1 Monat Frist kündigen. Ein Preisvergleich lohnt sich jedes Jahr.",
      labels: { what: "Anbieter", start: "Vertragsbeginn", term: "Erstlaufzeit (Monate)" }, ph: { what: "z. B. Stadtwerke" },
      name: "Strom/Gas {what} – Preise vergleichen", name0: "Strom / Gas – Preise vergleichen"
    },
    abo: {
      title: "Abo / Fitnessstudio", hint: "Nach der Mindestlaufzeit kannst du meist jederzeit mit 1 Monat Frist kündigen.",
      labels: { what: "Was?", start: "Vertragsbeginn", term: "Mindestlaufzeit (Monate)" }, ph: { what: "z. B. Fitnessstudio" },
      name: "{what} – Laufzeit endet", name0: "Abo – Laufzeit endet"
    },
    zahnarzt: { title: "Zahnarzt-Kontrolle", hint: "Für das Bonusheft zählt bei Erwachsenen eine Kontrolle pro Kalenderjahr.", labels: { date: "Letzte Kontrolle" } },
    checkup: { title: "Gesundheits-Check-up", hint: "Ab 35 zahlt die Krankenkasse den Check-up alle 3 Jahre.", labels: { date: "Letzter Check-up" } },
    tetanus: { title: "Tetanus-Impfung auffrischen", hint: "Tetanus und Diphtherie werden in der Regel alle 10 Jahre aufgefrischt.", labels: { date: "Letzte Impfung" } },
    arzttermin: { title: "Arzttermin", labels: { who: "Bei wem?", date: "Datum" }, ph: { who: "z. B. Hausärztin Dr. Weber" }, name: "Arzttermin – {what}", name0: "Arzttermin" },
    rechnung: { title: "Rechnung bezahlen", labels: { what: "Wofür?", date: "Fällig am" }, ph: { what: "z. B. Stadtwerke" }, name: "Rechnung – {what}", name0: "Rechnung bezahlen" },
    steuer: { title: "Steuererklärung", hint: "Ohne Steuerberater gilt in der Regel der 31. Juli des Folgejahres.", name0: "Steuererklärung abgeben" },
    eigene: { title: "Eigene Frist", labels: { title: "Was?", date: "Fällig am", every: "Wiederholung" }, ph: { title: "z. B. Rundfunkbeitrag prüfen" } },
    demo: { bill: "Stadtwerke", phone: "Telekom" }
  },
  en: {
    cat: { doc: "IDs & documents", car: "Car", contract: "Contracts & insurance", health: "Health", money: "Money", own: "Your own" },
    personalausweis: { title: "ID card", hint: "Apply for a new ID card in good time – it can take a few weeks.", labels: { date: "Valid until" } },
    reisepass: { title: "Passport", hint: "Many countries require at least 6 months of validity when you enter.", labels: { date: "Valid until" } },
    fuehrerschein: { title: "Driving licence", hint: "Check the expiry date on your licence – EU card licences have to be renewed every 15 years.", labels: { date: "Valid until" } },
    aufenthaltstitel: { title: "Residence permit", hint: "Apply for the extension early – appointments are often hard to get.", labels: { date: "Valid until" } },
    tuev: { title: "Car inspection", hint: "Usually due every 2 years – the date is on your inspection sticker or certificate.", labels: { month: "Next inspection due (month and year)" }, ph: { month: "e.g. 2027-04" } },
    inspektion: { title: "Car service", hint: "It's in the service book or shown on the car's display.", labels: { date: "Next service due on" } },
    handy: {
      title: "Phone / internet contract", hint: "After the minimum term you can usually cancel at short notice – a good time to compare prices.",
      labels: { what: "Provider", start: "Contract start", term: "Minimum term (months)" }, ph: { what: "e.g. Vodafone" },
      name: "{what} contract – minimum term ends", name0: "Phone / internet contract – minimum term ends"
    },
    versicherung: {
      title: "Insurance (home, liability …)", hint: "Your cancellation has to reach the insurer by this day. Otherwise the policy usually renews for another year.",
      labels: { what: "Which insurance?", end: "Policy ends on", notice: "Notice period (months)" }, ph: { what: "e.g. home insurance" },
      name: "{what} – last day to cancel", name0: "Insurance – last day to cancel"
    },
    strom: {
      title: "Electricity / gas contract", hint: "After the initial term you can usually cancel at short notice. Comparing prices once a year pays off.",
      labels: { what: "Provider", start: "Contract start", term: "Initial term (months)" }, ph: { what: "e.g. EDF" },
      name: "{what} energy – compare prices", name0: "Electricity / gas – compare prices"
    },
    abo: {
      title: "Subscription / gym", hint: "After the minimum term you can usually cancel at short notice.",
      labels: { what: "What?", start: "Contract start", term: "Minimum term (months)" }, ph: { what: "e.g. gym" },
      name: "{what} – minimum term ends", name0: "Subscription – minimum term ends"
    },
    zahnarzt: { title: "Dental check-up", hint: "Most dentists recommend a check-up every 6 months.", labels: { date: "Last check-up" } },
    checkup: { title: "Health check-up", hint: "Regular check-ups help to spot problems early.", labels: { date: "Last check-up" } },
    tetanus: { title: "Tetanus booster", hint: "Tetanus and diphtheria boosters are usually recommended every 10 years.", labels: { date: "Last vaccination" } },
    arzttermin: { title: "Doctor's appointment", labels: { who: "With whom?", date: "Date" }, ph: { who: "e.g. Dr Smith" }, name: "Doctor's appointment – {what}", name0: "Doctor's appointment" },
    rechnung: { title: "Pay a bill", labels: { what: "What for?", date: "Due on" }, ph: { what: "e.g. electricity" }, name: "Bill – {what}", name0: "Pay a bill" },
    eigene: { title: "Your own deadline", labels: { title: "What?", date: "Due on", every: "Repeats" }, ph: { title: "e.g. renew parking permit" } },
    demo: { bill: "Electricity", phone: "Vodafone" }
  }
};

function tplText(tp) { return (TPL_TEXT[LANG] && TPL_TEXT[LANG][tp.id]) || TPL_TEXT.de[tp.id] || {}; }
function tplTitle(tp) { return tplText(tp).title || tp.id; }
function tplHint(tp) { return tplText(tp).hint || ""; }
function fieldLabel(tp, f) { var x = tplText(tp); return (x.labels && x.labels[f.key]) || f.key; }
function fieldPh(tp, f) { var x = tplText(tp); return (x.ph && x.ph[f.key]) || ""; }
function catName(c) { return ((TPL_TEXT[LANG] || TPL_TEXT.en).cat || TPL_TEXT.de.cat)[c.id]; }
function demoWord(key) { return ((TPL_TEXT[LANG] || TPL_TEXT.en).demo || TPL_TEXT.de.demo)[key]; }
// Titel einer neuen Frist: mit Anbieter/Arzt ("Handyvertrag Telekom – …") oder ohne
function tplName(tp, v) {
  if (tp.id === "eigene") return v.title || tplTitle(tp);
  var x = tplText(tp), w = v.what || v.who;
  if (w && x.name) return x.name.replace("{what}", w);
  return x.name0 || tplTitle(tp);
}
// Vorlagen, die es in der App-Sprache gibt
function visibleTemplates() { return TEMPLATES.filter(function (tp) { return !tp.only || tp.only === LANG; }); }
