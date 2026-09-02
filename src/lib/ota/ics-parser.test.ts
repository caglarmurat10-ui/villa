import { describe, expect, it } from "vitest";
import { parseIcsEvents } from "./ics-parser";

function ics(...vevents: string[]) {
  return ["BEGIN:VCALENDAR", ...vevents, "END:VCALENDAR"].join("\r\n");
}

function vevent(uid: string, dtstart: string, dtend: string) {
  return ["BEGIN:VEVENT", `UID:${uid}`, `DTSTART;VALUE=DATE:${dtstart}`, `DTEND;VALUE=DATE:${dtend}`, "END:VEVENT"].join("\r\n");
}

describe("parseIcsEvents", () => {
  it("normal bir VEVENT'i dogru parse eder", () => {
    const events = parseIcsEvents(ics(vevent("abc-1", "20260901", "20260908")));
    expect(events).toEqual([{ uid: "abc-1", startDate: "2026-09-01", endDate: "2026-09-08" }]);
  });

  it("datetime (VALUE=DATE-TIME, Z suffix) degerlerden yalniz tarihi alir", () => {
    const raw = ics(["BEGIN:VEVENT", "UID:dt-1", "DTSTART:20260901T140000Z", "DTEND:20260908T110000Z", "END:VEVENT"].join("\r\n"));
    expect(parseIcsEvents(raw)).toEqual([{ uid: "dt-1", startDate: "2026-09-01", endDate: "2026-09-08" }]);
  });

  it("DTEND eksikse event'i sessizce dusurur (sahte sonsuz blok uretmez)", () => {
    const raw = ics(["BEGIN:VEVENT", "UID:no-end", "DTSTART;VALUE=DATE:20260901", "END:VEVENT"].join("\r\n"));
    expect(parseIcsEvents(raw)).toEqual([]);
  });

  it("end <= start olan (sifir/negatif sureli) event'i dusurur", () => {
    const zeroLength = vevent("zero", "20260901", "20260901");
    const negative = vevent("negative", "20260910", "20260905");
    expect(parseIcsEvents(ics(zeroLength))).toEqual([]);
    expect(parseIcsEvents(ics(negative))).toEqual([]);
  });

  it("UID eksikse event'i dusurur", () => {
    const raw = ics(["BEGIN:VEVENT", "DTSTART;VALUE=DATE:20260901", "DTEND;VALUE=DATE:20260905", "END:VEVENT"].join("\r\n"));
    expect(parseIcsEvents(raw)).toEqual([]);
  });

  it("katlanmis (folded) satirlari acar (RFC5545 line unfolding)", () => {
    const raw = ["BEGIN:VCALENDAR", "BEGIN:VEVENT", "UID:folded-1", "DTSTART;VALUE=DATE:20260901", "DTEND;VALUE=DATE:2026\r\n 0905", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    expect(parseIcsEvents(raw)).toEqual([{ uid: "folded-1", startDate: "2026-09-01", endDate: "2026-09-05" }]);
  });

  it("birden fazla VEVENT'i sirasiyla dondurur", () => {
    const raw = ics(vevent("a", "20260901", "20260905"), vevent("b", "20261001", "20261005"));
    expect(parseIcsEvents(raw)).toEqual([
      { uid: "a", startDate: "2026-09-01", endDate: "2026-09-05" },
      { uid: "b", startDate: "2026-10-01", endDate: "2026-10-05" },
    ]);
  });

  it("art yil sinirini (leap day, 29 Subat 2028) dogru parse eder", () => {
    const raw = ics(vevent("leap", "20280228", "20280301"));
    expect(parseIcsEvents(raw)).toEqual([{ uid: "leap", startDate: "2028-02-28", endDate: "2028-03-01" }]);
  });
});
