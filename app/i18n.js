// heylivo: Sprachen der App. Die App spricht die Sprache, die man gewählt hat
// (?lang=… oder Auswahl oben rechts, gemerkt im Browser), sonst die des Handys,
// sonst Englisch. Neue Sprache = Eintrag in LANGS + Texte in TXT + Vorlagen-Texte
// (templates.js) + Wörterbuch fürs Verstehen (voice.js).

var LANGS = { de: "Deutsch", en: "English" };
var LOCALES = { de: "de-DE", en: "en-GB" };

var LANG = (function () {
  var asked = new URLSearchParams(location.search).get("lang");
  var saved = null;
  try { saved = localStorage.getItem("livo.lang"); } catch (e) {}
  if (asked && LANGS[asked]) { try { localStorage.setItem("livo.lang", asked); } catch (e) {} return asked; }
  var wished = [saved].concat(navigator.languages || [navigator.language]);
  for (var i = 0; i < wished.length; i++) {
    var code = String(wished[i] || "").slice(0, 2).toLowerCase();
    if (LANGS[code]) return code;
  }
  return "en";
})();
// Datumsformat des Handys, wenn es zur Sprache passt (en-US schreibt Monat/Tag), sonst das übliche
var LOCALE = (navigator.language || "").slice(0, 2).toLowerCase() === LANG ? navigator.language : LOCALES[LANG];
document.documentElement.lang = LANG;

// Auswahl merken und neu laden (ohne ?lang=, das sonst wieder gewinnen würde)
function setLang(code) {
  try { localStorage.setItem("livo.lang", code); } catch (e) {}
  location.href = location.pathname;
}

