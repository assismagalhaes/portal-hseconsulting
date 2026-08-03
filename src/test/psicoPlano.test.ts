import { describe, expect, it } from "vitest";
import { montarNovoItemPlano } from "@/lib/psicoPlano";

describe("montarNovoItemPlano", () => {
  it("define prioridade de monitoramento para ação preventiva sem prioridade explícita", () => {
    const item = montarNovoItemPlano("plano-1", {
      titulo: "Monitorar ritmo, carga e pausas",
      acao_recomendada: "Monitorar ritmo, carga e pausas",
      objetivo: null,
      nivel_recomendacao: "transversal",
    });

    expect(item.prioridade).toBe("monitoramento");
    expect(item.objetivo).toBe("Monitorar ritmo, carga e pausas");
    expect(item.selecionado).toBe(true);
  });

  it("preserva prioridade e objetivo definidos pela origem", () => {
    const item = montarNovoItemPlano("plano-1", {
      titulo: "Ação crítica",
      acao_recomendada: "Intervir imediatamente",
      objetivo: "Reduzir exposição",
      prioridade: "critica",
    });

    expect(item.prioridade).toBe("critica");
    expect(item.objetivo).toBe("Reduzir exposição");
  });
});
