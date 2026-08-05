import { describe, expect, it } from "vitest";
import { sanitizeUploadResponse } from "@/pages/psico/importacao/shared";

describe("sanitizeUploadResponse", () => {
  it("remove colunas sem cabeçalho e mantém a amostra alinhada", () => {
    const result = sanitizeUploadResponse({
      importacao_id: "import-1",
      formato: "csv",
      hash_sha256: "hash",
      tamanho_bytes: 100,
      cabecalhos: ["Carimbo", "01. Pergunta", "  "],
      amostra: [["05/08/2026", "Sempre", ""]],
    });

    expect(result.cabecalhos).toEqual(["Carimbo", "01. Pergunta"]);
    expect(result.amostra).toEqual([["05/08/2026", "Sempre"]]);
  });

  it("rejeita respostas sem nenhuma coluna válida", () => {
    expect(() => sanitizeUploadResponse({ cabecalhos: ["", "  "], amostra: [] }))
      .toThrow("Nenhuma coluna válida foi detectada");
  });
});
