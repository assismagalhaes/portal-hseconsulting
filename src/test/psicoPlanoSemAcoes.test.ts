import { describe, expect, it } from "vitest";
import { isErroBloqueantePlano, separarErrosPorEtapa } from "@/lib/psicoRevisaoGates";
import fs from "node:fs";
import path from "node:path";

const migrationPath = path.resolve(
  process.cwd(),
  "supabase/migrations/20260727131406_allow_collective_plan_without_actions.sql",
);
const consolidatedApprovalPath = path.resolve(
  process.cwd(),
  "src/components/psico/PsicoAprovacaoConsolidada.tsx",
);

describe("gates do plano de ação coletivo", () => {
  it("não trata campos da revisão técnica como bloqueios do plano", () => {
    expect(isErroBloqueantePlano("RESPONSAVEL_TECNICO_AUSENTE")).toBe(false);
    expect(isErroBloqueantePlano("LIMITACOES_INCOMPLETAS")).toBe(false);
    expect(isErroBloqueantePlano("PARECER_CONCLUSIVO_INCOMPLETO")).toBe(false);
  });

  it("mantém como bloqueantes somente pendências próprias do plano", () => {
    expect(isErroBloqueantePlano("FATOR_SIGNIFICATIVO_SEM_ACAO")).toBe(true);
    expect(isErroBloqueantePlano("ITENS_SEM_RESPONSAVEL:1")).toBe(true);
    expect(isErroBloqueantePlano("ITENS_SEM_PRAZO:1")).toBe(true);
    expect(isErroBloqueantePlano("ITENS_SEM_EVIDENCIA:1")).toBe(true);
  });

  it("separa os erros conforme a etapa do fluxo", () => {
    expect(separarErrosPorEtapa([
      "RESPONSAVEL_TECNICO_AUSENTE",
      "ITENS_SEM_PRAZO:2",
    ])).toEqual({
      plano: ["ITENS_SEM_PRAZO:2"],
      revisao: ["RESPONSAVEL_TECNICO_AUSENTE"],
    });
  });

  it("a migration remove a exigência incondicional de itens", () => {
    const sql = fs.readFileSync(migrationPath, "utf8");
    expect(sql).toContain("codigo NOT IN ('PLANO_SEM_ACOES', 'FATOR_SIGNIFICATIVO_SEM_ACAO')");
    expect(sql).toContain("rf.tratamento_tecnico = 'acao_recomendada'");
    expect(sql).not.toContain("rf.significativo_calculado = true");
    expect(sql).not.toContain("rf.tratamento_tecnico <> 'sem_acao_especifica'");
  });

  it("não exibe pendências da revisão técnica como itens da próxima etapa no plano", () => {
    const source = fs.readFileSync(consolidatedApprovalPath, "utf8");
    expect(source).not.toContain("Itens da próxima etapa");
    expect(source).not.toContain("Não bloqueiam o plano");
    expect(source).not.toContain("Serão preenchidos na Revisão Técnica");
  });
});
