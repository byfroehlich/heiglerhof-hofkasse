import { beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Prüft das echte SQL-Schema in einem Postgres im Speicher (ohne Supabase).
let db: PGlite;
const q = async <T = Record<string, unknown>>(sql: string, params?: unknown[]) => (await db.query<T>(sql, params)).rows;
let loc: string, bl: string, ho: string;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create schema auth; create table auth.users(id uuid primary key);
    create schema storage; create table storage.buckets(id text primary key, name text, public bool, file_size_limit bigint, allowed_mime_types text[]);
    create role anon; create role authenticated;`);
  for (const f of ["0001_init.sql", "0002_warnbestand.sql", "0003_warnstufen.sql", "0004_adressen_karte_partner.sql", "0005_zahlarten.sql"]) await db.exec(readFileSync(join(__dirname, "../migrations", f), "utf8"));
  loc = (await q<{ id: string }>(`insert into locations(slug,name,typ) values('alpenblick','Ferienwohnung Alpenblick','Ferienwohnung') returning id`))[0].id;
  bl = (await q<{ id: string }>(`insert into products(name,inhalt,einheit,price_cents,alkohol_vol) values('Bierlikör',100,'ml',600,21.6) returning id`))[0].id;
  ho = (await q<{ id: string }>(`insert into products(name,inhalt,einheit,price_cents) values('Honig',250,'g',650) returning id`))[0].id;
  await q(`insert into location_products(location_id,product_id,ist,soll,warn) values($1,$2,4,6,2),($1,$3,3,4,2)`, [loc, bl, ho]);
});

const order = (status: string, items: object[]) =>
  q<{ order_id: string; order_nr: number; total: number }>(`select * from create_order($1,$2,$3::jsonb)`, [loc, status, JSON.stringify(items)]);

describe("create_order", () => {
  it("legt Kopf und Positionen an und rechnet die Summe", async () => {
    const [o] = await order("created", [{ product_id: bl, unit_price_cents: 600, quantity: 2 }, { product_id: ho, unit_price_cents: 650, quantity: 1 }]);
    expect(o.total).toBe(1850);
    const items = await q<{ name_snapshot: string }>(`select name_snapshot from order_items where order_id=$1 order by 1`, [o.order_id]);
    expect(items.map((i) => i.name_snapshot)).toEqual(["Bierlikör 0,1 l", "Honig 250 g"]);
  });
  it("lehnt geänderte Preise, zu große Mengen und fremde Produkte ab", async () => {
    await expect(order("created", [{ product_id: bl, unit_price_cents: 1, quantity: 1 }])).rejects.toThrow(/preis/);
    await expect(order("created", [{ product_id: bl, unit_price_cents: 600, quantity: 5 }])).rejects.toThrow(/bestand/);
    await expect(order("created", [{ product_id: "00000000-0000-4000-8000-000000000000", unit_price_cents: 600, quantity: 1 }])).rejects.toThrow(/verfuegbar/);
    await expect(order("paid", [{ product_id: bl, unit_price_cents: 600, quantity: 1 }])).rejects.toThrow(/status/);
  });
});

describe("book_stock", () => {
  it("bucht erst nach Zahlung, genau einmal, und meldet den Meldebestand einmal", async () => {
    const [o] = await order("created", [{ product_id: bl, unit_price_cents: 600, quantity: 2 }]);
    expect(await q(`select * from book_stock($1)`, [o.order_id])).toEqual([]);
    await q(`update orders set status='paid' where id=$1`, [o.order_id]);
    const low = await q<{ product_name: string; ist: number }>(`select * from book_stock($1)`, [o.order_id]);
    expect(low).toEqual([expect.objectContaining({ product_name: "Bierlikör", ist: 2 })]);
    expect(await q(`select * from book_stock($1)`, [o.order_id])).toEqual([]);
    const [c] = await order("cash", [{ product_id: bl, unit_price_cents: 600, quantity: 1 }]);
    expect(await q(`select * from book_stock($1)`, [c.order_id])).toEqual([]); // schon gemeldet
    expect((await q<{ ist: number }>(`select ist from location_products where product_id=$1`, [bl]))[0].ist).toBe(1);
  });
  it("nutzt den festen Warnbestand statt Prozent", async () => {
    await q(`update location_products set ist=8, soll=10, warn=5 where product_id=$1`, [ho]);
    const [o] = await order("cash", [{ product_id: ho, unit_price_cents: 650, quantity: 2 }]);
    expect(await q(`select * from book_stock($1)`, [o.order_id])).toEqual([]); // 6 > 5
    const [o2] = await order("cash", [{ product_id: ho, unit_price_cents: 650, quantity: 1 }]);
    expect(await q(`select * from book_stock($1)`, [o2.order_id])).toEqual([expect.objectContaining({ product_name: "Honig", ist: 5 })]);
  });
  it("meldet leer ein zweites Mal, aber nur einmal", async () => {
    const [o] = await order("cash", [{ product_id: bl, unit_price_cents: 600, quantity: 1 }]);
    expect(await q(`select * from book_stock($1)`, [o.order_id])).toEqual([expect.objectContaining({ product_name: "Bierlikör", ist: 0 })]);
    expect((await q<{ stufe: string }>(`select stufe from stock_alerts where product_id=$1`, [bl]))[0].stufe).toBe("leer");
    await q(`update location_products set ist=1 where product_id=$1`, [bl]); // teilweise aufgefüllt
    expect((await q<{ stufe: string }>(`select stufe from stock_alerts where product_id=$1`, [bl]))[0].stufe).toBe("knapp");
    const [o2] = await order("cash", [{ product_id: bl, unit_price_cents: 600, quantity: 1 }]);
    expect(await q(`select * from book_stock($1)`, [o2.order_id])).toHaveLength(1); // wieder leer
  });
  it("Auffüllen setzt die Meldung zurück", async () => {
    await q(`update location_products set ist=soll where product_id=$1`, [bl]);
    expect((await q<{ n: number }>(`select count(*)::int n from stock_alerts where product_id=$1`, [bl]))[0].n).toBe(0);
  });
  it("archivierte Verkaufsstellen verkaufen nichts", async () => {
    await q(`update locations set active=false where id=$1`, [loc]);
    await expect(order("cash", [{ product_id: bl, unit_price_cents: 600, quantity: 1 }])).rejects.toThrow();
    await q(`update locations set active=true where id=$1`, [loc]);
  });
});

describe("Adressen und Karte", () => {
  it("prüft PLZ, Koordinaten und Werbelink", async () => {
    await expect(q(`update locations set plz='abc' where id=$1`, [loc])).rejects.toThrow();
    await expect(q(`update locations set lat=91 where id=$1`, [loc])).rejects.toThrow();
    await expect(q(`update locations set werbung_link='javascript:alert(1)' where id=$1`, [loc])).rejects.toThrow();
    await q(`update locations set strasse='Wank 6', plz='87484', lat=47.6152, lng=10.5208, werbung_link='https://heiglerhof.de' where id=$1`, [loc]);
    expect((await q<{ oeffentlich: boolean }>(`select oeffentlich from locations where id=$1`, [loc]))[0].oeffentlich).toBe(false); // Ferienwohnung
  });
});

describe("Zahlarten", () => {
  it("sind standardmäßig beide an, eine darf aus, beide nicht", async () => {
    expect((await q<{ bar_aktiv: boolean; paypal_aktiv: boolean }>(`select bar_aktiv, paypal_aktiv from locations where id=$1`, [loc]))[0]).toEqual({ bar_aktiv: true, paypal_aktiv: true });
    await q(`update locations set bar_aktiv=false where id=$1`, [loc]);
    await expect(q(`update locations set paypal_aktiv=false where id=$1`, [loc])).rejects.toThrow();
    await q(`update locations set bar_aktiv=true where id=$1`, [loc]);
    expect((await q<{ u: boolean }>(`select ueberweisung_aktiv u from locations where id=$1`, [loc]))[0].u).toBe(false);
  });
  it("Überweisung legt eine offene Bestellung an und bucht den Bestand", async () => {
    await q(`update location_products set ist=5 where product_id=$1`, [ho]);
    const [o] = await order("transfer", [{ product_id: ho, unit_price_cents: 650, quantity: 2 }]);
    expect((await q<{ status: string; paid_at: string | null }>(`select status, paid_at from orders where id=$1`, [o.order_id]))[0]).toEqual({ status: "transfer", paid_at: null });
    await q(`select * from book_stock($1)`, [o.order_id]);
    expect((await q<{ ist: number }>(`select ist from location_products where product_id=$1`, [ho]))[0].ist).toBe(3);
    await q(`update orders set status='transfer_paid' where id=$1`, [o.order_id]);
    await expect(q(`update orders set status='quatsch' where id=$1`, [o.order_id])).rejects.toThrow();
  });
});
