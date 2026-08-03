import { describe, expect, it } from "vitest";
import { fmtDate } from "@/components/psico/resultados/shared";

describe("fmtDate", () => {
  it("preserva datas sem horário no calendário informado", () => {
    expect(fmtDate("2026-07-18")).toBe("18/07/2026");
    expect(fmtDate("2026-07-31")).toBe("31/07/2026");
  });

  it("retorna travessão para valores ausentes ou inválidos", () => {
    expect(fmtDate(null)).toBe("—");
    expect(fmtDate("data-inválida")).toBe("—");
  });
});
