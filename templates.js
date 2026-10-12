// Vorlagen für Deutschland. Jede Vorlage fragt so wenig wie möglich ab und
// rechnet daraus aus: due = Fälligkeit, every = Wiederholung in Monaten
// (0 = einmalig), lead = wie viele Tage vorher erinnert wird.
// from: "done" = nächster Termin zählt ab dem Tag, an dem man "Erledigt" tippt
// (z. B. Zahnarzt), sonst ab der alten Fälligkeit (z. B. TÜV).
// renew: Dokumente bekommen beim Erneuern ein neues "Gültig bis"-Datum.
// dateMeans: was ein gesprochenes Datum in der Vergangenheit bedeutet ("last" = letztes Mal,
// "start" = Vertragsbeginn). Ein Datum in der Zukunft ist dann direkt der Termin.

var CATEGORIES = [
  { id: "doc", name: "Ausweise & Dokumente", icon: "🪪" },
  { id: "car", name: "Auto", icon: "🚗" },
  { id: "contract", name: "Verträge & Versicherungen", icon: "📄" },
  { id: "health", name: "Gesundheit", icon: "🩺" },
  { id: "money", name: "Geld & Steuern", icon: "💶" },
  { id: "own", name: "Eigene", icon: "⭐" }
];

var EVERY_OPTIONS = [
  [0, "Einmalig"], [1, "Jeden Monat"], [3, "Alle 3 Monate"], [6, "Alle 6 Monate"],
  [12, "Jedes Jahr"], [24, "Alle 2 Jahre"], [36, "Alle 3 Jahre"], [120, "Alle 10 Jahre"]
];

function months(v, def) { var n = parseInt(v, 10); return n > 0 ? n : def; }

