import { describe, expect, it } from "vitest";
import {
  MAINTENANCE_INTERVAL_MONTHS,
  addMonths,
  classifyDue,
  daysUntilDue,
  dueLabel,
} from "./compliance";

describe("addMonths", () => {
  it("verschiebt um ganze Monate", () => {
    expect(addMonths(new Date(2026, 0, 15), 12)).toEqual(new Date(2027, 0, 15));
    expect(addMonths(new Date(2026, 0, 15), 3)).toEqual(new Date(2026, 3, 15));
  });

  it("korrigiert den Tagesüberlauf am Monatsende", () => {
    // 31. Jan + 1 Monat -> 28. Feb (kein 31. Februar)
    expect(addMonths(new Date(2026, 0, 31), 1)).toEqual(new Date(2026, 1, 28));
    // 31. Jan + 1 Monat im Schaltjahr -> 29. Feb
    expect(addMonths(new Date(2028, 0, 31), 1)).toEqual(new Date(2028, 1, 29));
  });

  it("kennt einen 3-Jahres-Turnus für Legionellen", () => {
    expect(MAINTENANCE_INTERVAL_MONTHS.DREIJAEHRLICH).toBe(36);
  });
});

describe("daysUntilDue", () => {
  it("zählt kalendertagsgenau, ignoriert die Uhrzeit", () => {
    const now = new Date(2026, 5, 10, 23, 30);
    expect(daysUntilDue(new Date(2026, 5, 10, 1, 0), now)).toBe(0);
    expect(daysUntilDue(new Date(2026, 5, 12, 1, 0), now)).toBe(2);
    expect(daysUntilDue(new Date(2026, 5, 8, 1, 0), now)).toBe(-2);
  });
});

describe("classifyDue", () => {
  const now = new Date(2026, 5, 10, 12, 0);

  it("markiert Vergangenes als überfällig", () => {
    expect(classifyDue(new Date(2026, 5, 1), now).status).toBe("overdue");
  });

  it("markiert das Vorwarnfenster als bald fällig", () => {
    expect(classifyDue(new Date(2026, 5, 10), now).status).toBe("soon");
    expect(classifyDue(new Date(2026, 5, 24), now).status).toBe("soon");
  });

  it("markiert weit Entferntes als im Plan", () => {
    expect(classifyDue(new Date(2026, 5, 25), now).status).toBe("ok");
  });
});

describe("dueLabel", () => {
  it("formuliert die Fälligkeit deutsch", () => {
    expect(dueLabel(-3)).toBe("überfällig seit 3 Tag(en)");
    expect(dueLabel(0)).toBe("heute fällig");
    expect(dueLabel(5)).toBe("fällig in 5 Tag(en)");
  });
});
