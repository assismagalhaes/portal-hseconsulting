import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeValidationCode } from "@/pages/psico/PsicoValidarRelatorio";

const migration = readFileSync(
  resolve("supabase/migrations/20260729145127_improve_public_psico_report_validation.sql"),
  "utf8",
);

describe("validação pública do relatório psicossocial", () => {
  it("normaliza maiúsculas, minúsculas, prefixos, espaços e URLs", () => {
    const expected = "56B4-2E6A-BACE-821B-75DD-D258-383B-7A91";

    expect(normalizeValidationCode(expected.toLowerCase())).toBe(expected);
    expect(normalizeValidationCode(`Código de validação: ${expected}`)).toBe(expected);
    expect(normalizeValidationCode(`  ${expected.slice(0, 9)} \n${expected.slice(9)}  `)).toBe(expected);
    expect(
      normalizeValidationCode(
        `https://portal.hseconsulting.com.br/validar/relatorio-psicossocial?codigo=${expected.toLowerCase()}`,
      ),
    ).toBe(expected);
  });

  it("normaliza também no banco e mantém o retorno público restrito a metadados", () => {
    expect(migration).toContain("upper(coalesce(p_codigo_validacao, ''))");
    expect(migration).toContain("'encontrado', true");
    expect(migration).toContain("'organizacao', v.organizacao");
    expect(migration).toContain("'cnpj_mascarado', v_cnpj_mascarado");
    expect(migration).toContain("'revisao_vigente', v.revisao_vigente");
    expect(migration).toContain("WHEN v.status = 'revogado' OR v.relatorio_status = 'revogado'");
    expect(migration).toContain("WHEN v.status = 'substituido' THEN 'Substituído'");
    expect(migration).not.toContain("snapshot_conteudo");
    expect(migration).not.toContain("psico_respostas");
  });

  it("preserva a função pública somente para validação por código", () => {
    expect(migration).toContain("SECURITY DEFINER");
    expect(migration).toContain("SET search_path = ''");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.psico_validar_publico_relatorio(text)");
    expect(migration).toContain("TO anon, authenticated, service_role");
  });

  it("não confunde indisponibilidade do serviço com código inexistente", () => {
    const page = readFileSync(
      resolve("src/pages/psico/PsicoValidarRelatorio.tsx"),
      "utf8",
    );

    expect(page).toContain("Não foi possível validar agora");
    expect(page).toContain("Código não localizado");
    expect(page).toContain("Documento indisponível");
    expect(page).toContain("Versão autêntica, mas substituída");
    expect(page).toContain("Relatório autêntico e vigente");
  });
});