var TEMPLATES = [
  // Ausweise & Dokumente
  {
    id: "personalausweis", cat: "doc", title: "Personalausweis", lead: 90, renew: true,
    fields: [{ key: "date", label: "Gültig bis", type: "date" }],
    hint: "Neuen Ausweis rechtzeitig beim Bürgeramt beantragen – die Herstellung dauert einige Wochen.",
    compute: function (v) { return { due: fromISO(v.date), every: 0 }; }
  },
  {
    id: "reisepass", cat: "doc", title: "Reisepass", lead: 180, renew: true,
    fields: [{ key: "date", label: "Gültig bis", type: "date" }],
    hint: "Viele Länder verlangen bei der Einreise noch mindestens 6 Monate Gültigkeit.",
    compute: function (v) { return { due: fromISO(v.date), every: 0 }; }
  },
  {
    id: "fuehrerschein", cat: "doc", title: "Führerschein", lead: 90, renew: true,
    fields: [{ key: "date", label: "Gültig bis (Feld 4b auf der Karte)", type: "date" }],
    hint: "Der EU-Kartenführerschein muss alle 15 Jahre erneuert werden.",
    compute: function (v) { return { due: fromISO(v.date), every: 0 }; }
  },
  {
    id: "aufenthaltstitel", cat: "doc", title: "Aufenthaltstitel", lead: 90, renew: true,
    fields: [{ key: "date", label: "Gültig bis", type: "date" }],
    hint: "Die Verlängerung früh bei der Ausländerbehörde beantragen – Termine sind oft knapp.",
    compute: function (v) { return { due: fromISO(v.date), every: 0 }; }
  },

  // Auto
  {
    id: "tuev", cat: "car", title: "TÜV / Hauptuntersuchung", lead: 30,
    fields: [{ key: "month", label: "Nächste HU laut Plakette (Monat und Jahr)", type: "month", placeholder: "z. B. 2027-04" }],
    hint: "Steht auf der Plakette am hinteren Kennzeichen. Danach meist alle 2 Jahre.",
    compute: function (v) { return { due: endOfMonth(v.month), every: 24 }; }
  },
  {
    id: "kfzversicherung", cat: "car", title: "Kfz-Versicherung wechseln", lead: 30, fields: [],
    hint: "Die meisten Kfz-Versicherungen laufen bis 31.12. – kündigen oder wechseln geht bis 30.11.",
    compute: function () { return { due: nextYearly(11, 30), every: 12 }; }
  },
  {
    id: "inspektion", cat: "car", title: "Inspektion / Auto-Service", lead: 14, from: "done",
    fields: [{ key: "date", label: "Nächste Inspektion fällig am", type: "date" }],
    hint: "Steht im Serviceheft oder wird im Auto-Display angezeigt.",
    compute: function (v) { return { due: fromISO(v.date), every: 12 }; }
  },
  {
    id: "reifen", cat: "car", title: "Reifenwechsel", lead: 14, fields: [],
    hint: "Faustregel „von O bis O“: Winterreifen von Oktober bis Ostern.",
    compute: function () {
      var a = nextYearly(10, 1), b = nextYearly(4, 1);
      return { due: a < b ? a : b, every: 6 };
    }
  },

  // Verträge & Versicherungen
  {
    id: "handy", cat: "contract", title: "Handy- / Internetvertrag", lead: 45, dateMeans: "start",
    fields: [
      { key: "what", label: "Anbieter", type: "text", optional: true, placeholder: "z. B. Telekom" },
      { key: "start", label: "Vertragsbeginn", type: "date" },
      { key: "term", label: "Mindestlaufzeit (Monate)", type: "months", value: 24 }
    ],
    hint: "Nach der Mindestlaufzeit kannst du meist jederzeit mit 1 Monat Frist kündigen – ein guter Zeitpunkt, Preise zu vergleichen.",
    name: function (v) { return (v.what ? "Handyvertrag " + v.what : "Handy- / Internetvertrag") + " – Laufzeit endet"; },
    compute: function (v) { return { due: addMonths(fromISO(v.start), months(v.term, 24)), every: 0 }; }
  },
  {
    id: "versicherung", cat: "contract", title: "Versicherung (Hausrat, Haftpflicht …)", lead: 30,
    fields: [
      { key: "what", label: "Welche Versicherung?", type: "text", optional: true, placeholder: "z. B. Hausrat" },
      { key: "end", label: "Vertrag läuft ab am", type: "date" },
      { key: "notice", label: "Kündigungsfrist (Monate)", type: "months", value: 3 }
    ],
    hint: "Bis zu diesem Tag muss deine Kündigung beim Versicherer angekommen sein. Sonst verlängert sich der Vertrag meist um ein Jahr.",
    name: function (v) { return (v.what || "Versicherung") + " – letzter Kündigungstag"; },
    compute: function (v) { return { due: addMonths(fromISO(v.end), -months(v.notice, 3)), every: 12 }; }
  },
  {
    id: "strom", cat: "contract", title: "Strom- / Gasvertrag", lead: 30, dateMeans: "start",
    fields: [
      { key: "what", label: "Anbieter", type: "text", optional: true, placeholder: "z. B. Stadtwerke" },
      { key: "start", label: "Vertragsbeginn", type: "date" },
      { key: "term", label: "Erstlaufzeit (Monate)", type: "months", value: 12 }
    ],
    hint: "Nach der Erstlaufzeit kannst du meist mit 1 Monat Frist kündigen. Ein Preisvergleich lohnt sich jedes Jahr.",
    name: function (v) { return (v.what ? "Strom/Gas " + v.what : "Strom / Gas") + " – Preise vergleichen"; },
    compute: function (v) { return { due: addMonths(fromISO(v.start), months(v.term, 12)), every: 12 }; }
  },
  {
    id: "abo", cat: "contract", title: "Abo / Fitnessstudio", lead: 30, dateMeans: "start",
    fields: [
      { key: "what", label: "Was?", type: "text", optional: true, placeholder: "z. B. Fitnessstudio" },
      { key: "start", label: "Vertragsbeginn", type: "date" },
      { key: "term", label: "Mindestlaufzeit (Monate)", type: "months", value: 12 }
    ],
    hint: "Nach der Mindestlaufzeit kannst du meist jederzeit mit 1 Monat Frist kündigen.",
    name: function (v) { return (v.what || "Abo") + " – Laufzeit endet"; },
    compute: function (v) { return { due: addMonths(fromISO(v.start), months(v.term, 12)), every: 0 }; }
  },

  // Gesundheit
  {
    id: "zahnarzt", cat: "health", title: "Zahnarzt-Kontrolle", lead: 14, from: "done", dateMeans: "last",
    fields: [{ key: "date", label: "Letzte Kontrolle", type: "date" }],
    hint: "Für das Bonusheft zählt bei Erwachsenen eine Kontrolle pro Kalenderjahr.",
    compute: function (v) { return { due: addMonths(fromISO(v.date), 6), every: 6 }; }
  },
  {
    id: "checkup", cat: "health", title: "Gesundheits-Check-up", lead: 30, from: "done", dateMeans: "last",
    fields: [{ key: "date", label: "Letzter Check-up", type: "date" }],
    hint: "Ab 35 zahlt die Krankenkasse den Check-up alle 3 Jahre.",
    compute: function (v) { return { due: addMonths(fromISO(v.date), 36), every: 36 }; }
  },
  {
    id: "tetanus", cat: "health", title: "Tetanus-Impfung auffrischen", lead: 60, from: "done", dateMeans: "last",
    fields: [{ key: "date", label: "Letzte Impfung", type: "date" }],
    hint: "Tetanus und Diphtherie werden in der Regel alle 10 Jahre aufgefrischt.",
    compute: function (v) { return { due: addMonths(fromISO(v.date), 120), every: 120 }; }
  },
  {
    id: "arzttermin", cat: "health", title: "Arzttermin", lead: 1,
    fields: [
      { key: "who", label: "Bei wem?", type: "text", optional: true, placeholder: "z. B. Hausärztin Dr. Weber" },
      { key: "date", label: "Datum", type: "date" }
    ],
    name: function (v) { return v.who ? "Arzttermin – " + v.who : "Arzttermin"; },
    compute: function (v) { return { due: fromISO(v.date), every: 0 }; }
  },

  // Geld & Steuern
  {
    id: "rechnung", cat: "money", title: "Rechnung bezahlen", lead: 3,
    fields: [
      { key: "what", label: "Wofür?", type: "text", optional: true, placeholder: "z. B. Stadtwerke" },
      { key: "date", label: "Fällig am", type: "date" }
    ],
    name: function (v) { return v.what ? "Rechnung – " + v.what : "Rechnung bezahlen"; },
    compute: function (v) { return { due: fromISO(v.date), every: 0 }; }
  },
  {
    id: "steuer", cat: "money", title: "Steuererklärung", lead: 45, fields: [],
    hint: "Ohne Steuerberater gilt in der Regel der 31. Juli des Folgejahres.",
    name: function () { return "Steuererklärung abgeben"; },
    compute: function () { return { due: nextYearly(7, 31), every: 12 }; }
  },

  // Eigene
  {
    id: "eigene", cat: "own", title: "Eigene Frist", lead: 14,
    fields: [
      { key: "title", label: "Was?", type: "text", placeholder: "z. B. Rundfunkbeitrag prüfen" },
      { key: "date", label: "Fällig am", type: "date" },
      { key: "every", label: "Wiederholung", type: "select", options: EVERY_OPTIONS, value: 0 }
    ],
    name: function (v) { return v.title; },
    compute: function (v) { return { due: fromISO(v.date), every: parseInt(v.every, 10) || 0 }; }
  }
];
