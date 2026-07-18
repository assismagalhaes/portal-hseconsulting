import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve("supabase/migrations/20260718180000_fix_psico_report_validation_status.sql"),
  "utf8",
);
const reportFunction = readFileSync(
  resolve("supabase/functions/psico-gerar-relatorio/template.tsx"),
  "utf8",
);

describe("validação da emissão do relatório psicossocial", () => {
  it("usa a coluna real de status do processamento", () => {
    expect(migration).not.toContain("v_proc.status_processamento");
    expect(migration).toContain("v_proc.status IS DISTINCT FROM 'concluido'");
    expect(migration).toContain("v_processamento_valido := true");
  });

  it("retorna flags falsas sem acessar records não inicializados", () => {
    expect(migration).toContain("'processamento_valido', v_processamento_valido");
    expect(migration).toContain("'revisao_tecnica_aprovada', v_revisao_aprovada");
    expect(migration).toContain("'plano_aprovado', v_plano_aprovado");
    expect(migration).toContain("'responsavel_tecnico_valido', v_responsavel_valido");
  });
});

describe("autenticação da função de geração do relatório", () => {
  it("usa a API disponível na versão fixada do supabase-js", () => {
    expect(reportFunction).toContain('userClient.auth.getUser(token)');
    expect(reportFunction).toContain('const userId = userData.user.id');
    expect(reportFunction).not.toContain('userClient.auth.getClaims');
  });
});
