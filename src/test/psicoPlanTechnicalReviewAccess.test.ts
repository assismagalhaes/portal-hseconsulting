import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve("supabase/migrations/20260806110923_allow_tecnico_mark_psico_plan_reviewed.sql"),
  "utf8",
);

describe("permissao tecnica para marcar plano psicossocial como revisado", () => {
  it.each([
    "psico_marcar_plano_revisado",
    "psico_validar_revisao_tecnica",
    "psico_validar_revisao_tecnica_sem_parecer_v1_4",
  ])("audita toda a cadeia transitiva: %s", (functionName) => {
    expect(migration).toContain(`'${functionName}'`);
  });

  it("troca o gate legado pelo gate do modulo psicossocial", () => {
    expect(migration).toContain("'public.can_see_psico('");
    expect(migration).toContain("Gate legado ainda presente em");
  });

  it("expoe somente as RPCs publicas ao perfil autenticado", () => {
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.psico_marcar_plano_revisado(uuid) TO authenticated, service_role",
    );
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.psico_validar_revisao_tecnica(uuid) TO authenticated, service_role",
    );
    expect(migration).toMatch(
      /psico_validar_revisao_tecnica_sem_parecer_v1_4\(uuid\)[\s\S]*FROM PUBLIC, anon, authenticated/,
    );
  });
});
