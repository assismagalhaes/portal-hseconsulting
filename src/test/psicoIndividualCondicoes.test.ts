import { describe, expect, it } from "vitest";
import { condicaoLabel } from "@/lib/psicoIndividualCondicoes";

describe("condicaoLabel", () => {
  it("distingue condições do mesmo fator", () => {
    expect(condicaoLabel("PAR-F1-CARGA")).toBe("Distribuição da carga de trabalho");
    expect(condicaoLabel("PAR-F1-RITMO")).toBe("Ritmo de trabalho");
  });

  it("mantém fallback legível para novas chaves", () => {
    expect(condicaoLabel("PAR-F8-NOVA-CONDICAO")).toBe("NOVA CONDICAO");
  });
});
