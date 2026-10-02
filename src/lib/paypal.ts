import "server-only";
import { bestellNr } from "./format";
import { env } from "./env";
import { toPayPalValue, type Quote } from "./pricing";

let token: { value: string; until: number } | null = null;

async function accessToken(): Promise<string> {
  if (token && token.until > Date.now() + 60_000) return token.value;
  const res = await fetch(`${env.paypalApiBase}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${env.paypalClientId}:${env.paypalSecret}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`PayPal Token ${res.status}`);
  const j = (await res.json()) as { access_token: string; expires_in: number };
  token = { value: j.access_token, until: Date.now() + j.expires_in * 1000 };
  return token.value;
}

/** Für die Diagnose: passen Client ID, Secret und API-Adresse zusammen? Gibt nie den Token heraus. */
export async function paypalAnmeldung(): Promise<"ok" | string> {
  try { await accessToken(); return "ok"; }
  catch (e) { return (e as Error).message.replace(/^PayPal Token /, "abgelehnt, Status "); }
}

async function call<T>(path: string, body: unknown, requestId: string): Promise<{ status: number; data: T }> {
  const res = await fetch(`${env.paypalApiBase}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": requestId, // Idempotenz: gleiche ID -> gleiche Antwort, keine Doppelbuchung
      Prefer: "return=representation",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as T;
  return { status: res.status, data };
}

export async function createPayPalOrder(orderId: string, orderNr: number, quote: Quote, locationName: string) {
  const value = toPayPalValue(quote.total_cents);
  const { status, data } = await call<{ id?: string }>(
    "/v2/checkout/orders",
    {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: orderId,
          custom_id: orderId,
          invoice_id: bestellNr(orderNr),
          description: `Heiglerhof Hofkasse · ${locationName}`.slice(0, 127),
          amount: {
            currency_code: "EUR",
            value,
            breakdown: { item_total: { currency_code: "EUR", value } },
          },
          items: quote.lines.map((l) => ({
            name: l.label.slice(0, 127),
            quantity: String(l.quantity),
            unit_amount: { currency_code: "EUR", value: toPayPalValue(l.unit_price_cents) },
            category: "PHYSICAL_GOODS",
          })),
        },
      ],
      payment_source: {
        paypal: { experience_context: { shipping_preference: "NO_SHIPPING", user_action: "PAY_NOW", brand_name: "Heiglerhof" } },
      },
    },
    `create-${orderId}`,
  );
  if (status >= 300 || !data.id) throw new Error(`PayPal Create ${status}`);
  return data.id;
}

export type CaptureResult = {
  status: string;
  captureId: string | null;
  captureStatus: string | null;
  amountValue: string | null;
  currency: string | null;
  customId: string | null;
};

export async function capturePayPalOrder(paypalOrderId: string): Promise<CaptureResult> {
  type R = {
    status?: string;
    purchase_units?: { custom_id?: string; payments?: { captures?: { id: string; status: string; custom_id?: string; amount: { value: string; currency_code: string } }[] } }[];
  };
  const { status, data } = await call<R>(`/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, undefined, `capture-${paypalOrderId}`);
  if (status >= 300 && status !== 422) throw new Error(`PayPal Capture ${status}`);
  const cap = data.purchase_units?.[0]?.payments?.captures?.[0];
  return {
    status: data.status ?? "UNKNOWN",
    captureId: cap?.id ?? null,
    captureStatus: cap?.status ?? null,
    amountValue: cap?.amount.value ?? null,
    currency: cap?.amount.currency_code ?? null,
    customId: cap?.custom_id ?? data.purchase_units?.[0]?.custom_id ?? null,
  };
}

/** Webhook-Signatur über die PayPal-API prüfen. */
export async function verifyWebhook(headers: Headers, body: unknown): Promise<boolean> {
  const h = (n: string) => headers.get(n) ?? "";
  const { status, data } = await call<{ verification_status?: string }>(
    "/v1/notifications/verify-webhook-signature",
    {
      auth_algo: h("paypal-auth-algo"),
      cert_url: h("paypal-cert-url"),
      transmission_id: h("paypal-transmission-id"),
      transmission_sig: h("paypal-transmission-sig"),
      transmission_time: h("paypal-transmission-time"),
      webhook_id: env.paypalWebhookId,
      webhook_event: body,
    },
    `verify-${h("paypal-transmission-id") || crypto.randomUUID()}`,
  );
  return status === 200 && data.verification_status === "SUCCESS";
}
