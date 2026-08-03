import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("tolerância transacional do plano por IA", () => {
  it("descarta apenas monitoramentos opcionais incompatíveis ou duplicados", () => {
    const sql = fs.readFileSync(
      path.resolve(
        process.cwd(),
        "supabase/migrations/20260727184052_tolerate_invalid_optional_monitoring_ai.sql",
      ),
      "utf8",
    );

    expect(sql).toContain("RENAME TO psico_aplicar_plano_ia_strict_v1");
    expect(sql).toContain("_nivel_recomendacao <> 'essencial'");
    expect(sql).toContain("_fator_codigo = ANY(_monitoramentos_usados)");
    expect(sql).toContain("jsonb_set(_sel, '{fatores_codes}'");
    expect(sql).toContain("public.psico_aplicar_plano_ia_strict_v1(");
    expect(sql).not.toContain("RAISE EXCEPTION 'MONITORAMENTO_IA_");
  });

  it("mantém uma única migration de criação da camada sanitizadora", () => {
    const migrationsDir = path.resolve(process.cwd(), "supabase/migrations");
    const ocorrencias = fs
      .readdirSync(migrationsDir)
      .filter((arquivo) => arquivo.endsWith(".sql"))
      .map((arquivo) => fs.readFileSync(path.join(migrationsDir, arquivo), "utf8"))
      .reduce(
        (total, sql) =>
          total +
          (sql.match(/RENAME TO psico_aplicar_plano_ia_strict_v1/g) || []).length,
        0,
      );

    expect(ocorrencias).toBe(1);
  });

  it("descarta vínculo sem ação na camada pública e mantém a RPC estrita fechada", () => {
    const sql = fs.readFileSync(
      path.resolve(
        process.cwd(),
        "supabase/migrations/20260729130714_tolerate_ai_links_without_action.sql",
      ),
      "utf8",
    );

    expect(sql).toContain("IF _tratamento = 'sem_acao_especifica' THEN");
    expect(sql).toMatch(/IF _tratamento = 'sem_acao_especifica' THEN\s+CONTINUE;/);
    expect(sql).toContain("IF _tratamento = 'acao_recomendada' THEN");
    expect(sql).toContain("RETURN public.psico_aplicar_plano_ia_strict_v1(");
    expect(sql).toContain("FROM PUBLIC, anon, authenticated, service_role");
    expect(sql).not.toContain("CREATE OR REPLACE FUNCTION public.psico_aplicar_plano_ia_strict_v1");
  });

  it("mantém o provedor do portal isolado da configuração do ASP Insights", () => {
    const edgeFunction = fs.readFileSync(
      path.resolve(
        process.cwd(),
        "supabase/functions/psico-gerar-plano-ia/index.ts",
      ),
      "utf8",
    );

    expect(edgeFunction).toContain('const DEFAULT_MODEL = "google/gemini-3.6-flash"');
    expect(edgeFunction).toContain('Deno.env.get("LOVABLE_API_KEY")');
    expect(edgeFunction).toContain("https://ai.gateway.lovable.dev/v1/chat/completions");
    expect(edgeFunction).not.toContain("GEMINI_API_KEY");
  });
});
