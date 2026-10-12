// heylivo: Push-Erinnerungen.
// - POST {"action":"run"} mit Header x-cron-secret: täglich per pg_cron (0003_reminders_cron.sql).
//   Erinnert jeden Nutzer in der Testphase oder mit Livo Plus an alle Fristen, deren
//   Erinnerungszeit erreicht ist (Fälligkeit minus lead_days) - einmal pro Fälligkeit
//   (notified_for). Mehrere Fristen am selben Tag kommen als eine Nachricht.
// - POST {"action":"soon"} mit Header x-cron-secret: jede Minute per pg_cron (0005_soon_reminders.sql).
//   Erinnert kurz vor Terminen mit Uhrzeit (remind_min Minuten vorher), einmal pro Termin
//   (time_notified_for). Die Uhrzeit gilt in der Zeitzone, in der die Frist gespeichert wurde.
// - POST {"action":"test"} mit dem Login des Nutzers (Authorization: Bearer <access token>):
//   sofort eine Probe-Nachricht an seine Geräte, nach "Erinnerungen einschalten".
//
// Web Push wie in Smart Menu (staff-push): RFC 8291 (aes128gcm) + RFC 8292 (VAPID)
// mit Web Crypto, ohne npm-Paket. Der private VAPID-Schlüssel liegt nur als
// Function-Secret VAPID_PRIVATE_KEY bei Supabase, nie im Repo.

import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
const VAPID = {
  publicKey: Deno.env.get('VAPID_PUBLIC_KEY') ?? '',
  privateKey: Deno.env.get('VAPID_PRIVATE_KEY') ?? '',
  subject: Deno.env.get('VAPID_SUBJECT') ?? 'https://heylivo.github.io'
};
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';
const APP_URL = 'https://heylivo.github.io/app/';
const TRIAL_DAYS = 30;
// Nur echte Push-Dienste der Browser - ein Abo ist nur eine URL, an die diese Funktion sendet.
const PUSH_HOSTS = ['fcm.googleapis.com', 'android.googleapis.com', 'push.services.mozilla.com', 'push.apple.com', 'notify.windows.com'];
// Eine Erinnerung, die erst am nächsten Tag ankommt, hilft trotzdem noch.
const TTL_SECONDS = 24 * 3600;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

type Sub = { endpoint: string; p256dh: string; auth_key: string; user_id: string };
type Deadline = { id: string; user_id: string; title: string; due: string; due_time: string | null; lead_days: number; notified_for: string | null };
type SoonRow = { id: string; user_id: string; title: string; due: string; due_time: string; remind_min: number; tz: string | null; time_notified_for: string | null };
type Payload = { title: string; body: string; tag: string; url: string; urgency?: string };

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}

// --- Datum: "JJJJ-MM-TT", gerechnet in UTC, "heute" in deutscher Zeit -----------
function berlinToday(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
}
function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}
function fmt(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}
// Gleiche Texte wie in der App (whenText in app.js)
function whenText(days: number): string {
  if (days === 0) return 'heute fällig';
  if (days === 1) return 'morgen fällig';
  if (days === -1) return 'seit gestern fällig';
  if (days < 0) return `seit ${-days} Tagen fällig`;
  if (days <= 60) return `in ${days} Tagen`;
  const months = Math.round(days / 30.44);
  if (months < 24) return `in ${months} Monaten`;
  return `in ${Math.round(days / 365.25)} Jahren`;
}

// --- Web Push: RFC 8291 + RFC 8292, wie staff-push in Smart Menu -----------------
const encoder = new TextEncoder();

function fromBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((length, part) => length + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

async function hkdf(salt: Uint8Array, secret: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8));
}

// Die Nachricht als ein einziger aes128gcm-Record für ein Abo (RFC 8291)
async function encryptPayload(plaintext: Uint8Array, uaPublic: Uint8Array, authSecret: Uint8Array): Promise<Uint8Array> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']) as CryptoKeyPair;
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', keys.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, keys.privateKey, 256));
  const ikm = await hkdf(authSecret, ecdhSecret, concat(encoder.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const cek = await hkdf(salt, ikm, encoder.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, encoder.encode('Content-Encoding: nonce\0'), 12);
  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  // 0x02 = Trennzeichen des letzten (hier einzigen) Records
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, concat(plaintext, new Uint8Array([2]))));
  // Kopf: Salt, Record-Größe 4096, dann unser einmaliger öffentlicher Schlüssel
  const header = new Uint8Array(21);
  header.set(salt);
  new DataView(header.buffer).setUint32(16, 4096);
  header[20] = asPublic.length;
  return concat(header, asPublic, ciphertext);
}

