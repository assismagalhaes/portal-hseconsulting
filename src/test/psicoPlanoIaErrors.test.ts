import { describe, expect, it } from "vitest";
import { mensagemErroPlanoIA } from "@/lib/psicoPlano";

describe("mensagemErroPlanoIA", () => {
  it("traduz erros operacionais conhecidos sem expor o non-2xx genérico", () => {
    expect(mensagemErroPlanoIA("IA_LIMITE_ATINGIDO")).toContain("limite temporário");
    expect(mensagemErroPlanoIA("PLANO_NAO_APLICADO")).toContain("não pôde ser aplicada");
  });

  it("mantém uma mensagem segura quando o backend não retorna JSON", () => {
    expect(mensagemErroPlanoIA()).toBe(
      "Não foi possível gerar o plano com IA. Nenhuma alteração foi aplicada.",
    );
  });
});
