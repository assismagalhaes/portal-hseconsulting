import { describe, expect, it } from "vitest";
import { normalizarData } from "../../supabase/functions/_shared/psico-importacao-dates";

describe("normalizarData de importação psicossocial", () => {
  it("normaliza o timestamp exportado pelo Google Forms", () => {
    expect(normalizarData("2026/05/27 2:41:24 PM GMT-3")).toBe("2026-05-27");
  });

  it("aceita formatos ISO e brasileiro", () => {
    expect(normalizarData("2026-05-29T10:01:43-03:00")).toBe("2026-05-29");
    expect(normalizarData("29/05/2026 10:01:43")).toBe("2026-05-29");
    expect(normalizarData("29-05-2026")).toBe("2026-05-29");
  });

  it("recusa datas impossíveis ou vazias", () => {
    expect(normalizarData("2026/02/30 10:00:00")).toBeNull();
    expect(normalizarData("31/04/2026")).toBeNull();
    expect(normalizarData("")).toBeNull();
  });
});
