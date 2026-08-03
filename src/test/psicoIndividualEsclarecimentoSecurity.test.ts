import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260730130350_add_aqi_clarification_requests.sql"),
  "utf8",
);
const validator = readFileSync(
  resolve(process.cwd(), "supabase/functions/psico-individual-esclarecimento-validar/index.ts"),
  "utf8",
);
const publicForm = readFileSync(
  resolve(process.cwd(), "src/components/psico/PsicoIndividualClarificationForm.tsx"),
  "utf8",
);

describe("segurança do esclarecimento AQI", () => {
  it("não concede acesso autenticado às respostas individuais", () => {
    expect(migration).toContain(
      "REVOKE ALL ON TABLE public.psico_individual_esclarecimento_respostas FROM PUBLIC, anon, authenticated",
    );
    expect(migration).not.toMatch(
      /GRANT\s+SELECT[\s\S]{0,100}psico_individual_esclarecimento_respostas[\s\S]{0,50}authenticated/i,
    );
  });

  it("expõe ao técnico somente a síntese sanitizada", () => {
    const listFunction = migration.slice(
      migration.indexOf("CREATE OR REPLACE FUNCTION public.psico_ind_listar_esclarecimentos"),
      migration.indexOf("CREATE OR REPLACE FUNCTION public.psico_ind_finalizar_esclarecimento"),
    );
    expect(listFunction).toContain("sintese_sanitizada");
    expect(listFunction).not.toContain("esclarecimento_respostas");
  });

  it("usa perguntas genéricas aplicáveis a qualquer fator e impede dados pessoais", () => {
    expect(validator).toContain("fator_codigo");
    expect(validator).toContain("perigo_codigo");
    expect(publicForm).toContain("Não informe nomes, condições de saúde ou outros dados pessoais");
    expect(validator).toContain("sem citar nomes ou dados pessoais");
    expect(validator).not.toContain("carga_excessiva");
  });

  it("bloqueia aprovação enquanto há esclarecimento pendente", () => {
    expect(migration).toContain("esclarecimentos_pendentes");
    expect(migration).toContain("status IN ('aguardando_respostas','parcial')");
  });

  it("rejeita campos obrigatórios ausentes no fechamento transacional", () => {
    expect(migration).toContain("coalesce(p_respostas->>'frequencia', '') NOT IN");
    expect(migration).toContain("coalesce(p_respostas->>'controle', '') NOT IN");
    expect(migration).toContain("coalesce(p_respostas->>'aplicacao', '') NOT IN");
  });
});
