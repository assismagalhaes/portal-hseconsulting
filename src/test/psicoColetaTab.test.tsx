import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PsicoColetaTab from "@/components/psico/PsicoColetaTab";

const getResumoColeta = vi.fn();

vi.mock("@/lib/psicoColeta", () => ({
  calcularChecklist: vi.fn(),
  getResumoColeta: (...args: unknown[]) => getResumoColeta(...args),
  abrirColeta: vi.fn(),
  prorrogarColeta: vi.fn(),
  encerrarColeta: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

describe("PsicoColetaTab", () => {
  beforeEach(() => {
    getResumoColeta.mockResolvedValue({
      error: null,
      data: {
        integridade_ok: true,
        prazo_expirado: false,
        participantes_ativos_atuais: 3,
        acessaram: 2,
        respondidos: 2,
        pendentes: 1,
        percentual_participacao: 66.7,
        prazo: "2026-07-31",
        participantes_na_abertura: 3,
        respostas_anonimas: 2,
        coleta_aberta_em: "2026-07-18T16:43:00Z",
        coleta_encerrada_em: null,
        convites_ativos: 1,
        convites_distribuidos: 3,
      },
    });
  });

  it("limpa os dados ao cancelar e mantém os diálogos isolados", async () => {
    render(
      <PsicoColetaTab
        av={{ id: "avaliacao-1", codigo: "AFP-2026-000003", status: "coleta_em_andamento", data_fim_prevista: "2026-07-31" }}
        onReload={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: /Prorrogar prazo/i }));
    const prorrogar = screen.getByRole("dialog");
    const motivoProrrogar = within(prorrogar).getByRole("textbox");
    fireEvent.change(motivoProrrogar, { target: { value: "Motivo temporário da prorrogação" } });
    fireEvent.click(within(prorrogar).getByRole("button", { name: "Cancelar" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /Encerrar coleta/i }));

    const encerrar = screen.getByRole("dialog");
    const camposEncerrar = within(encerrar).getAllByRole("textbox") as HTMLInputElement[];
    expect(camposEncerrar).toHaveLength(1);
    expect(camposEncerrar[0]).toHaveValue("");
  });
});