// RFC 8292: kurzlebiges JWT für den Push-Dienst, signiert mit dem Schlüsselpaar,
// mit dem der Browser abonniert hat (VAPID_PUBLIC_KEY in push.js)
async function vapidAuthorization(endpoint: string): Promise<string> {
  const point = fromBase64Url(VAPID.publicKey);
  const jwk = { kty: 'EC', crv: 'P-256', x: toBase64Url(point.slice(1, 33)), y: toBase64Url(point.slice(33, 65)), d: VAPID.privateKey };
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const segment = (value: unknown) => toBase64Url(encoder.encode(JSON.stringify(value)));
  const unsigned = `${segment({ typ: 'JWT', alg: 'ES256' })}.${segment({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: VAPID.subject })}`;
  const signature = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, encoder.encode(unsigned)));
  return `vapid t=${unsigned}.${toBase64Url(signature)}, k=${VAPID.publicKey}`;
}

// HTTP-Status des Push-Dienstes (201 = angenommen), 0 wenn nicht erreichbar
async function sendPush(target: Sub, payload: Payload): Promise<number> {
  try {
    const body = await encryptPayload(encoder.encode(JSON.stringify(payload)), fromBase64Url(target.p256dh), fromBase64Url(target.auth_key));
    const response = await fetch(target.endpoint, {
      method: 'POST',
      headers: {
        Authorization: await vapidAuthorization(target.endpoint),
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: String(payload.urgency === 'high' ? 3600 : TTL_SECONDS),
        Urgency: payload.urgency === 'high' ? 'high' : 'normal'
      },
      body
    });
    await response.body?.cancel();
    return response.status;
  } catch {
    return 0;
  }
}
// --- Ende Web Push ----------------------------------------------------------------

function validEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return url.protocol === 'https:' && PUSH_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

// An alle Geräte eines Nutzers; abgemeldete oder ungültige Geräte werden vergessen.
// Ergebnis: wie viele Geräte die Nachricht angenommen haben.
async function deliver(targets: Sub[], payload: Payload): Promise<number> {
  let ok = 0;
  for (const target of targets) {
    if (!validEndpoint(target.endpoint)) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', target.endpoint);
      continue;
    }
    const status = await sendPush(target, payload);
    if (status >= 200 && status < 300) ok++;
    else if (status === 404 || status === 410) await supabase.from('push_subscriptions').delete().eq('endpoint', target.endpoint);
  }
  return ok;
}

// Liest alle Zeilen, auch über die 1000er-Grenze der API hinaus
async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
}

function messageFor(list: Deadline[], today: string): Payload {
  list.sort((a, b) => a.due.localeCompare(b.due));
  if (list.length === 1) {
    const d = list[0];
    const when = whenText(daysBetween(today, d.due));
    return {
      title: d.title,
      body: `${when.charAt(0).toUpperCase()}${when.slice(1)} · fällig am ${fmt(d.due)}${d.due_time ? `, ${d.due_time.slice(0, 5)} Uhr` : ''}`,
      tag: `livo-${d.id}`,
      url: APP_URL
    };
  }
  const lines = list.slice(0, 4).map((d) => `${d.title} – ${whenText(daysBetween(today, d.due))}`);
  if (list.length > 4) lines.push(`… und ${list.length - 4} weitere`);
  return { title: `${list.length} Fristen brauchen deine Aufmerksamkeit`, body: lines.join('\n'), tag: 'livo-daily', url: APP_URL };
}

// Nur wer in der Testphase ist oder Livo Plus hat (gleiche Regel wie 0002_trial.sql)
async function eligibleUsers(today: string): Promise<Set<string>> {
  const [plus, trial] = await Promise.all([
    fetchAll<{ user_id: string }>((a, b) => supabase.from('plans').select('user_id').gte('plus_until', today).order('user_id').range(a, b)),
    fetchAll<{ user_id: string }>((a, b) => supabase.from('usage').select('user_id').gte('trial_started', addDays(today, -TRIAL_DAYS)).order('user_id').range(a, b))
  ]);
  return new Set([...plus, ...trial].map((row) => row.user_id));
}

async function subscriptionsOf(userIds: string[]): Promise<Sub[]> {
  const subs: Sub[] = [];
  for (let i = 0; i < userIds.length; i += 100) {
    const { data } = await supabase.from('push_subscriptions').select('endpoint, p256dh, auth_key, user_id').in('user_id', userIds.slice(i, i + 100));
    subs.push(...((data ?? []) as Sub[]));
  }
  return subs;
}

// Datum + Uhrzeit in einer Zeitzone (z. B. "2026-11-03", "10:00", "Europe/Berlin") als UTC-Millisekunden
function zonedToUtc(date: string, time: string, tz: string): number {
  const [y, m, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  let zone = tz;
  try { new Intl.DateTimeFormat('en-US', { timeZone: zone }); } catch { zone = 'Europe/Berlin'; }
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
  }).formatToParts(new Date(guess));
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const shownThere = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
  return guess - (shownThere - guess);
}

