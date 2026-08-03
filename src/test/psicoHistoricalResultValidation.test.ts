import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve("supabase/migrations/20260720123000_allow_historical_import_result_processing.sql"),
  "utf8",
);

describe("validação de resultados de importação histórica", () => {
  it("dispensa convites somente para importação bruta", () => {
    expect(migration).toContain("v_importacao_bruta := v_av.origem_coleta = 'importacao_bruta'");
    expect(migration).toContain("IF NOT v_importacao_bruta AND v_qtd_convites_resp <> v_qtd_resp");
    expect(migration).toContain("v_importacao_bruta OR v_qtd_convites_resp = v_qtd_resp");
  });

  it("mantém obrigatórias as estruturas e a integridade das 35 respostas", () => {
    expect(migration).toContain("IF v_qtd_fatores <> 7");
    expect(migration).toContain("IF v_qtd_perg <> 35");
    expect(migration).toContain("IF v_qtd_opcoes <> 5");
    expect(migration).toContain("t.c <> 35");
    expect(migration).toContain("v_qtd_itens = v_itens_esperados");
  });

  it("aceita questionário legado não publicado apenas na importação bruta", () => {
    expect(migration).toContain("ELSIF v_qv.status::text NOT IN ('publicada','arquivada')");
    expect(migration).toContain("IF v_importacao_bruta THEN");
    expect(migration).toContain("Importação histórica vinculada a questionário legado não publicado.");
    expect(migration).toContain("Questionário não está publicado ou arquivado.");
  });
});
