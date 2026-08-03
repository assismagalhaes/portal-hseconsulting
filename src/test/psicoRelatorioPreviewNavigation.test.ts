import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const reportTab = readFileSync(
  resolve("src/components/psico/PsicoRelatorioTab.tsx"),
  "utf8",
);

describe("navegação da prévia do relatório psicossocial", () => {
  it("gera o PDF com a sessão atual antes de navegar a nova aba", () => {
    expect(reportTab).toContain("await previewRelatorio(av.id)");
    expect(reportTab).toContain("URL.createObjectURL(blob)");
    expect(reportTab).toContain("previewWindow.location.replace(pdfUrl)");
  });

  it("não encaminha a nova aba para uma rota protegida do portal", () => {
    expect(reportTab).not.toContain(
      "relatorio/preview`",
    );
  });

  it("fecha a aba provisória quando a geração falha", () => {
    expect(reportTab).toContain("previewWindow.close()");
    expect(reportTab).toContain("traduzirErroEmissao(error");
  });
});