// Kurz vor Terminen mit Uhrzeit. Fenster: ab "remind_min vorher" bis 15 Minuten nach
// Beginn, falls ein Lauf ausgefallen ist - danach hilft die Nachricht nicht mehr.
async function runSoon() {
  const now = Date.now();
  const today = berlinToday();
  const { data, error } = await supabase.from('deadlines')
    .select('id, user_id, title, due, due_time, remind_min, tz, time_notified_for')
    .not('due_time', 'is', null).not('remind_min', 'is', null)
    .gte('due', addDays(today, -1)).lte('due', addDays(today, 2));
  if (error) throw error;
  const candidates = ((data ?? []) as SoonRow[]).filter((row) => {
    const key = `${row.due} ${row.due_time.slice(0, 5)}`;
    if (row.time_notified_for === key) return false;
    const at = zonedToUtc(row.due, row.due_time, row.tz || 'Europe/Berlin');
    return now >= at - row.remind_min * 60000 && now <= at + 15 * 60000;
  });
  if (!candidates.length) return { soon: 0 };
  const eligible = await eligibleUsers(today);
  const rows = candidates.filter((row) => eligible.has(row.user_id));
  const subs = await subscriptionsOf([...new Set(rows.map((row) => row.user_id))]);
  let sent = 0;
  for (const row of rows) {
    const targets = subs.filter((sub) => sub.user_id === row.user_id);
    if (!targets.length) continue;
    const at = zonedToUtc(row.due, row.due_time, row.tz || 'Europe/Berlin');
    const minutes = Math.round((at - now) / 60000);
    const time = row.due_time.slice(0, 5);
    const body = minutes > 0 ? `Beginnt in ${minutes} ${minutes === 1 ? 'Minute' : 'Minuten'} · ${time} Uhr` : `Jetzt · ${time} Uhr`;
    const ok = await deliver(targets, { title: row.title, body, tag: `livo-soon-${row.id}`, url: APP_URL, urgency: 'high' });
    if (!ok) continue;
    sent++;
    await supabase.from('deadlines').update({ time_notified_for: `${row.due} ${time}` }).eq('id', row.id);
  }
  return { soon: sent };
}

async function runReminders() {
  const today = berlinToday();
  const eligible = await eligibleUsers(today);
  if (!eligible.size) return { today, users: 0, devices: 0, deadlines: 0 };

  const rows = await fetchAll<Deadline>((a, b) => supabase.from('deadlines')
    .select('id, user_id, title, due, due_time, lead_days, notified_for')
    .lte('due', addDays(today, 366)).order('id').range(a, b));
  const byUser = new Map<string, Deadline[]>();
  for (const row of rows) {
    if (!eligible.has(row.user_id) || row.notified_for === row.due || addDays(row.due, -row.lead_days) > today) continue;
    byUser.set(row.user_id, [...(byUser.get(row.user_id) ?? []), row]);
  }

  const subs = await subscriptionsOf([...byUser.keys()]);

  let users = 0, devices = 0, deadlines = 0;
  for (const [userId, list] of byUser) {
    const targets = subs.filter((sub) => sub.user_id === userId);
    // Ohne Gerät noch nichts abhaken - die Erinnerung kommt, sobald Push an ist.
    if (!targets.length) continue;
    const ok = await deliver(targets, messageFor(list, today));
    if (!ok) continue;
    users++;
    devices += ok;
    deadlines += list.length;
    await Promise.all(list.map((d) => supabase.from('deadlines').update({ notified_for: d.due }).eq('id', d.id)));
  }
  return { today, users, devices, deadlines };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!VAPID.publicKey || !VAPID.privateKey) return json({ error: 'Push is not configured.' }, 500);

  let body: { action?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }

  if (body.action === 'run' || body.action === 'soon') {
    if (!CRON_SECRET || request.headers.get('x-cron-secret') !== CRON_SECRET) return json({ error: 'Not allowed.' }, 401);
    try {
      return json(body.action === 'run' ? await runReminders() : await runSoon());
    } catch (error) {
      return json({ error: String((error as { message?: string })?.message ?? error) }, 500);
    }
  }

  if (body.action === 'test') {
    const token = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return json({ error: 'Not signed in.' }, 401);
    const { data: subs } = await supabase.from('push_subscriptions').select('endpoint, p256dh, auth_key, user_id').eq('user_id', data.user.id);
    const sent = await deliver((subs ?? []) as Sub[], {
      title: '✓ Erinnerungen sind an',
      body: 'Livo meldet sich, sobald eine Frist näher rückt.',
      tag: 'livo-on',
      url: APP_URL
    });
    return json({ sent });
  }

  return json({ error: 'Unknown action.' }, 400);
});
