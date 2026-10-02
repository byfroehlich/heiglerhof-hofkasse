import "server-only";

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Umgebungsvariable ${name} fehlt`);
  return v;
}

export const env = {
  get supabaseUrl() { return need("NEXT_PUBLIC_SUPABASE_URL"); },
  get supabaseAnonKey() { return need("NEXT_PUBLIC_SUPABASE_ANON_KEY"); },
  get supabaseServiceKey() { return need("SUPABASE_SERVICE_ROLE_KEY"); },
  get paypalClientId() { return need("NEXT_PUBLIC_PAYPAL_CLIENT_ID"); },
  get paypalSecret() { return need("PAYPAL_CLIENT_SECRET"); },
  get paypalApiBase() { return process.env.PAYPAL_API_BASE || "https://api-m.sandbox.paypal.com"; },
  get paypalWebhookId() { return need("PAYPAL_WEBHOOK_ID"); },
  get cronSecret() { return need("CRON_SECRET"); },
  resendKey: process.env.RESEND_API_KEY,
  notifyTo: process.env.NOTIFY_EMAIL,
  notifyFrom: process.env.NOTIFY_FROM || "Hofkasse <hofkasse@heiglerhof.de>",
};
