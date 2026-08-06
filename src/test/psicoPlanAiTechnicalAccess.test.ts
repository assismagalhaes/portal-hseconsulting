import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.resolve(
    process.cwd(),
    "supabase/migrations/20260806113443_allow_tecnico_apply_psico_ai_plan.sql",
  ),
  "utf8",
);

describe("autorizacao tecnica na aplicacao do plano gerado por IA", () => {
  it("corrige o gate da fachada e da autoridade estrita", () => {
    expect(migration).toContain("'psico_aplicar_plano_ia'");
    expect(migration).toContain("'psico_aplicar_plano_ia_strict_v1'");
    expect(migration).toContain("'public.can_see_psico('");
    expect(migration).toContain("Funcoes ainda usam can_see_internal");
  });

  it("mantem apenas a fachada acessivel ao usuario autenticado", () => {
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.psico_aplicar_plano_ia(uuid, jsonb, text, text)\n  TO authenticated, service_role",
    );
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.psico_aplicar_plano_ia_strict_v1(uuid, jsonb, text, text)\n  FROM PUBLIC, anon, authenticated",
    );
    expect(migration).not.toContain(
      "GRANT EXECUTE ON FUNCTION public.psico_aplicar_plano_ia_strict_v1(uuid, jsonb, text, text)\n  TO authenticated",
    );
  });
});
