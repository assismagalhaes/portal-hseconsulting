import { describe, expect, it } from "vitest";
import { mensagemErroConciliacao } from "@/lib/psicoIndividualFunctionError";

describe("mensagemErroConciliacao", () => {
  it("traduz o erro retornado pela Edge Function", async () => {
    const response = new Response(
      JSON.stringify({ error: "ler_entradas_falhou", detail: "detalhe interno" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );

    await expect(mensagemErroConciliacao({ context: response })).resolves.toBe(
      "Não foi possível carregar os formulários respondidos.",
    );
  });

  it("não expõe detalhes internos desconhecidos", async () => {
    const response = new Response(
      JSON.stringify({ error: "codigo_interno", detail: "segredo técnico" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );

    await expect(mensagemErroConciliacao({ context: response })).resolves.toBe(
      "Não foi possível processar a conciliação. Tente novamente.",
    );
  });
});
