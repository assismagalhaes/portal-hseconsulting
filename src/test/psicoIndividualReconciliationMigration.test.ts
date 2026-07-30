import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260730121744_harden_aqi_reconciliation_review.sql",
  ),
  "utf8",
);

describe("migração de revisão da conciliação AQI", () => {
  it("bloqueia aprovação de divergências sem validação humana", () => {
    expect(migration).toContain("divergencias_sem_validacao_tecnica");
    expect(migration).toContain("revisado_em IS NULL");
  });

  it("reabre somente antes de plano e relatório emitido", () => {
    expect(migration).toContain("reabertura_bloqueada_plano_existente");
    expect(migration).toContain("reabertura_bloqueada_relatorio_emitido");
  });

  it("registra aprovação e reabertura na auditoria da avaliação", () => {
    expect(migration).toContain("conciliacao_individual_aprovada");
    expect(migration).toContain("conciliacao_individual_reaberta");
  });
});
