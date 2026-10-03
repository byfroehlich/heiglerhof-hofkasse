import { z } from "zod";

export const MAX_QTY = 10;
export const MAX_ITEMS = 20;

const uuid = z.uuid();
const slug = z.string().regex(/^[a-z0-9]{2,32}$/);

export const checkoutSchema = z.object({
  location: slug,
  items: z
    .array(z.object({ product_id: uuid, quantity: z.number().int().min(1).max(MAX_QTY) }).strict())
    .min(1)
    .max(MAX_ITEMS),
  age_confirmed: z.boolean().optional(),
}).strict();
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const captureSchema = z.object({ paypal_order_id: z.string().regex(/^[A-Z0-9]{5,40}$/) }).strict();

const euroCents = z
  .string()
  .trim()
  .regex(/^\d{1,3}([.,]\d{1,2})?$/, "Preis bitte wie 4,50 angeben")
  .transform((v) => Math.round(parseFloat(v.replace(",", ".")) * 100))
  .refine((c) => c > 0 && c <= 99900, "Preis muss zwischen 0,01 und 999 € liegen");

export const productSchema = z.object({
  name: z.string().trim().min(1, "Name fehlt").max(80),
  zusatz: z.string().trim().max(120).transform((v) => v || null),
  inhalt: z.coerce.number().int().min(1, "Inhalt fehlt").max(100000),
  einheit: z.enum(["g", "ml"]),
  price: euroCents,
  // Händlerpreis für Wiederverkäufer, darf leer bleiben
  haendler: z.string().default("").transform((v) => v.trim().replace(/\s*€$/, "")).pipe(z.union([z.literal("").transform(() => null), euroCents])),
  alkohol: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : parseFloat(v.replace(",", "."))))
    .refine((v) => v === null || (Number.isFinite(v) && v > 0 && v < 100), "Alkohol bitte als Zahl, z. B. 18,5"),
  farbe: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export const locationSchema = z.object({
  name: z.string().trim().min(1, "Name fehlt").max(80),
  typ: z.enum(["Ferienwohnung", "Hotel", "Verkaufskasten", "Laden"]),
  ort: z.string().trim().max(80).transform((v) => v || null),
});

const leerNull = (max: number) => z.string().trim().max(max).transform((v) => v || null);
const koord = (min: number, max: number) =>
  z.string().trim().transform((v) => (v === "" ? null : Number(v.replace(",", "."))))
    .refine((v) => v === null || (Number.isFinite(v) && v >= min && v <= max), "Koordinate ungültig");

export const locationEditSchema = locationSchema.extend({
  strasse: leerNull(120),
  plz: z.string().trim().regex(/^(\d{4,5})?$/, "PLZ bitte mit 4 oder 5 Ziffern").transform((v) => v || null),
  hinweis: leerNull(200),
  oeffentlich: z.boolean(),
  demo: z.boolean(),
  wiederverkaeufer: z.boolean(),
  lat: koord(-90, 90),
  lng: koord(-180, 180),
  werbung_text: leerNull(300),
  werbung_link: z.string().trim().max(300)
    .transform((v) => (v === "" ? null : /^https?:\/\//i.test(v) ? v.replace(/^http:/i, "https:") : `https://${v}`))
    .refine((v) => v === null || URL.canParse(v), "Link ungültig"),
});
