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
});
