import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const { epcText, ibanGueltig, ibanLesbar } = await import("./giro");

describe("giro", () => {
  it("prüft IBAN-Prüfziffern", () => {
    expect(ibanGueltig("DE89370400440532013000")).toBe(true);
    expect(ibanGueltig("DE89370400440532013001")).toBe(false);
    expect(ibanGueltig("XX")).toBe(false);
  });
  it("baut den EPC-Text", () => {
    const t = epcText({ iban: "DE89370400440532013000", empfaenger: "Heiglerhof", bic: "" }, 1250, "HH 1023 Heiglerhof");
    expect(t.split("\n")).toEqual(["BCD", "002", "1", "SCT", "", "Heiglerhof", "DE89370400440532013000", "EUR12.50", "", "", "HH 1023 Heiglerhof"]);
    expect(ibanLesbar("DE89370400440532013000")).toBe("DE89 3704 0044 0532 0130 00");
  });
});
