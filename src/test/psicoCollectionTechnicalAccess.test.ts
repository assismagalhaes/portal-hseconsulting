import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("acesso tecnico as operacoes da coleta psicossocial", () => {
  const migration = fs.readFileSync(
    path.resolve(
      process.cwd(),
      "supabase/migrations/20260805181500_allow_tecnico_manage_psico_collection.sql",
    ),
    "utf8",
  );

  it.each([
    "psico_abrir_coleta",
    "psico_prorrogar_coleta",
    "psico_encerrar_coleta",
    "psico_resumo_coleta",
  ])("inclui a RPC %s no ajuste de autorizacao", (rpc) => {
    expect(migration).toContain(`'${rpc}'`);
  });

  it("substitui o gate legado sem ampliar acesso a usuarios anonimos", () => {
    expect(migration).toContain("'public.can_see_psico('");
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.can_see_psico(uuid) FROM PUBLIC, anon",
    );
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.can_see_psico(uuid) TO authenticated, service_role",
    );
  });
});
