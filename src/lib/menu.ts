/** Bereiche des Adminbereichs, genutzt von Seitenleiste (Browser) und Startbildschirm (Server). */
export const MENU = [
  { href: "/admin/bestellungen", label: "Bestellungen", icon: "🧾", info: "Alle Käufe, Überweisungen bestätigen" },
  { href: "/admin/nachfuellen", label: "Nachfüllen", icon: "📦", info: "Was wo fehlt, abhaken" },
  { href: "/admin/tour", label: "Nachfülltour", icon: "🚗", info: "Beste Route mit Packliste" },
  { href: "/admin/nachbestellungen", label: "Nachbestellungen", icon: "📝", info: "Von Wiederverkäufern, Lieferschein" },
  { href: "/admin/abrechnung", label: "Abrechnung", icon: "💶", info: "Umsatz je Verkaufsstelle und Monat" },
  { href: "/admin/produkte", label: "Produkte und Preise", icon: "🍯", info: "Anlegen, Fotos, Preise" },
  { href: "/admin/verkaufsstellen", label: "Verkaufsstellen", icon: "📍", info: "Sortiment, Bestand, Zahlarten, Schild" },
  { href: "/admin/einstellungen", label: "Einstellungen", icon: "⚙️", info: "Bankdaten, App und Mitteilungen" },
] as const;

export type MenuEintrag = (typeof MENU)[number];

/** Menü in der gespeicherten Reihenfolge; neue oder unbekannte Bereiche hängen hinten an. */
export function sortiereMenu(reihenfolge: readonly string[] | null | undefined): MenuEintrag[] {
  const rang = new Map((reihenfolge ?? []).map((h, i) => [h, i]));
  return [...MENU].sort((a, b) => (rang.get(a.href) ?? 999 + MENU.indexOf(a)) - (rang.get(b.href) ?? 999 + MENU.indexOf(b)));
}
