// heylivo: Stripe-Webhook für Livo Plus (11,99 € inkl. MwSt. für 1 Jahr, ohne
// automatische Verlängerung).
// Gekauft wird über einen Stripe-Zahlungslink im Stripe-Konto von Smart Menu Solutions;
// die App hängt die Nutzer-ID als client_reference_id an. Bei checkout.session.completed
// verlängert diese Funktion plans.plus_until um ein Jahr - ab heute oder ab dem alten
// Ende, falls Plus noch läuft. Alle anderen Zahlungen des Kontos (Smart Menu) werden
// ignoriert; der Smart-Menu-Webhook ignoriert umgekehrt diese Einmalzahlungen.
//
// Signaturprüfung wie in der Stripe-Doku (HMAC-SHA256 über "t.payload") mit Web Crypto,
// ohne npm-Paket. Secrets: STRIPE_WEBHOOK_SECRET (whsec_...), optional
// LIVO_PAYMENT_LINK_ID (plink_...) - dann zählt nur genau dieser Zahlungslink.

import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
const WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';
const PAYMENT_LINK = Deno.env.get('LIVO_PAYMENT_LINK_ID') ?? '';
const PRICE_CENTS = 1199;
const TOLERANCE_SECONDS = 300;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const encoder = new TextEncoder();

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Header "t=1700000000,v1=abc…[,v1=…]" - mindestens eine v1-Signatur muss passen
async function validSignature(payload: string, header: string): Promise<boolean> {
  if (!WEBHOOK_SECRET) return false;
  let timestamp = '';
  const signatures: string[] = [];
  for (const part of header.split(',')) {
    const [key, value] = part.split('=');
    if (key === 't') timestamp = value;
    if (key === 'v1' && value) signatures.push(value);
  }
  if (!timestamp || !signatures.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > TOLERANCE_SECONDS) return false;
  const key = await crypto.subtle.importKey('raw', encoder.encode(WEBHOOK_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${payload}`)));
  const expected = Array.from(mac, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return signatures.some((signature) => sameText(signature, expected));
}

function berlinToday(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
}
function addYear(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

type Session = {
  id: string; mode?: string; payment_link?: string | null; payment_status?: string; currency?: string;
  amount_total?: number; client_reference_id?: string | null; customer_details?: { email?: string | null } | null;
};

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const payload = await request.text();
  if (!(await validSignature(payload, request.headers.get('stripe-signature') ?? ''))) return json({ error: 'Invalid signature' }, 400);

  let event: { type?: string; data?: { object?: Session } };
  try {
    event = JSON.parse(payload);
  } catch {
    return json({ error: 'Invalid payload' }, 400);
  }
  if (event.type !== 'checkout.session.completed' || !event.data?.object) return json({ received: true });

  const session = event.data.object;
  const userId = String(session.client_reference_id ?? '');
  // Nur Livo-Plus-Käufe: über einen Zahlungslink, in Euro, mit einer heylivo-Nutzer-ID
  const fromOurLink = PAYMENT_LINK ? session.payment_link === PAYMENT_LINK : !!session.payment_link && session.amount_total === PRICE_CENTS;
  if (session.mode !== 'payment' || !fromOurLink || session.currency !== 'eur' || !UUID.test(userId)) return json({ received: true, ignored: true });
  if (session.payment_status !== 'paid') return json({ received: true, ignored: 'unpaid' });

  const { data: plan } = await supabase.from('plans').select('plus_until, stripe_session_id').eq('user_id', userId).maybeSingle();
  // Stripe stellt Ereignisse manchmal doppelt zu - dieselbe Zahlung nur einmal verbuchen
  if (plan?.stripe_session_id === session.id) return json({ received: true, duplicate: true });

  const today = berlinToday();
  const start = plan?.plus_until && plan.plus_until > today ? plan.plus_until : today;
  const plusUntil = addYear(start);
  const { error } = await supabase.from('plans').upsert({
    user_id: userId,
    plus_until: plusUntil,
    stripe_session_id: session.id,
    email: session.customer_details?.email ?? null,
    updated_at: new Date().toISOString()
  });
  if (error) {
    console.error('Livo Plus could not be saved', session.id, userId, error);
    // Unbekannte Nutzer-ID: ein neuer Versuch hilft nicht - nicht endlos wiederholen lassen
    if (error.code === '23503') return json({ received: true, error: 'unknown user' });
    return json({ error: 'Could not save' }, 500);
  }
  console.log('Livo Plus activated', userId, plusUntil, session.id);
  return json({ received: true, plusUntil });
});