var TXT = {
  de: {
    "q.open": "„", "q.close": "“",
    "time.suffix": " Uhr",
    "note.demo": "Demo mit Beispiel-Fristen – hier wird nichts gespeichert.",
    "note.beta": "Beta: Deine Fristen werden sicher gespeichert – ohne Anmeldung, in diesem Browser.",
    "loading": "Lädt …",
    "offline": "Keine Verbindung. Bitte prüf dein Internet und lade die Seite neu.",
    "add": "Frist hinzufügen",
    "err.trial": "Deine {n} Tage Testphase sind vorbei. Mit Livo Plus für 11,99 € im Jahr geht es weiter.",
    "err.save": "Das Speichern hat nicht geklappt. Bitte prüf deine Internetverbindung und versuch es nochmal.",
    "when.today": "heute fällig", "when.tomorrow": "morgen fällig", "when.yesterday": "seit gestern fällig",
    "when.overdue": "seit {n} Tagen fällig", "when.days": "in {n} Tagen", "when.months": "in {n} Monaten", "when.years": "in {n} Jahren",
    "every.0": "einmalig", "every.1": "jeden Monat", "every.12": "jedes Jahr", "every.years": "alle {n} Jahre", "every.months": "alle {n} Monate",
    "everyopt.0": "Einmalig", "everyopt.1": "Jeden Monat", "everyopt.3": "Alle 3 Monate", "everyopt.6": "Alle 6 Monate",
    "everyopt.12": "Jedes Jahr", "everyopt.24": "Alle 2 Jahre", "everyopt.36": "Alle 3 Jahre", "everyopt.120": "Alle 10 Jahre",
    "remind.now": "sofort", "remind.from": "ab {date}",
    "voicebar.sub": "Frist einfach sagen, z. B. „Mein Ausweis läuft im März 2027 ab“",
    "status.plus": "Livo Plus aktiv bis {date}",
    "status.trialStart": "<b>{n} Tage kostenlos testen</b> – die Testphase startet mit deiner ersten Frist.",
    "status.trial": "Testphase:", "status.today": "<b>endet heute</b>", "status.left1": "noch <b>1 Tag</b> kostenlos", "status.left": "noch <b>{n} Tage</b> kostenlos",
    "status.expired": "<b>Deine Testphase ist vorbei.</b> Deine Fristen kannst du weiter ansehen. Zum Eintragen, Ändern und für Erinnerungen: <u>Livo Plus aktivieren</u>",
    "sec.now": "Jetzt kümmern", "sec.later": "Alles im Blick", "allgood": "✅ Alles im Griff – gerade ist nichts fällig.",
    "card.remind": "Erinnerung {x}", "card.due": "fällig am {x}",
    "empty.title": "Nie wieder eine Frist verpassen.", "empty.sub": "Sag Livo einfach, woran du denken musst – oder wähle eine Vorlage.", "empty.all": "Alle Vorlagen ansehen",
    "picker.title": "Was möchtest du im Blick behalten?", "picker.voice": "🎤 Lieber sagen statt tippen", "cancel": "Abbrechen",
    "voice.intro": "Sag einfach, worum es geht und wann – z. B. „Mein Ausweis läuft im März 2027 ab“ oder „Zahnarzt am 3. November um 10 Uhr“. Livo hört zu, bis du kurz still bist – oder tipp aufs Mikrofon, wenn du fertig bist.",
    "voice.unsupported": "Spracheingabe geht in diesem Browser nicht – in Chrome auf Android und in Safari auf dem iPhone schon. Du kannst den Satz aber hier eintippen.",
    "voice.type": "… oder hier eintippen", "voice.speak": "Sprechen", "voice.listening": "Ich höre zu …",
    "voice.denied": "Das Mikrofon ist nicht erlaubt. Bitte im Browser erlauben – oder den Satz eintippen.",
    "voice.nothing": "Ich habe nichts gehört. Tipp nochmal aufs Mikrofon.",
    "voice.when": "{said} – Wann? Sag zum Beispiel „am 3. November“.",
    "form.lead": "Erinnern – wie viele Tage vorher?", "form.time": "Uhrzeit", "optional": "(optional)", "form.soon": "Kurz vorher erinnern",
    "soon.min": "{n} Minuten vorher", "soon.hour": "1 Stunde vorher", "soon.hours": "{n} Stunden vorher", "soon.no": "Nein",
    "form.what": "Was?", "form.due": "Fällig am", "form.every": "Wiederholung", "save": "Speichern", "saving": "Speichert …", "back": "Zurück",
    "form.err": "Bitte trag ein, was es ist und ein gültiges Datum.", "form.errFields": "Bitte fülle die Pflichtfelder mit einem gültigen Datum aus.",
    "draft.title": "Habe ich das richtig verstanden?", "draft.noDate": "Das Datum habe ich nicht verstanden – bitte unten eintragen.", "draft.again": "Nochmal sagen",
    "saved": "Gespeichert ✓ Erinnerung {x}", "saved.plain": "Gespeichert ✓",
    "preview": "Fällig am <b>{due}</b> · Erinnerung <b>{remind}</b> · {every}", "preview.empty": "Fällig am … – bitte die Felder ausfüllen.",
    "done.next": "Erledigt – nächster Termin", "done.renew": "Erneuert – neues Datum eintragen", "done": "Erledigt",
    "dl.due": "Fällig am", "dl.remind": "Erinnerung", "dl.remindVal": "{n} Tage vorher ({x})", "dl.soon": "Kurz vorher", "dl.every": "Wiederholung",
    "edit": "Bearbeiten", "plus.toEdit": "Livo Plus aktivieren, um zu ändern", "delete": "Löschen",
    "toast.doneNext": "Erledigt ✓ Nächster Termin: {date}", "toast.done": "Erledigt ✓",
    "edit.renewTitle": "Neues Datum eintragen", "edit.renewHint": "Trag das neue „Gültig bis“-Datum ein – dann erinnert Livo dich beim nächsten Mal wieder rechtzeitig.", "edit.renewLabel": "Neu gültig bis",
    "confirm.delete": "„{title}“ wirklich löschen?",
    "plus.over": "Deine {n} Tage Testphase sind vorbei", "plus.active": "Livo Plus ist aktiv", "plus.until": "Aktiv bis <b>{date}</b>. Ein weiterer Kauf verlängert um ein Jahr ab diesem Datum.",
    "plus.offer": "<b>Livo Plus – 11,99 € inkl. MwSt. für 1 Jahr</b> (weniger als 1 € im Monat)<br>✓ Unbegrenzt viele Fristen<br>✓ Erinnerungen aufs Handy<br>✓ Eintragen per Sprache: „Hey Livo …“<br>✓ Erledigen, ändern, erneuern",
    "plus.kept": "Deine bisherigen Fristen bleiben erhalten und du kannst sie weiter ansehen.",
    "plus.buy": "Livo Plus kaufen – 11,99 €", "plus.extend": "Um 1 Jahr verlängern – 11,99 €", "plus.soon": "Livo Plus kommt bald",
    "plus.legal": "Einmalzahlung, verlängert sich nicht automatisch. Livo Plus gilt für die Fristen in diesem Browser. Es gelten unsere <a href=\"../agb.html\" target=\"_blank\">AGB</a> (mit Widerrufsbelehrung) und die <a href=\"../datenschutz.html\" target=\"_blank\">Datenschutzerklärung</a>. Bezahlt wird sicher über Stripe.",
    "toast.thanks": "Danke! Livo Plus wird freigeschaltet …", "toast.plusActive": "Livo Plus ist aktiv bis {date} ✓", "toast.plusPending": "Die Zahlung ist da – Plus erscheint gleich. Lade die Seite in einer Minute neu.",
    "push.card": "Erinnerungen einschalten", "push.cardSub": "Livo meldet sich von selbst, wenn eine Frist näher rückt.",
    "push.ios": "<b>🔔 Erinnerungen auf dem iPhone:</b> Tippe unten auf <b>Teilen</b> (Viereck mit Pfeil) und dann auf <b>„Zum Home-Bildschirm“</b>. Öffne heylivo danach über das neue Symbol – dort kannst du die Erinnerungen einschalten.",
    "push.blocked": "🔕 Benachrichtigungen sind für heylivo blockiert. Erlaube sie in den Einstellungen deines Browsers, damit Livo dich erinnern kann.",
    "push.unsupported": "Dieser Browser kann keine Erinnerungen anzeigen. Am besten klappt es mit Chrome auf Android und Safari auf dem iPhone.",
    "push.on": "🔔 Erinnerungen sind an",
    "toast.pushOn": "Erinnerungen sind an ✓", "toast.pushBlocked": "Benachrichtigungen sind blockiert.", "toast.pushOff": "Erinnerungen wurden nicht eingeschaltet.", "toast.retry": "Das hat nicht geklappt. Bitte nochmal versuchen.",
    "lang": "Sprache"
  },
  en: {
    "q.open": "“", "q.close": "”",
    "time.suffix": "",
    "note.demo": "Demo with sample deadlines – nothing is saved here.",
    "note.beta": "Beta: your deadlines are stored safely – no sign-up, in this browser.",
    "loading": "Loading …",
    "offline": "No connection. Please check your internet and reload the page.",
    "add": "Add a deadline",
    "err.trial": "Your {n}-day trial is over. Carry on with Livo Plus for €11.99 a year.",
    "err.save": "Saving didn't work. Please check your internet connection and try again.",
    "when.today": "due today", "when.tomorrow": "due tomorrow", "when.yesterday": "overdue since yesterday",
    "when.overdue": "{n} days overdue", "when.days": "in {n} days", "when.months": "in {n} months", "when.years": "in {n} years",
    "every.0": "one-off", "every.1": "every month", "every.12": "every year", "every.years": "every {n} years", "every.months": "every {n} months",
    "everyopt.0": "One-off", "everyopt.1": "Every month", "everyopt.3": "Every 3 months", "everyopt.6": "Every 6 months",
    "everyopt.12": "Every year", "everyopt.24": "Every 2 years", "everyopt.36": "Every 3 years", "everyopt.120": "Every 10 years",
    "remind.now": "right away", "remind.from": "from {date}",
    "voicebar.sub": "Just say it, e.g. “My ID card expires in March 2027”",
    "status.plus": "Livo Plus active until {date}",
    "status.trialStart": "<b>Try it free for {n} days</b> – your trial starts with your first deadline.",
    "status.trial": "Trial:", "status.today": "<b>ends today</b>", "status.left1": "<b>1 day</b> left for free", "status.left": "<b>{n} days</b> left for free",
    "status.expired": "<b>Your trial is over.</b> You can still view your deadlines. To add or change them and to get reminders: <u>get Livo Plus</u>",
    "sec.now": "Act now", "sec.later": "Coming up", "allgood": "✅ All good – nothing is due right now.",
    "card.remind": "Reminder {x}", "card.due": "due {x}",
    "empty.title": "Never miss a deadline again.", "empty.sub": "Just tell Livo what you need to remember – or pick a template.", "empty.all": "See all templates",
    "picker.title": "What would you like to keep track of?", "picker.voice": "🎤 Rather say it than type it", "cancel": "Cancel",
    "voice.intro": "Just say what it is and when – e.g. “My ID card expires in March 2027” or “Dentist on 3 November at 10 am”. Livo listens until you pause – or tap the microphone when you're done.",
    "voice.unsupported": "Voice input doesn't work in this browser – it does in Chrome on Android and Safari on iPhone. You can type the sentence here instead.",
    "voice.type": "… or type it here", "voice.speak": "Speak", "voice.listening": "Listening …",
    "voice.denied": "The microphone isn't allowed. Please allow it in your browser – or type the sentence.",
    "voice.nothing": "I didn't hear anything. Tap the microphone again.",
    "voice.when": "{said} – When? Say for example “on 3 November”.",
    "form.lead": "Remind me – how many days before?", "form.time": "Time", "optional": "(optional)", "form.soon": "Remind me shortly before",
    "soon.min": "{n} minutes before", "soon.hour": "1 hour before", "soon.hours": "{n} hours before", "soon.no": "No",
    "form.what": "What?", "form.due": "Due on", "form.every": "Repeats", "save": "Save", "saving": "Saving …", "back": "Back",
    "form.err": "Please enter what it is and a valid date.", "form.errFields": "Please fill in the required fields with a valid date.",
    "draft.title": "Did I get that right?", "draft.noDate": "I didn't catch the date – please enter it below.", "draft.again": "Say it again",
    "saved": "Saved ✓ Reminder {x}", "saved.plain": "Saved ✓",
    "preview": "Due <b>{due}</b> · Reminder <b>{remind}</b> · {every}", "preview.empty": "Due … – please fill in the fields.",
    "done.next": "Done – next date", "done.renew": "Renewed – enter new date", "done": "Done",
    "dl.due": "Due on", "dl.remind": "Reminder", "dl.remindVal": "{n} days before ({x})", "dl.soon": "Shortly before", "dl.every": "Repeats",
    "edit": "Edit", "plus.toEdit": "Get Livo Plus to make changes", "delete": "Delete",
    "toast.doneNext": "Done ✓ Next date: {date}", "toast.done": "Done ✓",
    "edit.renewTitle": "Enter the new date", "edit.renewHint": "Enter the new “valid until” date – Livo will remind you in time again next time.", "edit.renewLabel": "New valid until",
    "confirm.delete": "Really delete “{title}”?",
    "plus.over": "Your {n}-day trial is over", "plus.active": "Livo Plus is active", "plus.until": "Active until <b>{date}</b>. Another purchase adds one year from that date.",
    "plus.offer": "<b>Livo Plus – €11.99 incl. VAT for 1 year</b> (less than €1 a month)<br>✓ Unlimited deadlines<br>✓ Reminders on your phone<br>✓ Add by voice: “Hey Livo …”<br>✓ Complete, edit, renew",
    "plus.kept": "Your deadlines are kept and you can still view them.",
    "plus.buy": "Buy Livo Plus – €11.99", "plus.extend": "Extend by 1 year – €11.99", "plus.soon": "Livo Plus is coming soon",
    "plus.legal": "One-off payment, does not renew automatically. Livo Plus applies to the deadlines in this browser. Our <a href=\"../agb.html\" target=\"_blank\">terms</a> (incl. right of withdrawal) and <a href=\"../datenschutz.html\" target=\"_blank\">privacy policy</a> apply. Payment is handled securely by Stripe.",
    "toast.thanks": "Thank you! Livo Plus is being activated …", "toast.plusActive": "Livo Plus is active until {date} ✓", "toast.plusPending": "Your payment has arrived – Plus will show up shortly. Reload the page in a minute.",
    "push.card": "Turn on reminders", "push.cardSub": "Livo gets in touch by itself when a deadline is coming up.",
    "push.ios": "<b>🔔 Reminders on iPhone:</b> tap <b>Share</b> at the bottom (square with an arrow), then <b>“Add to Home Screen”</b>. Then open heylivo from the new icon – you can turn reminders on there.",
    "push.blocked": "🔕 Notifications are blocked for heylivo. Allow them in your browser settings so Livo can remind you.",
    "push.unsupported": "This browser can't show reminders. They work best with Chrome on Android and Safari on iPhone.",
    "push.on": "🔔 Reminders are on",
    "toast.pushOn": "Reminders are on ✓", "toast.pushBlocked": "Notifications are blocked.", "toast.pushOff": "Reminders were not turned on.", "toast.retry": "That didn't work. Please try again.",
    "lang": "Language"
  }
};

// Text in der App-Sprache, fehlende Übersetzungen fallen auf Englisch zurück
function t(key, vars) {
  var s = (TXT[LANG] && TXT[LANG][key]) || TXT.en[key] || TXT.de[key] || key;
  if (vars) s = s.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? vars[k] : m; });
  return s;
}
// Zitat in den Anführungszeichen der Sprache
function quote(s) { return t("q.open") + s + t("q.close"); }
