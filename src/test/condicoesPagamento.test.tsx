import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ParcelasCard } from "@/components/proposal/document/atoms";
import { buildTextoCondicao, formatarMarcoParcela, type ParcelaForm } from "@/lib/condicoesPagamento";

const parcela = (patch: Partial<ParcelaForm> = {}): ParcelaForm => ({
  numero: 1,
  percentual: 100,
  marco: "aceite_proposta",
  dias_apos_marco: 0,
  dia_mes: null,
  descricao: null,
  ...patch,
});

describe("formatarMarcoParcela", () => {
  it("mantém o marco sem sufixo quando a parcela vence no evento", () => {
    expect(formatarMarcoParcela(parcela())).toBe("Aceite da proposta");
  });

  it("exibe os dias após o marco", () => {
    expect(formatarMarcoParcela(parcela({ dias_apos_marco: 30 })))
      .toBe("Aceite da proposta (+30 dias)");
  });

  it("exibe o dia da parcela mensal recorrente", () => {
    expect(formatarMarcoParcela(parcela({
      marco: "mensal_recorrente",
      dia_mes: 10,
    }))).toBe("Mensal recorrente (dia 10)");
  });
});

describe("buildTextoCondicao", () => {
  it("preserva os prazos diferentes de todas as parcelas", () => {
    const texto = buildTextoCondicao("3 parcelas iguais", [
      parcela({ numero: 1, percentual: 33.33 }),
      parcela({ numero: 2, percentual: 33.33, dias_apos_marco: 30 }),
      parcela({ numero: 3, percentual: 33.34, dias_apos_marco: 60 }),
    ], 27_520);

    expect(texto).toContain("Aceite da proposta\n");
    expect(texto).toContain("Aceite da proposta (+30 dias)");
    expect(texto).toContain("Aceite da proposta (+60 dias)");
  });
});

describe("ParcelasCard", () => {
  it("leva os prazos do snapshot para o cronograma impresso", () => {
    render(
      <ParcelasCard
        snap={{
          nome: "3 parcelas iguais",
          parcelas: [
            parcela({ numero: 1, percentual: 33.33 }),
            parcela({ numero: 2, percentual: 33.33, dias_apos_marco: 30 }),
            parcela({ numero: 3, percentual: 33.34, dias_apos_marco: 60 }),
          ],
        }}
        total={27_520}
        primary="#0b1f4d"
        accent="#16a34a"
        neutral="#f4f6fb"
        textoPadrao=""
      />,
    );

    expect(screen.getByText("Aceite da proposta")).toBeInTheDocument();
    expect(screen.getByText("Aceite da proposta (+30 dias)")).toBeInTheDocument();
    expect(screen.getByText("Aceite da proposta (+60 dias)")).toBeInTheDocument();
  });
});
