import { describe, expect, it } from "vitest";
import { bestellNr, verwendungszweck } from "../format";

describe("Bestellnummer", () => {
  it("setzt das Jahr nach deutscher Zeit davor", () => {
    expect(bestellNr(1023, "2026-10-02T12:00:00Z")).toBe("2026-1023");
    expect(bestellNr(1024, "2026-12-31T23:30:00Z")).toBe("2027-1024"); // in Deutschland schon Neujahr
  });
  it("baut den Verwendungszweck mit Verkaufsstelle", () => {
    expect(verwendungszweck(1023, "  Hotel   Alpenrose ", "2026-10-02T12:00:00Z")).toBe("2026-1023 Hotel Alpenrose");
    expect(verwendungszweck(1, "x".repeat(200)).length).toBe(140);
  });
});
