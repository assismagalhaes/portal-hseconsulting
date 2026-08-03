import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MapaPerguntas from "@/components/psico/resultados/MapaPerguntas";

let loaded = false;

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(({ queryKey }: { queryKey: string[] }) => {
    if (!loaded) return { isLoading: true, data: undefined };

    if (queryKey[1] === "dashboard-resultados") {
      return {
        isLoading: false,
        data: {
          ok: true,
          data: {
            processamento: { questionario: { codigo: "HSE-IT", versao: 1 } },
            fatores: [{ fator_id: "fator-1", fator_codigo: "F1", fator_nome: "Demandas" }],
          },
        },
      };
    }

    if (queryKey[1] === "resultados-perguntas") {
      return {
        isLoading: false,
        data: [{
          pergunta_id: "pergunta-1",
          numero: 1,
          fator_id: "fator-1",
          classificacao_media: "Risco Alto",
          score_medio: 3.2,
          percentual_desfavoravel: 50,
          percentual_alto_critico: 50,
          percentual_critico: 0,
          total_respostas_validas: 2,
        }],
      };
    }

    return { isLoading: false, data: { "pergunta-1": { texto: "Tenho prazos adequados.", inversa: false } } };
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {},
}));

describe("MapaPerguntas", () => {
  beforeEach(() => {
    loaded = false;
  });

  it("preserva a ordem dos hooks na transição entre carregamento e dados", () => {
    const { rerender } = render(<MapaPerguntas avaliacaoId="avaliacao-1" escopoId="escopo-1" />);
    expect(screen.getByText("Carregando perguntas…")).toBeInTheDocument();

    loaded = true;
    rerender(<MapaPerguntas avaliacaoId="avaliacao-1" escopoId="escopo-1" />);

    expect(screen.getByText("Mapa das perguntas")).toBeInTheDocument();
    expect(screen.getByText(/1 perguntas exibidas/)).toBeInTheDocument();
    expect(screen.getByText("Tenho prazos adequados.")).toBeInTheDocument();
  });
});
