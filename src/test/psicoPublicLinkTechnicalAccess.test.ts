import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("acesso tecnico ao link publico psicossocial", () => {
  const migration = fs.readFileSync(
    path.resolve(
      process.cwd(),
      "supabase/migrations/20260805170000_allow_tecnico_generate_public_link.sql",
    ),
    "utf8",
  );

  it("autoriza pela regra do modulo psicossocial e exige usuario autenticado", () => {
    expect(migration).toContain(
      "auth.uid() IS NULL OR NOT public.can_see_psico(auth.uid())",
    );
    expect(migration).not.toContain("can_see_internal(auth.uid())");
  });

  it("mantem a RPC restrita aos papeis autenticados", () => {
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.psico_gerar_link_publico(uuid) FROM PUBLIC, anon",
    );
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.psico_gerar_link_publico(uuid) TO authenticated, service_role",
    );
  });
});
