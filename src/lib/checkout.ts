import "server-only";
import { db } from "./supabase";
import { loadShop } from "./shop";
import { buildQuote, QuoteError, toPayPalValue } from "./pricing";
import { createPayPalOrder, capturePayPalOrder } from "./paypal";
import { after } from "next/server";
import { notifyLowStock, type LowStock } from "./notify";
import { bestandPush, kaufPush } from "./push";
import type { CheckoutInput } from "./validation";
import { bankdaten, epcText, giroSvg, ibanLesbar } from "./giro";

export class CheckoutError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export type Ueberweisung = { empfaenger: string; iban: string; bic: string; betrag_cents: number; zweck: string; qr: string };
export type Receipt = { ueberweisung?: Ueberweisung; nr: number; total_cents: number; status: "paid" | "cash" | "review" | "transfer"; items: { label: string; quantity: number; unit_price_cents: number }[] };

async function prepare(input: CheckoutInput) {
  const shop = await loadShop(input.location);
  if (!shop) throw new CheckoutError("Diese Verkaufsstelle gibt es nicht mehr.", 404);
  let quote;
  try {
    quote = buildQuote(input.items, shop.products);
  } catch (e) {
    if (e instanceof QuoteError) throw new CheckoutError(e.message, 409);
    throw e;
  }
  if (quote.hasAlcohol && input.age_confirmed !== true) throw new CheckoutError("Liköre gibt es nur für Erwachsene ab 18.", 400);
  return { shop, quote };
}

async function insertOrder(locationId: string, status: "created" | "cash" | "transfer", lines: { product_id: string; unit_price_cents: number; quantity: number }[]) {
  const { data, error } = await db().rpc("create_order", { p_location: locationId, p_status: status, p_items: lines });
  if (error) {
    if (/preis geaendert|bestand|nicht verfuegbar/.test(error.message)) throw new CheckoutError("Das Angebot hat sich gerade geändert. Bitte neu laden.", 409);
    throw error;
  }
  const row = (data as { order_id: string; order_nr: number; total: number }[])[0];
  return row;
}

/** Schritt 1 bis 4: prüfen, Preise laden, rechnen, Bestellung speichern, PayPal-Order anlegen. */
export async function startPayPalCheckout(input: CheckoutInput): Promise<{ paypal_order_id: string }> {
  const { shop, quote } = await prepare(input);
  if (!shop.location.paypal) throw new CheckoutError("PayPal ist hier gerade nicht möglich. Bitte bar zahlen.", 403);
  const order = await insertOrder(shop.location.id, "created", quote.lines);
  if (order.total !== quote.total_cents) throw new Error("Summenabweichung Server/DB");
  const paypalId = await createPayPalOrder(order.order_id, order.order_nr, quote, shop.location.name);
  const { error } = await db().from("orders").update({ paypal_order_id: paypalId }).eq("id", order.order_id);
  if (error) throw error;
  return { paypal_order_id: paypalId };
}

/** Schritt 5 und 6: Capture, gegen die Datenbank abgleichen, Zahlung und Bestand buchen. */
export async function finishPayPalCheckout(paypalOrderId: string): Promise<Receipt> {
  const { data: order } = await db()
    .from("orders")
    .select("id, nr, status, total_cents, currency")
    .eq("paypal_order_id", paypalOrderId)
    .maybeSingle<{ id: string; nr: number; status: string; total_cents: number; currency: string }>();
  if (!order) throw new CheckoutError("Bestellung nicht gefunden.", 404);
  if (order.status === "paid") return receipt(order.id); // doppelter Aufruf: nichts doppelt buchen
  if (order.status !== "created") throw new CheckoutError("Diese Bestellung ist schon abgeschlossen.", 409);

  const cap = await capturePayPalOrder(paypalOrderId);
  const ok =
    cap.status === "COMPLETED" &&
    cap.captureStatus === "COMPLETED" &&
    cap.amountValue === toPayPalValue(order.total_cents) &&
    cap.currency === order.currency &&
    cap.customId === order.id;

  if (!cap.captureId) throw new CheckoutError("PayPal hat die Zahlung nicht bestätigt.", 402);
  await markPaid(order.id, cap.captureId, ok ? "paid" : "review");
  return receipt(order.id);
}

/** Wird auch vom Webhook genutzt. Nur created -> paid/review, nie zweimal. */
export async function markPaid(orderId: string, captureId: string, status: "paid" | "review") {
  const { data } = await db()
    .from("orders")
    .update({ status, paypal_capture_id: captureId, paid_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("status", "created")
    .select("id");
  if (data?.length && status === "paid") await bookStock(orderId);
}

export async function startCashCheckout(input: CheckoutInput): Promise<Receipt> {
  const { shop, quote } = await prepare(input);
  if (!shop.location.bar) throw new CheckoutError("Barzahlung ist hier gerade nicht möglich. Bitte mit PayPal zahlen.", 403);
  const order = await insertOrder(shop.location.id, "cash", quote.lines);
  await bookStock(order.order_id);
  return receipt(order.order_id);
}

/** Überweisung: Bestellung offen anlegen, Bestand buchen, Bankdaten und GiroCode zurückgeben. */
export async function startTransferCheckout(input: CheckoutInput): Promise<Receipt> {
  const { shop, quote } = await prepare(input);
  const bank = await bankdaten();
  if (!shop.location.ueberweisung || !bank) throw new CheckoutError("Überweisung ist hier gerade nicht möglich.", 403);
  const order = await insertOrder(shop.location.id, "transfer", quote.lines);
  await bookStock(order.order_id);
  const zweck = `HH ${order.order_nr} Heiglerhof`;
  return {
    ...(await receipt(order.order_id)),
    ueberweisung: { empfaenger: bank.empfaenger, iban: ibanLesbar(bank.iban), bic: bank.bic, betrag_cents: order.total, zweck, qr: giroSvg(epcText(bank, order.total, zweck)) },
  };
}

async function bookStock(orderId: string) {
  const { data, error } = await db().rpc("book_stock", { p_order: orderId });
  if (error) { console.error("[bestand]", error.message); return; }
  const low = (data ?? []) as LowStock[];
  await notifyLowStock(low);
  // Push-Mitteilungen erst nach der Antwort an den Gast verschicken, damit die Kasse nicht wartet
  after(async () => { await kaufPush(orderId); await bestandPush(low); });
}

async function receipt(orderId: string): Promise<Receipt> {
  const { data, error } = await db()
    .from("orders")
    .select("nr, total_cents, status, order_items(name_snapshot, quantity, unit_price_cents)")
    .eq("id", orderId)
    .single<{ nr: number; total_cents: number; status: Receipt["status"]; order_items: { name_snapshot: string; quantity: number; unit_price_cents: number }[] }>();
  if (error) throw error;
  return {
    nr: data.nr,
    total_cents: data.total_cents,
    status: data.status,
    items: data.order_items.map((i) => ({ label: i.name_snapshot, quantity: i.quantity, unit_price_cents: i.unit_price_cents })),
  };
}
