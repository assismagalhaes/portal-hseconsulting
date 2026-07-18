import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve("supabase/migrations/20260718180000_fix_psico_report_validation_status.sql"),
  "utf8",
);
const reportContentMigration = readFileSync(
  resolve("supabase/migrations/20260718183000_fix_psico_report_content_without_import.sql"),
  "utf8",
);
const reportImportRecordMigration = readFileSync(
  resolve("supabase/migrations/20260718190000_fix_psico_report_import_record_type.sql"),
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

describe("conteudo aprovado do relatorio sem importacao", () => {
  it("nao acessa um record de importacao que nunca foi inicializado", () => {
    expect(reportContentMigration).toContain("_tem_importacao BOOLEAN := false");
    expect(reportContentMigration).toContain("_tem_importacao := FOUND");
    expect(reportContentMigration).toContain("CASE WHEN NOT _tem_importacao");
    expect(reportContentMigration).not.toContain("CASE WHEN _imp IS NULL");
  });

  it("trata avaliacao ou revisao ausente usando FOUND", () => {
    expect(reportContentMigration.match(/IF NOT FOUND THEN/g)).toHaveLength(2);
    expect(reportContentMigration).not.toContain("IF _av IS NULL");
    expect(reportContentMigration).not.toContain("IF _rev IS NULL");
  });

  it("define a estrutura do registro de importacao antes de acessar seus campos", () => {
    expect(reportContentMigration).toContain(
      "_imp public.psico_importacoes_avaliacoes%ROWTYPE",
    );
    expect(reportImportRecordMigration).toContain(
      "_imp public.psico_importacoes_avaliacoes%ROWTYPE",
    );
    expect(reportImportRecordMigration).not.toContain("_imp RECORD");
  });
});
